import 'dotenv/config';
import Stripe from 'stripe';
import postgres from 'postgres';

// Read-only. Never prints credentials, customer data, invoice bodies or database URLs.
const required = ['POSTGRES_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'BASE_URL',
  'STRIPE_BASE_PRICE_ID', 'STRIPE_PLUS_PRICE_ID', 'STRIPE_PORTAL_CONFIGURATION_ID', 'STRIPE_EXPECTED_ACCOUNT_ID'];
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, ...(detail ? { detail } : {}) }); };
for (const key of required) check(key, Boolean(process.env[key]?.trim()));
check('paid_usage_policy', process.env.BETA_UNLIMITED_USAGE === 'false', 'Set false explicitly in both web and contacts deployments.');
let client;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' });
    const account = await stripe.accounts.retrieve();
    check('stripe_account_identity', account.id === process.env.STRIPE_EXPECTED_ACCOUNT_ID);
    check('stripe_charges_enabled', account.charges_enabled === true);
    check('stripe_payouts_enabled', account.payouts_enabled === true);
    check('stripe_account_requirements', !account.requirements?.currently_due?.length && !account.requirements?.pending_verification?.length,
      'An account under review needs its final Stripe decision checked separately.');
    for (const name of ['Base', 'Plus']) {
      const id = process.env[`STRIPE_${name.toUpperCase()}_PRICE_ID`];
      if (!id) continue;
      const price = await stripe.prices.retrieve(id, { expand: ['product'] });
      check(`${name}_live_monthly_price`, price.livemode && price.active && price.type === 'recurring'
        && price.recurring?.interval === 'month' && price.recurring.interval_count === 1
        && price.recurring.usage_type === 'licensed' && price.billing_scheme === 'per_unit'
        && price.unit_amount > 0 && typeof price.product === 'object' && price.product.active && price.product.name === name,
        `${price.currency.toUpperCase()} ${price.unit_amount} minor units`);
    }
    const endpointUrl = `${String(process.env.BASE_URL || '').replace(/\/$/, '')}/api/stripe/webhook`;
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const endpoint = endpoints.data.find(item => item.url === endpointUrl && item.status === 'enabled' && item.livemode);
    const events = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid',
      'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];
    check('reachard_webhook_destination', Boolean(endpoint));
    check('reachard_webhook_events', Boolean(endpoint && events.every(event => endpoint.enabled_events.includes('*') || endpoint.enabled_events.includes(event))));
    if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
      const portal = await stripe.billingPortal.configurations.retrieve(process.env.STRIPE_PORTAL_CONFIGURATION_ID);
      check('membership_portal', portal.active && portal.livemode && !portal.features.subscription_update.enabled
        && portal.features.subscription_cancel.enabled && portal.features.subscription_cancel.mode === 'at_period_end');
    }
  }
  if (process.env.POSTGRES_URL) {
    client = postgres(process.env.POSTGRES_URL, { max: 1, connect_timeout: 10 });
    await client.begin(async sql => {
      await sql`SET TRANSACTION READ ONLY`;
      await sql`SET LOCAL statement_timeout = '15s'`;
      const indexes = await sql`select indexname from pg_indexes where tablename='credit_ledger'
        and indexname in ('credit_ledger_initial_subscription_unique','credit_ledger_monthly_invoice_unique')`;
      check('billing_grant_indexes', indexes.length === 2);
      const [row] = await sql`select count(*)::int as missing from teams where subscription_status in ('active','trialing','past_due')
        and stripe_subscription_id is not null and not exists (
          select 1 from credit_ledger where metadata->>'subscriptionId'=teams.stripe_subscription_id
          and action in ('subscription.initial_grant','subscription.monthly_grant') and metadata->>'periodEnd' is not null)`;
      check('existing_member_periods', row.missing === 0, `${row.missing} subscriptions need verified period backfill before release.`);
    });
  }
} catch {
  check('read_only_audit_completed', false, 'A configured service could not be inspected. No changes were made.');
} finally {
  if (client) await client.end({ timeout: 5 });
}
console.table(results);
if (results.some(result => !result.pass)) process.exitCode = 1;
