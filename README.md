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

Set `POSTGRES_URL` to the same database used by `web/`, then set the provider API keys in `server/.env`. The production contact pipeline uses RapidAPI for search and Apollo for on-demand email reveal:

```powershell
POSTGRES_URL=postgresql://...
CONTACT_PROVIDER=rapidapi
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_PEOPLE_HOST=fresh-linkedin-scraper-api.p.rapidapi.com
RAPIDAPI_METADATA_HOST=z-real-time-linkedin-scraper-api1.p.rapidapi.com
APOLLO_API_KEY=your-apollo-key
CONTACT_SEARCH_CREDITS=0
CONTACT_REVEAL_CREDITS=1
EMAIL_DRAFT_CREDITS=0
```

Search preview and the included outreach draft do not consume Contact Kits. Revealing an email consumes one Contact Kit through Apollo `people/match`.

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
