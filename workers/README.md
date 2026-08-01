# Maildrill — Backend Service (`workers/`)

Part of the **web-maildrill-astro** root pnpm workspace (package name still
`workers`). Install once from the repo root — `pnpm install` covers
Astro and this tree (`workers`, `workers/packages/*`, `workers/apps/*`).

> **Start here for current architecture & ops:** [`HANDOFF.md`](HANDOFF.md)

Three Fastify apps (or one unified `dev-server`) + BullMQ workers on Postgres
(Drizzle) + Redis/Valkey:

- **Messaging** (`apps/api`) — submit/cancel/retry messages, webhook routes (kept
  for mock/tests; **Infobip DLRs should target PostHog**, not these routes).
- **Product** (`apps/product-api`) — subscribers, lists, segments, tags,
  templates, campaigns, media, stats, identity.
- **Workers** — dispatch, outbox publisher, scheduler, maintenance,
  **campaign-delivery** (PostHog HogQL → message/campaign completion),
  **template-approval** (Infobip poll for WA templates).

Visual editors stay in the parent Astro app. Longer design notes:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (webhook-centric sections are
**stale** — prefer HANDOFF + [`docs/posthog-infobip-hog.md`](docs/posthog-infobip-hog.md)).

## Stack

Fastify · BullMQ · Redis/Valkey · PostgreSQL · Drizzle · Pino · Zod · TypeScript ·
Vitest. Node on a VPS (not edge).

## Layout

```
apps/
  api                 messaging HTTP (:3000 alone)
  product-api         product HTTP (:3001 alone)
  email-builder-api   AI / Unsplash (:3100 alone)
  workers             role processes (see below)
  dev-server          unified local process (HTTP + core workers on :3001)
packages/
  config              zod env — loads monorepo **root** `../.env`
  database domain queues providers services product
  observability       pino, metrics, HogQL client
  authz identity httpkit
migrations/
docs/                 ARCHITECTURE, Infobip scheme, PostHog Hog
HANDOFF.md            canonical current architecture
```

## Quick start

Prereqs: Node 22, pnpm. Env at **repo root** (`../.env` from here).

```bash
# From monorepo root (recommended):
cp .env.example .env
pnpm install                    # installs Astro + workers together
pnpm --dir workers db:up        # Docker Postgres + Redis (or local)
pnpm --dir workers db:migrate
pnpm --dir workers dev          # unified :3001
# or: pnpm --filter workers dev

# Astro + workers together:
pnpm dev:all

# Or the whole stack in containers (repo root — web + workers + Postgres + Redis):
docker compose up --build
```

Split processes (prod-style):

```bash
pnpm start:api                  # :3000
pnpm start:product-api          # :3001
pnpm worker all                 # includes campaign-delivery + template-approval
```

Per-role:

```bash
pnpm worker dispatch
pnpm worker events
pnpm worker publisher
pnpm worker scheduler
pnpm worker maintenance
pnpm worker template-approval
pnpm worker campaign-delivery
```

> **Dev-server:** unified `pnpm dev` starts dispatch, events, publisher, scheduler,
> maintenance, **template-approval**, and **campaign-delivery**. Set `DEV_WORKERS=0`
> for HTTP-only.

## Delivery & analytics (locked)

```
Send → Infobip (callbackData: tenantId|channel|maildrillMessageId)
Infobip DLR/seen/voice → PostHog Hog only
campaign-delivery poller (~5s HogQL) → Postgres message + campaign "sent"
GET /v1/stats/activity → HogQL when POSTHOG_PERSONAL_API_KEY set (else Postgres)
```

Campaigns stay **`sending`** until all messages are terminal. Details:
[`docs/posthog-infobip-hog.md`](docs/posthog-infobip-hog.md).

Env (root `.env`): `POSTHOG_PERSONAL_API_KEY` (`query:read`),
`POSTHOG_PROJECT_ID=526344`, `POSTHOG_APP_HOST=https://us.posthog.com`,
`CAMPAIGN_DELIVERY_POLL_INTERVAL_MS` (default 5000).

## Try it

```bash
# submit (mock provider by default)
curl -sX POST localhost:3001/v1/messages \
  -H 'x-api-key: dev-key:dev-secret' -H 'content-type: application/json' \
  -d '{"channel":"email","to":"you@example.com","content":{"subject":"hi","html":"<p>hi</p>"}}'

# mock delivery webhook still works for local tests (not the Infobip prod path)
curl -sX POST 'localhost:3001/webhooks/mock/delivery?secret=change-me' \
  -H 'content-type: application/json' \
  -d '{"events":[{"messageId":"<providerMessageId>","status":"delivered","eventId":"e1"}]}'
```

## API docs

OpenAPI + Scalar:

- Messaging `:3000` → `/docs` · `/openapi.json` (standalone api)
- Product / unified `:3001` → `/docs` · `/openapi.json`

## Auth

`x-api-key: <id>:<secret>` (`API_KEYS`) or `Authorization: Bearer <HS256 JWT>`
(`tenantId`, `JWT_SECRET` shared with Astro). Tenant always from credential.

## Product routes (high level)

Subscribers, lists, segments, tags, templates, suppressions, media, campaigns
send, stats (`/v1/stats/activity`), custom fields, `/v1/me`, magic-link auth.
Campaign send → `submitMessage` (outbox → dispatch); status stays `sending` until
the delivery poller completes the campaign.

## Tests

```bash
pnpm test                       # unit (no infra)
RUN_E2E=1 pnpm test             # + Postgres + Redis
```

## Provider drivers

`PROVIDER_DRIVER=mock` (default) or `infobip` + Infobip credentials. Outbound
sends stamp Infobip `callbackData` for PostHog tenancy. See
`packages/providers/src/infobip.ts`.
