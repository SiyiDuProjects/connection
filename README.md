# Reachard

Chrome Extension + Express API + Next.js SaaS app for finding company contacts from LinkedIn job pages.

## Structure

- `extension/`: Manifest V3 Chrome extension injected only on LinkedIn job pages.
- `server/`: Express API proxy that keeps contact provider credentials private and charges Contact Kit unlocks.
- `web/`: Reachard web app with auth, Stripe billing, dashboard, Contact Kits, preferences, and extension tokens.

The app uses a Postgres + Drizzle + cookie auth stack. It does not use Supabase.

## Web App

```powershell
cd web
copy .env.example .env
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm dev
```

Required `web/.env` values:

```powershell
POSTGRES_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BASE_URL=http://localhost:3000
APP_URL=http://localhost:3000
AUTH_SECRET=generate-a-long-random-secret
EMAIL_FROM="Reachard <noreply@yourdomain.com>"
RESEND_API_KEY=re_...
MONTHLY_CREDITS=20
```

For local development, email verification links are printed to the web server log if `EMAIL_FROM` and `RESEND_API_KEY` are not set. Production should configure both values so sign-up and resend flows can deliver verification email.

AI drafts open through `mailto:` or a Gmail compose URL. The app does not require Gmail OAuth for v1 and does not track whether a draft was sent or replied to.

After signing in, open `Dashboard > Extension` and generate an extension API token.

## Local Server

```powershell
cd server
copy .env.example .env
npm install
npm run dev
```

Set `POSTGRES_URL` to the same database used by `web/`, then set the provider API key in `server/.env`. The example config uses Explorium:

```powershell
POSTGRES_URL=postgresql://...
CONTACT_PROVIDER=explorium
EXPLORIUM_API_KEY=your-key
EXPLORIUM_SEARCH_MODE=preview
EXPLORIUM_SEARCH_LIMIT=5
```

`EXPLORIUM_SEARCH_MODE=preview` and `EXPLORIUM_SEARCH_LIMIT=5` keep the initial contact search cheap. User-facing Contact Kits are consumed when a contact is unlocked, not when search preview or the included outreach draft runs.

## Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select the `extension/` folder.
5. Open the extension options page.
6. Paste the token from `Dashboard > Extension`.
7. Open a LinkedIn job page like `https://www.linkedin.com/jobs/view/...`.

The extension defaults to `https://contacts.reachard.studio`. Change the API base URL in the extension options page if you need to use a local or staging server.

The unpacked development extension has a stable ID from `extension/manifest.json`: `ojajfgpfdkmaiccoeffhbdbccefpbala`. Set the web app `ALLOWED_EXTENSION_IDS` environment variable to that ID, or to a comma-separated list if you also publish a Chrome Web Store build.
