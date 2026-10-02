# Porting builder42-landing's improvements back into this repo — status

Companion to [`../packages/VENDOR.md`](../packages/VENDOR.md) (which only documents the two seams
this host wires) and to `../builder42-landing/packages/VENDOR.md` (the authoritative list of *what*
diverges, over there — **47** numbered divergences, **numbered to #48**, #28 withdrawn). This file is
the port log **on this side**: what has been replayed into `packages/builder42/` here, what is in
progress, and exactly where the next agent should pick up. Read this before touching
`packages/builder42/` for any reason resembling "bring over a fix from builder42-landing".

> **Re-measured 2026-10-02.** Bundles A–D are **all done and committed** here (bundle D is no longer
> uncommitted — it landed as `b1308ab` and came into `feat/ui-polish-p1` through the merge
> `0bf320e`). A file-level comparison of the two `packages/builder42/src` trees on that date:
> **49 files differ, 2 exist only in builder42-landing, 0 only here, 396 are byte-identical.** The
> two extra files over there are `app/layout/JsonView.tsx` and `app/layout/viewModes.ts` — that is
> divergence **#21**, excluded on purpose by user decision, so their absence here is correct and
> not a gap.
>
> **What is genuinely left to replay: one entry, #46.** (It was two until 2026-10-02; **#47 is now
> done** — see the F31 section below, which landed it in the same change.)
>
> - **#46** — the `headerAutosave` tour anchor, its step and its en/es/it copy, plus the overview
>   tour's first step pointing at the host's autosave chip instead of the logo
>   (`app/tour/tourAnchors.ts` has no `headerAutosave` key here). **Judgement call this host has to
>   make, not a mechanical port:** that anchor exists because that host has no backend and shows a
>   browser-storage autosave chip in its own header. This host persists through its own server, so
>   the right move may be the same decision already taken for #9/#12 — exclude it — or to anchor an
>   equivalent step on this host's own save affordance. Decide, then record the decision here.
>   **Still open**: deliberately not decided while porting F31, because it needs a product call
>   about this host's own header, not a diff.
> - **#47 — DONE 2026-10-02.** `src/index.ts` now re-exports `parseSiteJson` and `ValidationResult`
>   so a host can validate a persisted site before handing it to `Builder42Editor`'s `site` prop.
>   Two additive export lines plus a doc comment; replayed alongside F31's port so both trees sit at
>   a known-equal baseline for the performance change. The **host** half over there (clearing a
>   corrupt `localStorage` key and falling back to the first-run seed) was **not** ported — it is
>   static-host-specific, and this host persists through its own server. The underlying lesson still
>   applies here: never pass an unvalidated stored document into the `site` prop.
>
> The remaining delta inside those 49 files was **not** audited entry-by-entry in that session.
> Much of it is known-deliberate (the #21 exclusion threads through `Canvas.tsx`,
> `EmbeddedChrome.tsx` and the view-mode files; #9/#12, #35 and #42 are excluded or
> reference-only). Do not read "49 differ" as "49 things to port".

## Chain F31 (canvas render cost) — phase 1 PORTED here 2026-10-02

**Status: phase 1 (T1+T2+T3) is applied in this tree. Phase 2 does not exist to port.** This was
paired work by explicit decision, not a divergence left to accumulate. The user's decision
(recorded verbatim as D-F31.7 in `../builder42-landing/.orquestacion/bitacora.md`): that repo is the
**test bed** — smaller, static, no backend, so a browser pass over a built `dist/` takes minutes —
and **the changes land here as soon as they are verified there**, not "eventually". They were
verified there (three gates per task, including three headless-Chromium passes and an export-equality
proof over all 18 templates) and then replayed here the same day.

**Phase 2 (`content-visibility: auto`, T4) was never written over there, so there is nothing to
replay.** Its own baseline refuted it: T0 measured **0 long tasks when scrolling the canvas top to
bottom at every site size**, including 9 377 nodes, so the metric the task existed to move was
already zero and the chain's own rule ("if the scroll is already cheap at 32x, the corresponding
task is dropped") applied. The `contain: layout` / `showModal()` hazard described below was
therefore never exercised. If phase 2 is ever revived, that hazard is still real here.

What was ported, both inside `packages/builder42`:

- **Phase 1 — `builder/canvas/NodeRenderer.tsx`, subscription reduction.** That component opens
  **29** separate `useDocumentStore` subscriptions per node (lines 82–148), and the canvas renders
  every node of the document with no windowing (unconditional recursion at lines 399–405), so a
  9 377-node site evaluates ~272 000 selectors on **every store write**. The refactor: hoist the 11
  stable action references out of the reactive path (store actions are created once in the `immer`
  initializer, so subscribing to them returns the same function forever), move the 11 tree-global
  values into one context mounted at `Canvas`, and narrow `selectedId` / `editingTextNodeId` /
  `pickInsert` to per-node booleans so selecting a node re-renders 2 components instead of all of
  them. **Mechanical, no behavioural intent, no model change — the easiest kind of diff to replay.**
- **Phase 2 — not ported because it was never written.** It would have been
  `content-visibility: auto` on section-level nodes in `styles/chrome/canvas-nodes.css` plus one
  class from `NodeRenderer.tsx`. Kept here only for the hazard it documents, which this repo
  shares if it is ever revived: `content-visibility: auto` implies `contain: layout style paint`,
  and `styles/chrome/canvas.css` already records that `contain: layout` broke the Modal component's
  `showModal()` by creating a containing block for `position: fixed` descendants.

### What actually landed here, file by file

| file | change |
| --- | --- |
| `packages/builder42/src/builder/canvas/NodeRenderer.tsx` | T1 + T2 + T3. 18 hunks from the upstream diff; 17 applied byte-for-byte, 1 by hand (see below). |
| `packages/builder42/src/builder/canvas/CanvasDocContext.tsx` | **new file**, applied verbatim — the provider that subscribes once for the whole canvas. |
| `packages/builder42/src/app/layout/Canvas.tsx` | wraps `<main className="pbx-canvas">` in `<CanvasDocProvider>`. Applied cleanly at offsets −1 and −12 lines (this file carries the #21 exclusion, so its line numbers differ from that repo's). |
| `packages/builder42/src/index.ts` | divergence #47, the `parseSiteJson` / `ValidationResult` re-export. |

**The one hunk that needed hand-work, recorded so it is not mistaken for a conflict in the code.**
It failed on a *context* line, not on a change: a comment in this tree reads "computed for the
`pbx-node--selected` class **below**" where that repo's reads "**above**". This tree's wording is
the accurate one (the class is built further down the file), so **this tree's comment was kept** and
the hunk's two real edits — `selectedId === id` → `isSelected` on the `canvasInlineText` tour anchor
and on the `pbx-node--selected` class — were applied by hand. The two trees' `NodeRenderer.tsx` were
otherwise identical before this port, which is why the rest replayed verbatim.

**`CanvasDocProvider` must enclose every `NodeRenderer` mount point, and it does.** `useCanvasDoc()`
throws outside the provider on purpose — a missing provider is a mounting bug and a loud failure
beats a canvas silently rendering stale values. Verified in this tree: there are exactly three
`<NodeRenderer` call sites (`Canvas.tsx:205`, `ModalEditorOverlay.tsx:99`, and `NodeRenderer.tsx:402`
recursing into its own children), and the first two are both inside `.pbx-canvas__frame`, which is
inside the provider.

### Gates run here, with results

| gate | result |
| --- | --- |
| `tsc -p packages/builder42 --noEmit` | **clean**, exit 0. Run twice: after the three phase-1 files and again after #47. |
| `npm run check` (`astro check`) | **0 errors, 0 warnings, 3 hints** over 339 files. The 3 hints are pre-existing and unrelated (`LandingPageBuilder.tsx:229` `returnValue` deprecation, two unused `useState` bindings in `automations/AutomationBuilder.tsx`). |
| `npm run build` | **green**, exit 0, 1m 39s — so the editor island still bundles with the new context module in the graph. |
| Export-equality scope proof | `git diff` over `packages/builder42/src/builder/{export,model,registry}` and `src/runtime` is **empty**. Nothing `exportSite()` reads, walks or emits was touched, which is the "by construction" half of D-F31.3 — checked here, not assumed from the other repo. |

### What is owed and was NOT done — do not read this port as fully verified

1. **T0's measurement was not re-run on this host, and no number from that repo is reproduced here
   as if it were.** The blocker is structural, not laziness: this host's editor route is
   `src/pages/dashboard/landings/editor.astro`, which is `prerender = false`, redirects to `/login`
   without `Astro.locals.session`, and calls `loadLandingBuilder(session, url)` before it renders.
   A measurement needs a built server, a live session and a way to seed a 9 377-node site through
   the landings backend — which is exactly the asymmetry that made the other repo the test bed.
   **The numbers in `../builder42-landing/.orquestacion/bitacora.md` (chain F31, T0–T3) describe a
   static host, a different page and different surrounding CSS. They do not transfer.** What *does*
   transfer is the subscription arithmetic, which is arithmetic and not a speedup: 29 subscriptions
   per node → 7, plus 13 in the provider for the whole canvas.
2. **Nothing was opened in a browser on this side.** The behavioural evidence for phase 1 is that
   repo's three headless-Chromium passes (20/20 on the eleven hoisted actions, 10/10 on the per-node
   boolean *transitions*, 18/18 on the eleven context values including a slug rename proving the
   path map is sensitive to a slug change and blind to a keystroke). Those ran against a static host.
3. **No test suite was run** — the standing user rule is that suites run only on request. T2 narrows
   the subscription behind the `pbx.canvas.inlineText` anchor, so `tests/tour-anchors-coverage.test.ts`
   and `tests/tourSteps.i18n-parity.test.ts` are the ones worth asking for here. The condition is
   unchanged (`selectedId === id` moved inside the selector), but that is an argument, not a run.
4. **The empirical export-equality proof was not reproduced here.** Over there it was 18 template
   sites re-derived through the real `exportSite()`, all byte-identical. This host's landings live in
   its backend, so the equivalent is a saved landing exported before and after. The scope proof above
   is what this side has.
5. **#46 is still open** (above), by choice.

## Why this exists

`builder42-landing` is a sibling repo (`../builder42-landing`) that copied `packages/builder42` and
`packages/product-tour` from this repo at commit `b62c20b843009b039c4a761ec2230915d09beb92`
(2026-09-17, branch `feat/ui-polish-p1`). Since then it has accumulated **47** documented
improvements/fixes, numbered to #48 with #28 withdrawn. This file tracks replaying them.

## Status at a glance

| Bundle | What | Status |
| --- | --- | --- |
| A (23 files, VENDOR #2,#4-#8,#13,#14) | Defect fixes, no host coupling | **Done.** Commit `e8ecfb4`. |
| B (partial, VENDOR #10,#11,#15) | Embed seams + tour i18n fix | **Done, partial.** Commit `7aa894d`. #9/#12 excluded on purpose (this host persists through its own backend — no `.zip`-download flow to anchor a tour step to). |
| C (18 entries, VENDOR #16-#20,#22-#26,#36-#41,#43,#44) | Structural bugs + additive model/UI, no host decision | **Done — 18/18.** Commit `fb259c1`. See below. |
| D (7 entries, VENDOR #29-#34,#45) | Tour rework + first-run seed + theme seam — needs host decisions | **Done — 7/7. Committed** (`b1308ab`, merged via `0bf320e`). |
| **F31 phase 1** (VENDOR #48) | Canvas subscription reduction — T1 (11 actions hoisted), T2 (3 per-node booleans), T3 (one context for 11 tree-global values) | **Done — ported 2026-10-02.** Paired work (D-F31.7), not a divergence. Type gates + build green here; **measurement and browser pass owed** — see the F31 section. |
| **Left to replay** | VENDOR **#46** (headerAutosave anchor — needs a host decision) | **Not started, open by choice.** #47 was cleared 2026-10-02. |
| Excluded | VENDOR #21 (JSON preview) | **Explicit user decision — do not port.** |
| Reference only | VENDOR #35 (header dropdown width), #42 (canvas padding) | **Do not port** — host-specific visual preferences on that repo's own header/canvas, not structural. |

Bundle C landed as `fb259c1` and bundle D as `b1308ab`; both are in `feat/ui-polish-p1` through the
merge `0bf320e`. Run `git status` before anything else in a new session to confirm what's actually
there; do not trust this file's file list over the real diff if they disagree.

## Bundle C — done (18 of 18)

Applied directly to the working tree (no `.patch` files were generated — edited in place with the
equivalent of the diffs in `../builder42-landing/packages/VENDOR.md`):

- **#17** `styles/chrome/shell.css` — compound `.pbx-body--preview` selectors (Preview ignored panel
  collapse state before).
- **#18** `builder/registry/components/Navbar.tsx` — `:where(a)` in `NAVBAR_CSS` so a node's own
  class can out-specify the brand-link default.
- **#44** same file — seeded brand text `"Your Logo"` (was `"Mi Marca"`), English-only registry
  content convention.
- **#19** `builder/export/minify.ts` — `minifyCss` no longer eats the descendant combinator in
  front of a pseudo-class (`.a :where(b)` used to become the dead selector `.a:where(b)`). New test
  `tests/minifyCss.selectors.test.ts` (4 cases) copied over.
- **#36** `styles/chrome/narrow.css` — `z-index: 41` on `.pbx-panel-handle` (was buried under the
  panel's own `z-index: 40`) + fixed transform on the collapsed right handle (was landing a full
  handle-width past the viewport edge).
- **#38** `styles/chrome/sidebar.css` — `.pbx-body--inspector-collapsed .pbx-inspector` changed
  from `overflow: hidden` to `display: none` (the `<aside>` rounded to ~1px and opened a phantom
  horizontal scrollbar across the whole builder). **Do not confuse with the #14 fix already in
  bundle A**, which touches a *different* rule (`.pbx-sidebar`, the compact rail, not the
  inspector).
- **#23** `builder/store/slices/ui.ts` — `activeBreakpoint` initial value `"base"`, not `"xl"` (a
  first edit used to write silently into a `@media (min-width:1280px)` block).
- **#24** `app/layout/Canvas.tsx` — navigation guard in Edit mode: registry components render real
  `<a href>`s, and nothing cancelled their activation, so a click could navigate the whole
  top-level document away from the editor. **Surgical port**: only the `useEffect` block with
  `cancelLinkActivation`/`cancelSubmit` was taken. The file in builder42-landing mixes this with
  #21 (JSON preview imports/render — left out, per the exclusion) and #33 (`onClickCapture` for
  the canvas tour zone — bundle D, not added yet).
- **#25** `builder/store/slices/behaviors.ts` (new `setNodeBehavior(nodeId, type | null)` action,
  one `set()` per swap) + `builder/inspector/BehaviorsSection.tsx` (rewritten: a single
  `PbxSelect` instead of a per-category accordion, one behaviour visible/editable at a time, a
  warning banner when the node actually has more than one) + i18n (`behaviors.none`,
  `behaviors.hasMoreWarning` in `inspector.json` × en/es/it).
- **#39** `builder/layers/LayersTree.tsx` (rewritten: the document's true root renders as a locked,
  non-selectable row instead of an indistinguishable clickable one) + i18n (`layers.rootLabel`,
  `layers.rootLocked` in `header.json` × en/es/it) + CSS (`.pbx-layers__row--root`,
  `.pbx-layers__label--root` in `inspector-controls.css`).
- **#40** `builder/dnd/NodeActionsRail.tsx` (rewritten `measure()`: centres on the *visible
  intersection* of the node's rect and the scroll container's rect, not the node's full rect — a
  tall node, e.g. the page-root wrapper from #26, used to leave the rail off-screen after scrolling)
  + a `scroll` listener on `.pbx-canvas`.
- **#41** `builder/dnd/SelectionHandle.tsx` (rewritten `measure()`: single-edge clamp instead of
  intersection-centring, because this handle anchors to the node's top edge, not its centre) + the
  same `scroll` listener pattern. **Left out on purpose**: the `{...dataTourAttr(BUILDER42_TOUR_ANCHORS.canvasDragNode)}`
  spread that builder42-landing's version carries on the root element — `canvasDragNode` is VENDOR
  #34 (bundle D), not added to `tourAnchors.ts` here yet. **When #34 lands, add that spread back
  into this file too**, not just the anchor key.
- **#37 + #43** `styles/chrome/inspector-sections.css` — both landed together (they touch the same
  file with no conflict): #37 is the sticky-bar bleed (three new rules so the Props/Estilo/⚡ tab
  row's underline reaches the panel edge instead of stopping 10px short); #43 is two colour
  fixes (`#fff` → `var(--pb-chrome-text-on-accent)`, `#93c5fd` → `var(--pb-chrome-accent-on-dark)`)
  — the second needed a **new token**, `--pb-chrome-accent-on-dark`, added to
  `styles/chrome/tokens.css` (not reassigned in `dark.css`, same pattern as its sibling
  `--pb-chrome-danger-on-dark` — both live on the permanently-dark band). The same swap was also
  applied in `styles/chrome/canvas-code-json.css` (`.pbx-code h3`).
- **#20** `builder/model/types.ts` (`AppearanceStyle` gains `rotate`/`scale`/`transition` as
  individual `StyleValue` fields, never the `transform` shorthand — a component like
  `Sticker.tsx` writes its own inline `transform` and the shorthand would clobber it) +
  `builder/export/cssSerializer.ts` (`hasAnyTransition`/`statesWithTransition` + the
  `@media (prefers-reduced-motion: reduce)` neutralisation, anchored per-selector so a state's own
  transition doesn't out-specify the guard) + `builder/inspector/styleFields.ts` (3 new field defs)
  + `builder/inspector/panel/sections.ts` (3 new rows in the existing `effects` section, tier
  `advanced`) + i18n (`panel.rows.{rotate,scale,transition}` in `inspector.json`, and the same 3
  keys in `common.json` — both needed, checked both) × en/es/it + new test
  `tests/styleTransform.test.ts` (18 cases, copied verbatim).

- **#22 — style presets.** `builder/registry/types.ts` (`StylePresetCategory` +
  `StylePresetDefinition` right after `BehaviorDefinition`) + `builder/model/style.ts`
  (`mergeLayer` is now **exported**; it was module-private here too, so the upstream change applied
  as-is) + `builder/registry/stylePresetRegistry.ts` (**new**, copied verbatim — 10 entries +
  `mergeStylePreset()`) + `builder/store/slices/props.ts` (new `applyStylePreset(nodeId, presetId)`,
  one `set()` = one undo step) + `builder/inspector/StylePresetsSection.tsx` (**new**, verbatim —
  it reuses `PanelSection` and the `.pbx-behaviors-grid`/`.pbx-behavior-card--available`/
  `.pbx-behaviors__hint` classes, all of which **already exist** in this repo's
  `styles/chrome/inspector-sections.css`, so no CSS was needed) + `builder/inspector/panel/
  StylePanel.tsx` (mounts `<StylePresetsSection>` above the field sections, only in the
  no-active-state branch) + i18n (`stylePresets.*`, 12 keys × en/es/it, inserted in upstream's
  position — after `behaviors`, before `fieldHelp`; key parity across the three locales verified
  with a one-line node script: 12/12/12, identical key lists) + the two upstream test files copied
  verbatim (`tests/stylePresetRegistry.test.ts`, `tests/applyStylePreset.undo.test.ts`).

  **Undocumented upstream dependency, ported with it:** the registry's `eyebrow`/`sectionTitle`/
  `bodyText` presets write `typography.letterSpacing` and `typography.textTransform`, **neither of
  which existed in this repo's model** — and no numbered VENDOR entry covers them (VENDOR only
  mentions them in passing, inside #20's point (c)). So this session also ported, from upstream:
  `builder/model/types.ts` (`TypographyStyle.letterSpacing` + `.textTransform`, with their
  docblocks), `builder/inspector/styleFields.ts` (`U_TRACK` unit list + the two field defs —
  `letterSpacing` is `numeric` with `defaultUnit: "em"` because unitless is invalid CSS for it;
  `textTransform` is a 4-option `select`), `builder/inspector/panel/sections.ts` (two `advanced`
  rows in the `typography` section: `typography.letterSpacing`, `typography.transform`), and i18n
  (`panel.rows.{letterSpacing,textTransform}` in `inspector.json` **and**
  `styleLabels.{letterSpacing,textTransform}` in `common.json`, × en/es/it — both bundles carry
  style labels here). Per #20's point (c) `registry/styleToCss.ts` needs no edit: it maps the group
  with `Object.entries`. Without this, `stylePresetRegistry.ts` does not typecheck (3 × TS2353).
- **#16 + #26 — the `pizzeria-page` layout and the page-root wrapper.**
  `builder/registry/layouts/pages/pizzeriaPage.ts` copied **verbatim** (103 KB, 287 nodes) +
  `builder/registry/layoutRegistry.ts`, two independent changes: the new `pizzeria-page` entry
  (archetype `A9`, theme `forno`, English-only — no `siteLocales`), inserted after
  `restaurant-page` as upstream has it; and `wrapPageRootBands(fragment)` (#26) called from
  `loadPageLayout` right after `mod.build()`, which inserts one deletable `container` between a
  page's root and its bands for **every** layout, not just this one. + i18n
  (`templates.layouts.{pizzeriaPage,pizzeriaPageDesc}` in `sidebar.json` × en/es/it). This repo has
  **no** `scripts/dump-template-catalog.mjs` and no `public/templates/**` catalog (grep → the only
  hit is the docblock inside `layoutRegistry.ts` itself), so #26 has no catalog to regenerate here
  — unlike upstream.

## Bundle C — verification state

**Repaired first, before anything else:** `builder/export/cssSerializer.ts` did not parse — the #20
port had eaten the two opening lines of `classNameForNode`'s docblock (`/**` + its first line), so
the file ended with a dangling comment body and `tsc` reported 31 syntax errors from line 252 on.
The two lines were restored from `git show HEAD:…` (unchanged text) — the ported logic itself was
intact. **A green test suite did not catch this**, because `vitest` only loads the modules a test
imports.

Gates actually run in this session, in this order:

1. `pnpm --filter builder42 exec tsc --noEmit -p tsconfig.json` → **clean**, re-run after every
   step (after the `cssSerializer` repair, after #22 + the typography fields, and after #16/#26).
2. `pnpm --filter builder42 test` → **234 passed / 22 files**, green. Run at the point where
   bundle C was 13/18 + the repair; **not** re-run after #22/#16/#26 were added (the user asked to
   skip test runs for the rest of the session).

Still **not** verified, and the next thing to do:

- The two test files copied with #22 (`stylePresetRegistry.test.ts` 28 cases,
  `applyStylePreset.undo.test.ts` 5 cases) have **never been executed here**, and `tsconfig.json`'s
  `include` is `["src", "shared"]`, so `tsc` does not even typecheck them. Expected total after
  running: 234 + 33 = **267**, but treat that as a prediction, not a baseline.
- `npm run check` (astro check) and `npm run build` have not been run against any of bundle C.
- Nothing has been opened in a browser. The rewritten React files (`BehaviorsSection.tsx`,
  `LayersTree.tsx`, `NodeActionsRail.tsx`, `SelectionHandle.tsx`) plus the new
  `StylePresetsSection.tsx` are the highest risk: this package's vitest suite has no jsdom, so
  green tests do not prove a React change renders (caveat 21 in
  `../builder42-landing/docs/HANDOFF.md`).

## Bundle D — done (7 of 7)

The user confirmed (2026-09-30) adopting the **full** tour rework, not a partial cut — all four
tours, the chooser, the zone-based auto-start, and the theme seam. All of it is now in the working
tree, uncommitted. What landed, in the order it was applied (each step depends on the one before):

- **#30 — per-tour persistence.** `hooks/useLocalConfig.ts` gains `tours: Record<string,
  TourPersistedState>` (default `{}`) and exports `TourPersistedState`; the four flat keys
  (`tourSeen`/`tourVersion`/`tourCompleted`/`tourLastStepIndex`) stay **declared** but are no
  longer read or written anywhere — documented as legacy in place. No migration: every visitor is
  re-offered the new per-tour tours. `app/tour/useBuilder42Tour.ts`'s
  `createConfigBackedTourPersistence()` now keys all five methods off the `tourId` they already
  received, read-modify-writing the whole `tours` record each time (no cached copy — two bridge
  instances must not clobber each other).
- **#31 — the tour split into four.** `app/tour/tourSteps.ts` gains four additive exports
  (`BUILDER42_TOUR_IDS`/`Builder42TourId`/`BUILDER42_TOUR_ORDER`, `BUILDER42_TOUR_ANCHOR_MAP`,
  `buildBuilder42TourStepsFor`); `buildBuilder42TourSteps` itself was **not** touched (D-F29.24).
  `useBuilder42Tour.ts` drops `const TOUR_ID`, builds per tour id, tracks the active tour in a ref
  so `languageChanged` rebuilds the right one, and exports `TOUR_VERSION`.
- **#34 — the four new anchors.** `sidebarDragHint`, `canvasInlineText`, `canvasDragNode`,
  `settingsTheme` in `tourAnchors.ts`, one step each in the flat list (6b/9b/9c/15b) and one entry
  each in the anchor map. Call sites: `Sidebar.tsx` (`SidebarItem` gained an optional `tourAnchor`
  prop, passed `true` **only** for `idx === 0 && defIdx === 0` of the open-mode palette),
  `NodeRenderer.tsx` (conditional on `selectedId === id`), `SelectionHandle.tsx` (unconditional on
  `.pbx-drag-handle`), `ThemesEditor.tsx` (unconditional on its root `<section>`). The two
  conditional spreads are the part a file-diff replay gets wrong.
- **#32 — the chooser.** `app/tour/tourChooserStore.ts` and `app/tour/TourChooserModal.tsx` copied
  verbatim (the modal reuses `SimpleModal` + the `pbx-modal*`/`pbx-onboarding-modal*` classes, all
  of which already exist here — no CSS added). `requestBuilder42TourRestart()` keeps its exact name
  and signature but now opens the chooser (D-F29.27); `buildTour`'s `onEvent` opens it on
  `tour_completed` of the **overview** tour only. `<TourChooserModal />` is mounted unconditionally
  in both shells (`app/App.tsx`, `Builder42Editor.tsx`).
- **#33 — zone tours + the H125 fix.** `app/tour/zoneTourTriggers.ts` copied verbatim (all gating
  lives there, including the `library`-only `sidebarTab === "components"` precondition from
  D-F29.36). `onClickCapture` added to exactly three elements: `Sidebar.tsx`'s
  `.pbx-side-tabs__panel` (**not** the panel-slot root — that would let a tab click start the
  tour), `Canvas.tsx`'s edit-mode `<main className="pbx-canvas">`, and `Inspector.tsx`'s
  `.pbx-panel-slot--right`. `useBuilder42Tour.ts` also gained `isBuilder42TourRunning()` backed by
  a module flag set on `tour_started` and cleared on both terminal events plus unmount, and the
  H125 explicit-construction fix inside `markSeen`/`saveProgress`.
- **#45 — the theme seam, wired per the decision recorded below.** `Builder42EditorProps` gains
  `hostThemeControl?: { effective: "light" | "dark"; onToggle: () => void }`, threaded through
  `Builder42EditorInner` to `HostCanvasToolbar`, which renders a new `HostThemeToggle` (a single
  `Sun`/`Moon` icon button in the `__right` group, reusing `.pbx-history`/`.pbx-history__btn` — no
  CSS added; renders `null` when the prop is absent). `header.json` gains `theme.toggleTo`
  (interpolated) × en/es/it. **Host side** (`src/components/react/LandingPageBuilder.tsx`):
  `useHostTheme()` for the effective value and a local `toggleHostTheme` writing
  `<html data-theme>` + `localStorage['md-theme']`, the same pair `AppShell.tsx` owns.
- **#29 — the first-run seed helper.** `builder/baseSite.ts` copied verbatim and re-exported from
  the barrel. **Ships inert here**: no surface in the package calls it and this host does not seed
  with it — its landings come from the backend. The entry's own invariant makes that correct (the
  first-run *condition* is always the host's to evaluate); if this host ever wants a seeded blank
  landing, the decision belongs in `LandingPageBuilder.tsx`, not in the package.

**Excluded from bundle D on purpose, same as in bundle B:** VENDOR #12's `headerDownload` anchor
(`pbx.header.download`) and its `downloadAvailable` config flag. This host persists landings
through its own backend and mounts no `.zip`-download button, so there is nothing to highlight.
Consequences a future replay must not "fix" by copying upstream: the `overview` tour has **4**
anchors here, not 5; `BUILDER42_TOUR_ANCHOR_MAP` has no `headerDownload` entry;
`Builder42TourStepsConfig` has no `downloadAvailable`; and `tour.json` has no
`steps.headerDownload` copy.

i18n for bundle D: `tour.json` × en/es/it gained the `chooser` section (title, subtitle,
closeLabel, and title+description for each of the four tours) and the four new
`steps.{sidebarDragHint,canvasInlineText,canvasDragNode,settingsTheme}` entries — 22 steps per
locale, identical key sets across the three (verified by script), `headerDownload` absent.

### Tests touched for bundle D (ported, not run)

- `tests/tour-anchors-coverage.test.ts` — the four new anchors added to `filesByAnchor` so the
  "exactly one call-site per registered anchor" invariant still holds. The host-header path and the
  `!channel && identity` assertion stay as they are here (VENDOR #1); no `headerDownload` case.
- `tests/tourSteps.i18n-parity.test.ts` — the four new anchor→step-id mappings.
- `tests/useBuilder42Tour.persistence.test.ts` — the two assertions that read the flat keys now
  read `tours[tourId]`, same as upstream. Upstream's own `reset()` case still asserts
  `readConfig("tourSeen") === false`, which now passes on the declared default; left identical.
- Not ported: upstream's edits to `tourSteps.i18nInstance.test.ts` and
  `tourSteps.standaloneChrome.test.ts` (both only add `downloadAvailable` to a config literal —
  excluded here), and `tests/tourThemeCss.test.ts` (guards VENDOR #3, which this repo has not
  ported — see the gap list below).

## Gaps found while porting — divergences NOT in any bundle

Three things upstream carries that no numbered VENDOR entry covers, and that this log had not
recorded either. Two were **required** by bundle C and are now ported; the rest are still open.

**Ported, because bundle C did not compile/render without them:**

1. `TypographyStyle.letterSpacing` + `.textTransform` (model, style fields, two `advanced` rows,
   i18n in `inspector.json` + `common.json`) — `stylePresetRegistry.ts` writes both. Details under
   #22 above. Upstream's `tests/typographyTracking.test.ts` (141 lines) was copied with them.
2. The **`sticker` component and the `sticker-drag` behaviour.** `pizzeriaPage.ts` (#16) creates 6
   nodes of type `"sticker"` and attaches the `sticker-drag` behaviour — neither existed here, so
   the layout would have rendered "type not registered" six times with a dead behaviour. Ported:
   `registry/components/Sticker.tsx`, `registry/behaviors/stickerDrag.ts`,
   `runtime/behaviors/stickerDrag.ts`, the prebuilt `runtime/dist/stickerDrag.js`, both registry
   entries (`componentRegistry.ts`, `behaviorRegistry.ts`), the palette icon
   (`ComponentTypeIcon.tsx` + a `Sticker` re-export in `Icon.tsx`), i18n
   (`common.json`'s `components.sticker` + `props.sticker.*`, `inspector.json`'s
   `behaviors.fields["sticker-drag"].*` × en/es/it), and `tests/sticker.test.ts`.

   **One step beyond upstream, deliberately:** upstream has no `behaviors.name["sticker-drag"]` or
   `behaviors.desc["sticker-drag"]` entry, so `BehaviorsSection.tsx` — which renders
   `t("behaviors.name.<type>", { defaultValue: def.label })` — falls back to the definition's
   hardcoded Spanish label ("Pegatina arrastrable") in English and Italian too. Both keys were
   added here in all three locales, placed right after `sticky`'s (the reference entry, and the
   behaviour `stickerDrag.ts`'s own docblock keeps comparing itself to). Every other behaviour in
   the catalogue has both keys; now this one does as well.

   **Lesson for the next bundle:** a layout is not "copy one file" — audit the node types and
   behaviour ids it references against this repo's registries before calling it done.

**Still open, deliberately not touched in this session** (each needs its own decision; none blocks
bundles C or D):

- **VENDOR #3** — the tour theme stylesheet as a top-level static import instead of
  `ensureTourThemeCss()`'s dynamic one. Not in bundle A's list and never ported; this repo still
  has the helper and both its call sites, and `useBuilder42Tour.ts` was hand-edited for bundle D
  precisely to preserve that. Upstream's `tourThemeCss.test.ts` guards the opposite shape, so it
  was not copied. The upstream rationale (a stale Vite CSS preload warning) is host-specific and
  unverified here.
- **VENDOR #27** — the host's API adapters registered in a `useMemo` (render phase) instead of a
  `useEffect`, so `fetchHealth()` calls from child mount effects don't fall through to the network
  fallback. Also unaccounted for in any bundle. Worth evaluating: the defect it fixes would show up
  here too (`app/App.tsx` and `Header.tsx` call `fetchHealth()` on mount).
- Upstream-only i18n keys outside every bundle, left absent on purpose: `canvas.json`'s `json.*`
  (VENDOR #21, excluded), `header.json`'s `onboarding.chooseLanguage`, `inspector.json`'s
  `numericUnitInput.*` and `seoSettings.*Placeholder` (their components — `NumericUnitInput.tsx`,
  `SeoSettings.tsx` — also differ upstream), and `tour.json`'s `steps.headerDownload` (#12).
- Chrome CSS still differing: `styles/chrome/{canvas,header,inspector,inspector-controls}.css`
  (#35 and #42 are "do not port"; the rest was not audited this session).

## Bundle D — the wiring decision behind #45 (kept for the record)

**#45 (theme seam) has a concrete wiring decision already made, described here so it isn't
re-derived:** maildrill has no `EditorHeader.tsx` of its own the way builder42-landing does — the
landing editor's host is `src/components/react/LandingPageBuilder.tsx`, using the *shared*
`ChannelEditorShell` (same shell the email editor uses). So `hostThemeControl` should render
**inside the package's own canvas toolbar** (`HostToolbar.tsx`'s `HostCanvasToolbar`), using the
default behaviour VENDOR #45 describes — **not** the follow-up variant where builder42-landing
moved the control into its own site header, because this host has no equivalent header slot to put
it in. Read/write plan:
- **Read**: `src/components/react/hooks/useHostTheme.ts` already exists and is already the pattern
  used by `VisualEmailBuilder.tsx` (`const hostTheme = useHostTheme();` → passed down as a prop,
  D30: "the host decides the theme, the package receives it as a prop, the package never reads
  `data-theme` itself"). Reuse it as-is in `LandingPageBuilder.tsx`.
- **Write**: no existing toggle function to reuse directly — `AppShell.tsx`'s `toggleTheme` (lines
  ~189-198) is the reference pattern: `document.documentElement.setAttribute('data-theme', next)`
  + `localStorage.setItem('md-theme', next)` in a try/catch. Write an equivalent local callback in
  `LandingPageBuilder.tsx` and pass `hostThemeControl={{ effective: hostTheme, onToggle }}` to
  `<Builder>`.

**#34's tour anchors have call-sites beyond `tourAnchors.ts` itself** — all four are now stamped
(see the bundle D section above); this list stays as the record of where, because none of it is
visible from `tourAnchors.ts`:
- `SelectionHandle.tsx` needs `{...dataTourAttr(BUILDER42_TOUR_ANCHORS.canvasDragNode)}` added back
  onto its root element (deliberately left out when #41 was ported earlier this session — see the
  note under #41 above).
- `app/layout/Sidebar.tsx` needs the conditional `tourAnchor` prop on `SidebarItem`, applied **only**
  to the first item of the first "Básicos" group in open mode — getting this unconditional breaks
  the anchor-coverage test's "exactly one call-site" invariant.
- `builder/canvas/NodeRenderer.tsx` needs the conditional spread on the selected node only.
- `builder/inspector/ThemesEditor.tsx` needs the unconditional anchor on its root section.
- `tour.json`'s three locale files need `steps.{sidebarDragHint,canvasInlineText,canvasDragNode,
  settingsTheme}` entries.

**#12's exclusion still holds and must not be undone by a careless copy of `tourAnchors.ts`.**
`headerDownload` (`pbx.header.download`) exists in builder42-landing's `tourAnchors.ts` right next
to the four #34 anchors — **do not port it**. This host's own `Builder42EditorHandle.downloadZip()`
equivalent (VENDOR #9) was excluded in bundle B on purpose: this host persists through a real
backend, so there is no `.zip`-download button in its chrome to anchor a tour step to.

Read the four sub-entries (#29, #30, #31+#32, #33) in
`../builder42-landing/packages/VENDOR.md` in full before writing any code — they're long, and the
ordering/gating details (which zone tour sits at which position, the H125 stale-progress fix
inside the persistence bridge, the `library` zone's tab-row exclusion fix) are exactly the kind of
thing that's invisible in a file diff and only readable in that prose.

## Gates to run once bundle C (or D) reaches a stopping point

```bash
pnpm --filter builder42 exec tsc --noEmit -p tsconfig.json
npm run check        # astro check — the authoritative type gate for this whole repo
pnpm --filter builder42 test
npm run build
```

No baseline numbers are recorded here on purpose — the last known-good baseline for this package
was captured **before** this session's bundle C changes (post-bundle-B: `pnpm --filter builder42
test` 212 passed / 20 files, per the `7aa894d` commit message). Bundle C then measured 234 passed /
22 files at 13/18 + the `cssSerializer` repair. **Nothing has been test-run since**, on the user's
instruction to skip test runs for the rest of the session, so bundle D's state is:

- `pnpm --filter builder42 exec tsc --noEmit -p tsconfig.json` → **clean**, re-run after every step
  of bundle D (persistence, split, anchors, chooser, zone triggers, theme seam, `baseSite`, and the
  sticker/typography gap fixes).
- The host side (`LandingPageBuilder.tsx`) reports **no** errors under the repo-root `tsc`. Note
  that the repo-root `tsc -p tsconfig.json` is **not** a usable gate for `packages/builder42`: its
  `@/*` alias points at the host's `src/`, so the vendored package's own `@/…` imports all resolve
  to `TS2307` there. The package's own `tsconfig.json` is the gate; `npm run check` (astro check) is
  the authoritative one for the host and has **not** been run.
- Test files added/edited but **never executed**: bundle C's `stylePresetRegistry.test.ts` (28) and
  `applyStylePreset.undo.test.ts` (5), the gap fixes' `typographyTracking.test.ts` and
  `sticker.test.ts`, and bundle D's three edited tour tests. Expect the suite count to move well
  past 267; treat any number in this file as a prediction, not a baseline.
- Nothing has been opened in a browser. For bundle D that matters more than usual: the chooser
  modal, the four tours' step ordering, and the zone triggers are behaviour this package's
  jsdom-less vitest cannot exercise at all.

## Bookkeeping when bundle C or D lands (commit + housekeeping)

1. Commit bundle C (and/or D) separately from any further work, one `fix(builder42): …` commit per
   bundle, same convention as `e8ecfb4`/`7aa894d`. (Bundle C landed as `fb259c1`.)
2. Update `../builder42-landing/packages/VENDOR.md`'s intro sentence (currently "Forty-four
   divergences") and `../builder42-landing/docs/HANDOFF.md`'s caveat 13 and
   `../builder42-landing/AGENTS.md`'s caveat 7 to note which numbers have been replayed here —
   **do not delete the divergence entries over there**; they document that repo's own history and
   stay valid regardless of what this repo has caught up on. This file (not VENDOR.md) is the
   source of truth for *this repo's* porting status. **Still pending** as of bundle D.
3. Update this file's "Status at a glance" table and move completed items from "remaining" to
   "done" in the same commit as the code that ports them.
4. Consider adding the two unaccounted divergences found this session (#3, #27) to VENDOR.md's own
   numbering over there, or at least noting in that file that `letterSpacing`/`textTransform` and
   the `sticker` component/`sticker-drag` behaviour are undocumented divergences — this repo hit all
   four the hard way (a type error and a would-be broken template).
