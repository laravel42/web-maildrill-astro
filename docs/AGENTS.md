# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before making changes.

> Astro site + workspace UI + BFF at the repo root; messaging/product backend in
> [`../workers/`](../workers/). Product overview: [`PRODUCT.md`](PRODUCT.md). Backend ops
> handoff: [`../workers/HANDOFF.md`](../workers/HANDOFF.md).

## What this is

Marketing website **and** authenticated campaign-workspace UI for **Maildrill**, a multichannel
messaging workspace (email, SMS, WhatsApp, voice). Astro 7 — static-first marketing plus
SSR app/auth/api routes via `@astrojs/node` (standalone) — with React 19 islands,
plus the nested `workers/` Fastify backend. See [`../README.md`](../README.md) / `PRODUCT.md` for architecture.

## Stack

- **Astro 7** (static-first marketing; app routes opt into SSR with `export const prerender = false`;
  `@astrojs/node` standalone adapter) · **React 19** islands · **TypeScript** (strict)
- Hand-authored CSS + design tokens (`src/styles/tokens.css`) — reuse tokens, never scatter raw hex
- Content Collections + Zod (`src/content.config.ts`)
- **pnpm** workspaces at the repo root (`packages/*` email editor + `workers` / `workers/{packages,apps}/*`) · Vitest + Playwright
- Node `>=22.12`

## Commands

```bash
pnpm install
npm run dev          # http://localhost:4321
npm run build        # production build (the real gate — compiles the vendored editor too)
npm run check        # astro check  (THE type gate — see below)
npm run typecheck    # astro check && tsc --noEmit
npm run lint         # eslint (+ jsx-a11y)
npm run test         # vitest
npm run test:e2e     # playwright

# Backend (same install — included in root workspace)
pnpm --filter workers dev   # unified single process on :3001 (product+messaging+EB+workers)
# or: pnpm --dir workers dev

# Or both from the repo root (split APIs + workers, then Astro when ports are up):
pnpm dev:all

# Full stack in containers (split APIs + BullMQ + Postgres + Redis):
docker compose up --build
```

## Verification gates (important)

- **`npm run check` (astro check) is the authoritative type gate — it must be 0 errors.**
- **`npm run build` must pass** (it compiles the vendored email-builder from source).
- `tsc --noEmit` currently reports ~460 **pre-existing** errors, all but a handful inside the
  vendored editor packages (`verbatimModuleSyntax` type-only import nits, MUI prop typings). These
  are **not introduced by your change** — do not try to "fix" them wholesale. When verifying, confirm your
  edited files add **no new** errors and that `astro check` + `build` are green.

Always run `astro check` and `build` after changes. Write/run tests for new behavior.

## Brand system (read before touching styles)

- `--brand #ff441f` (orange) — identity accent (logo, nav hovers, glows). **Not** button fills.
- `--accent #4f46e5` (indigo) — interactive accent (links, primary-CTA hover, focus ring, email channel).
- `--ink #1f1e1b` — text + marketing primary CTA background. In-app primary actions are solid indigo.
- Warm-cream surfaces; dark bands use `--ink-band`. Channel colors: email indigo, SMS cyan,
  WhatsApp green, voice amber.

## Layout

```
src/
  components/{navigation,react,seo,ui}   # React islands live in react/
  config/ content/ layouts/ lib/ pages/ styles/ types/
  middleware.ts                          # auth gate for /dashboard (Auth.js session)
packages/
  email-builder-standalone/              # vendored visual email editor (compiled from source)
  email-builder/ document-core/ block-*/ # editor sub-packages
  builder42/                             # vendored visual landing-page editor (see VENDOR.md)
workers/                                 # messaging + product backend (was workers)
  apps/{api,product-api,email-builder-api,workers,dev-server}
  packages/{config,database,domain,services,product,…}
  packages/activepieces-core/            # vendored MIT Activepieces subset (see its VENDOR.md)
  packages/automations/                  # Automations: engine, pieces, runtime, event bridge
```

**Automations** (visual workflows) span both trees — read
[`architecture/automations-activepieces.md`](architecture/automations-activepieces.md) before
touching `workers/packages/{activepieces-core,automations}`,
`src/components/react/automations/`, or the domain event bus in
`workers/packages/domain/src/events.ts`. Two rules that are easy to break: published
automation versions are **immutable** (editing opens a new draft), and the engine
(`@maildrill/automations/engine`) may not import a Maildrill service — it talks to the
product only through injected ports.

**Landing pages** (Builder42, `/dashboard/landings`) — read
[`landing-pages-builder-integration.md`](landing-pages-builder-integration.md) before
touching `packages/builder42/`, `src/components/react/{AppLandings,LandingPageBuilder*}.tsx`,
`src/lib/app/{landings,builder42-adapters}.ts`, or the `landings` table/routes in
`workers/`. Three rules that are easy to break: a landing is one whole **site**
(`BuilderSite`: multi-page), the list queries must **never** select `document` (it
inlines images as data URLs, so a row can be megabytes — `page_count`/`document_bytes`
exist for that), and every editor capability (AI, Unsplash, publish, translate) is
gated by the `fetchHealth` adapter — an unset adapter is a 404 against this host, not
"feature off".

**Backend lives in [`../workers/`](../workers/)** and is part of the **root**
`pnpm-workspace.yaml` (`workers`, `workers/packages/*`, `workers/apps/*`). One
`pnpm install` at the repo root installs everything. Frontend talks to it via
`API_BASE_URL` (default `http://localhost:3001`; Docker also sets
`MESSAGING_API_BASE_URL` / `EB_API_BASE_URL` for the split). Read [`../workers/HANDOFF.md`](../workers/HANDOFF.md)
before changing delivery, stats, or Infobip notify wiring.

**Env:** one file at the **repo root** (`.env` / `.env.example`). `workers/packages/config`
loads `../.env` automatically — do not keep a separate `workers/.env`.

**Delivery analytics:** Infobip DLRs → PostHog Hog only → `campaign-delivery` HogQL poller →
Postgres. Do not re-point Infobip delivery notify at Maildrill webhooks for product truth.

Hydration is opt-in per island with the cheapest directive that works; no marketing route ships
page-wide React. Prefer `src/lib/app/` client helpers over ad-hoc `fetch` in components.

## Vendored email builder (`packages/email-builder-standalone`)

The visual editor is **vendored and compiled from source**, wrapped by
`src/components/react/VisualEmailBuilder.tsx`. Key facts:

- The app mounts it with **`componentsStorage="local"`** — the Components Library (sections,
  layouts, templates, themes, primitives) is seeded into `localStorage` from a bundled preset
  catalog (`seedLocalLibrary` + `localPresets`), keyed `eb:lib:*`.
- **Thumbnails** for library cards are generated client-side by `lazyThumbnailGenerator`
  (`captureSubtreeThumbnail` renders each item in a sandboxed iframe and rasterises via
  `html-to-image`), stored as data URLs under `eb:lib:thumbnails`.
  - Capture aspect is chosen **per card variant** so it matches the display band exactly (no
    distortion, no `object-fit:cover` zoom): `subtree` (section/layout) 4:3, `template` 2:3. Pass
    `variant: 'subtree' | 'template'` — it's the single source of the capture/output dimensions.
  - The cache is **version-gated**: `seedLocalLibrary` clears `eb:lib:thumbnails` when the preset
    catalog `version` bumps (`eb:lib:thumbnails:version`), so evolving templates regenerate.
  - Generation is an **incremental queue**: all missing items are marked pending (cards show a
    Skeleton via `thumbnailStatus`), then captured one-by-one, newest-first (matching the drawer's
    default `updatedDesc` sort), yielding a frame before each capture to keep the UI responsive.
  - To force a manual refresh in dev: `localStorage.removeItem('eb:lib:thumbnails'); location.reload()`.
    (The `window.__recapture*` helpers are **backend-mode only** — they hit `/dev/*` endpoints.)

## Guided product tours (`packages/product-tour`)

`@md/product-tour` (`packages/product-tour`) is the driver.js-based tour engine — host- and
domain-agnostic, knows nothing about Maildrill, PostHog, or which editor mounted it.
`createTour()` defers `import('driver.js')` and the popover CSS to `start()`, never to module
top-level, so neither enters an editor's initial chunk. Full design record:
[`product-tour-driverjs-plan.md`](product-tour-driverjs-plan.md).

- **Anchors are a per-editor registry, not inline strings.** Each editor owns one
  `tourAnchors.ts` (`packages/email-builder-standalone/src/tour/tourAnchors.ts`,
  `packages/builder42/src/app/tour/tourAnchors.ts`) mapping a step key to a `data-tour="…"`
  value, stamped via that file's `dataTourAttr(...)`. No `.tsx` may hardcode a `data-tour`
  string. Renaming or removing a key without updating the registry (and the step + its i18n
  copy that reference it) breaks the tour silently at runtime — nothing type-checks that
  connection.
- **builder42 additionally enforces the registry stays 1:1 with the tour steps**, including
  copy parity per locale (`packages/builder42/tests/tourSteps.flags.test.ts`,
  `tourSteps.i18n-parity.test.ts`). Consequence: a control that no step highlights must **not**
  get a `data-tour` key — find it by accessible name instead (see the landings relaunch button
  below, `HostToolbar.tsx`, which has no anchor on purpose).
- **Single instance:** the engine keeps at most one live driver.js instance per `tourId`,
  process-wide, last-start-wins — a second `start()` destroys the first even if it arrives while
  the first is still awaiting its lazy `import('driver.js')`.
- **Escape** closes the tour and never reaches the host editor, except when a visible modal is
  open on top of the page (`[aria-modal="true"], dialog[open], [role="dialog"]`, excluding
  driver.js's own `.driver-popover`, and only if actually visible — hidden/zero-size/`display:
  none` dialogs don't count) — then Escape is left to the modal and the tour stays open.
- **Relaunch entry points**, per editor: email editor → the header help button in
  `App/TemplatePanel/index.tsx` and the command palette (`App/CommandPalette/index.tsx`), both
  via `requestTourRestart()` (`documents/editor/EditorContext.tsx`). Landings → `HostToolbar.tsx`
  in the embed and `ProfileMenu.tsx` in the standalone, both via
  `requestBuilder42TourRestart()`. The Astro host's `src/components/react/shared/EditorHeader.tsx`
  wires **no** tour button for either channel — it only stamps `data-tour` anchors.
- **Persistence:** email under the `eb:` prefix via the engine's own
  `createLocalStoragePersistence('eb:')`; builder42 through `useLocalConfig`'s
  `tourSeen`/`tourVersion` keys (`pb:` prefix) via a custom `TourPersistence` adapter. Bump each
  editor's own `TOUR_VERSION` constant to re-offer the tour to everyone who already saw a prior
  version.
- **Telemetry:** the engine emits four domain-agnostic events through `onEvent` —
  `tour_started`, `tour_step_viewed`, `tour_completed`, `tour_dismissed` — and never imports
  PostHog. The mapping to `window.posthog?.capture(event.event, { tour_id, step_index,
  total_steps, editor })` lives only in the two host wrappers,
  `src/components/react/VisualEmailBuilder.tsx` and `src/components/react/LandingPageBuilder.tsx`.
- **Editor theme comes from the host, never from the package (D30/D31).** The host observes
  `<html data-theme>` with `useHostTheme` (`src/components/react/hooks/useHostTheme.ts`, a
  `MutationObserver` on `attributeFilter: ['data-theme']`) and passes the result down as
  `darkMode` on `VisualEmailBuilder.tsx`; the vendored editor still never reads the host DOM
  itself. The tour popover follows the theme for free, because its CSS vars are derived from
  the active MUI theme, not from a second theme channel. Host React islands have no DOM test
  infrastructure in this repo — the root Vitest environment is `node`, with no jsdom/happy-dom/
  `@testing-library` — which is why a host-side hook like this one has to expose a DOM-free,
  injectable core (`normalizeHostTheme`, `readHostTheme`, `observeHostTheme` taking an
  observer factory) instead of only a React hook.
- **Any tour step that changes UI state snapshots it and restores it, idempotently (D26).**
  Two live examples in the email editor: the four consecutive library steps
  (`eb.library.tabs` through `eb.library.templates`) share one deferred-restore guard so the
  drawer's open state and active tab don't flicker open/closed between steps (D33); and the
  command palette step opens the palette by dispatching its own **toggle** hotkey behind a
  `data-state="open"` guard (so it never closes a palette the user already had open), then
  blurs the palette's input so the tour keeps its arrow-key and `Tab` navigation (D27).
- **A tour step never writes to the user's document (D25).** Steps that need a particular block
  to exist (e.g. a text block for the inspector-tabs step) use `when()` to skip themselves when
  it's absent, instead of inserting demo content — inserting content would pollute the undo
  stack and trigger an autosave the user never asked for.
- **Never persist a user preference from a tour hook.** `setInspectorDrawerMode` flags
  `inspectorModeUserOverride` and writes the choice to `localStorage`; a tour step that needs
  the inspector open in a particular mode writes the transient state straight to the store
  (`editorStateStore.setState(...)`) instead, so a step never leaves behind a preference the
  user didn't choose.
- **Highlight precision (D29, continuing D16).** An anchor must wrap only the controls its copy
  talks about, never a container that also includes controls it doesn't mention — hence
  `eb.inspector.tabs` is its own anchor around just the Content/Styles tab strip rather than
  reusing `eb.inspector.panel`, and the Blocks tab's *Basics* and *Structure* groups each get
  their own anchor instead of sharing one over the whole grid.
- **email-builder-standalone does not enforce the registry↔1:1-with-steps invariant that
  builder42 does.** Its tests check flag filtering, locale parity, and explicit anchor lists
  (`tourSteps.flags.test.ts`, `tourSteps.i18n-parity.test.ts`, `tourAnchors.render.test.tsx`), so
  an anchor can exist there without a step referencing it. Copy still has to land in all three
  locales for every step that does exist — and the i18n-parity test only asserts that a key
  exists and is a non-empty string, never that it was actually translated, so a new step can
  ship the same English title into `es-419`/`it-IT` and pass the gate; catching that needs a
  human read of the diff (this happened once in this same chain of work and needed a follow-up
  commit).

## Local development caveats

- **Auth is real (passwordless login code, allowlisted during the private rollout — see
  `PRODUCT.md` §1.5).** `getSession` (auth-astro) in `src/middleware.ts` throws "problem with the
  server configuration" without `AUTH_SECRET`; unauthenticated visits to `/dashboard/*` redirect
  to `/login`. Logging in locally needs the workers backend running (code storage + verify live in
  Postgres).
- `/api/v1/*` calls (e.g. `custom-fields`) return **401** without a real session — callers handle
  this gracefully (they're wrapped in try/catch); it's benign console noise, not a failure.
- `about:srcdoc` console messages ("Blocked script execution" / "can escape its sandboxing") come
  from the thumbnail-capture and hover-preview iframes' sandboxes — benign warnings about our own
  content.

## Orchestrator mode

If you are told you are acting as the **orchestrator** (coordinating subagents/workers over
this repo, delegating tasks, running a multi-agent pipeline), read
[`../SKILLS/orquestation.md`](../SKILLS/orquestation.md) **before** delegating anything.
It defines the serial handoff/verification protocol (one subagent at a time, one commit per
task, scope discipline, the verification gate) that governs how you split work and hand it off.

## Conventions

- Match existing style/tokens/libraries; read neighbouring code before adding new patterns.
- Reuse design tokens; keep accessibility (jsx-a11y) clean.
- Keep changes scoped to the task. Prefer `src/lib/app/` and the BFF over ad-hoc fetches.

## Git / branch conventions

- `main` is protected — don't push directly or force-push it.
- Isolated editor work happens on `work/email-builder-isolated`.
- Commit only when asked; stage specific files (never blanket `git add .` that could sweep in
  `.env`). Conventional-commit style messages (`feat(...)`, `fix(...)`).
