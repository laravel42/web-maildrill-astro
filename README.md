# Maildrill (Astro)

Marketing website **and** authenticated campaign-workspace UI for **Maildrill**, built from the
Claude Design handoff as an **Astro** site with **React islands**.

> The fastest professional workspace to create, deliver and analyze campaigns.

Maildrill is a multichannel messaging workspace — **email, SMS, WhatsApp, and voice** — designed to
feel like _Linear meets Resend_, not an admin panel.

---

## Tech stack

| Layer          | Choice                                                     |
| -------------- | ---------------------------------------------------------- |
| Framework      | **Astro 5** — static-first marketing, islands architecture |
| Interactive UI | **React 19** — app shell, pricing estimator, forms         |
| Language       | **TypeScript** (strict, `astro/tsconfigs/strict`)          |
| Styling        | Hand-authored CSS + design tokens (CSS custom properties)  |
| Content        | Astro **Content Collections** + **Zod** schemas            |
| Fonts          | **Geist** / **Geist Mono** (variable woff2)                |
| Tests          | **Vitest** (unit/integration) + **Playwright** (e2e)       |
| Quality gates  | ESLint (+ jsx-a11y) · Prettier · `astro check` · `tsc`     |

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

```
public/                 favicon (orange drill mark), icons, OG image, robots, manifest
src/
  components/
    navigation/         Logo, MarketingNav (dropdowns), MarketingFooter
    react/              Interactive islands (AppShell, PricingEstimator, AuthForm,
                        ContactForm, MobileNav, App{Dashboard,Campaigns,…}, Icon)
    seo/                SeoHead, JsonLd
    ui/                 Button, Badge, Container, Section, Icon (curated inline SVGs)
  config/               site, routes, navigation, channels, channel-pages, pricing (+rates)
  content/              blog, guides, legal (Content Collections)
  layouts/              Base, Marketing, Auth, App
  lib/
    app/                mock data + services (the API integration boundary)
    seo/                metadata + JSON-LD helpers
    icons.ts            framework-agnostic icon path data + IconName type
    pricing-math.ts     pure, unit-tested estimator math
    env.ts              typed env access
  pages/                marketing, auth, app/*, rss, 404
  styles/               tokens.css · global.css · components.css · app.css
  types/                domain types
tests/                  unit, integration, e2e
```

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
| App shell (sidebar/topbar/⌘K)   | `client:idle`    | interactive chrome for `/app/*` only                                                                |
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

### App (noindex, mock auth)

- `/app` — Dashboard
- `/app/{campaigns,templates,lists,subscribers,media,analytics,settings}`

### System

- `/404` · `/robots.txt` · `/sitemap-index.xml` · `/rss.xml`
- Redirects: `/privacy-policy → /legal/privacy`, `/terms-of-service → /legal/terms`

---

## Setup

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:4321
```

### Environment variables

| Variable              | Client? | Purpose                     |
| --------------------- | ------- | --------------------------- |
| `PUBLIC_SITE_URL`     | yes     | Canonical base, sitemap, OG |
| `PUBLIC_POSTHOG_KEY`  | yes     | Optional analytics          |
| `PUBLIC_POSTHOG_HOST` | yes     | Optional analytics host     |
| `AUTH_SECRET`         | **no**  | Future auth signing         |
| `API_BASE_URL`        | **no**  | Future API base             |

Only `PUBLIC_*` variables reach the client. Server env is read exclusively via `getServerEnv()` in
[`src/lib/env.ts`](src/lib/env.ts).

---

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build (static output + sitemap)
npm run preview      # preview dist/
npm run typecheck    # astro check && tsc --noEmit
npm run lint         # eslint (+ jsx-a11y)
npm run format       # prettier --write
npm run test         # vitest (unit + integration)
npm run test:e2e     # playwright (build first, or it runs against preview)
npm run test:all     # unit + e2e
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

## Integration boundaries / placeholders

The app area uses **mock services** in [`src/lib/app/services.ts`](src/lib/app/services.ts) and
fixtures in [`src/lib/app/mock-data.ts`](src/lib/app/mock-data.ts). UI imports data only through the
services module, so wiring a real backend is a single-file swap:

- `mockSignIn` / `mockSignUp` / `mockResetPassword` — succeed locally; login routes to `/app`.
- `mockContactSubmit` — success UI only.
- `listCampaigns`, `listSubscribers`, … — in-memory fixtures.

Replace those implementations with real HTTP clients; do not scatter `fetch` through components.

---

## Deployment

Static output (`build.format: 'file'` for clean, no-trailing-slash URLs) — deploy `dist/` to any
static host. **Always build with `PUBLIC_SITE_URL` set to the deploy origin** so canonicals, the
sitemap, robots.txt, OG tags, and RSS all agree.

### Cloudflare Pages (current)

Live at **https://maildrill-astro.pages.dev**. Deployed as a static site (no adapter/Functions
needed). `public/_redirects` provides clean 301s on Pages.

```bash
# one-time: create the project
wrangler pages project create maildrill-astro --production-branch main

# build against the production origin, then deploy
PUBLIC_SITE_URL=https://maildrill-astro.pages.dev npm run build
wrangler pages deploy dist --project-name maildrill-astro --branch main
```

To use a **custom domain** (e.g. `maildrill.com`): add it in the Pages project → Custom domains,
then rebuild/redeploy with `PUBLIC_SITE_URL=https://maildrill.com` (or set that as a Pages build
environment variable if you wire up Git-connected builds).

### Any other static host

1. `PUBLIC_SITE_URL=https://your-domain npm run build`
2. Deploy `dist/`.

---

## Assumptions & known placeholders

1. **Target stack is Astro** (this repo). The handoff `AGENTS.md` / `PRODUCT.md` describe the
   original Laravel/Livewire product; those are treated as backend context, not this deliverable.
2. **Brand color is `#ff441f` orange** per the shipped `.dc.html` prototypes (which supersede the
   1.0 `DESIGN.md` "indigo brand" note — indigo is the interactive accent).
3. **Voice** is a first-class channel surface across marketing + app (the prototype treats it as
   exploratory; kept as designed).
4. **Auth is mocked** — no real sessions, SSO, or 2FA (SSO buttons run the mock flow).
5. **App data is mocked**; the deepest interactive prototype flows (email builder, full campaign
   wizard, every modal) are represented via the shell + key screens rather than pixel-ported from
   the 470 KB prototype. Dashboard, Campaigns (table + detail drawer), and the workspace screens are
   built to the design's patterns.
6. **Fonts** load Geist from jsDelivr with `font-display: swap`; self-host by dropping the woff2 in
   `public/fonts/` and repointing the `@font-face` `src` in `global.css`.

```

```
