# Reachard

Chrome Extension + Express API + Next.js SaaS app for finding relevant company contacts from job pages, company sites, and public professional profiles.

## Structure

- `extension/`: Manifest V3 Chrome extension for supported job, company, and public professional-profile pages.
- `server/`: Express API proxy that keeps contact provider credentials private and charges Contact Kit unlocks.
- `web/`: Reachard web app with auth, Stripe billing, dashboard, Contact Kits, preferences, and extension tokens.

The app uses a Postgres + Drizzle + cookie auth stack. It does not use Supabase.

## Local Environment Check

On macOS or Linux, run this from the repo root after cloning:

```bash
./scripts/check-local-env.sh
```

The script checks whether Node.js, npm, corepack/pnpm, `.env` files, and installed dependencies are present. On macOS, install Node.js with Homebrew if needed:

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
BASE_MONTHLY_CREDITS=20
PLUS_MONTHLY_CREDITS=60
STRIPE_BASE_PRICE_ID=price_...
STRIPE_PLUS_PRICE_ID=price_...
NEXT_PUBLIC_CHROME_STORE_URL=
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_PEOPLE_HOST=fresh-linkedin-scraper-api.p.rapidapi.com
```

For local development, email verification links are printed to the web server log if `EMAIL_FROM` and `RESEND_API_KEY` are not set. Production should configure both values so sign-up and resend flows can deliver verification email.

AI drafts open through `mailto:` or a Gmail compose URL. The app does not require Gmail OAuth for v1 and does not track whether a draft was sent or replied to.

Friend invite links are direct-attribution only. A copied dashboard invite link points to `/sign-up?ref=CODE`; the inviter earns one month free only after that directly invited user completes Stripe checkout. If the invited user later invites another buyer, that later purchase rewards the invited user, not the original inviter. Rewards are recorded in `friend_invite_rewards` and applied as Stripe customer balance credit to the inviter, with pending rewards retried after the inviter has a Stripe subscription.

After signing in, open `Dashboard > Extension` and generate an extension API token.

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

## Local Server

macOS/Linux:

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Windows PowerShell:

```powershell
cd server
copy .env.example .env
npm install
npm run dev
```

Set `POSTGRES_URL` to the same database used by `web/`, then configure Treg in `server/.env`. The production contact pipeline uses Treg's Icypeas route for current-company people search and Treg's Apollo route for on-demand verified work-email reveal:

```env
POSTGRES_URL=postgresql://...
CONTACT_PROVIDER=treg
TREG_TOKEN=your-treg-token
TREG_BASE_URL=https://treg.to
TREG_SEARCH_ENDPOINT=icypeas.people.search
TREG_EMAIL_ENDPOINT=apollo.people.enrich
CONTACT_SEARCH_CREDITS=0
CONTACT_REVEAL_CREDITS=1
EMAIL_DRAFT_CREDITS=0
BETA_UNLIMITED_USAGE=true
```

During private beta, `BETA_UNLIMITED_USAGE` defaults to enabled, so all authenticated users can search, reveal verified emails, and generate drafts without reducing their Contact Kit balance. API usage and provider cost telemetry are still recorded. Set `BETA_UNLIMITED_USAGE=false` to restore the configured per-action costs. The reveal uses the candidate's LinkedIn URL first and falls back to name plus company domain when needed.

## Production Access

Production VPS access uses the shared local SSH handle documented in `/Users/bytedance/.codex/AGENTS.md`. Project-specific service, env, and Docker details are in `AGENTS.md`.

## Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select the `extension/` folder.
5. Open the extension options page.
6. Paste the token from `Dashboard > Extension`.
7. Open a LinkedIn job page like `https://www.linkedin.com/jobs/view/...`.

The extension defaults to `https://contacts.reachard.co`. Change the API base URL in the extension options page if you need to use a local or staging server.

During private beta, `ALLOW_ANY_EXTENSION_ID` defaults to enabled so unpacked builds with different valid Chrome extension IDs can connect after the user signs in. Before public launch, set `ALLOW_ANY_EXTENSION_ID=false` and set `ALLOWED_EXTENSION_IDS` to the final Chrome Web Store ID. Keep `NEXT_PUBLIC_CHROME_STORE_URL` empty during private beta; the website then shows `Join private beta` instead of pretending the extension is already installable. After publication, set it to the verified Chrome Web Store listing URL.
