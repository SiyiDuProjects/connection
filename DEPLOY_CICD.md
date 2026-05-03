# CI/CD Deployment

This repo includes a GitHub Actions workflow that deploys only the `server/` folder to the VPS and rebuilds the existing Docker Compose service.

## What It Does

On every push to `main` that changes `server/**`:

```text
GitHub Actions
-> npm ci
-> node --check server files
-> rsync server/ to VPS
-> docker compose up -d --build connection_contacts
-> curl public health URL
```

The workflow does not upload `.env`, so production secrets stay on the server.

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

or update the workflow command to use `sudo docker compose`.

