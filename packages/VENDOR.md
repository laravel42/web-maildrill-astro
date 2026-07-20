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

## Scope

`packages/**` is excluded from this repo's `tsconfig` and eslint: it is upstream
code, checked upstream, and this repo's rules (`noUncheckedIndexedAccess`, etc.)
are stricter than the ones it was written against.
