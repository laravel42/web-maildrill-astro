# Maildrill — Design System & UX Specification

**Version:** 2.0 (reflects the shipped prototype)
**Status:** Living design specification

> This document supersedes the 1.0 vision draft where they differ. Where the
> vision said "Inter / neutral," the shipped product uses **Geist** and a
> **warm-cream** palette — those decisions are canonical and recorded below.

---

## 1. Vision

Maildrill should feel like **Linear meets Resend**, not an admin panel. Every
screen optimizes for **speed, clarity, confidence, and scalability** instead of
CRUD. The product is professional, calm, fast, predictable, powerful, minimal —
and never playful, decorative, colorful, or enterprise-legacy.

The user should never feel they are _using software_. They should feel they are
_running campaigns_.

---

## 2. Design principles

1. **Workspaces over dashboards** — pages help users do work, not display stats.
2. **One primary action** — the primary CTA is always obvious.
3. **Information hierarchy** — current task → primary actions → operational data
   → metadata. Never the reverse.
4. **Progressive disclosure** — 5 primary controls + "Advanced ▾", not 30.
5. **Dense but breathable** — the density of Linear/GitHub with room to breathe.

---

## 3. Visual language

### 3.1 Color

The palette is a **warm cream** neutral ramp with an **indigo/purple** brand
accent. Semantic colors only — no decorative color. Tokens are CSS custom
properties driven by `[data-theme]`.

**Light (`:root`, `[data-theme="light"]`)**

| Token                  | Value                 | Use                         |
| ---------------------- | --------------------- | --------------------------- |
| `--bg`                 | `#f6f5f2`             | App background (warm cream) |
| `--surface`            | `#ffffff`             | Cards, panels               |
| `--surface2`           | `#f3f2ee`             | Hover / subtle fills        |
| `--border`             | `#ecebe6`             | Default borders             |
| `--border2`            | `#e4e2da`             | Stronger borders / hover    |
| `--divider`            | `#efeee9`             | Hairlines                   |
| `--text`               | `#1f1e1b`             | Primary text                |
| `--text2`              | `#3a3833`             | Secondary                   |
| `--text3`              | `#57554e`             | Tertiary                    |
| `--text4`              | `#77756c`             | Quaternary                  |
| `--muted` / `--muted2` | `#a5a39a` / `#c0beb4` | Muted labels                |
| `--accent-tint`        | `#eef0ff`             | Accent wash                 |

**Dark (`[data-theme="dark"]`)** — a warm near-black ramp: `--bg:#15130d`,
`--surface:#201d16`, `--surface2:#2a261e`, `--border:#332f26`, `--text:#f5f3ec`,
`--accent-tint:rgba(99,91,245,.2)`.

**Brand & semantic**

| Role                   | Color                         |
| ---------------------- | ----------------------------- |
| Brand / primary action | `#4f46e5` (hover `#4338ca`)   |
| Success                | Green (`#16a34a` / `#22c55e`) |
| Warning                | Amber                         |
| Danger                 | Red (`#dc2626`)               |

**Channel colors** (used consistently in pills, filters, previews, analytics):

| Channel  | Color            |
| -------- | ---------------- |
| Email    | Indigo `#4f46e5` |
| SMS      | Cyan             |
| WhatsApp | Green            |

### 3.2 Typography

- **Font:** `Geist` (UI), `Geist Mono` (code / numeric mono contexts).
- **Weights:** headings semibold (600); body regular (400); 500 for emphasis.
- **Numbers:** tabular (`.tnum { font-variant-numeric: tabular-nums }`) for all
  metrics, tables, and KPIs.

### 3.3 Border radius

| Component | Radius |
| --------- | ------ |
| Buttons   | 10px   |
| Cards     | 16px   |
| Images    | 12px   |
| Dialogs   | 20px   |

### 3.4 Elevation

Three subtle elevations only. Card hover uses
`box-shadow: 0 6px 18px rgba(30,27,22,.07)` with a 1px lift. **No
glassmorphism** (the header's translucent blur is the single deliberate
exception).

### 3.5 Motion

Fast and subtle, **150–250ms**. Named keyframes: `fade`, `slidein`/`slideout`
(drawers), `ovfade`/`ovfadeout` (overlays), `pop` (modals), `toastin`, `grow`
(bars), `spin`. Motion explains interaction; it never entertains. Prefer
skeleton loaders over spinners.

---

## 4. Layout

- **Sidebar:** 280px, collapsible, full viewport height.
- **Header:** 64px, translucent, with in-navbar global search + theme toggle.
- **Content:** centered, max-width ~1600px, comfortable margins, fluid.

---

## 5. Navigation

Sidebar (WORKSPACE group): Dashboard, Campaigns, Templates, Lists, Subscribers,
Media Library, Analytics — plus Settings. Global search is **⌘K**, available
everywhere.

---

## 6. Screen specs (summary)

Each production screen must document: purpose, hierarchy, components,
interactions, acceptance criteria, accessibility, future extensions, and
implementation notes.

- **Dashboard** — greeting, quick actions, KPI strip, recent campaigns, recent
  activity, performance-by-channel, getting started. Never 40 KPI cards.
- **Campaigns** — dense table default; Status/Name/Channel/Audience/Scheduled/
  Performance/Updated/Actions; persistent filters + chips, bulk actions, search,
  pagination; detail drawer with 6-KPI grid.
- **Campaign wizard** — Sender/Audience/Content/Review/Schedule; left stepper,
  center content, right live preview, sticky footer; channel-aware.
- **Email builder** — three panels (Block Library / Canvas / Property Inspector),
  floating toolbar, autosave, undo/redo, responsive preview.
- **Lists** — uniform index + detail drawer (growth chart, tags, notes,
  attachments, custom fields, activity).
- **Subscribers** — CRM table + right-side details drawer, saved segments (with
  live counts, persisted), segment builder, tabs, sorting, pagination.
- **Templates** — gallery, large previews, category grouping, hover actions.
- **Media** — folders, asset grid, drag & drop, upload queue, preview drawer.
- **Analytics** — trends, comparisons, funnels, timelines, top campaigns/links/
  devices. Avoid raw numbers.
- **Settings** — sectioned subnav (Workspace, Branding, Domains, SMTP, Billing,
  API, Users, Permissions, Integrations, AI); never one scrolling page.

---

## 7. Component library

Token-driven, reusable components only: Buttons, Inputs, Cards, Tables, Dialogs,
Drawers, Badges, Tags, Progress, Charts, Breadcrumbs, Tabs, Pagination, Toasts,
Empty states, Command palette. The catalog lives in `Storybook.dc.html`.

**States** every component supports: loading, empty, success, warning, error,
disabled.

---

## 8. Accessibility

Keyboard-first, visible focus states (`0 0 0 3px rgba(79,70,229,.12)` focus
ring), ARIA support, high contrast, and **never communicate by color alone**
(pills and badges pair color with a label/icon).

---

## 9. Responsive

Desktop-first, tablet-optimized, mobile-simplified. Do not replicate desktop
layouts on small screens — reprioritize content.

---

## 10. Definition of done (design)

Visually consistent, responsive, accessible, keyboard-navigable,
component-driven, production-ready, documented, and testable.
