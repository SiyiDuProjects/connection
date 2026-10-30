# Reachard application

One Next.js app serves the website, authentication, billing and extension API
on the existing VPS. See [the root README](../README.md) for setup and
[deployment instructions](../DEPLOY_CICD.md) for production operations.

Accounts are personal: `billing_accounts.user_id` uniquely links each user to
Stripe customer/subscription state. Paid invoice evidence stays in the append-only
`credit_ledger`. PostgreSQL owns atomic charging, durable email unlocks,
idempotency and entitlement checks. Friend referrals use separate direct-attribution
records; they do not create teams or shared subscriptions.

Install the pinned dependencies with `pnpm install --frozen-lockfile`, then follow
[CollectUI installation](docs/cloud-build.md). Preserve existing private `.env`
files. New local installations can copy `.env.example` without overwriting them.
There is no seed script that creates users, prices or subscriptions.

Use `pnpm preview` for public pages, or `pnpm test:local` for the real account
flows against a disposable PostgreSQL database and mock providers. The latter
accepts `@reachard.test` accounts without external email delivery.

Release checks:

```bash
pnpm test:contacts
node --test --test-concurrency=1 scripts/*.test.mjs scripts/*.test.cjs
node scripts/check-pro-install.mjs
node scripts/check-ui-boundaries.mjs
pnpm build
node scripts/verify-unified-runtime.mjs
```

Fresh databases may apply all migrations with `pnpm db:migrate`. Existing
production uses the explicitly staged migration commands in the deployment guide.
Migration history remains immutable. Production payment, email and paid-provider
checks require separate live acceptance; fixtures do not contact those services.
