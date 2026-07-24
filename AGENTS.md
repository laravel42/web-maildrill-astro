# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before making changes.

> This file describes **this** deliverable — the Astro site + workspace UI. The root
> `PRODUCT.md` describes the original Laravel/Livewire product and is **backend context only**,
> not the target stack.

## What this is

Marketing website **and** authenticated campaign-workspace UI for **Maildrill**, a multichannel
messaging workspace (email, SMS, WhatsApp, voice). Astro 5, static-first, with React 19 islands.
See `README.md` for the full product/architecture tour.

## Stack

- **Astro 5** (static-first, islands) · **React 19** islands · **TypeScript** (strict)
- Hand-authored CSS + design tokens (`src/styles/tokens.css`) — reuse tokens, never scatter raw hex
- Content Collections + Zod (`src/content.config.ts`)
- **pnpm** workspaces (monorepo: `packages/*`) · Vitest + Playwright
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
```

Shell note: the dev environment is **Windows PowerShell** — chain commands with `;`, not `&&`.

## Verification gates (important)

- **`npm run check` (astro check) is the authoritative type gate — it must be 0 errors.**
- **`npm run build` must pass** (it compiles the vendored email-builder from source).
- `tsc --noEmit` currently reports ~160 **pre-existing** errors, almost all inside the vendored
  editor packages (`verbatimModuleSyntax` type-only import nits, MUI prop typings). These are **not
  introduced by your change** — do not try to "fix" them wholesale. When verifying, confirm your
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
  middleware.ts                          # auth gate for /app + /dashboard
packages/
  email-builder-standalone/              # vendored visual email editor (compiled from source)
  email-builder/ document-core/ block-*/ # editor sub-packages
```

Hydration is opt-in per island with the cheapest directive that works; no marketing route ships
page-wide React. Mock services live in `src/lib/app/services.ts` — wire a real backend by swapping
that one module, don't scatter `fetch` through components.

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

## Local development caveats

- **Auth is mocked / being reworked.** `getSession` (auth-astro) in `src/middleware.ts` throws
  "problem with the server configuration" without `AUTH_SECRET`. For isolated builder work, set
  `SKIP_AUTH_FOR_BUILDER_WORK=true` in a local `.env` (gitignored) to bypass the session check on
  `/app` + `/dashboard`. **This bypass must never be committed.**
- `/api/v1/*` calls (e.g. `custom-fields`) return **401** without a real session — callers handle
  this gracefully (they're wrapped in try/catch); it's benign console noise, not a failure.
- `about:srcdoc` console messages ("Blocked script execution" / "can escape its sandboxing") come
  from the thumbnail-capture and hover-preview iframes' sandboxes — benign warnings about our own
  content.

## Conventions

- Match existing style/tokens/libraries; read neighbouring code before adding new patterns.
- Reuse design tokens; keep accessibility (jsx-a11y) clean.
- Keep changes scoped to the task. Prefer editing the mock services boundary over ad-hoc fetches.

## Git / branch conventions

- `main` is protected — don't push directly or force-push it.
- Isolated editor work happens on `work/email-builder-isolated`.
- Commit only when asked; stage specific files (never blanket `git add .` that could sweep in
  `.env` or the auth bypass). Conventional-commit style messages (`feat(...)`, `fix(...)`).
- Never commit `src/middleware.ts`'s `SKIP_AUTH_FOR_BUILDER_WORK` bypass.

## Learned User Preferences

- Communicate in Spanish with this user.
- In the AI generation dialog, never expose Zod validation paths, schema mismatch details, or raw SSE/backend warning JSON to end users; use generic status copy and log diagnostics in dev only.

## Learned Workspace Facts

- AI email generation HTTP API lives in sibling repo `maildrill-service/apps/email-builder-api`; this Astro app proxies it through `src/pages/api/eb/[...path].ts` (`eb-proxy.ts`).
- Unsplash `IMAGE_POOL` for new templates and refine mode is resolved in `maildrill-service` (`generate.ts`, `buildRefinePrompt`); refine must not skip the pool just because `currentDocument` is present.
- `AIPreviewPanel.sanitizeForReader` must walk `ColumnsContainer` column-slot `childrenIds`; omitting them makes modal preview hide columns that render on the canvas.
- LLM-emitted CSS padding strings are normalized client-side in the repair pipeline (`coerceGeneratedStyles.ts` inside `repairDocument`) before validation and apply.
