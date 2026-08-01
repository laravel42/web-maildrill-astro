# syntax=docker/dockerfile:1
# One image for both runtime processes:
#   web     → node dist/server/entry.mjs           (Astro SSR, @astrojs/node standalone)
#   workers → pnpm --dir workers start             (unified Fastify APIs + BullMQ workers, runs from source via tsx)
# The workers run uncompiled and the Astro server keeps runtime deps external
# (nodemailer, sharp), so both need the full workspace + node_modules — hence a
# single image with the command chosen per service in docker-compose.yml.

FROM node:22-bookworm-slim

# corepack picks up the pinned pnpm from package.json's `packageManager`.
RUN corepack enable
WORKDIR /app

# Fetch packages from the lockfile alone so the download layer survives source
# edits, then install offline once the workspace manifests are in place.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline

# Build-time configuration. Non-PUBLIC vars used by the BFF (API_BASE_URL) are
# baked into the SSR bundle at build; PUBLIC_* land in the browser bundle.
# Empty PUBLIC_SITE_URL falls back to siteConfig.url in astro.config.ts.
ARG API_BASE_URL=http://workers:3001
ARG PUBLIC_SITE_URL=
ARG PUBLIC_POSTHOG_PROJECT_TOKEN=
ARG PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV API_BASE_URL=$API_BASE_URL \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_POSTHOG_PROJECT_TOKEN=$PUBLIC_POSTHOG_PROJECT_TOKEN \
    PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST

RUN pnpm run build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

EXPOSE 4321 3001

# Default command is the Astro server; compose overrides it for workers.
CMD ["node", "dist/server/entry.mjs"]
