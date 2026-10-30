# Reachard

Chrome extension + one Next.js application for finding relevant company contacts from job pages, company sites, and public professional profiles.

## Current Website and Local Preview

`web/` is the single active web app. The approved homepage is **Find the people behind the job you want.**, with a split hero, an automatically looping extension demonstration, black/white/gray surfaces, and blue actions. Homepage and Pricing share `web/components/reachard/design.tsx` and `web/app/marketing.css`.

For local visual review, no database or Stripe credentials are required:

```powershell
cd web
npm run preview
```

Open **http://127.0.0.1:3012/** for the homepage, **http://127.0.0.1:3012/pricing** for Pricing, and `/sign-in` or `/sign-up` for the centered account-card pages. This runs the actual app, not a separate preview implementation. Prices remain unavailable without a billing configuration; account and payment operations still require their normal services.

Retired design checkouts and recovery copies belong in `.archive/` and are not development entry points. Do not use the former `artifacts/marketing-preview` app or the old green homepage.

## Structure

- `extension/`: Manifest V3 Chrome extension for supported job, company, and public professional-profile pages.
- `web/`: Next.js website and API, with auth, Stripe billing, profiles, extension tokens and contact operations.
- `web/lib/contacts/`: framework-independent provider operations, billing transactions and traffic controls.
- `deploy/`: single-instance VPS deployment, candidate checks and rollback.
- `brand/`: one display-name configuration and icon master; generated web/API/extension bridges keep presentation consistent.

Billing belongs directly to each user through `billing_accounts`; the starter
team/membership/invitation model is retired. `activity_logs` retains per-user
audit history. The app uses a Postgres + Drizzle + cookie auth stack. It does not use Supabase.

## Local Environment Check

On macOS or Linux, run this from the repo root after cloning:

```bash
./scripts/check-local-env.sh
```

The script checks whether Node.js, npm, corepack/pnpm, `.env` files, and installed dependencies are present. It also verifies the installed HeroUI Pro version and its component/CSS entry points; an existing `node_modules` directory alone is not sufficient. See [cloud builds](web/docs/cloud-build.md) if this check fails after restoring dependencies. On macOS, install Node.js with Homebrew if needed:

```bash
brew install node
corepack enable
```

## Web App

macOS/Linux:

```bash
cd web
cp .env.example .env
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm dev
```

Windows PowerShell:

```powershell
cd web
copy .env.example .env
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm dev
```

Required `web/.env` values:

```env
POSTGRES_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BASE_URL=http://localhost:3000
APP_URL=http://localhost:3000
AUTH_SECRET=generate-a-long-random-secret
EMAIL_FROM="Reachard <noreply@yourdomain.com>"
RESEND_API_KEY=re_...
STRIPE_BASE_PRICE_ID=price_...
STRIPE_PLUS_PRICE_ID=price_...
NEXT_PUBLIC_CHROME_STORE_URL=
```

Account creation and email recovery require a configured Resend sender and API key. Missing delivery configuration stops those operations; codes and links are never printed as a delivery fallback. Public page previews still work without credentials.

AI drafts open through `mailto:` or a Gmail compose URL. The app does not require Gmail OAuth for v1 and does not track whether a draft was sent or replied to.

Friend invite links are direct-attribution only. A copied dashboard invite link points to `/sign-up?ref=CODE`; the inviter earns one month free only after that directly invited user completes Stripe checkout. If the invited user later invites another buyer, that later purchase rewards the invited user, not the original inviter. Rewards are recorded in `friend_invite_rewards` and applied as Stripe customer balance credit to the inviter, with pending rewards retried after the inviter has a Stripe subscription.

After signing in, the website connects an installed extension automatically. Account and connection settings stay on the website.

The website and extension ship in English. Shared website copy lives in `web/lib/i18n.ts`; no language cookie, browser-language detection, or language synchronization is needed.

### Landing Hero Background

The landing page reads its hero image from:

```text
web/public/images/home/hero-background.png
```

To try a different image without editing CSS, run one of:

```bash
./scripts/set-home-hero-background.sh /path/to/image.png
```

```powershell
.\scripts\set-home-hero-background.cmd "C:\path\to\image.png"
```

The script copies the source image into the fixed public path and leaves the source file in place. In local dev, refresh the browser to preview; run a full build/screenshot only after choosing the final image.

## Contact API

The website and extension API run in the same Next.js Node process. Enable the
API with `REACHARD_CONTACTS_ENABLED=1` and configure Treg in `web/.env`:

```env
CONTACT_PROVIDER=treg
TREG_TOKEN=your-treg-token
TREG_BASE_URL=https://treg.to
TREG_SEARCH_ENDPOINT=icypeas.people.search
TREG_EMAIL_ENDPOINT=apollo.people.enrich
BETA_UNLIMITED_USAGE=false
```

Search and drafts use zero app credits; a successfully verified work-email
reveal uses one. PostgreSQL transactions still own entitlement revalidation,
idempotency and charging. The shared token verifier requires a verified,
undeleted account and an unrevoked token. One database pool serves both the
website and contact operations.

For disposable, offline account and extension testing, run `pnpm test:local`
from `web/`. It starts one Next.js app on port 3000 with an in-memory database
and mock contact providers. No production database or paid provider is used.

Run provider, timeout, billing and admission fixtures with `pnpm test:contacts`
from `web/`. The deployment workflow also requires the website and extension
checks in `.github/workflows/validate.yml` before building the release image.

## Production Access

Resolve production SSH access from the current host configuration. Project-specific service, environment, and Docker deployment details are in `AGENTS.md`; do not reuse an identity path from another computer.

## Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select the `extension/` folder.
5. Sign in on the Reachard website to connect the extension.
6. Open a supported job, company, or LinkedIn profile page.

The extension defaults to `https://contacts.reachard.co`. For local or staging use, the website supplies the API URL during connection through `NEXT_PUBLIC_API_BASE_URL` (local development uses the same Next.js origin on port 3000).

The extension is published. Preserve `contacts.reachard.co` and the existing
API paths for installed versions during migration. Production uses the existing
Chrome Store ID and explicit extension allowlists; retain any authorized local
development IDs when updating them. `NEXT_PUBLIC_CHROME_STORE_URL` must keep the
published listing URL from the existing website configuration.

## Brand and launch package

Change `name` in `brand/brand.json` for spelling or capitalization. Run `node scripts/sync-brand.mjs` to update all generated display text. Replace `brand/mark.png` for the graphic, then run `node scripts/build-brand-icons.mjs`, synchronize, and rebuild the extension. The image contains only the symbol; lettering remains editable text. Domain names, service identifiers, and stored account data are independent of display branding.

Archived store preparation files remain local under `artifacts/`. See `extension/STORE_SUBMISSION.md` for reproducible build commands and reviewer instructions. Preparation does not imply a store submission or a production deployment.
