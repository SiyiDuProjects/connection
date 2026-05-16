# Agent Notes

## Documentation Maintenance

- Keep `README.md` and `AGENTS.md` updated promptly when behavior, setup, deployment, or operational details change.

## Web App Invite Rewards

- Dashboard friend invite links use direct attribution only: `/sign-up?ref=CODE` records the direct inviter at sign-up.
- The inviter reward is granted only after the directly invited user completes Stripe checkout.
- Rewards are not multi-level. If invited user B invites buyer C, C's purchase rewards B, not the original inviter A.
- One free month is implemented as Stripe customer balance credit for the inviter and tracked in `friend_invite_rewards` to prevent duplicate rewards.
- If the inviter does not yet have a Stripe customer/subscription, the reward remains pending and is retried after the inviter completes checkout.

## Web App Landing Hero

- The landing hero background uses the fixed public asset `web/public/images/home/hero-background.png`.
- To try a new hero image, run `.\scripts\set-home-hero-background.cmd "C:\path\to\image.png"` from the repo root. The script copies the source into the fixed asset path and leaves the source file in place.
- During visual iteration, refresh the local browser after swapping the file. Save full build/screenshot verification for the selected final image unless code or CSS changed.

## Production Server

- Host: `49.51.38.235`
- SSH key: `C:\Users\Administrator\Desktop\Projects\Siyi.pem`
- SSH user: `ubuntu`
- Project env file on host: `/opt/connection/server/.env`
- Docker Compose file: `/home/ubuntu/muxing/docker-compose.yml`
- Contacts service/container: `connection_contacts`
- Compose service name: `connection_contacts`
- Server container working directory: `/app`
- Server command inside container: `node src/index.js`
- Public/local server port: `8787`

## Important Deployment Detail

The production contacts server runs inside Docker, not directly from the host.

Do not assume that restarting a host `node src/index.js` process is the correct deployment path. The container uses `env_file: /opt/connection/server/.env`, so env changes require recreating the container. A plain `docker restart connection_contacts` may keep old env values.

Use:

```bash
cd /home/ubuntu/muxing
sudo docker compose up -d --build connection_contacts
```

Then verify:

```bash
curl -sS http://127.0.0.1:8787/health
sudo docker inspect connection_contacts --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E 'CONTACT_PROVIDER|RAPIDAPI|CONTACT_SEARCH_CREDITS|CONTACT_REVEAL_CREDITS|EMAIL_DRAFT_CREDITS'
sudo docker logs --tail 30 connection_contacts
```

Do not print secret values in user-visible output. Mask keys when showing env.

## Current Contact Pipeline Env

The intended production contact pipeline is:

- RapidAPI Fresh LinkedIn Scraper for candidate search and LinkedIn company/school/location ID lookup.
- Apollo only for on-demand email reveal.
- Search costs zero app credits.
- Reveal costs one app credit.
- Draft email costs zero app credits.

Required server env:

```env
CONTACT_PROVIDER=rapidapi
RAPIDAPI_KEY=...
RAPIDAPI_PEOPLE_HOST=fresh-linkedin-scraper-api.p.rapidapi.com
APOLLO_API_KEY=...
CONTACT_SEARCH_CREDITS=0
CONTACT_REVEAL_CREDITS=1
EMAIL_DRAFT_CREDITS=0
```

`APOLLO_API_KEY` must remain set because `Reveal email` calls Apollo `people/match`.

## RapidAPI Hosts

- People search host: `fresh-linkedin-scraper-api.p.rapidapi.com`
- People search endpoint: `/api/v1/search/people`
- Company lookup endpoint: `/api/v1/company/profile?company=...`
- School lookup endpoint: `/api/v1/search/schools?keyword=...`
- Location lookup endpoint: `/api/v1/search/location?keyword=...`

RapidAPI marketplace page URLs are not the runtime host. Use the `*.p.rapidapi.com` host in env and requests.

## Lessons From 2026-05-08

- `/opt/connection/server/.env` is the correct host env file, but the running app reads it only through Docker Compose `env_file`.
- The container cwd is `/app`; `/proc/<pid>/cwd` showing `/app` means the process is in Docker.
- `/proc/<pid>/environ` can show startup env, but `/health` is the better source for the app's effective provider status.
- If `/health` shows `contactProvider: "apollo"` after changing `/opt/connection/server/.env`, recreate the container with Compose.
- The server backup made during the RapidAPI switch was `/opt/connection/server/.env.bak-20260508001058`.
