# Unified Next.js deployment

## Architecture and compatibility

`web/` contains the website and native Next.js Route Handlers for search, email
reveal, drafts and extension account access. Express is removed. One Node 22
process runs on the existing VPS (`49.51.38.235`) so process-wide concurrency,
rate limits and circuit breakers remain shared. Do not scale to multiple
instances without moving those admission controls to a shared coordinator.

The runtime binds to `127.0.0.1:8787` behind the existing Cloudflare Tunnel.
The app preserves the existing permanent `www.reachard.co` redirect to
`reachard.co`, including paths and query strings, without relying on Vercel.
The shared VPS uses a 512 MiB memory limit (768 MiB including swap) per candidate
and release container. Check observed usage before increasing limits or adding
instances. Builds run on GitHub, not on the shared VPS.
Keep both `reachard.co` and `contacts.reachard.co`. Installed extensions can keep
using their old URLs. `/api/account` selects the extension contract for Bearer
authentication or the contacts hostname; cookie-authenticated website requests
keep their existing contract. An explicit `/api/extension/account` is also
available. Contacts-host pricing and connection links redirect to the website.

`REACHARD_TRUST_CLOUDFLARE_PROXY=1` is safe only for this loopback-only ingress.
It uses `CF-Connecting-IP` for unauthenticated limits and ignores arbitrary
`X-Forwarded-For`. Other environments default to one anonymous bucket.

## Configuration and prerequisites

The release container is `reachard`; its private environment is
`/opt/reachard/runtime.env` (root-owned, mode 600). Combine the existing website
Production settings with the existing contact provider settings using a secure
transfer. Preserve `AUTH_SECRET`, Stripe keys, webhook signing secret, price
IDs, mail sender, Resend key, extension allowlists, public store URL, database
URL and all provider budgets. Never generate replacement signing keys as part
of this move. Vercel, GitHub and Cloudflare secrets are separate stores.

The Docker env file uses literal `KEY=value` lines. Remove shell-style wrapping
quotes when importing a Vercel dotenv export, and reject multiline values.
Do not print the result. `deploy/check-runtime-env.py` reports only missing or
invalid key names. It checks required website/provider settings and disables
mock/beta billing in production. Keep any additional optional existing settings.

Keep `BASE_URL`, `APP_URL`, `WEB_BASE_URL` and public website/API build URLs at
`https://reachard.co`. Add both public origins to the web CORS allowlist as
needed. Set production extension IDs/origins to the existing published IDs.
The image sets `REACHARD_CONTACTS_ENABLED=1`; leave it disabled on Vercel while
that service is retained as the website rollback target.

The current personal-account schema ends at `0022_retire_team_model`. Database
changes are separate from activation. Never rewrite already-applied migrations.

## Personal-account migration

1. Make a private full database dump and confirm its archive can be read. Save
   the running image, environment and aggregate account/ledger invariants.
2. From the reviewed checkout, run `node scripts/migrate-db.mjs --status`, then
   `--through 0021_personal_billing_accounts` with the production environment.
   This renames the billing table, preserves every ID and Stripe association,
   backfills the unique owner, and changes entitlement reads. Temporary views
   and triggers keep the previous image and new signup paths compatible. Any
   ambiguous ownership or remaining invitation aborts the whole transaction.
   If status reports the verified historical `0010_friend_invite_rewards` gap,
   first run `--repair-missing 0010_friend_invite_rewards`. This fills the missing
   schema/history entry and refuses duplicate referral attribution. It creates
   no rewards or Stripe balance transactions. Other gaps require separate review.
3. Stage and activate the tested image normally. Verify public routes and the
   personal-account schema before continuing.
4. Run `node scripts/migrate-db.mjs --through 0022_retire_team_model` from that
   image. This removes compatibility views/triggers, membership/invitation tables,
   and unused role/name/team columns. It retains activity, ledger, unlock and
   referral records. Verify the same account/billing invariants again.

The image includes the migration CLI and SQL under `/app`. To run it without
starting the web process, use `docker run --rm --env-file /opt/reachard/runtime.env
--entrypoint node reachard:COMMIT_SHA scripts/migrate-db.mjs --status` (join these
lines). Replace `--status` only with the explicit `--through` target above.
The CLI checks migration hashes, serializes migration runs and commits atomically;
it never prints configuration or row values.

Before reverting to an image from before the personal-account migration **after
0022**, run `deploy/restore-billing-compat.sql` in a transaction. This recreates
only compatibility objects and preserves new users and billing writes. Do not
restore an old database dump over newer purchases. Then restore the previous
image/environment and verify health. This reverse path is covered by a migration
test and allows 0022 to be reapplied after retrying the release.

## Build, stage and activate

`.github/workflows/deploy-next.yml` first runs the complete reusable validation
workflow. It then builds the Node 22 Linux standalone image with the exact
CollectUI beta.9 installation through a BuildKit `HEROUI_KEY` secret. Licensed
runtime files travel directly to the VPS over SSH, never through a public
artifact or registry. See `web/docs/cloud-build.md`.

The workflow uses the existing `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY`
secrets and the current repository's `HEROUI_KEY`. A manual run with activation off prepares the image and stages it if the
private runtime configuration exists. A main-branch push
activates only after validation and candidate checks pass. Manual activation
is allowed only on main. Apply the compatible migration before merging a release that requires it.

For a prepared image, run as root on the VPS:

```bash
bash /opt/reachard/deploy/activate.sh reachard:COMMIT_SHA stage
bash /opt/reachard/deploy/activate.sh reachard:COMMIT_SHA activate
```

Replace `COMMIT_SHA` with the complete 40-character reviewed commit. Staging
starts `reachard_candidate` on loopback port 18787, checks database/provider
readiness, homepage and sign-in, then removes it. It does not switch traffic.
Activation saves private recovery files under `/opt/reachard/backups/`, stops
the old container with a 90-second grace period, recreates the unified runtime,
and checks health. Failure restores the old image and running environment, using the previous unified image. Deployments require an existing Reachard
release as their rollback target and never edit shared Compose services.

## Public routing and acceptance

Cloudflare Tunnel routes `reachard.co`, `www.reachard.co` and
`contacts.reachard.co` to this VPS. Website `www` requests redirect to the apex.
No deployment needs to alter DNS or unrelated tunnel routes.

Check both public hosts: `/health`, `/live`, homepage/sign-in/pricing, account
401 behavior, extension CORS preflight, connection redirects and release
revision. An invalid Stripe webhook must be rejected. Do not use paid provider
calls, real payments or delivered emails as routine release tests.

## Rollback

`/opt/reachard/last-rollback-path` identifies the private pre-activation snapshot.
Automatic rollback applies when activation fails. For a later rollback, use the
saved image, environment and Compose configuration, observing the schema
compatibility step above if 0022 has already been applied. Verify `/health`
locally and publicly. Never run `docker compose down` on the shared host.

Historical split-service containers, Vercel deployments and backups remain
private recovery assets; they are not part of the active deployment workflow.
The GitHub repository and old Vercel project retain their external `connection`
identifier. Renaming those external resources is independent of application
branding and is unnecessary for this release. Existing `fc_` extension tokens
remain valid by hash; newly issued tokens use `rd_`. Stripe's old
`reachardTeamId` metadata is accepted only against the preserved billing ID.

Official runtime references: [self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
and [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
