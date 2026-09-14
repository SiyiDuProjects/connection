import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import Stripe from 'stripe';
import { hasMembershipAccess, isBetaUnlimitedUsage } from '../../server/src/lib/membership-policy.js';

// Execute the real billing modules and SQL. Only Stripe HTTP and Next request context are substituted.
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const pg = new PGlite();
const database = drizzle(pg);
const cache = new Map();
const sub = new Map(), sessions = new Map();
const priceOverrides = new Map();
const invoiceOverrides = new Map();
process.env.STRIPE_BASE_PRICE_ID = 'price_base_current';
process.env.STRIPE_PLUS_PRICE_ID = 'price_plus_current';
let events = [], balances = [], createdSessions = [], portals = [], configs = [];
let failStripe = false;
const now = Math.floor(Date.now() / 1000);
const future = now + 86400 * 30;
const price = (id = 'price_base', name = id.includes('plus') ? 'Plus' : 'Base') => ({ id, active: true, type: 'recurring', billing_scheme: 'per_unit',
  unit_amount: name === 'Base' ? (id.endsWith('_current') ? 900 : 800) : (id.endsWith('_current') ? 1900 : 1200),
  currency: 'usd', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  product: { id: `prod_${name}`, active: true, name, default_price: id } });
const subscription = (id = 'sub_main', options = {}) => ({ id, customer: 'cus_main', status: 'active', created: 10,
  metadata: { reachardTeamId: '1' }, items: { data: [{ price: price(), quantity: 1, current_period_start: now - 86400, current_period_end: future }] }, ...options });
const checkoutSession = (id = 'cs_main', options = {}) => ({ id, customer: 'cus_main', subscription: 'sub_main',
  status: 'complete', mode: 'subscription', payment_status: 'paid', client_reference_id: '1', priceId: 'price_base',
  invoice: 'in_checkout', metadata: { reachardTeamId: '1' }, ...options });
const invoice = (options = {}) => ({ id: 'in_renewal', customer: 'cus_main', status: 'paid', amount_paid: 800,
  billing_reason: 'subscription_cycle', parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_main' } },
  lines: { has_more: false, data: [{ period: { start: future - 100, end: future + 86400 * 30 },
    parent: { type: 'subscription_item_details', subscription_item_details: { subscription: 'sub_main', proration: false } },
    pricing: { price_details: { price: 'price_base' } } }] }, ...options });
const clone = value => structuredClone(value);
const fakeStripe = {
  webhooks: new Stripe('sk_test_fixture_only').webhooks,
  subscriptions: {
    retrieve: async id => { if (failStripe) throw new Error('fixture unavailable'); assert.ok(sub.has(id), id); return clone(sub.get(id)); },
    list: async ({ customer }) => ({ data: [...sub.values()].filter(item => item.customer === customer), has_more: false }),
  },
  prices: { retrieve: async id => clone(priceOverrides.get(id) || price(id)) },
  invoices: {
    retrieve: async id => clone(invoiceOverrides.get(id) || invoice({ id, billing_reason: 'subscription_create',
      lines: { has_more: false, data: [{ amount: price(sessions.get('cs_main').priceId).unit_amount,
        period: { start: now - 86400, end: future },
        parent: { type: 'subscription_item_details', subscription_item_details: { subscription: 'sub_main', proration: false } },
        pricing: { price_details: { price: sessions.get('cs_main').priceId } } }] } })),
  },
  checkout: { sessions: {
    retrieve: async id => { assert.ok(sessions.has(id), id); return clone(sessions.get(id)); },
    list: async filter => ({ data: [...sessions.values()].filter(item => (!filter.customer || item.customer === filter.customer)
      && (!filter.subscription || item.subscription === filter.subscription) && (!filter.status || item.status === filter.status)), has_more: false }),
    listLineItems: async id => ({ data: [{ price: price(sessions.get(id).priceId || 'price_base'), quantity: 1 }] }),
    expire: async id => { const session = sessions.get(id); assert.equal(session.status, 'open'); session.status = 'expired'; return clone(session); },
    create: async params => { createdSessions.push(params); const id = `cs_new_${createdSessions.length}`;
      const session = { ...params, id, status: 'open', priceId: params.line_items[0].price, url: `https://checkout.stripe.com/${id}` };
      sessions.set(id, session); return clone(session); },
  } },
  customers: {
    create: async () => ({ id: 'cus_main' }),
    createBalanceTransaction: async (customer, data, options) => {
      balances.push({ customer, data, options }); return { id: 'cbt_reward' };
    },
  },
  billingPortal: {
    configurations: {
      list: async () => ({ data: configs }),
      retrieve: async id => { const config = configs.find(item => item.id === id); assert.ok(config); return clone(config); },
      create: async data => { const result = { ...data, id: 'bpc_reachard', active: true }; configs.push(result); return result; },
    },
    sessions: { create: async data => { portals.push(data); return { url: 'https://billing.stripe.com/fixture' }; } },
  },
};
const overrides = {
  stripe: class { constructor() { return fakeStripe; } },
  '@/lib/db/drizzle': { db: database },
  postgres: () => async (strings, ...values) => (await pg.query(strings.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows,
  '@/lib/db/queries': {
    getUser: async () => ({ id: 1, email: 'member@example.com' }),
    getTeamByStripeCustomerId: async id => (await database.select().from(schema.teams).where(require('drizzle-orm').eq(schema.teams.stripeCustomerId, id)))[0],
  },
  '@/lib/product-events': { recordProductEvent: async (...args) => events.push(args) },
  'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { url }); } },
  'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
};
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', compiled)(specifier => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith('@/')) return load(resolve(root, `${specifier.slice(2)}.ts`));
    if (specifier.startsWith('.')) return load(resolve(dirname(file), `${specifier}.ts`));
    return require(specifier);
  }, module, module.exports);
  return module.exports;
}
const schema = load(resolve(root, 'lib/db/schema.ts'));
const checkout = load(resolve(root, 'lib/payments/checkout.ts'));
const billing = load(resolve(root, 'lib/payments/stripe.ts'));
const invoices = load(resolve(root, 'lib/payments/invoices.ts'));
const webhook = load(resolve(root, 'app/api/stripe/webhook/route.ts'));
const policy = load(resolve(root, 'lib/payments/billing-policy.ts'));
const plans = load(resolve(root, 'lib/payments/plans.ts'));
const previousDbUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL = 'fixture-only';
const account = load(resolve(root, '../server/src/lib/account.js'));
if (previousDbUrl === undefined) delete process.env.POSTGRES_URL; else process.env.POSTGRES_URL = previousDbUrl;
const rows = async sql => (await pg.query(sql)).rows;
const grants = () => rows('SELECT * FROM credit_ledger ORDER BY id');
function useCurrentCheckout(name = 'Base') {
  const id = name === 'Base' ? 'price_base_current' : 'price_plus_current';
  sub.get('sub_main').items.data[0].price = price(id);
  sessions.get('cs_main').priceId = id;
  return id;
}
function invoiceLine(priceId, { start = now - 30, end = future, amount = 100, proration = false, credited = false } = {}) {
  return { amount, period: { start, end }, pricing: { price_details: { price: priceId } },
    parent: { type: 'subscription_item_details', subscription_item_details: {
      subscription: 'sub_main', proration,
      ...(credited ? { proration_details: { credited_items: { invoice: 'in_previous', invoice_line_items: ['il_previous'] } } } : {})
    } } };
}

before(async () => {
  const journal = JSON.parse(readFileSync(resolve(root, 'lib/db/migrations/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries.filter(entry => entry.idx <= 19)) {
    await pg.exec(readFileSync(resolve(root, 'lib/db/migrations', `${entry.tag}.sql`), 'utf8'));
  }
  // Row locking must still prevent duplicates without the defense-in-depth indexes.
  await pg.exec('DROP INDEX credit_ledger_initial_subscription_unique; DROP INDEX credit_ledger_monthly_invoice_unique;');
});
beforeEach(async () => {
  sub.clear(); sessions.clear(); priceOverrides.clear(); invoiceOverrides.clear(); events = []; balances = []; createdSessions = []; portals = []; configs = []; failStripe = false;
  sub.set('sub_main', subscription());
  sub.set('sub_inviter', subscription('sub_inviter', { customer: 'cus_inviter' }));
  sessions.set('cs_main', checkoutSession());
  delete process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  await pg.exec(`TRUNCATE users, teams, team_members, credit_ledger, stripe_webhook_events, friend_invites, friend_invite_redemptions, friend_invite_rewards RESTART IDENTITY CASCADE;
    INSERT INTO users (id,email,password_hash) VALUES (1,'member@example.com','fixture'),(2,'inviter@example.com','fixture');
    INSERT INTO teams (id,name,stripe_customer_id,stripe_subscription_id,subscription_status) VALUES
      (1,'Member','cus_main',null,null),(2,'Inviter','cus_inviter','sub_inviter','active');
    INSERT INTO team_members(user_id,team_id,role) VALUES(1,1,'owner'),(2,2,'owner');
    INSERT INTO friend_invites(inviter_user_id,token) VALUES(2,'fixture');
    INSERT INTO friend_invite_redemptions(invite_id,invited_user_id) VALUES(1,1);`);
});
after(async () => { await pg.close(); });

test('first checkout and simultaneous replay grant once, including an access expiry', async () => {
  await Promise.all([checkout.handleSuccessfulCheckoutSession('cs_main'), checkout.handleSuccessfulCheckoutSession('cs_main')]);
  const ledger = await grants(); assert.equal(ledger.length, 1); assert.equal(ledger[0].amount, 20);
  assert.equal(ledger[0].metadata.periodEnd, future); assert.equal(balances.length, 0);
});
test('invoice arriving first fulfills without a success-page visit; repeated events reward once', async () => {
  const paid = invoice({ id: 'in_first', billing_reason: 'subscription_create' });
  await invoices.handlePaidInvoice(paid); await invoices.handlePaidInvoice(paid);
  assert.equal((await grants()).length, 1); assert.equal(balances.length, 1);
});
test('subscription event arriving before invoice still recovers initial checkout', async () => {
  await billing.handleSubscriptionChange(subscription());
  await invoices.handlePaidInvoice(invoice({ billing_reason: 'subscription_create' }));
  assert.equal((await grants()).length, 1);
});
test('free trial and zero-total invoices do not pay referral rewards; paid conversion does', async () => {
  sub.get('sub_main').status = 'trialing'; sessions.get('cs_main').payment_status = 'no_payment_required';
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  await invoices.handlePaidInvoice(invoice({ billing_reason: 'subscription_create', amount_paid: 0 }));
  assert.equal(balances.length, 0); assert.equal((await rows('SELECT * FROM friend_invite_rewards')).length, 0);
  sub.get('sub_main').status = 'active';
  await invoices.handlePaidInvoice(invoice()); assert.equal(balances.length, 1);
});
test('Basil and legacy invoice payloads grant each paid period exactly once', async () => {
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  await Promise.all([invoices.handlePaidInvoice(invoice({ amount_paid: 0 })), invoices.handlePaidInvoice(invoice({ amount_paid: 0 }))]);
  const legacy = invoice({ id: 'in_legacy', parent: null, subscription: { id: 'sub_main' }, amount_paid: 0,
    lines: { has_more: false, data: [{ type: 'subscription', proration: false, price: { id: 'price_base' }, period: { end: future + 86400 * 60 } }] } });
  await invoices.handlePaidInvoice(legacy);
  assert.deepEqual((await grants()).map(row => row.amount), [20,20,20]);
  assert.equal(balances.length, 0);
});
test('late renewal uses its invoice price rather than the currently upgraded plan', async () => {
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  sub.get('sub_main').items.data[0].price = price('price_plus', 'Plus');
  await invoices.handlePaidInvoice(invoice());
  assert.equal((await grants())[1].amount, 20);
});
test('wrong owner, customer mismatch and canceled checkout do not grant access', async () => {
  await assert.rejects(checkout.handleSuccessfulCheckoutSession('cs_main', { expectedUserId: 2 }), /does not belong/);
  sessions.get('cs_main').customer = 'cus_other'; await assert.rejects(checkout.handleSuccessfulCheckoutSession('cs_main'), /does not match/);
  sessions.get('cs_main').customer = 'cus_main'; sub.get('sub_main').status = 'canceled';
  assert.equal(await checkout.handleSuccessfulCheckoutSession('cs_main'), null); assert.equal((await grants()).length, 0);
});
test('old subscription snapshots synchronize latest state and cannot cancel a newer subscription', async () => {
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  sub.get('sub_main').status = 'canceled'; await billing.handleSubscriptionChange(subscription());
  assert.equal((await rows('SELECT subscription_status FROM teams WHERE id=1'))[0].subscription_status, 'canceled');
  await pg.exec("UPDATE teams SET stripe_subscription_id='sub_new',subscription_status='active' WHERE id=1");
  await billing.handleSubscriptionChange(subscription('sub_main', { status: 'canceled' }));
  assert.equal((await rows('SELECT subscription_status FROM teams WHERE id=1'))[0].subscription_status, 'active');
});
test('repeated checkout starts reuse the open session; plan change expires the old one', async () => {
  sub.delete('sub_main'); sessions.clear();
  const team = { id: 1 };
  for (let index=0; index<2; index++) await assert.rejects(billing.createCheckoutSession({ team, priceId: 'price_base_current' }), error => error.url === 'https://checkout.stripe.com/cs_new_1');
  assert.equal(createdSessions.length, 1);
  await assert.rejects(billing.createCheckoutSession({ team, priceId: 'price_plus_current' }), error => error.url === 'https://checkout.stripe.com/cs_new_2');
  assert.equal(sessions.get('cs_new_1').status, 'expired');
});
test('past due and unpaid subscriptions block a second checkout', async () => {
  for (const status of ['past_due','unpaid','incomplete','paused']) {
    sub.get('sub_main').status = status;
    await assert.rejects(billing.createCheckoutSession({ team: { id: 1 }, priceId: 'price_base_current' }), error => error.url === '/dashboard?billing=already-active');
  }
  assert.equal(createdSessions.length, 0);
});
test('portal allows only current prices, invoices upgrades, and schedules cheaper changes for the period end', async () => {
  configs = [{ id: 'bpc_other', metadata: {}, features: { subscription_update: { enabled: true } } }];
  await billing.createCustomerPortalSession({ stripeCustomerId: 'cus_main' });
  assert.equal(portals[0].configuration, 'bpc_reachard');
  const update = configs[1].features.subscription_update;
  assert.equal(update.enabled, true);
  assert.deepEqual(update.default_allowed_updates, ['price']);
  assert.equal(update.proration_behavior, 'always_invoice');
  assert.deepEqual(update.products, [
    { product: 'prod_Base', prices: ['price_base_current'] }, { product: 'prod_Plus', prices: ['price_plus_current'] }
  ]);
  assert.deepEqual(update.schedule_at_period_end.conditions, [{ type: 'decreasing_item_amount' }]);
  assert.equal(configs[1].features.subscription_cancel.mode, 'at_period_end');
});
test('signed webhook retries a transient failure; tampered payload is rejected; replay is acknowledged', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture_only';
  const payload = JSON.stringify({ id: 'evt_fixture', type: 'checkout.session.completed', data: { object: { id: 'cs_main' } } });
  const header = fakeStripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const request = body => new Request('https://example.com/webhook', { method: 'POST', body, headers: { 'stripe-signature': header } });
  assert.equal((await webhook.POST(request(payload + ' '))).status, 400);
  failStripe = true; assert.equal((await webhook.POST(request(payload))).status, 500);
  assert.equal((await rows("SELECT processed FROM stripe_webhook_events WHERE id='evt_fixture'"))[0].processed, false);
  failStripe = false; assert.equal((await webhook.POST(request(payload))).status, 200);
  assert.equal((await (await webhook.POST(request(payload))).json()).duplicate, true);
  assert.equal((await grants()).length, 1);
});
test('membership expires at its paid boundary, with no implicit beta bypass', () => {
  const saved = process.env.BETA_UNLIMITED_USAGE; delete process.env.BETA_UNLIMITED_USAGE;
  try {
    assert.equal(isBetaUnlimitedUsage(), false);
    for (const status of ['active','trialing','past_due']) {
      assert.equal(hasMembershipAccess({ status, periodEnd: 200 }, 199000), true);
      assert.equal(hasMembershipAccess({ status, periodEnd: 200 }, 200000), false);
    }
    assert.equal(hasMembershipAccess({ status: 'canceled', periodEnd: future }), false);
    assert.equal(hasMembershipAccess({ status: 'active' }), false);
    process.env.BETA_UNLIMITED_USAGE = 'true'; assert.equal(isBetaUnlimitedUsage(), true);
  } finally { if (saved === undefined) delete process.env.BETA_UNLIMITED_USAGE; else process.env.BETA_UNLIMITED_USAGE = saved; }
});
test('monthly validation rejects quarterly, metered and multi-seat memberships', async () => {
  assert.equal(policy.isMonthlyPrice({ ...price(), recurring: { ...price().recurring, interval_count: 3 } }), false);
  assert.equal(policy.isMonthlyPrice({ ...price(), recurring: { ...price().recurring, usage_type: 'metered' } }), false);
  const value = subscription(); value.items.data[0].quantity = 2;
  await assert.rejects(billing.resolveSubscriptionPlan(value), /exactly one/);
});

test('an unpaid invoice cannot grant allowance or reward, and a missing period is retriable', async () => {
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  await invoices.handlePaidInvoice(invoice({ status: 'open' }));
  assert.equal((await grants()).length, 1); assert.equal(balances.length, 0);
  const malformed = invoice(); delete malformed.lines.data[0].period.end;
  await assert.rejects(invoices.handlePaidInvoice(malformed), /billing period/);
  assert.equal((await grants()).length, 1);
});

test('contacts API reads only the current membership period from the real ledger query', async () => {
  assert.equal(hasMembershipAccess(await account.getMembershipForUser(1)), false);
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  assert.equal(hasMembershipAccess(await account.getMembershipForUser(1)), true);
  await invoices.handlePaidInvoice(invoice());
  assert.equal((await account.getMembershipForUser(1)).periodEnd, future);
  await pg.exec("UPDATE teams SET stripe_subscription_id='sub_different' WHERE id=1");
  assert.equal(hasMembershipAccess(await account.getMembershipForUser(1)), false);
});

test('account deletion can safely encounter an already canceled subscription', async () => {
  sub.get('sub_main').status = 'canceled';
  await billing.cancelSubscriptionAtPeriodEnd('sub_main');
  sub.get('sub_main').status = 'active'; sub.get('sub_main').cancel_at_period_end = true;
  await billing.cancelSubscriptionAtPeriodEnd('sub_main');
});

test('current $9 checkout grants exactly 50 with a purchased-price period, excluding prior trial or saved allowance', async () => {
  useCurrentCheckout();
  await pg.exec("insert into credit_ledger(user_id,amount,action) values(1,3,'trial.initial_grant'),(1,100,'manual.legacy_grant')");
  await Promise.all([checkout.handleSuccessfulCheckoutSession('cs_main'), checkout.handleSuccessfulCheckoutSession('cs_main')]);
  const grant = (await grants()).find(row => row.action === 'subscription.initial_grant');
  assert.equal(grant.amount, 50);
  assert.equal(grant.metadata.entitlementVersion, plans.ENTITLEMENT_VERSION);
  assert.equal(grant.metadata.allowanceMode, 'monthly');
  assert.equal(grant.metadata.priceId, 'price_base_current');
  assert.equal(grant.metadata.periodStart, now - 86400);
  assert.equal(grant.metadata.periodEnd, future);
  const entitlement = await account.getBillingStateForUser(1);
  assert.equal(entitlement.remaining, 50);
  assert.equal(entitlement.unlimited, false);
});

test('current $19 checkout grants a paid unlimited period without numeric customer credits', async () => {
  useCurrentCheckout('Plus');
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  const grant = (await grants())[0];
  assert.equal(grant.amount, 0);
  assert.equal(grant.metadata.allowanceMode, 'unlimited');
  assert.equal(grant.metadata.priceId, 'price_plus_current');
  const entitlement = await account.getBillingStateForUser(1);
  assert.equal(entitlement.unlimited, true);
  assert.equal(account.publicCredits(entitlement).remaining, null);
});

test('old prices cannot start new checkouts, while existing $8 and $12 subscriptions retain 20 and 60', async () => {
  for (const [id, allowance] of [['price_base', 20], ['price_plus', 60]]) {
    await assert.rejects(billing.resolveCheckoutPlan(id), /configured price/);
    const value = subscription(); value.items.data[0].price = price(id);
    const plan = await billing.resolveSubscriptionPlan(value);
    assert.equal(plan.monthlyCredits, allowance);
    assert.equal(plan.unlimited, false);
    assert.equal(plan.allowanceMode, 'legacy');
  }
  for (const [id, amount] of [['price_base_current', 900], ['price_plus_current', 1900]]) {
    assert.equal((await billing.resolveCheckoutPlan(id)).priceId, id);
    priceOverrides.set(id, { ...price(id), unit_amount: amount - 100 });
    await assert.rejects(billing.resolveCheckoutPlan(id), /published/);
    priceOverrides.delete(id);
  }
});

test('a subscription update alone and an unpaid upgrade invoice cannot unlock Plus', async () => {
  useCurrentCheckout(); await checkout.handleSuccessfulCheckoutSession('cs_main');
  sub.get('sub_main').items.data[0].price = price('price_plus_current');
  await billing.handleSubscriptionChange(subscription());
  await invoices.handlePaidInvoice(invoice({ status: 'open', billing_reason: 'subscription_update',
    lines: { has_more: false, data: [invoiceLine('price_plus_current', { proration: true })] } }));
  assert.equal((await grants()).length, 1);
  assert.equal((await account.getBillingStateForUser(1)).unlimited, false);
  assert.equal((await account.getBillingStateForUser(1)).remaining, 50);
});

test('paid upgrade skips a zero-dollar old-price credit and grants Plus exactly once', async () => {
  useCurrentCheckout(); await checkout.handleSuccessfulCheckoutSession('cs_main');
  const paid = invoice({ id: 'in_upgrade', billing_reason: 'subscription_update', amount_paid: 1000,
    lines: { has_more: false, data: [
      invoiceLine('price_base_current', { amount: 0, start: now - 86400, proration: true, credited: true }),
      invoiceLine('price_plus_current', { amount: 1000, proration: true })
    ] } });
  await Promise.all([invoices.handlePaidInvoice(paid), invoices.handlePaidInvoice(paid)]);
  assert.equal((await grants()).length, 2);
  assert.equal((await grants())[1].metadata.priceId, 'price_plus_current');
  assert.equal((await account.getBillingStateForUser(1)).unlimited, true);
});

test('late old Base invoice in the same period cannot overwrite a more recent paid Plus upgrade', async () => {
  useCurrentCheckout(); await checkout.handleSuccessfulCheckoutSession('cs_main');
  await invoices.handlePaidInvoice(invoice({ id: 'in_upgrade', billing_reason: 'subscription_update',
    lines: { has_more: false, data: [invoiceLine('price_plus_current', { proration: true })] } }));
  await invoices.handlePaidInvoice(invoice({ id: 'in_delayed_base',
    lines: { has_more: false, data: [invoiceLine('price_base_current', { start: now - 86400 })] } }));
  assert.equal((await account.getBillingStateForUser(1)).unlimited, true);
});

test('a future downgrade invoice leaves Plus unlimited until its purchased billing period starts', async () => {
  useCurrentCheckout('Plus'); await checkout.handleSuccessfulCheckoutSession('cs_main');
  await invoices.handlePaidInvoice(invoice({ id: 'in_scheduled_base', amount_paid: 900,
    lines: { has_more: false, data: [invoiceLine('price_base_current', { start: future, end: future + 86400 * 30, amount: 900 })] } }));
  const entitlement = await account.getBillingStateForUser(1);
  assert.equal(entitlement.unlimited, true);
  assert.equal(entitlement.periodEnd, future);
});

test('a downgrade starts a fresh Base allowance after the prior Plus period has ended', async () => {
  useCurrentCheckout('Plus');
  invoiceOverrides.set('in_checkout', invoice({ id: 'in_checkout', billing_reason: 'subscription_create',
    lines: { has_more: false, data: [invoiceLine('price_plus_current', { start: now - 86400 * 30, end: now - 60, amount: 1900 })] } }));
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  await invoices.handlePaidInvoice(invoice({ id: 'in_current_base', amount_paid: 900,
    lines: { has_more: false, data: [invoiceLine('price_base_current', { start: now - 60, end: future, amount: 900 })] } }));
  const entitlement = await account.getBillingStateForUser(1);
  assert.equal(entitlement.unlimited, false);
  assert.equal(entitlement.allowanceMode, 'monthly');
  assert.equal(entitlement.remaining, 50);
});

test('delayed Base checkout fulfillment cannot use a newer unpaid Plus subscription price', async () => {
  useCurrentCheckout();
  sub.get('sub_main').items.data[0].price = price('price_plus_current');
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  const grant = (await grants())[0];
  assert.equal(grant.metadata.priceId, 'price_base_current');
  assert.equal(grant.amount, 50);
  assert.equal((await account.getBillingStateForUser(1)).unlimited, false);
});

test('current-price checkout waits for its paid invoice and rejects mismatched invoice ownership', async () => {
  useCurrentCheckout();
  sessions.get('cs_main').invoice = null;
  await assert.rejects(checkout.handleSuccessfulCheckoutSession('cs_main'), /invoice/i);
  assert.equal((await grants()).length, 0);
  sessions.get('cs_main').invoice = 'in_checkout';
  invoiceOverrides.set('in_checkout', invoice({ id: 'in_checkout', billing_reason: 'subscription_create', customer: 'cus_other' }));
  await assert.rejects(checkout.handleSuccessfulCheckoutSession('cs_main'), /invoice|customer/i);
  assert.equal((await grants()).length, 0);
});

test('revisiting an older Base checkout cannot roll back the visible plan after a paid Plus upgrade', async () => {
  useCurrentCheckout(); await checkout.handleSuccessfulCheckoutSession('cs_main');
  sub.get('sub_main').items.data[0].price = price('price_plus_current');
  await billing.handleSubscriptionChange(subscription());
  await invoices.handlePaidInvoice(invoice({ id: 'in_upgrade', billing_reason: 'subscription_update',
    lines: { has_more: false, data: [invoiceLine('price_plus_current', { proration: true })] } }));
  await checkout.handleSuccessfulCheckoutSession('cs_main');
  assert.equal((await rows('select plan_name from teams where id=1'))[0].plan_name, 'Plus');
  assert.equal((await account.getBillingStateForUser(1)).unlimited, true);
});

test('stale configured $8/$12 IDs preserve legacy fulfillment while new checkout still rejects those old prices', async () => {
  const savedEnv = [process.env.STRIPE_BASE_PRICE_ID, process.env.STRIPE_PLUS_PRICE_ID];
  const savedCache = new Map(cache);
  process.env.STRIPE_BASE_PRICE_ID = 'price_base'; process.env.STRIPE_PLUS_PRICE_ID = 'price_plus';
  for (const path of ['lib/payments/plans.ts', 'lib/payments/stripe.ts', 'lib/payments/checkout.ts']) cache.delete(resolve(root, path));
  try {
    // Reload the actual module under the old environment, rather than changing
    // its exported objects after initialization.
    const staleBilling = load(resolve(root, 'lib/payments/stripe.ts'));
    const staleCheckout = load(resolve(root, 'lib/payments/checkout.ts'));
    for (const [id, allowance] of [['price_base', 20], ['price_plus', 60]]) {
      const value = subscription(); value.items.data[0].price = price(id);
      const plan = await staleBilling.resolveSubscriptionPlan(value);
      assert.equal(plan.monthlyCredits, allowance);
      assert.equal(plan.unlimited, false);
      assert.equal(plan.allowanceMode, 'legacy');
      await assert.rejects(staleBilling.resolveCheckoutPlan(id), /published/);
    }
    await staleCheckout.handleSuccessfulCheckoutSession('cs_main');
    await staleCheckout.handleSuccessfulCheckoutSession('cs_main');
    assert.deepEqual((await grants()).map(row => row.amount), [20]);
  } finally {
    [process.env.STRIPE_BASE_PRICE_ID, process.env.STRIPE_PLUS_PRICE_ID] = savedEnv;
    cache.clear(); for (const [path, value] of savedCache) cache.set(path, value);
  }
});

test('immutable current IDs or entitlement metadata with incorrect amounts can never fall back to legacy terms', () => {
  for (const [name, id, wrongAmount] of [
    ['Base', 'price_1UFMwl0nhgFoMCt9zFzWNPKB', 800], ['Plus', 'price_1UFMyB0nhgFoMCt9O3DiG8iW', 1200]
  ]) {
    assert.throws(() => plans.resolvePurchasedPlan(name, { id, currency: 'usd', unit_amount: wrongAmount }), /published/);
    assert.throws(() => plans.resolvePurchasedPlan(name, { id: 'price_metadata_fixture', currency: 'usd', unit_amount: wrongAmount,
      metadata: { reachardEntitlementVersion: plans.ENTITLEMENT_VERSION } }), /published/);
    assert.throws(() => plans.resolvePurchasedPlan(name, { id, currency: 'eur', unit_amount: name === 'Base' ? 900 : 1900 }), /published/);
  }
});
