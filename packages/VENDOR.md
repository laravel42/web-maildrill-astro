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

---

# Vendored Builder42 (landing-page editor)

`packages/builder42/` is copied from `pb-static` (`~/projects-container/projects/_laravel42/pb-static`),
the visual landing-page/site editor — **upstream**, unlike EmailBuilder.js. This
is docs/52 (F8) of that repo's plan: same vendoring shape as the EmailBuilder.js
packages above (consumed from `src/` by this app's Vite, never from `dist/`),
but a from-scratch copy rather than a third-party import — there is no
`web-*-js` counterpart to track.

## Re-importing after an upstream change

Copy `src/` and `shared/` from `pb-static`, then re-apply the manifest
adaptations below. Per pb-static's `docs/52 §4.2b`, the goal is **zero code
patches**: any change needed to make the editor work embedded is meant to land
in `pb-static` itself, never as a patch here. If a future sync needs one
anyway, list it in a "Code patches" section here, same as EmailBuilder.js above.

### Manifest adaptations

- `main`/`types`/`exports` point at `src/index.ts`, never `dist/` — this app
  never builds the package, its own Vite compiles the copy. `./style.css` maps
  to `src/styles/chrome-embedded.css` (the embed-safe barrel from pb-static's
  `docs/52 F6` — omits the standalone-only `@font-face`/`html,body,#root` rules,
  which don't belong inside this host's page).
- `react`/`react-dom` are `peerDependencies`, not `dependencies` — same reason
  as EmailBuilder.js: two React instances break hooks.
- `scripts` and build tooling (vite, vitest, typescript, `@types/*`) are
  dropped — this app compiles the source directly.

### Code patches

- `shared/api.ts` — added `MediaAsset`/`MediaListResponse` and `media.enabled`
  on `HealthResponse` (docs/landing-pages-builder-integration.md §4b). This is
  the host's own media library as a second image source, complementary to
  Unsplash — there is no upstream `pb-static` counterpart to conflict with, so
  a future sync should just keep these alongside whatever upstream adds here.
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

Per pb-static's `docs/52 §4.2b`, the ideal is zero patches — but this one has
no upstream equivalent to land in (`pb-static` doesn't have a "host media
library" concept), so it stays listed here instead.

### Known cross-package conflict: `@tiptap/*` version split

Both `packages/email-builder-standalone` (`@tiptap/*@^3.29.2`) and
`packages/builder42` (`@tiptap/*@3.27.2`) depend on Tiptap, and both live in
the same pnpm workspace — there is no isolation between the two vendored
copies. `prosemirror-state` itself dedupes to one version (confirmed with
`pnpm why prosemirror-state`), so the two editors don't fight over a shared
singleton at runtime. `@tiptap/core` does **not** dedupe on its own — two
copies coexist — which by itself is inert (`builder42` and
`email-builder-standalone` are never mounted on the same page), but the split
has a sharper failure mode worth documenting: `@tiptap/starter-kit@3.27.2`'s
*own* manifest declares its internal sub-extensions (`@tiptap/extension-bold`,
`@tiptap/extension-list`, etc.) with open `^3.x` ranges. The npm registry
serves those against whatever is newest today (`3.30.5` at the time of
writing), which expects a newer `@tiptap/core` than 3.27.2 actually exports
(e.g. `getPreviousBlockSibling`) — a **`SyntaxError` at import time** inside
`pb-static`'s own `richtext.ts`, not something `email-builder-standalone`
triggers. This was latent in `pb-static`'s committed lockfile already; it only
surfaced after a clean `pnpm install` re-resolved the tree from scratch.
`pb-static`'s `pnpm-workspace.yaml` now pins every `@tiptap/starter-kit`
sub-extension to `3.27.2` via `overrides` to keep `@tiptap/core` deduped to one
version there. **This app's own lockfile is unaffected** (its
`email-builder-standalone` copy pins `^3.29.2` directly, with no `starter-kit`
in its dependency tree), but if a future sync bumps `builder42`'s Tiptap set,
re-run `pnpm why @tiptap/core` here afterward — a real fix means bumping both
vendored copies to the same Tiptap release, not just re-pinning.

