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

The current schema must include migration `0020_idempotency_request_hash`.
This consolidation itself adds no database migration. For future schema changes,
back up the database and apply backward-compatible migrations before activation;
health checks reject missing account/billing schema. Atomic charges, unique
constraints, advisory locks and idempotency remain in PostgreSQL.

## Build, stage and activate

`.github/workflows/deploy-next.yml` first runs the complete reusable validation
workflow. It then builds the Node 22 Linux standalone image with the exact
CollectUI beta.9 installation through a BuildKit `HEROUI_KEY` secret. Licensed
runtime files travel directly to the VPS over SSH, never through a public
artifact or registry. See `web/docs/cloud-build.md`.

The workflow uses the existing `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY`
secrets and the current repository's `HEROUI_KEY`. A push to
`codex/nextjs-vps`, or a manual run with activation off, prepares the image and
stages it if the private runtime configuration exists. A main-branch push
activates only after validation and candidate checks pass. Manual activation
is allowed only on main. Never merge until configuration and initial hostname
cutover preparations are complete.

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
and checks health. Failure restores the old image and running environment, or
restarts the retained legacy container. Shared Compose marks
`connection_contacts` with the `legacy-reachard` profile to prevent accidental
restart alongside the new port owner. Other services are not changed.

## First hostname cutover

1. Save the current Cloudflare DNS records, tunnel ingress configuration and
   Vercel Production deployment URL. Confirm the new private config preserves
   existing account sessions, payment and email settings.
2. Stage and activate the unified runtime while retaining the contacts hostname.
3. Update the existing tunnel's ingress for `reachard.co` and `www.reachard.co`
   to `http://127.0.0.1:8787`, preserving all unrelated tunnel routes. Update
   only the website's DNS records to that tunnel. Keep contacts routing intact.
4. Check both public hosts: `/health`, `/live`, homepage/sign-in/pricing,
   protected-account 401 behavior, extension CORS preflight, old connection
   redirects and release revision. Confirm cookie sessions and webhook endpoint
   routing. A malformed Stripe webhook must be rejected, never granted benefits.
5. Retain the previous Vercel deployment, legacy container/image, DNS records and
   private backups until the migration is accepted. A provider fixture pass is
   not proof of live paid-provider behavior; paid calls need explicit approval.

Hostname changes require Cloudflare management access. A tunnel runtime token
alone does not grant DNS/ingress management. Website configuration must be
recovered from its existing authorized store; never substitute fake credentials.

## Rollback

`/opt/reachard/last-rollback-path` identifies the private pre-activation snapshot.
Automatic rollback applies when activation fails. For a later rollback, first
restore website DNS/ingress to the saved Vercel target if returning to the split
architecture. Then stop/remove only `reachard`, restore the saved shared Compose
file and restart policy, and start the retained `connection_contacts` container.
For an earlier unified release, use its saved image, environment and Compose
configuration. Verify `/health` locally and publicly before closing the incident.
Never run `docker compose down` on the shared host or remove unrelated services.

Official runtime references: [self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
and [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
