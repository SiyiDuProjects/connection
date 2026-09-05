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
let events = [], balances = [], createdSessions = [], portals = [], configs = [];
let failStripe = false;
const future = Math.floor(Date.now() / 1000) + 86400 * 30;
const price = (id = 'price_base', name = 'Base') => ({ id, active: true, type: 'recurring', billing_scheme: 'per_unit',
  unit_amount: name === 'Base' ? 800 : 1200, currency: 'usd', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  product: { id: `prod_${name}`, active: true, name, default_price: id } });
const subscription = (id = 'sub_main', options = {}) => ({ id, customer: 'cus_main', status: 'active', created: 10,
  metadata: { reachardTeamId: '1' }, items: { data: [{ price: price(), quantity: 1, current_period_end: future }] }, ...options });
const checkoutSession = (id = 'cs_main', options = {}) => ({ id, customer: 'cus_main', subscription: 'sub_main',
  status: 'complete', mode: 'subscription', payment_status: 'paid', client_reference_id: '1', metadata: { reachardTeamId: '1' }, ...options });
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
  prices: { retrieve: async id => price(id, id === 'price_plus' ? 'Plus' : 'Base') },
  checkout: { sessions: {
    retrieve: async id => { assert.ok(sessions.has(id), id); return clone(sessions.get(id)); },
    list: async filter => ({ data: [...sessions.values()].filter(item => (!filter.customer || item.customer === filter.customer)
      && (!filter.subscription || item.subscription === filter.subscription) && (!filter.status || item.status === filter.status)), has_more: false }),
    listLineItems: async id => ({ data: [{ price: { id: sessions.get(id).priceId || 'price_base' } }] }),
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
const previousDbUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL = 'fixture-only';
const account = load(resolve(root, '../server/src/lib/account.js'));
if (previousDbUrl === undefined) delete process.env.POSTGRES_URL; else process.env.POSTGRES_URL = previousDbUrl;
const rows = async sql => (await pg.query(sql)).rows;
const grants = () => rows('SELECT * FROM credit_ledger ORDER BY id');

before(async () => {
  await pg.exec(`CREATE TABLE users (id serial PRIMARY KEY, name varchar(100), email varchar(255), email_verified_at timestamp, password_hash text,
    role varchar(20) DEFAULT 'owner', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp);
    CREATE TABLE teams (id serial PRIMARY KEY, name varchar(100), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
      stripe_customer_id text UNIQUE, stripe_subscription_id text UNIQUE, stripe_product_id text, plan_name varchar(50), subscription_status varchar(20));
    CREATE TABLE team_members (id serial PRIMARY KEY, user_id int, team_id int, role varchar(50), joined_at timestamp DEFAULT now());
    CREATE TABLE credit_ledger (id serial PRIMARY KEY, user_id int, amount int, action text, request_id text, metadata jsonb DEFAULT '{}', created_at timestamp DEFAULT now());
    CREATE TABLE stripe_webhook_events (id text PRIMARY KEY, type text, processed boolean DEFAULT false, created_at timestamp DEFAULT now());
    CREATE TABLE friend_invites (id serial PRIMARY KEY, inviter_user_id int, token text, created_at timestamp DEFAULT now(), last_generated_at timestamp DEFAULT now());
    CREATE TABLE friend_invite_redemptions (id serial PRIMARY KEY, invite_id int, invited_user_id int, created_at timestamp DEFAULT now());`);
  await pg.exec(readFileSync(resolve(root, 'lib/db/migrations/0010_friend_invite_rewards.sql'), 'utf8'));
  // Intentionally omit billing grant indexes: row locking must still prevent duplicate grants.
});
beforeEach(async () => {
  sub.clear(); sessions.clear(); events = []; balances = []; createdSessions = []; portals = []; configs = []; failStripe = false;
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
  for (let index=0; index<2; index++) await assert.rejects(billing.createCheckoutSession({ team, priceId: 'price_base' }), error => error.url === 'https://checkout.stripe.com/cs_new_1');
  assert.equal(createdSessions.length, 1);
  await assert.rejects(billing.createCheckoutSession({ team, priceId: 'price_plus' }), error => error.url === 'https://checkout.stripe.com/cs_new_2');
  assert.equal(sessions.get('cs_new_1').status, 'expired');
});
test('past due and unpaid subscriptions block a second checkout', async () => {
  for (const status of ['past_due','unpaid','incomplete','paused']) {
    sub.get('sub_main').status = status;
    await assert.rejects(billing.createCheckoutSession({ team: { id: 1 }, priceId: 'price_base' }), error => error.url === '/dashboard?billing=already-active');
  }
  assert.equal(createdSessions.length, 0);
});
test('portal ignores another product configuration and disables unsupported changes', async () => {
  configs = [{ id: 'bpc_other', metadata: {}, features: { subscription_update: { enabled: true } } }];
  await billing.createCustomerPortalSession({ stripeCustomerId: 'cus_main' });
  assert.equal(portals[0].configuration, 'bpc_reachard');
  assert.equal(configs[1].features.subscription_update.enabled, false);
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
  assert.equal((await account.getMembershipForUser(1)).periodEnd, future + 86400 * 30);
  await pg.exec("UPDATE teams SET stripe_subscription_id='sub_different' WHERE id=1");
  assert.equal(hasMembershipAccess(await account.getMembershipForUser(1)), false);
});

test('account deletion can safely encounter an already canceled subscription', async () => {
  sub.get('sub_main').status = 'canceled';
  await billing.cancelSubscriptionAtPeriodEnd('sub_main');
  sub.get('sub_main').status = 'active'; sub.get('sub_main').cancel_at_period_end = true;
  await billing.cancelSubscriptionAtPeriodEnd('sub_main');
});
