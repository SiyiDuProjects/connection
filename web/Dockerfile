# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY web/ ./
RUN --mount=type=secret,id=heroui_key,required=true \
    HEROUI_KEY="$(cat /run/secrets/heroui_key)" node scripts/install-reviewed-pro.mjs
RUN node scripts/check-pro-install.mjs && pnpm test:contacts
ARG RELEASE_SHA
ENV REACHARD_BUILD_SHA=$RELEASE_SHA NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_WEB_BASE_URL=https://reachard.co NEXT_PUBLIC_API_BASE_URL=https://reachard.co
RUN AUTH_SECRET=build-only-placeholder-at-least-32-characters \
    BASE_URL=https://reachard.co POSTGRES_URL=postgresql://build:build@127.0.0.1:1/build \
    STRIPE_SECRET_KEY=sk_test_build STRIPE_WEBHOOK_SECRET=whsec_build pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ARG RELEASE_SHA
LABEL org.opencontainers.image.revision=$RELEASE_SHA
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=127.0.0.1 PORT=8787
ENV REACHARD_BUILD_SHA=$RELEASE_SHA REACHARD_CONTACTS_ENABLED=1 REACHARD_TRUST_CLOUDFLARE_PROXY=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(async r=>{if(!r.ok||!(await r.json()).ready)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
