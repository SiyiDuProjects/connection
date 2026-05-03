# Deploy With Existing Sub2Api

This project can run on the same VPS as Sub2Api. Use separate local ports and separate Cloudflare Tunnel public hostnames.

## Target Shape

```text
sub2api.your-domain.com   -> http://localhost:8080
contacts.your-domain.com  -> http://localhost:8787
```

Sub2Api keeps using port `8080`. This LinkedIn contacts API uses port `8787`.

## Cloudflare Tunnel

In the same Cloudflare Tunnel, add a second Public Hostname:

```text
Subdomain: contacts
Domain: your-domain.com
Type: HTTP
URL: http://localhost:8787
```

Keep the existing Sub2Api hostname:

```text
Subdomain: sub2api
Domain: your-domain.com
Type: HTTP
URL: http://localhost:8080
```

No public VPS port needs to be opened when Cloudflare Tunnel is used.

## Server Env

Create `/opt/connection/server/.env`:

```env
PORT=8787
CONTACT_PROVIDER=explorium
APOLLO_API_KEY=your_apollo_api_key
APOLLO_MOCK=true
EXPLORIUM_API_KEY=your_explorium_api_key
EXTENSION_ORIGIN=chrome-extension://your-real-extension-id
GMAIL_SUBJECT_PREFIX=Quick question from a Berkeley student
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

Use Explorium for the live provider:

```env
CONTACT_PROVIDER=explorium
APOLLO_MOCK=false
EXPLORIUM_API_KEY=your_explorium_api_key
```

Use mock mode only for UI testing:

```env
APOLLO_MOCK=true
```

Use Apollo only if Apollo API access is upgraded:

```env
CONTACT_PROVIDER=apollo
APOLLO_MOCK=false
APOLLO_API_KEY=your_apollo_api_key
```

## Option A: Add To Existing Docker Compose

If your current compose file is `~/muxing/docker-compose.yml`, add this service next to `muxing` and `cloudflared`:

```yaml
  connection_contacts:
    build: /opt/connection/server
    container_name: connection_contacts
    restart: always
    network_mode: "host"
    env_file:
      - /opt/connection/server/.env
```

Then run:

```bash
cd ~/muxing
docker compose up -d --build connection_contacts
docker logs -f connection_contacts
```

Health check:

```bash
curl http://localhost:8787/health
```

## Option B: Run With PM2

```bash
cd /opt/connection/server
npm install --omit=dev
npm install -g pm2
pm2 start src/index.js --name connection-contacts
pm2 save
pm2 startup
```

Health check:

```bash
curl http://localhost:8787/health
```

## Extension Setting

In the Chrome Extension options page, set:

```text
https://contacts.your-domain.com
```

Then click Save and allow the requested host permission.
