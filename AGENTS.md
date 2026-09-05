# Agent Notes

## Change Hygiene

- Keep this file focused on Reachard-specific product, provider, deployment, and verification details.

## Canonical Web App and Design

- The only active web app is `web/` in the repository root. Do not implement product changes in `output/`, `.archive/`, or an artifact preview copy.
- The active homepage uses a Granola-inspired split hero: **Find the people behind the job you want.** on the left, layered Reachard imagery and an automatically looping extension demonstration on the right. Its source is `web/app/(dashboard)/page.tsx`, homepage styles are `web/app/(dashboard)/home.css`, and the illustrative demo is `web/components/reachard/extension-demo.tsx`. Shared navigation remains in `web/components/reachard/design.tsx` and marketing tokens in `web/app/marketing.css`. The previous landscape homepage is recoverable from `.archive/home-before-granola-20260904-202829/`.
- The approved visual baseline is black, white, gray, and blue actions (`#007aff`). Do not restore the old green brand palette or the retired **Know who to contact. Know what to say.** homepage.
- Login and registration use the same approved design version: the centered account card in `web/app/(login)/login.tsx`, with `web/app/auth.css`. Do not restore the retired split-screen green login page.
- Pricing follows the concise HeroUI pricing-card reference: one short heading, Base/Plus cards, prices, purchase buttons, and brief benefits. Do not add a second marketing hero, repeated feature sections, FAQ, or a closing CTA without a request.
- Pricing separates **Individuals** (Base/Plus) from **Teams & Agencies** (one organization inquiry card linking to `support@reachard.co`). Do not invent organization prices or advertise unimplemented team features.
- Public homepage actions are **Install extension** (blue primary) and **Get started** (secondary, links to sign-up). The shared header uses one **Get started** account entry and centers its navigation independently of the logo and actions. Do not add public Dashboard / Explore Workspace / workspace-preview navigation. The homepage demo starts automatically, is silent, loops, and uses clearly labeled sample data without backend calls. Keep the homepage short: hero, three-step explanation, closing installation section, footer.
- The centered marketing navigation contains only **How it works** and **Pricing**. Do not repeat **Install extension** in the header navigation; keep installation in the page buttons.
- The account sidebar has **Dashboard**, **My profile**, **Refer a Friend**, and **Settings**. Dashboard shows recent activity once; do not restore duplicate charts/KPIs or a separate Recent activity navigation item.
- **Refer a Friend** lives at `/dashboard/refer-a-friend` and uses `/api/invite-friend`. Account details, password changes, and account deletion share `/dashboard/general`; `/dashboard/security` redirects there.
- Dashboard offers **Add to Chrome**, not a manual **Connect extension** action. Preserve the automatic session bridge and the extension-initiated authentication callback route.
- Run `npm run preview` from `web/` for `http://127.0.0.1:3012/`. It runs the actual app source with a separate build cache; public homepage and Pricing previews need no database or Stripe credentials. Do not create a second app or duplicate page/header implementation for previewing.
- `.archive/` holds retired versions and recovery copies, not active source. Inspect `git worktree list` before assuming a separate checkout is authoritative.

## HeroUI Pro Installation Channel

- This project uses the user-provided CollectUI distribution, not direct heroui.pro account login. Existing MCP and the `heroui-react-pro` / `heroui-pro-design-taste` Skills use that channel.
- For cloud builds, use `hpsetup@4.7.1` with the secret `HEROUI_KEY`. The CollectUI personal token is for MCP/Skills and must not be substituted for the install key. Do not request an official HeroUI CI token for this setup.
- Follow `web/docs/cloud-build.md` and https://docs.collectui.pro/hpsetup/usage. Keep credentials in GitHub/Vercel secrets only; never commit keys, authenticated documentation URLs, or downloaded Pro library files.

## Web App Invite Rewards

- Dashboard friend invite links use direct attribution only: `/sign-up?ref=CODE` records the direct inviter at sign-up.
- The inviter reward is granted only after the directly invited user completes Stripe checkout.
- Rewards are not multi-level. If invited user B invites buyer C, C's purchase rewards B, not the original inviter A.
- One free month is implemented as Stripe customer balance credit for the inviter and tracked in `friend_invite_rewards` to prevent duplicate rewards.
- If the inviter does not yet have a Stripe customer/subscription, the reward remains pending and is retried after the inviter completes checkout.

## Web App Landing Hero

- The landing hero background uses the fixed public asset `web/public/images/home/hero-background.png`.
- To try a new hero image, run `./scripts/set-home-hero-background.sh /path/to/image.png` on macOS/Linux or `.\scripts\set-home-hero-background.cmd "C:\path\to\image.png"` on Windows from the repo root. The script copies the source into the fixed asset path and leaves the source file in place.
- During visual iteration, refresh the local browser after swapping the file. Save full build/screenshot verification for the selected final image unless code or CSS changed.

## Local macOS Setup

- After a fresh clone on macOS/Linux, run `./scripts/check-local-env.sh` from the repo root to check Node.js, npm, corepack/pnpm, `.env` files, and installed dependencies.
- If Node.js tooling is missing on macOS, install it with `brew install node`, then run `corepack enable` before installing web dependencies.

## Production Server

- Host: `49.51.38.235`
- SSH user: `ubuntu`
- Resolve SSH access from the current host configuration; do not reuse paths from a different machine.
- Project env file on host: `/opt/connection/server/.env`
- Docker Compose file: `/home/ubuntu/siyi/docker-compose.yml`
- Contacts service/container: `connection_contacts`
- Compose service name: `connection_contacts`
- Server container working directory: `/app`
- Server command inside container: `node src/index.js`
- Public/local server port: `8787`

Keep SSH keys and server secrets out of chat and logs. Run this health check on the deployment host:

```bash
curl -sS http://127.0.0.1:8787/health
```

## Important Deployment Detail

The production contacts server runs inside Docker, not directly from the host.

Do not assume that restarting a host `node src/index.js` process is the correct deployment path. The container uses `env_file: /opt/connection/server/.env`, so env changes require recreating the container. A plain `docker restart connection_contacts` may keep old env values.

Use:

```bash
cd /home/ubuntu/siyi
sudo docker compose up -d --build connection_contacts
```

Then verify:

```bash
curl -sS http://127.0.0.1:8787/health
sudo docker logs --tail 30 connection_contacts
```

Use `/health` for effective provider status. If configuration inspection is necessary, select only named non-secret fields; do not dump container environment variables. Inspect logs locally and redact secrets before sharing excerpts.

## Current Contact Pipeline Env

The intended production contact pipeline is:

- Treg `icypeas.people.search` for current-company candidate search.
- Treg `apollo.people.enrich` for on-demand verified work-email reveal.
- Job title, school, and location are ranking signals after search, not hard provider filters.
- Search costs zero app credits.
- Reveal costs one app credit only when a verified work email is returned.
- Draft email costs zero app credits.

Required server env:

```env
CONTACT_PROVIDER=treg
TREG_TOKEN=...
TREG_BASE_URL=https://treg.to
TREG_SEARCH_ENDPOINT=icypeas.people.search
TREG_EMAIL_ENDPOINT=apollo.people.enrich
CONTACT_SEARCH_CREDITS=0
CONTACT_REVEAL_CREDITS=1
EMAIL_DRAFT_CREDITS=0
```

Do not send paid live Treg requests during verification without explicit approval. Use fixture tests for routine release validation.

## Legacy RapidAPI Hosts

- People search host: `fresh-linkedin-scraper-api.p.rapidapi.com`
- People search endpoint: `/api/v1/search/people`
- Company lookup endpoint: `/api/v1/company/profile?company=...`
- School lookup endpoint: `/api/v1/search/schools?keyword=...`
- Location lookup endpoint: `/api/v1/search/location?keyword=...`

These hosts are retained only for the legacy `rapidapi` provider path. RapidAPI marketplace page URLs are not the runtime host; use the `*.p.rapidapi.com` host in env and requests.
