# Maildrill (Astro)

Marketing website **and** authenticated campaign-workspace UI for **Maildrill**, built from the
Claude Design handoff as an **Astro** site with **React islands**.

> The fastest professional workspace to create, deliver and analyze campaigns.

Maildrill is a multichannel messaging workspace — **email, SMS, WhatsApp, and voice** — designed to
feel like _Linear meets Resend_, not an admin panel.

---

## Tech stack

| Layer          | Choice                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| Framework      | **Astro 7** — static-first marketing, islands architecture                           |
| SSR            | **@astrojs/node** (standalone) — app/auth/api routes opt in with `prerender = false` |
| Interactive UI | **React 19** — app shell, pricing estimator, forms                                   |
| Language       | **TypeScript** (strict, `astro/tsconfigs/strict`)                                    |
| Styling        | Hand-authored CSS + design tokens (CSS custom properties)                            |
| Content        | Astro **Content Collections** + **Zod** schemas                                      |
| Fonts          | **Geist** / **Geist Mono** (variable woff2)                                          |
| Tests          | **Vitest** (unit/integration) + **Playwright** (e2e)                                 |
| Quality gates  | ESLint (+ jsx-a11y) · Prettier · `astro check` · `tsc`                               |

---

## The brand system (read before touching styles)

Two accent roles, deliberately distinct — this is the single most important thing to get right:

- **`--brand` `#ff441f` (orange)** — identity accent: the logo mark + "drill" wordmark, nav/link
  hovers, active nav, star ratings, radial glows, small emphasis. **Not** button fills.
- **`--accent` `#4f46e5` (indigo)** — interactive accent: links, primary-CTA hover, the email
  channel, chart bars, the focus ring.
- **`--ink` `#1f1e1b`** — text + the **primary marketing CTA background** (an ink pill that turns
  indigo on hover). Inside the **app**, primary actions are solid indigo instead.

Surfaces are a **warm-cream** ramp (`--bg #f6f5f2`, `--surface #fff`). Dark bands (results, footer,
estimate card) use `--ink-band #15130d`. Channel colors: email indigo, SMS cyan, WhatsApp green,
voice amber — each with a matching tint. Display headings are Geist **800**; app headings are 600.

All tokens live in [`src/styles/tokens.css`](src/styles/tokens.css). Reuse them; never scatter raw
hex where a token exists.

---

## Architecture

This repo is a **monorepo**: Astro frontend + BFF at the root, messaging/product
backend under [`workers/`](workers/) (formerly the separate `workers`
repo). Env is shared at the **repo root** (`.env`). Backend handoff:
[`workers/HANDOFF.md`](workers/HANDOFF.md). Product overview: [`docs/PRODUCT.md`](docs/PRODUCT.md).
Agent guidance: [`docs/AGENTS.md`](docs/AGENTS.md) (also symlinked as root `AGENTS.md`).
Other project docs live in [`docs/`](docs/).

```
public/                 favicon, icons, OG image, robots, manifest
src/
  components/
    navigation/         Logo, MarketingNav, MarketingFooter
    react/              App shell, boards, wizards, forms, VisualEmailBuilder
    seo/ ui/ …
  config/ content/ layouts/ pages/ styles/ types/
  lib/
    app/                client API boundary (services → same-origin /api/v1)
    seo/ pricing-math.ts env.ts …
  middleware.ts         auth gate for /app + /dashboard
  pages/api/            BFF: JWT to workers, Auth.js helpers, EB proxy
packages/               vendored EmailBuilder.js (compiled from source)
workers/                Fastify + BullMQ + Drizzle (root workspace member)
  apps/{api,product-api,email-builder-api,workers,dev-server}
  packages/{config,database,domain,services,product,…}
  HANDOFF.md            current backend architecture & ops
tests/                  unit, integration, e2e
```

**Delivery analytics (locked):** Infobip DLRs → **PostHog Hog only** →
`campaign-delivery` worker HogQL-polls → Postgres message/campaign state.
In-app Analytics reads HogQL (Postgres fallback). See `workers/HANDOFF.md` §3.

### Astro / React hydration strategy

Marketing content, navigation, and CTAs are **pure Astro + CSS** and render fully without JS.
JavaScript is opt-in per island, with the cheapest directive that works:

| Surface                         | Hydration        | Why                                                                                                 |
| ------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| Every marketing page body       | none             | static HTML; SEO + zero JS cost                                                                     |
| Marketing motion module         | bundled script   | reveal, count-up, split headings, scramble, card hover, tilt, scroll-progress — reduced-motion safe |
| Marketing mobile nav            | `client:idle`    | only needed after first paint                                                                       |
| Pricing calculator              | `client:visible` | below the fold; hydrate when scrolled                                                               |
| Auth / contact forms            | `client:load`    | the sole purpose of those pages                                                                     |
| App shell (sidebar/topbar/⌘K)   | `client:idle`    | interactive chrome for `/dashboard/*` only                                                          |
| App screens (dashboard, boards) | `client:visible` | nested inside the shell                                                                             |

No marketing route ships page-wide React hydration.

---

## Route map

### Marketing (indexed)

- `/` — Home
- `/product` — Product (with `#channels` anchor)
- `/channels/{email,sms,whatsapp,voice}` — per-channel pages
- `/pricing` — Pricing + interactive estimator + FAQ
- `/deliverability` — Deliverability
- `/developers` — API docs (marketing)
- `/about` · `/contact` · `/support`
- `/blog`, `/blog/[slug]`
- `/guides`, `/guides/[slug]`
- `/legal/privacy`, `/legal/terms`

### Auth (noindex)

- `/login` · `/signup` · `/forgot-password`

### App (noindex, SSR, session-gated)

- `/dashboard` — Overview
- `/dashboard/{campaigns,templates,lists,subscribers,media,analytics,settings,profile}`
- `/dashboard/campaigns/[id]/report` — campaign report
- `/dashboard/lists/[id]` · `/dashboard/subscribers/[id]` — detail pages
- `/dashboard/templates/{email,sms,whatsapp,voice}` — per-channel template builders
  (email: vendored EmailBuilder.js; WhatsApp: wa-template-studio with Meta approval)

### System

- `/404` · `/robots.txt` · `/sitemap-index.xml` · `/rss.xml`
- Redirects: `/privacy-policy → /legal/privacy`, `/terms-of-service → /legal/terms`

---

## Setup

```bash
pnpm install
cp .env.example .env          # one file for Astro + workers
pnpm --dir workers db:up      # Docker Postgres + Redis (or point .env at your own)
pnpm --dir workers db:migrate
pnpm dev:all                  # product :3001 · messaging :3002 · EB :3003 · workers, then Astro :4321
# or separately: pnpm --filter workers dev   +   pnpm dev
# or the whole stack in containers: docker compose up --build
```

`pnpm --dir workers dev` (unified `dev-server`) starts dispatch, events, publisher,
scheduler, maintenance, **campaign-delivery**, and **template-approval**. Set
`DEV_WORKERS=0` to serve HTTP only. One root `pnpm install` covers Astro and
`workers/` (no second install under `workers/`).

### Environment variables

| Variable                       | Client? | Purpose                                               |
| ------------------------------ | ------- | ----------------------------------------------------- |
| `PUBLIC_SITE_URL`              | yes     | Canonical base, sitemap, OG                           |
| `PUBLIC_POSTHOG_PROJECT_TOKEN` | yes     | Browser PostHog project token (`phc_…`)               |
| `PUBLIC_POSTHOG_HOST`          | yes     | PostHog ingest host                                   |
| `AUTH_SECRET`                  | **no**  | Auth.js session                                       |
| `API_BASE_URL`                 | **no**  | workers product-api (default `http://localhost:3001`) |
| `MESSAGING_API_BASE_URL`       | **no**  | messaging API when split (default: same as `API_BASE_URL`) |
| `EB_API_BASE_URL`              | **no**  | email-builder API when split (default: same as `API_BASE_URL`) |
| `JWT_SECRET`                   | **no**  | Shared with workers — BFF mints tenant JWTs           |
| `DATABASE_URL` / `REDIS_URL`   | **no**  | workers (same root `.env`)                            |
| `POSTHOG_PERSONAL_API_KEY`     | **no**  | HogQL for stats + campaign-delivery (`query:read`)    |
| `POSTHOG_PROJECT_ID`           | **no**  | Maildrill messaging project (`526344`)                |

Only `PUBLIC_*` reach the browser. Full list: [`.env.example`](.env.example). Server
helpers: [`src/lib/env.ts`](src/lib/env.ts). Backend config: `workers/packages/config`.

---

## Commands

```bash
pnpm dev             # Astro only (:4321)
pnpm dev:workers     # unified Fastify + BullMQ on :3001 (single process)
pnpm dev:all         # split backends (:3002/:3001/:3003 + workers), then Astro
pnpm build           # production build (compiles vendored editor)
pnpm check           # astro check (authoritative type gate)
pnpm typecheck       # astro check && tsc --noEmit
pnpm lint            # eslint (+ jsx-a11y)
pnpm test            # vitest
pnpm test:e2e        # playwright
```

Recommended validation order:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
npx playwright install chromium   # once
npm run test:e2e
```

---

## Content workflow

1. Add Markdown under `src/content/{blog,guides,legal}`.
2. Frontmatter must satisfy the schema in [`src/content.config.ts`](src/content.config.ts).
3. `draft: true` excludes a file from production listings/routes.
4. Blog posts appear in `/rss.xml` automatically.

---

## SEO

- Reusable `SeoHead` + `resolveSeo()` — title template, description, canonical, robots, Open Graph,
  Twitter card, article dates/author.
- Page-specific JSON-LD helpers ([`src/lib/seo/structured-data.ts`](src/lib/seo/structured-data.ts)):
  Organization, WebSite, SoftwareApplication, Product, Service, FAQPage, BreadcrumbList, BlogPosting,
  Person — each applied only where it matches visible content (no fabricated ratings/prices).
- `robots.txt`, XML sitemap, web manifest, favicons, RSS, custom 404, and redirects are all wired.

---

## Integration boundaries

Workspace UI talks to **same-origin** `/api/v1/*` (Astro BFF), which mints a tenant
JWT and forwards to `workers/` (`API_BASE_URL`). Prefer the client helpers in
[`src/lib/app/`](src/lib/app/) over ad-hoc `fetch` in components.

Auth is passwordless (login code); see [`docs/PRODUCT.md`](docs/PRODUCT.md) for current
rollout caveats. Backend ops and Infobip→PostHog setup: [`workers/HANDOFF.md`](workers/HANDOFF.md).

---

## Deployment

`astro build` produces a **Node server** (`dist/server/entry.mjs`, `@astrojs/node` standalone —
it also serves the prerendered marketing pages and client assets) plus the `workers/` backend
processes. **Always build with `PUBLIC_SITE_URL` set to the deploy origin** so canonicals, the
sitemap, robots.txt, OG tags, and RSS all agree. Note that `API_BASE_URL` is **baked into the SSR
bundle at build time** — set it before building.

### Ploi VPS (current)

Two moving parts behind nginx, each run as Ploi daemons (Supervisor):

- **Astro SSR** — `node dist/server/entry.mjs` (`HOST`/`PORT` env; nginx proxies to it).
- **workers backend** — Fastify APIs + BullMQ workers; see
  [`workers/deploy/README.md`](workers/deploy/README.md) for the daemon layout, discovery-based
  restarts, and the traps already hit once (login shell, supervisor env, directory).

The site deploy script is [`deploy/ploi-deploy.sh`](deploy/ploi-deploy.sh) (git pull → pnpm
install → build → restart daemons). Infobip webhooks target PostHog, not this host — see
`workers/HANDOFF.md` §3.

### Docker (full stack)

[`docker-compose.yml`](docker-compose.yml) runs the production-style split from one
image ([`Dockerfile`](Dockerfile)):

```bash
docker compose up --build
# web http://localhost (:80) · product-api :3001 · messaging-api :3002 · email-builder-api :3003
# (+ Postgres, Redis, BullMQ workers; migrate runs once before APIs)
```

Startup order: Postgres/Redis healthy → `migrate` → APIs in parallel → BullMQ
`workers` (after product + messaging ready) → `web` (after all three APIs ready).

Containers run `NODE_ENV=production`, so the root `.env` must carry strong (non-`change-me`)
`JWT_SECRET` and `WEBHOOK_INFOBIP_SECRET` values or the backends refuse to boot. Also set
`AUTH_SECRET`, `SECURITY_ENCRYPTION_KEY` (before enabling 2FA), and Cloudflare SMTP
(`SMTP_HOST`/`USER`/`PASS` on port **465**). Passkeys need `WEBAUTHN_RP_ID` /
`WEBAUTHN_ORIGINS` matching the public site URL.

The Astro BFF uses `API_BASE_URL` (product), optional `MESSAGING_API_BASE_URL`, and
optional `EB_API_BASE_URL`. Compose sets the in-network hostnames automatically;
local `pnpm dev` can leave the split URLs unset (they fall back to `:3001`).

---

## Assumptions & known placeholders

1. **Stack** — Astro frontend + `workers/` Fastify backend in this repo (see `docs/PRODUCT.md` /
   `workers/HANDOFF.md`). Older Laravel/Livewire notes are historical only.
2. **Brand** — `#ff441f` orange identity; indigo is the interactive accent.
3. **Voice** — first-class channel across marketing + app.
4. **Auth** — passwordless login code against Postgres; signup is waitlist-gated (see `docs/PRODUCT.md` §4).
5. **Fonts** — Geist from jsDelivr with `font-display: swap`; self-host via `public/fonts/` if needed.
