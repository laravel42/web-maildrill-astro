# Maildrill — Product Overview

**Status:** Living product document
**Owner:** Product
**Last updated:** July 2026
**Package:** `laravel42/maildrill`

---

## What Maildrill is

Maildrill is a professional, **multi-tenant** workspace for designing, sending,
and measuring **multichannel** campaigns — **email, SMS, and WhatsApp** — from a
single place. It is built for operators who run campaigns for a living, not for
occasional admins clicking through a CRUD panel.

The guiding sentence:

> "The fastest professional workspace to create, deliver and analyze campaigns."

If the logo were removed, Maildrill should be compared to **Linear, Resend,
Vercel, Raycast, GitHub, and Notion** — never to a Bootstrap admin template.

Each **app** is a bounded workspace with its own campaigns, lists, subscribers,
quotas, branding, and user roster. Tenant isolation holds across branding,
permissions, quotas, and feature flags (e.g. AI, chat metadata).

---

## Who it's for

| Persona | Goal | What they need from Maildrill |
|---|---|---|
| **Customer users** (operators) | Ship campaigns quickly and confidently | Templates, lists, campaigns, media library, live preview, reliable scheduling |
| **Account-level users** | Collaborate within a workspace | Configurable, permission-scoped access |
| **Marketing lead** | Understand what's working | Trend-first analytics, per-channel performance |
| **List / audience owner** | Keep audiences clean and segmented | Subscribers CRM, saved segments, custom fields, import/export |
| **Platform admins** | Create & configure apps | Branding (from name/email, domains), quotas, invitations, impersonation, template gallery |

Role-based access separates **platform administration** from standard **tenant
operations**.

---

## Core principles (product)

1. **Workspaces over dashboards.** Every page helps the user *do work*, not just
   read statistics. No page exists solely to show numbers.
2. **One primary action.** Every screen answers "what should I do next?" with an
   obvious primary CTA.
3. **Progressive disclosure.** Show 5 primary controls and an "Advanced ▾",
   not 30 controls at once.
4. **Workspace isolation.** Apps carry their own branding, permissions, quotas,
   and optional feature flags.
5. **Speed, clarity, confidence, scalability** — in that order — over feature
   count.

---

## Channels

The channel enumeration is `email`, `sms`, `wa` (WhatsApp / Meta) — see
`App\Enums\CampaignType`. Orchestration, queues (`CampaignQueue`), and message
tables (`CampaignTable`) are aligned per channel.

- **Email** — primary channel. Delivered via **Infobip Email API v4**
  (marketing + transactional), with an optional Cloudflare Worker path for
  high-volume webhook ingestion.
- **SMS** — dedicated send pipeline and queue.
- **WhatsApp** — Meta pipeline and queue.

> **Note:** the interactive design prototype (`App.dc.html`) also mocks a
> **Voice** channel for exploration. Voice is **not** part of the shipping
> product's channel enum; treat it as a design spike, not an acceptance target.

---

## Feature inventory

The following reflects the shipping codebase plus the interactive prototype
(`App.dc.html`), which serves as the UX acceptance reference for the migrated
Livewire screens.

### Navigation & shell
- Fixed 280px collapsible sidebar; workspace destinations: Dashboard,
  Campaigns, Templates, Lists, Subscribers, Media Library, Analytics, Settings.
- 64px header with global search in the navbar and a dark-mode toggle.
- **⌘K command palette** for fuzzy navigation to any screen.
- Light / dark theme with persisted preference (`ThemeSwitcher`).

### Campaigns
- Lifecycle from **draft → send**: batch sends, progress visibility, scheduled
  sends with suspend/cancel hooks, **clone**, and optional **public archive** of
  sent content (embeddable via `AllowEmbedding` middleware).
- **Targeting** from one or more lists and named **segments**; recipient counts
  shown before send.
- **Email-specific**: subject, preheader, HTML/CSS + editor metadata,
  attachments, optional plain text, link/query-string handling, unique **open**
  and **click** metrics.
- **Send readiness**: **spam-score** checks and **sending-domain** verification
  (`SenderDomainValidator` / Infobip domain sync), plus optional Infobip
  pre-send validation.
- Prototype UX: high-density table + card view; columns Status, Name, **Channel**
  (color pill), Audience, Scheduled, Performance, Updated, Actions; status tabs,
  multi-select channel filter, persistent filter chips, search, column sorting,
  pagination, bulk actions; campaign detail drawer with a 6-KPI grid
  (Recipients, Delivered, Open rate, Click rate, Click-to-open, Unsubscribed).
  Analytics live inside the campaign detail.

### Campaign wizard (prototype UX)
- Five steps: **Sender → Audience → Content → Review → Schedule**.
- Left stepper, center content, right live preview, sticky footer nav.
- Channel-aware: Email / SMS / WhatsApp change the sender label, composer,
  character/segment counts, and the live phone preview.

### Templates & content
- **Email templates**: create, edit, preview, clone, upload, gallery
  integration, and multi-channel conversion utilities. Authoring uses an
  **integrated visual, block-based email builder** (drag-and-drop, HTML export).
- **Pages**: additional HTML page assets with manage/preview/clone flows.
- Prototype UX: gallery with large previews, category grouping, hover actions
  (Preview / Use / Clone / Favorite), bulk actions, pagination, detail drawer.

### Lists, subscribers & segments
- **Lists**: full CRUD + clone.
- **Subscribers** (CRM): per-list search and table operations, bulk
  unsubscribe/delete, GDPR toggles, individual updates, **token-based public
  subscribe**, export, and **import** (`SubscribersUpload` Livewire component).
- **Segments**: rules-based subsets per list with match counts and naming;
  prototype adds a segment builder (match-all/any), live counts, edit/delete,
  and persistence across reload.
- Prototype UX: status tabs, saved segments, details drawer (activity, channels,
  editable tags, custom fields), custom fields (`CustomFields` component),
  column sorting, pagination, bulk actions.

### Media library
- Centralizes images and files for campaign and template work
  (`MediaLibrary`, `UploadMediaButton` Livewire components).
- Prototype UX: grid / list / compact views, folder navigation, upload with
  preview + progress, duplicate-detection summary, import error handling, tag
  filtering, preview drawer, bulk actions.

### AI-assisted features (per-app, when enabled)
- Image generation and text transformation, subject to **rate limits** and
  access control (`config/ai.php`).

### Donations / fundraising (per-app, when enabled)
- Donation campaign setup, preview, and dashboard management; public donation
  views and thank-you flows; API support for pledgers, payment verification,
  campaign status, and **Stripe** payment intents.

### Billing & packages
- Pricing and checkout via **Laravel Cashier / Stripe** with post-purchase
  success handling; per-app **quota** and **send accounting** aligned to plans.
- Settings UX: sectioned subnav (never one long scroll) — Workspace, Branding,
  Domains, SMTP, Billing, API, Users, Permissions, Integrations, AI — with
  editable fields and save-toast feedback; usage split by channel.

### API & integrations
- **REST API (v1)** documented via Scramble (`/api/v1/docs`, `/api-docs`);
  authenticated access via **Laravel Sanctum**.
- Public endpoints for subscribe-by-token, captcha (where required), and
  donation/pledger flows.

### Operations
- **Queues + Redis** for campaign batch processing and finalization;
  **Horizon** for queue visibility; **Octane (RoadRunner)** for the web tier.

### Cross-cutting (prototype UX)
- Modals: Import contacts, New list, Export, Add subscribers, Segment builder,
  Upload file, Confirm, Notifications, list contextual menu.
- Toast notifications on every save / destructive confirm.
- Animated drawer open/close transitions; fluid layout.

---

## Trust, safety & rate limits

- Throttling on sensitive routes (campaign token preview, unsubscribe,
  subscribe, invites, AI features, payment intents, Stripe publishable key).
- Signed URLs for confirm-unsubscribe where applicable.
- Token-based subscribe/unsubscribe supported end to end.

---

## Definition of done (product)

A screen ships when it is visually consistent, responsive, accessible,
keyboard-navigable, component-driven, testable, and documented — and when it
gives the user a clear next action.

---

## Non-goals

- Decorative dashboards or vanity KPI walls.
- Playful / colorful / enterprise-legacy aesthetics.
- Replicating desktop layouts verbatim on mobile (reprioritize content instead).
- Treating the prototype's Voice channel as a shipping capability.

---

## Relationship to other documents

| Document | Purpose |
|---|---|
| `PRODUCT.md` | Product narrative, positioning, capability map (this file) |
| `DESIGN.md` | Visual language, tokens, component conventions |
| `README.md` | Repository overview, setup, frontend scripts |
| `AGENTS.md` / `CLAUDE.md` | Engineering conventions for this repo |
