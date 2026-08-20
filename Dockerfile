# syntax=docker/dockerfile:1
# One image for every runtime process (command chosen per Compose service):
#   web               → node dist/server/entry.mjs   (Astro SSR)
#   migrate           → pnpm --dir workers db:migrate
#   seed              → pnpm --dir workers db:seed   (opt-in compose profile)
#   product-api       → pnpm --dir workers start:product-api   (:3001)
#   messaging-api     → pnpm --dir workers start:api           (:3002)
#   email-builder-api → pnpm --dir workers start:email-builder-api (:3003)
#   workers           → pnpm --dir workers worker all          (BullMQ)
#
# Backends run uncompiled via tsx; the Astro server keeps runtime deps external
# (nodemailer, sharp), so both need the full workspace + node_modules — hence a
# single image. Compose runs migrate once before APIs/workers start; the seed
# service reuses the image behind a profile (it is destructive — see compose).

FROM node:24-bookworm-slim

# Outbound TLS (Cloudflare SMTP :465, Infobip, PostHog, S3) and sharp's native deps.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# corepack picks up the pinned pnpm from package.json's `packageManager`.
RUN corepack enable
WORKDIR /app

# Fetch packages from the lockfile alone so the download layer survives source
# edits, then install offline once the workspace manifests are in place.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline

# Build-time configuration. Non-PUBLIC vars used by the BFF are baked into the
# SSR bundle; PUBLIC_* land in the browser bundle. Compose also sets these at
# runtime (process.env wins over import.meta.env in the BFF helpers).
ARG API_BASE_URL=http://product-api:3001
ARG MESSAGING_API_BASE_URL=http://messaging-api:3002
ARG EB_API_BASE_URL=http://email-builder-api:3003
ARG PUBLIC_SITE_URL=
ARG PUBLIC_POSTHOG_PROJECT_TOKEN=
ARG PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV API_BASE_URL=$API_BASE_URL \
    MESSAGING_API_BASE_URL=$MESSAGING_API_BASE_URL \
    EB_API_BASE_URL=$EB_API_BASE_URL \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_POSTHOG_PROJECT_TOKEN=$PUBLIC_POSTHOG_PROJECT_TOKEN \
    PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST

RUN pnpm run build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

EXPOSE 4321 3002 3001 3003

# Default command is the Astro server; compose overrides for backend services.
CMD ["node", "dist/server/entry.mjs"]
