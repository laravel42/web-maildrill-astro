# Maildrill — Product, Tech Stack & Infrastructure

> The fastest professional workspace to create, deliver, and analyze campaigns.

Maildrill is a **multichannel messaging workspace** — email, SMS, WhatsApp, and
voice from one place — paired with a marketing site. It is designed to feel like
_Linear meets Resend_, not an admin panel.

This document describes **what the product is** (specifications), **what it's
built with** (tech stack), and **how it runs** (infrastructure). For brand/design
rules see [`../README.md`](../README.md). For the messaging backend (ops, Infobip →
PostHog, campaign-delivery poller) see [`../workers/HANDOFF.md`](../workers/HANDOFF.md)
— the backend lives in [`../workers/`](../workers/) (formerly the separate
`workers` repo).

---

## 1. Product specification

### 1.1 What it is

Two surfaces served from one Astro app:

- **Marketing site** — home, product, channels, pricing, deliverability, blog,
  guides, legal, support, contact. Static-first, SEO-driven.
- **Authenticated workspace** (`/dashboard/*`) — the campaign product (SSR, session-gated).

### 1.2 Channels

| Channel  | Accent | Purpose                          |
| -------- | ------ | -------------------------------- |
| Email    | Indigo | Rich campaigns via visual editor |
| SMS      | Cyan   | Short transactional/marketing    |
| WhatsApp | Green  | Conversational messaging         |
| Voice    | Amber  | Voice calls / drops              |

One audience, one workspace, every channel. Lists and subscribers are shared
across channels; a subscriber is addressed by `email` and/or `phone`.

### 1.3 Workspace screens

| Screen          | Capabilities                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**   | Workspace summary + per-channel breakdown, 30-day activity, recent campaigns                                                                                                                |
| **Campaigns**   | Create/edit, draft→send lifecycle, status-guarded dispatch (no double-send), dedicated report page (`/campaigns/[id]/report`)                                                               |
| **Templates**   | Per-channel builder pages — email (visual EmailBuilder.js + AI generation), SMS/Voice (composer), WhatsApp (wa-template-studio with Meta approval: submit, status polling, approval badges) |
| **Subscribers** | CRM view, add/edit (email, phone, name, status, tags), bulk actions, segments, detail page with pins + GDPR/consent badges                                                                  |
| **Lists**       | List CRUD, membership, consent + lifecycle fields, workspace-wide custom fields, member counts, detail page (`/lists/[id]`)                                                                 |
| **Segments**    | Rule-based (field + op + value) compiled to SQL `EXISTS`; membership counts                                                                                                                 |
| **Media**       | S3-backed asset library (presigned upload, CloudFront delivery)                                                                                                                             |
| **Analytics**   | Daily activity + channel-aware breakdown (PostHog HogQL when configured; else PG)                                                                                                           |
| **Profile**     | Account profile + workspace membership                                                                                                                                                      |
| **Settings**    | Workspace/account settings                                                                                                                                                                  |

### 1.4 Personalization (merge tags)

Templates use `{{…}}` merge tags substituted per-subscriber at send time:
`{{name}}`, `{{email}}`, `{{phone}}`, and `{{attributes.<key>}}` for workspace
custom fields. The editor's merge-tag menu is populated from the real custom-field
schema, not placeholders.

### 1.5 Auth & access (open registration)

- **Passwordless** — email a **magic link + 6-digit code**; no passwords.
- **Login is open** — any address can request a code; verifying it signs in.
- **Sign-up** is the same code exchange plus profile capture (name + email +
  phone + terms → "Start free trial" → enter the 6-digit code). The first
  verified code **creates the account + personal workspace** and lands in the
  dashboard; name and phone travel through the credentials → verify path onto
  the new user row (shown read-only on the Profile page).
- **Welcome email** is sent by the backend when an account is created (any
  entry path), over the Cloudflare relay. Sign-up also fires an internal
  notification to `SIGNUP_NOTIFY_TO` via `/api/signup-welcome`.

### 1.6 Pricing

Public pricing uses **fixed regional tiers** (`REGION_TIERS`), positioned ~10%
under Twilio/SendGrid, generated into `pricing-rates.json`. Infobip's internal
negotiated rate card is **not** exposed by any API — it is scraped offline
(`scripts/sync-infobip-rates.mjs`) and kept out of the repo.

**Billing** is prepaid credits: each workspace owns a wallet (micro-USD,
immutable ledger in Postgres), tops up via **Stripe Checkout** (packages +
commitment tiers are DB-configured), and consumption draws the balance per
delivered message at the channel rate card. Stripe handles payments, portal,
taxes, and invoices only — never balances. Enforcement (reserve → commit →
release around sends) is off by default (`BILLING_ENFORCEMENT`). See
[`../workers/docs/billing-architecture.md`](../workers/docs/billing-architecture.md).

---

## 2. Tech stack

### 2.1 Frontend (`web-maildrill-astro`)

| Layer           | Choice                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | **Astro 7** — static-first marketing + islands; SSR via node adapter (`mode: standalone`); pages opt into SSR with `export const prerender = false` |
| Interactive UI  | **React 19** islands (`@astrojs/react`)                                                                                                             |
| Language        | **TypeScript 6** (pinned < 7 — TS 7 breaks `astro check` + typescript-eslint)                                                                       |
| Styling         | Hand-authored **CSS + design tokens** (`src/styles/tokens.css`) and CSS Modules; no utility framework                                               |
| Fonts           | **Geist** / **Geist Mono** (variable woff2)                                                                                                         |
| Content         | Astro **Content Collections** + **Zod 4** schemas (blog/guides/legal)                                                                               |
| Auth            | **auth-astro** (`@auth/core`) — session + credentials                                                                                               |
| Backend client  | **openapi-fetch** + **openapi-typescript** (typed client generated from the backend OpenAPI)                                                        |
| Email (in-repo) | **Nodemailer** → Cloudflare Email Service SMTP relay — transactional sender (welcome, sign-up notify)                                               |
| SEO             | `@astrojs/sitemap`, `@astrojs/rss`, JSON-LD structured data                                                                                         |
| Tests           | **Vitest** (unit/integration) + **Playwright** (e2e)                                                                                                |
| Quality gates   | ESLint 10 (+ jsx-a11y) · Prettier · `astro check` · `tsc`                                                                                           |

### 2.2 Email editor (vendored)

**EmailBuilder.js** is vendored into `packages/*` (`email-builder-standalone`,
`document-core`, `email-builder`, and eight `block-*` packages) and **compiled
from source** rather than consumed as a prebuilt npm package — so it can be
patched and restyled in place. Uses MUI 9, zustand 5, react-dnd, tiptap, zod 4.
See [`../packages/VENDOR.md`](../packages/VENDOR.md) for the (few, documented) patches.

### 2.3 Backend (`workers/` — package name `workers`)

| Layer      | Choice                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| Runtime    | Node 22, **pnpm workspace** monorepo, `tsx`                                         |
| HTTP       | **Fastify 5** (+ `@fastify/swagger` OpenAPI, `@fastify/cors`, `@fastify/multipart`) |
| Validation | **Zod 3** (via a Fastify zod type-provider)                                         |
| Database   | **PostgreSQL** via **Drizzle ORM** (+ `drizzle-kit` migrations)                     |
| Queue      | **BullMQ 5** on **Redis** (`ioredis`)                                               |
| Storage    | **AWS S3** (`@aws-sdk/client-s3` + presigned PUT)                                   |
| Logging    | **pino**                                                                            |
| Providers  | **Infobip** (delivery) + a network-free **mock** provider                           |

Workspace layout:

```
apps/
  product-api       # workspace/product API (auth, campaigns, lists, subscribers,
                    #   segments, templates, tags, media, stats, custom-fields, me)
  api               # messaging + webhook ingestion API (messages, webhooks, admin)
  email-builder-api # EmailBuilder.js AI/image backend (generate, images, unsplash…)
  workers           # BullMQ workers (dispatch/send)
  dev-server        # single process mounting product + messaging + EB routes + workers
packages/
  authz  config  database  domain  httpkit  identity
  observability  product  providers  queues  services
```

---

## 3. Infrastructure & architecture

### 3.1 Topology

```
┌──────────────┐  same-origin   ┌────────────────────┐  JWT / API key  ┌─────────────────┐
│   Browser    │ ─────────────► │ Astro (BFF+SSR)    │ ──────────────► │ workers/        │
│ React islands│  /api/v1/*     │ Auth.js · SMTP     │                 │ Fastify+BullMQ  │
└──────────────┘                └────────────────────┘                 └────────┬────────┘
                                                                                │
                              ┌─────────────┬─────────────┬─────────────────────┼──────────┐
                              ▼             ▼             ▼                     ▼          ▼
                         Postgres       Redis         Infobip              PostHog     S3/CDN
                       (system of     (BullMQ)    (send + DLR notify     (Hog ingest
                        record)                    → PostHog only)        + HogQL)
```

### 3.2 The BFF pattern

The browser never holds a service credential. Islands call **same-origin**
`/api/*` routes on the Astro server, which:

1. Reads the Auth.js session (via middleware).
2. Mints a **tenant-scoped JWT** (shared `JWT_SECRET`) and forwards to
   `workers/` product-api (`API_BASE_URL`, default `http://localhost:3001`).
3. Streams the response back.

Public/unauthenticated endpoints (`/api/login-code`, `/api/signup-welcome`) run
server-side and never expose provider keys to the client.

### 3.3 Data architecture

- **PostgreSQL is the system of record.** Infobip is **delivery-only** (using it
  as a datastore was evaluated and rejected).
- **Tenancy** is **shared-schema + `tenant_id`** (every row is tenant-scoped).
- **Subscriber attributes** are a single flat `jsonb` bag; **custom fields** are
  workspace-wide definitions (`custom_field_defs`, unique on `tenant_id + key`).

### 3.4 Messaging pipeline

1. A send writes to a **transactional outbox** and enqueues a **BullMQ** job with
   a **deterministic job id** (generation-scoped; ids must not contain `:`).
2. **Workers** dispatch through the provider (`getProvider()` → Infobip or mock).
   Infobip sends stamp `callbackData` = `{tenantId}|{channel}|{maildrillMessageId}`.
3. **Delivery reports:** Infobip notify → **PostHog Hog only** (not Maildrill
   webhooks in production). The **`campaign-delivery`** worker HogQL-polls
   PostHog (~5s), applies message outcomes, and when every campaign message is
   terminal flips the campaign from **`sending`** → **`sent`**.
4. **Analytics:** `GET /v1/stats/activity` prefers PostHog HogQL
   (`POSTHOG_PERSONAL_API_KEY`); falls back to Postgres.
5. `sendCampaign` is guarded by `claimForSending` (no double-send) and leaves the
   campaign in **`sending`** until the poller completes it (empty audience →
   immediate `sent`).

Transactional emails (login code, welcome) are routed through the **Cloudflare
Email Service SMTP relay** (`smtp.mx.cloudflare.net`, shared `SMTP_*`/`MAIL_FROM`
env, domain `maildrill.net`) — never through Infobip or the campaign pipeline.
**Infobip carries campaign email only.** Full ops checklist: [`../workers/HANDOFF.md`](../workers/HANDOFF.md).

### 3.5 Media

Presigned **S3** PUT for uploads (`createUploadTicket` → `confirmUpload`),
delivered via **CloudFront**. Requires `AWS_REGION`, `MEDIA_S3_BUCKET`,
`MEDIA_CDN_DOMAIN` + bucket CORS for `PUT` from the app origin.

### 3.6 Configuration (env)

| Where              | Key vars                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Shared root `.env` | One file for Astro + workers (see `.env.example`)                                          |
| Frontend           | `PUBLIC_SITE_URL`, `AUTH_SECRET`, `JWT_SECRET`, `API_BASE_URL`, `PUBLIC_POSTHOG_*`         |
| Frontend SMTP      | `SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM`                                             |
| Backend            | `DATABASE_URL`, `REDIS_URL`, `PROVIDER_DRIVER`, `INFOBIP_*`, `API_KEYS`, AWS/media         |
| PostHog query      | `POSTHOG_PERSONAL_API_KEY` (`query:read`), `POSTHOG_PROJECT_ID=526344`, `POSTHOG_APP_HOST` |

Secrets live only in gitignored `.env` — never committed. `/design` is local-only
and gitignored.

### 3.7 Deployment

- **Ploi VPS (current)** — Astro SSR (`node dist/server/entry.mjs`) and the workers
  processes run as Ploi daemons behind nginx. Site script:
  [`../deploy/ploi-deploy.sh`](../deploy/ploi-deploy.sh); backend daemon layout and
  restart mechanics: [`../workers/deploy/README.md`](../workers/deploy/README.md).
- **Docker** — [`../docker-compose.yml`](../docker-compose.yml) runs web + unified
  workers + Postgres + Redis from one image (`../Dockerfile`); workers run
  migrations on boot. Production mode requires strong `JWT_SECRET` and
  `WEBHOOK_INFOBIP_SECRET` values in the root `.env`.

---

## 4. Current state & caveats

These reflect how the system behaves **today**, not the end goal:

- **Login and registration are open** — any address can request a code; the
  first verified code self-provisions the account + personal workspace (§1.5).
- **Welcome email** is sent by `workers/` on account creation, over the
  Cloudflare relay. The frontend's `/api/signup-welcome` now only sends the
  internal team notification (in-repo SMTP; logged no-op when unconfigured).
- **Auth requires `workers/`** (code storage + verify + session live in
  Postgres); the login-code email goes out via the Cloudflare relay, not
  Infobip.
- **Infobip** delivery is wired against the live account (WhatsApp template
  approval and voice preview run through it); `PROVIDER_DRIVER=mock` stays the
  dev default so local campaign work sends nothing real. Transactional email
  ignores the provider driver — it sends whenever `SMTP_*` is configured.
- The **API docs** page (`/developers`) is hidden for now (redirects home,
  excluded from nav/sitemap).

---

## 5. Repositories / paths

| Path                              | Role                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `web-maildrill-astro` (this repo) | Marketing + workspace UI + BFF + vendored editor + `workers/`                                             |
| `workers/`                        | Fastify + BullMQ + Drizzle backend (was `workers`) — see [`../workers/HANDOFF.md`](../workers/HANDOFF.md) |
| `web-email-builder-js`            | Upstream EmailBuilder.js (vendored into `packages/`)                                                      |
