# Agent Notes

## UI Style Notes

- Selected buttons should use `#f3f3f3`.
- Button hover backgrounds should use `#f9f9f9`.

## Documentation Maintenance

- Keep `README.md` and `AGENTS.md` updated promptly when behavior, setup, deployment, or operational details change.

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

- RapidAPI Fresh LinkedIn Scraper for candidate search.
- Apollo only for on-demand email reveal.
- Search costs zero app credits.
- Reveal costs one app credit.
- Draft email costs zero app credits.

Required server env:

```env
CONTACT_PROVIDER=rapidapi
RAPIDAPI_KEY=...
RAPIDAPI_PEOPLE_HOST=fresh-linkedin-scraper-api.p.rapidapi.com
RAPIDAPI_METADATA_HOST=z-real-time-linkedin-scraper-api1.p.rapidapi.com
APOLLO_API_KEY=...
CONTACT_SEARCH_CREDITS=0
CONTACT_REVEAL_CREDITS=1
EMAIL_DRAFT_CREDITS=0
```

`APOLLO_API_KEY` must remain set because `Reveal email` calls Apollo `people/match`.

## RapidAPI Hosts

- People search host: `fresh-linkedin-scraper-api.p.rapidapi.com`
- People search endpoint: `/api/v1/search/people`
- Metadata host: `z-real-time-linkedin-scraper-api1.p.rapidapi.com`
- Metadata is used for LinkedIn company/school/location ID lookup.

RapidAPI marketplace page URLs are not the runtime host. Use the `*.p.rapidapi.com` host in env and requests.

## Lessons From 2026-05-08

- `/opt/connection/server/.env` is the correct host env file, but the running app reads it only through Docker Compose `env_file`.
- The container cwd is `/app`; `/proc/<pid>/cwd` showing `/app` means the process is in Docker.
- `/proc/<pid>/environ` can show startup env, but `/health` is the better source for the app's effective provider status.
- If `/health` shows `contactProvider: "apollo"` after changing `/opt/connection/server/.env`, recreate the container with Compose.
- The server backup made during the RapidAPI switch was `/opt/connection/server/.env.bak-20260508001058`.
