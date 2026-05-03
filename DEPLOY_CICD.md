# CI/CD Deployment

This repo includes a GitHub Actions workflow that deploys only the `server/` folder to the VPS and rebuilds the existing Docker Compose service.

## What It Does

On every push to `main` that changes `server/**` or `.github/workflows/deploy-server.yml`:

```text
GitHub Actions
-> npm ci
-> node --check server files
-> rsync server/ to VPS
-> docker compose up -d --build connection_contacts
-> curl public health URL
```

The workflow does not upload `.env`, so production secrets stay on the server.

You can also run it manually from GitHub Actions with `workflow_dispatch`.

## Required GitHub Secrets

In GitHub repo settings, add:

```text
SSH_HOST=your_server_ip_or_hostname
SSH_PORT=22
SSH_USER=your_deploy_user
SSH_KEY=private SSH key for that deploy user
DEPLOY_PATH=/opt/connection/server
COMPOSE_PATH=/root/muxing
PUBLIC_HEALTH_URL=https://contacts.gaid.studio/health
```

Adjust paths if your server uses a different user or project directory.

## One-Time VPS Setup

Install Docker, create the deploy folder, and keep production env on the server:

```bash
sudo mkdir -p /opt/connection/server
sudo chown -R deployer:deployer /opt/connection
nano /opt/connection/server/.env
```

If your current Compose project lives in `/root/muxing`, make sure the Compose file contains this service:

```yaml
  connection_contacts:
    build: /opt/connection/server
    container_name: connection_contacts
    restart: always
    network_mode: "host"
    env_file:
      - /opt/connection/server/.env
```

Run the service once manually before relying on CI/CD:

```bash
cd /root/muxing
docker compose up -d --build connection_contacts
docker logs --tail=80 connection_contacts
curl http://localhost:8787/health
```

## Server Requirements

The server must already have:

```text
Docker
Docker Compose
cloudflared tunnel
~/muxing/docker-compose.yml with connection_contacts service
/opt/connection/server/.env
```

Your production `.env` should contain:

```env
PORT=8787
CONTACT_PROVIDER=explorium
APOLLO_MOCK=false
EXPLORIUM_API_KEY=your_explorium_api_key
EXTENSION_ORIGIN=
GMAIL_SUBJECT_PREFIX=Quick question from a Berkeley student
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

## Deploy User

Create a deploy user and add its SSH public key:

```bash
adduser deployer
usermod -aG sudo deployer
mkdir -p /home/deployer/.ssh
nano /home/deployer/.ssh/authorized_keys
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys
chown -R deployer:deployer /home/deployer/.ssh
```

If Docker requires sudo for this user, either add the user to the `docker` group:

```bash
usermod -aG docker deployer
```

Then log out and log back in as `deployer` so the new group membership is active.

## Daily Deployment

After the one-time setup:

```bash
git add server .github/workflows/deploy-server.yml DEPLOY_CICD.md
git commit -m "Add contacts server CI/CD"
git push origin main
```

The workflow will deploy automatically. Changes under `extension/**` alone do not trigger server deployment.

## Troubleshooting

- If `Configure SSH` fails, check `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY`, and the deploy user's `authorized_keys`.
- If `Sync server files` fails, check `DEPLOY_PATH` permissions.
- If `Rebuild container` fails, SSH into the VPS and run `docker compose config` inside `COMPOSE_PATH`.
- If `Health check` fails, check `PUBLIC_HEALTH_URL`, Cloudflare Tunnel routing, and `docker logs connection_contacts`.
