# Vendored EmailBuilder.js client

These packages are copied from `web-email-builder-js/packages/*` and compiled
**from source** by this app's Vite, rather than consumed as the prebuilt
`email-builder-online` npm package. That lets us patch and extend the editor in
place, and keeps a single build.

Contents: `email-builder-standalone` (the editor) plus its import closure —
`document-core`, `email-builder`, and the eight `block-*` packages.

## Re-importing after an upstream change

Copy `src/` for each package, then re-apply the adaptations below. They are
deliberately few so the sync stays mechanical.

### Manifest adaptations (all packages)

Upstream manifests are written for publishing, not source consumption:

- Entry points target `dist/`, which we never build. `email-builder-standalone`
  points `main`/`types`/`exports` at `src/` instead. `./style.css` maps to
  `src/global.css`, though `src/index.tsx` already imports it.
- The `@eb/*` packages sit in `devDependencies` (they get bundled at publish
  time). They are promoted to `dependencies` as `workspace:*`, or nothing
  resolves them at compile time.
- `react`/`react-dom` are moved to `peerDependencies` so the host app provides
  the single copy. Two React instances would break hooks.
- Build tooling (vite, eslint, typescript, @types/*) and `scripts` are dropped —
  the host app compiles these sources.

### Code patches

- `email-builder-standalone/src/App/TemplatePanel/index.tsx`
  — the undo/redo icons used SVG attributes in kebab-case (`stroke-linecap`,
  `stroke-linejoin`, `stroke-width`), which React rejects, logging "Invalid DOM
  property" on every render. Converted to camelCase, matching the same file's
  other icons (lines 89-91) which already did it correctly.

- `email-builder-standalone/src/App/ComponentsLibrary/LibraryHoverPreviewPortal.tsx`
  — the hover-preview iframe declared `sandbox="allow-same-origin allow-scripts"`,
  which makes browsers warn that the frame can escape its sandbox. `allow-scripts`
  is unnecessary: the skeleton srcDoc carries no `<script>` and all content is
  injected from the parent document, so it was dropped. This both silences the
  warning and tightens the sandbox.

- `email-builder-standalone/src/documents/editor/EditorContext.tsx`
  — `useBlockTypeSelected` nested a second `editorStateStore(...)` call inside a
  selector. Under zustand v5 that returns an unstable snapshot and
  `useSyncExternalStore` re-renders forever ("Maximum update depth exceeded" in
  `<InspectorDrawer>`), so the editor never paints. Fixed by reading the id as
  its own subscription and returning a primitive. **Report this upstream** — it
  is a real bug in the source, not a vendoring artifact.

- `block-notion-text/src/slash-menu-items.tsx`
  — the "Merge Tag" submenu was built by an IIFE inside the module-level
  `slashMenuItems` const, so it captured `getMergeTags()` **once at import time**
  — before the host sets `window.__emailBuilderCustomMergeTags` — and stayed
  stuck on the placeholder defaults. The bubble-menu dropdown reads
  `getMergeTags()` per render and was fine, so the two menus disagreed. Moved the
  submenu build into `getFilteredSlashMenuItems()` (called each time the menu
  opens) so it reflects the host's current merge tags. **Report this upstream** —
  the slash menu should honour custom merge tags like the bubble menu does.

## Scope

`packages/**` is excluded from this repo's `tsconfig` and eslint: it is upstream
code, checked upstream, and this repo's rules (`noUncheckedIndexedAccess`, etc.)
are stricter than the ones it was written against.

That rationale holds for the EmailBuilder.js tree above. It does **not** hold
for `packages/builder42`, which is first-party code with no upstream — see its
own section below.

---

# Builder42 (landing-page editor) — first-party, no longer vendored

`packages/builder42/` is the visual landing-page/site editor. It **originated**
as a copy of `pb-static` (`~/projects-container/projects/_laravel42/pb-static`,
docs/52 F8 of that repo's plan), but that relationship is **closed**: Builder42
continues as part of Maildrill, not as an independent project.

**Every change goes directly in this repo.** There is no re-sync, no upstream to
report bugs to, and no "zero code patches" goal — edit `packages/builder42/`
like any other first-party source. `pb-static` is provenance and historical
context only; do not copy files from it again, and do not treat its `docs/` as
binding decisions for this codebase.

The parts of the vendoring shape that survive are just facts about how the
package is wired, not a re-apply checklist:

### Manifest shape

- `main`/`types`/`exports` point at `src/index.ts`, never `dist/` — this app
  never builds the package, its own Vite compiles the source. `./style.css` maps
  to `src/styles/chrome-embedded.css`, the embed-safe barrel that omits the
  standalone-only `@font-face`/`html,body,#root` rules, which don't belong
  inside this host's page.
- `react`/`react-dom` are `peerDependencies`, not `dependencies` — same reason
  as EmailBuilder.js: two React instances break hooks.
- `scripts` and build tooling (vite, vitest, typescript, `@types/*`) were
  dropped at import time, because this app compiles the source directly. **That
  now leaves a real gap**: the package has no `tsconfig.json`, no test runner,
  and `packages/**` is excluded from this repo's tsconfig, eslint and
  `scripts/typecheck.mjs`. Code we now own gets neither type-checked nor linted
  here. `packages/wa-template-studio` is the precedent to follow (own
  `tsconfig.json` + `vitest.config.ts`, wired into the root `typecheck`
  script). Tracked in `docs/landing-pages-builder-plan.md`.

### Divergence from the original import (historical)

Kept as a record of *why* these files look the way they do. It is no longer a
list of patches to re-apply — there is nothing to re-apply them onto.

- `shared/api.ts` — added `MediaAsset`/`MediaListResponse` and `media.enabled`
  on `HealthResponse` (docs/landing-pages-builder-integration.md §4b). This is
  the host's own media library as a second image source, complementary to
  Unsplash.
- `src/services/apiAdapters.ts` / `apiClient.ts` — added `ListMediaFn` /
  `listMedia()` following the exact same adapter-first pattern as
  `searchImages`/`downloadImage` (check `getApiAdapters().listMedia` first,
  fall back to a relative `/api/media` fetch that no standalone server
  implements yet).
- `src/builder/inspector/controls/MediaPicker.tsx` — new file, a sibling of
  `UnsplashPicker.tsx` reusing its exact CSS classes (`pbx-unsplash*`) and
  infinite-scroll/debounce structure. Key behavioral difference: selecting an
  asset must resolve to `{ kind: "url", url }` via `setProp`, never
  `addAsset` — the host already serves the binary from its own storage, so
  inlining it again as a data URL is what makes landings balloon in size.
- `src/builder/inspector/controls/ImageSourceField.tsx` — added a third
  source button ("Media library") gated on `health.media.enabled`, alongside
  the existing Unsplash gate. `pickerOpen` changed from a boolean to
  `"unsplash" | "media" | null` so only one panel is open at a time.
- `src/i18n/locales/{en,es,it}/inspector.json` — added
  `imageSource.mediaLibrary.*` keys, mirroring the shape of
  `imageSource.unsplash.*`.
- `src/builder/inspector/controls/UnsplashPicker.tsx` /
  `src/styles/chrome/image-source.css` — two bugs reported by the host after
  enabling the `searchImages`/`downloadImage` adapters:
  1. **Horizontal overflow in the results grid**: `.pbx-unsplash__grid` used a
     bare `1fr 1fr` column template. A grid track's implicit minimum size is
     `auto` (its content's intrinsic size), so a very wide photo — the photo
     button sets `aspect-ratio: ${width} / ${height}` inline — could force a
     column past the panel's available width. Fixed with
     `grid-template-columns: repeat(2, minmax(0, 1fr))` plus `min-width: 0` on
     `.pbx-unsplash__cell` (same pattern already used by
     `.pbx-templates__grid` in `templates.css`), and `overflow-x: hidden` on
     the grid as a hard backstop.
  2. **Infinite scroll fired on mount instead of waiting for the user to
     scroll**: the `IntersectionObserver` watching the sentinel div had no
     `root` option, so it defaulted to the document viewport instead of the
     grid's own scroll container (`.pbx-unsplash__grid` has
     `overflow-y: auto` and a fixed `max-height`). Inside the host, the
     editor's surrounding layout doesn't necessarily scroll the page itself,
     so the sentinel could register as "intersecting" against the viewport
     right after the first page rendered — triggering page 2, 3, … back to
     back with no user scroll at all. Fixed by adding a `gridRef` on the grid
     div and passing it as `root` to the observer, so intersection is only
     computed against the panel's own internal scroll.
- `src/styles/chrome/inspector-controls.css` — `.pbx-imgsrc__actions` (Upload
  / Media library / Unsplash / Use URL buttons above the image picker)
  changed from a single-row `flex` to a `2×2` grid
  (`repeat(2, minmax(0, 1fr))`): with up to 4 buttons now available (adding
  the media-library and Unsplash buttons on top of the original 2), a single
  row felt cramped. Buttons stretch to `width: 100%` of their cell; with only
  3 present the last cell is simply empty.

### Known cross-package conflict: `@tiptap/*` version split (fixed 2026-09-01)

Both `packages/email-builder-standalone` (`@tiptap/*@3.30.6`, exact — see
below) and `packages/builder42` (`@tiptap/*@3.27.2`) depend on Tiptap, and
both live in the same pnpm workspace — there is no isolation between the two
vendored copies. `prosemirror-state` itself dedupes to one version (confirmed
with `pnpm why prosemirror-state`), so the two editors don't fight over a
shared singleton at runtime. `@tiptap/core` does **not** dedupe on its own —
two copies coexist — which by itself is inert (`builder42` and
`email-builder-standalone` are never mounted on the same page), but the split
had a sharper failure mode: **`@tiptap/starter-kit`'s own manifest declares
its internal sub-extensions (`@tiptap/extension-bold`, `@tiptap/extension-list`,
etc.) with open `^3.x` ranges**, and pnpm resolves those against whatever
compatible release already exists elsewhere in the workspace to reduce
duplicate installs — not necessarily the release the dependent package
itself pins.

This bit twice, on both sides of the split:

1. **`email-builder-standalone`/`@eb/block-notion-text` pinned `@tiptap/*@^3.29.2`**
   (open range). `@tiptap/starter-kit@^3.29.2`'s sub-extensions floated to
   `3.30.6` — newer than the `3.29.2` `@tiptap/core` these packages pinned
   directly — and `3.30.6`'s `@tiptap/extension-list` imports
   `getPreviousBlockSibling`, which `@tiptap/core@3.29.2` doesn't export: a
   **`MISSING_EXPORT` error at Vite's dependency-optimization step**
   (`astro check`/`astro dev`), not a type error. This was latent in the
   committed lockfile; it only surfaced after a clean `pnpm install`
   re-resolved the tree from scratch — the exact trap this section already
   warned about for `pb-static`.
2. Fixing (1) by pinning `email-builder-standalone`/`block-notion-text`'s
   whole Tiptap set to the exact version already in use downstream
   (`3.30.6`, no `^`) closed that gap, but shifted where pnpm's resolver goes
   looking for a "close enough" compatible release next: `builder42`'s own
   `@tiptap/starter-kit@3.27.2` has the *same* open-range sub-extensions
   problem, and once the tree was re-resolved, pnpm started deduping its
   internal `@tiptap/core`/`@tiptap/pm` against the new `3.30.6` instance
   instead of `builder42`'s own pinned `3.27.2` — a **type error**
   (`tsc -p packages/builder42`: "Two different types with this name exist,
   but they are unrelated") in `richtext.ts`/`TextToolbar.tsx`, since
   `StarterKit.configure(...)` came back typed against the wrong `@tiptap/core`
   instance. No runtime bug (both `@tiptap/core` instances were `3.27.2`-ish
   API-compatible), purely a nominal-type collision from having two
   generated `.d.ts` trees for what should be one package.

**Fix, both sides**: exact-pin every `@tiptap/*` dependency `email-builder-standalone`
and `@eb/block-notion-text` declare directly to `3.30.6` (was `^3.29.2`), and
add two single-level `pnpm-workspace.yaml` `overrides` so `builder42`'s own
`@tiptap/starter-kit@3.27.2` resolves its internal `@tiptap/core`/`@tiptap/pm`
against its own pinned version instead of whatever else is in the workspace:

```yaml
overrides:
  '@tiptap/starter-kit@3.27.2>@tiptap/core': '3.27.2'
  '@tiptap/starter-kit@3.27.2>@tiptap/pm': '3.27.2'
```

pnpm's override selector only supports **one** `parent>child` hop (no
`a>b>c` chains), so this pins the *direct* dependency of `@tiptap/starter-kit`
at that exact version — matched by `@tiptap/starter-kit@3.27.2` specifically
(a version string, not a package name), which only exists in `builder42`'s
tree (`email-builder-standalone` uses the separate `3.30.6` instance), so the
override cannot leak across the split. Verified with `pnpm why @tiptap/core`
/`pnpm why @tiptap/pm`: each package's `@tiptap/*` tree dedupes to exactly one
instance, matching what it declares.

**If you bump either package's Tiptap set again**: re-run
`pnpm why @tiptap/core` and `pnpm why @tiptap/pm` afterward and confirm each
package still resolves to a single instance of each. If `builder42` moves off
`3.27.2`, update the override's version-pinned selector to match, or drop it
if the sub-extension floating no longer reaches past what `builder42` itself
pins.

