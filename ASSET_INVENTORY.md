# Asset Inventory

Last updated: 2026-05-03

This file is a working inventory for the `connection` project. Do not put secrets, API keys, database passwords, SSH private keys, or webhook signing secrets in this file.

## Current Project Map

| Asset | Confirmed value | Owner / platform | Status | Notes |
| --- | --- | --- | --- | --- |
| Git repository | `https://github.com/SiyiDu/connection.git` | GitHub | Confirmed locally | Source of truth for `extension/`, `server/`, and `web/`. |
| Web app | `web/` | Vercel recommended | Needs dashboard confirmation | Next.js SaaS app. Deploy root should be `web`. |
| Contacts API | `server/` | VPS + Docker Compose | Needs VPS confirmation | Express API, expected local port `8787`. |
| Browser extension | `extension/` | Chrome unpacked / Chrome Web Store later | Local confirmed | Defaults to `https://contacts.gaid.studio` API and `https://gaid.studio` web app. |
| Production website domain | `gaid.studio` / `www.gaid.studio` | DNS provider needs confirmation | Referenced in code | Used by extension host permissions and default web URL. |
| Production API domain | `contacts.gaid.studio` | Cloudflare Tunnel expected | Referenced in code | Used by extension default API URL and CI health check docs. |
| Database | Neon Postgres | Neon | Local env detected | Shared by `web/` and `server/`. Rotate credentials if local `.env` was shared or committed anywhere. |
| Billing | Stripe | Stripe | Needs dashboard confirmation | `web/` expects Stripe secret and webhook secret. |
| Contact provider | Explorium or Apollo | Explorium / Apollo | Needs production confirmation | Docs recommend Explorium. Local env contains an Apollo key, so rotate it if exposed. |
| CI/CD | `.github/workflows/deploy-server.yml` | GitHub Actions | Confirmed locally | Deploys only `server/` to VPS on `main` changes. |

## Runtime Chain

```text
User
-> https://gaid.studio
-> Vercel project for web/
-> Neon Postgres
```

```text
Chrome Extension on LinkedIn
-> https://contacts.gaid.studio
-> Cloudflare Tunnel public hostname
-> VPS localhost:8787
-> Docker Compose service connection_contacts
-> server/
-> Neon Postgres
-> Explorium or Apollo contact provider
```

## Environment Variables To Track

### Web app, likely Vercel

| Variable | Required | Where it should live | Notes |
| --- | --- | --- | --- |
| `POSTGRES_URL` | Yes | Vercel project env | Same Neon database as server. |
| `STRIPE_SECRET_KEY` | Yes | Vercel project env | Use live key only for production. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Vercel project env | Must match the Stripe webhook endpoint. |
| `BASE_URL` | Yes | Vercel project env | Production should be `https://gaid.studio` or the final canonical web domain. |
| `NEXT_PUBLIC_WEB_BASE_URL` | Yes | Vercel project env | Should match `BASE_URL`. |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Vercel project env | Expected `https://contacts.gaid.studio`. |
| `ALLOWED_EXTENSION_IDS` | Yes for production extension connect flow | Vercel project env | Stable unpacked dev ID is `ojajfgpfdkmaiccoeffhbdbccefpbala`; use comma-separated values if a Chrome Web Store ID is added later. |
| `AUTH_SECRET` | Yes | Vercel project env | Long random secret. Rotate if exposed. |
| `MONTHLY_CREDITS` | Yes | Vercel project env | Current example: `20` Contact Kits. |
| `ADMIN_EMAILS` | Optional | Vercel project env | Local example includes an admin email. |

### Contacts API, likely VPS `/opt/connection/server/.env`

| Variable | Required | Where it should live | Notes |
| --- | --- | --- | --- |
| `PORT` | Yes | VPS env file | Expected `8787`. |
| `WEB_BASE_URL` | Yes | VPS env file | Should be final web app URL, not the API URL. |
| `POSTGRES_URL` | Yes | VPS env file | Same Neon database as web. |
| `CONTACT_PROVIDER` | Yes | VPS env file | Recommended `explorium`; `apollo` only if API access works. |
| `APOLLO_API_KEY` | Provider-dependent | VPS env file | Rotate if exposed. |
| `APOLLO_MOCK` | Yes | VPS env file | Production should usually be `false`. |
| `EXPLORIUM_API_KEY` | Provider-dependent | VPS env file | Needed when `CONTACT_PROVIDER=explorium`. |
| `EXPLORIUM_SEARCH_MODE` | Optional | VPS env file | `preview` keeps searches cheaper. |
| `EXPLORIUM_SEARCH_LIMIT` | Optional | VPS env file | Example value: `5`. |
| `EXTENSION_ORIGIN` | Optional | VPS env file | Real value should be `chrome-extension://<extension-id>` if enforced. |
| `RATE_LIMIT_WINDOW_MS` | Optional | VPS env file | Example value: `60000`. |
| `RATE_LIMIT_MAX` | Optional | VPS env file | Example value: `60`. |
| `CONTACT_SEARCH_CREDITS` | Optional | VPS env file | Example value: `0`. |
| `CONTACT_REVEAL_CREDITS` | Optional | VPS env file | Example value: `1`. |
| `EMAIL_DRAFT_CREDITS` | Optional | VPS env file | Example value: `0`. |

### GitHub Actions secrets

| Secret | Required | Purpose | Dashboard check |
| --- | --- | --- | --- |
| `SSH_HOST` | Yes | VPS hostname/IP | GitHub repo settings. |
| `SSH_PORT` | Optional | SSH port, default `22` | GitHub repo settings. |
| `SSH_USER` | Yes | Deploy user | GitHub repo settings and VPS. |
| `SSH_KEY` | Yes | Private key for deploy user | Rotate if exposed. |
| `DEPLOY_PATH` | Yes | Expected `/opt/connection/server` | GitHub repo settings and VPS. |
| `COMPOSE_PATH` | Yes | Expected `/root/muxing` or actual compose dir | GitHub repo settings and VPS. |
| `PUBLIC_HEALTH_URL` | Yes | Expected `https://contacts.gaid.studio/health` | GitHub repo settings. |

## Dashboard Checklist

### Cloudflare

| Item | Expected | Actual | Status |
| --- | --- | --- | --- |
| Zone for `gaid.studio` exists | Yes |  | Unknown |
| Nameservers at registrar point to Cloudflare | Yes if Cloudflare is DNS authority |  | Unknown |
| DNS record for `gaid.studio` | Points to Vercel |  | Unknown |
| DNS record for `www.gaid.studio` | Points to Vercel |  | Unknown |
| Tunnel public hostname `contacts.gaid.studio` | Points to `http://localhost:8787` |  | Unknown |
| Existing `sub2api` hostname | Points to `http://localhost:8080` if still used |  | Unknown |

### Vercel

| Item | Expected | Actual | Status |
| --- | --- | --- | --- |
| Project root | `web` |  | Unknown |
| Framework | Next.js |  | Unknown |
| Production domain | `gaid.studio` |  | Unknown |
| Environment variables match this file | Yes |  | Unknown |
| Build command | `corepack pnpm build` or migration + build |  | Unknown |

### Neon

| Item | Expected | Actual | Status |
| --- | --- | --- | --- |
| Project name |  |  | Unknown |
| Database | `neondb` or current app DB |  | Unknown |
| Region | `us-west-2` based on local URL |  | Needs confirmation |
| Connection string used by web and server | Same database |  | Needs confirmation |
| Password rotated after exposure | Yes |  | Pending |

### Tencent Cloud

| Item | Expected | Actual | Status |
| --- | --- | --- | --- |
| Any domain registration for `gaid.studio` | Registrar only, if bought there |  | Unknown |
| Any DNS zone still active | Should not conflict with Cloudflare authority |  | Unknown |
| Any server/CVM running this project | Only if VPS is Tencent |  | Unknown |
| Any paid resources not used | Identify and cancel later |  | Unknown |

## Immediate Risk Actions

1. Confirm whether `server/.env` and `web/.env` were ever committed, pasted, shared, or uploaded.
2. Rotate the Neon database password / connection string and update Vercel plus VPS env files.
3. Rotate the Apollo API key detected in local env.
4. Replace placeholder Stripe values before production; rotate real Stripe keys if they were ever exposed.
5. Confirm Cloudflare DNS authority before changing any DNS records.
6. Confirm Vercel production domain and set one canonical web URL.

## Safe Change Rule

For each infrastructure change, record:

| Date | System | Before | After | Reason | Verified by |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
