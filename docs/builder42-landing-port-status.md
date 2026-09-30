# Porting builder42-landing's improvements back into this repo — status

Companion to [`../packages/VENDOR.md`](../packages/VENDOR.md) (which only documents the two seams
this host wires) and to `../builder42-landing/packages/VENDOR.md` (the authoritative list of *what*
diverges, over there — 44 numbered divergences, #16–#45, #28 withdrawn). This file is the port log
**on this side**: what has been replayed into `packages/builder42/` here, what is in progress, and
exactly where the next agent should pick up. Read this before touching `packages/builder42/` for
any reason resembling "bring over a fix from builder42-landing".

## Why this exists

`builder42-landing` is a sibling repo (`../builder42-landing`) that copied `packages/builder42` and
`packages/product-tour` from this repo at commit `b62c20b843009b039c4a761ec2230915d09beb92`
(2026-09-17, branch `feat/ui-polish-p1`). Since then it has accumulated 44 documented improvements/
fixes that never made it back here. This file tracks replaying them.

## Status at a glance

| Bundle | What | Status |
| --- | --- | --- |
| A (23 files, VENDOR #2,#4-#8,#13,#14) | Defect fixes, no host coupling | **Done.** Commit `e8ecfb4`. |
| B (partial, VENDOR #10,#11,#15) | Embed seams + tour i18n fix | **Done, partial.** Commit `7aa894d`. #9/#12 excluded on purpose (this host persists through its own backend — no `.zip`-download flow to anchor a tour step to). |
| C (18 entries, VENDOR #16-#20,#22-#26,#36-#41,#43,#44) | Structural bugs + additive model/UI, no host decision | **Done — 18/18.** See below. Uncommitted. |
| D (7 entries, VENDOR #29-#34,#45) | Tour rework + first-run seed + theme seam — needs host decisions | **Not started.** Decisions already made (see below); no code written. |
| Excluded | VENDOR #21 (JSON preview) | **Explicit user decision — do not port.** |
| Reference only | VENDOR #35 (header dropdown width), #42 (canvas padding) | **Do not port** — host-specific visual preferences on that repo's own header/canvas, not structural. |

No commit has been made in this repo for bundle C or D yet — everything below is **uncommitted in
the working tree**. Run `git status` before anything else in a new session to confirm what's
actually there; do not trust this file's file list over the real diff if they disagree.

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

## Bundle D — decisions made, nothing implemented

The user confirmed (2026-09-30) adopting the **full** tour rework, not a partial cut — all four
tours, the chooser, the zone-based auto-start, and the theme seam. Nothing has been coded yet.

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

**#34's tour anchors have call-sites beyond `tourAnchors.ts` itself** — when adding
`sidebarDragHint`/`canvasInlineText`/`canvasDragNode`/`settingsTheme` to
`app/tour/tourAnchors.ts`, remember every file that stamps one:
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
test` 212 passed / 20 files, per the `7aa894d` commit message). Re-run and record the new numbers
in the commit message when bundle C (or D) is committed; do not assume the count only went up by
exactly "one test per file added" — `BehaviorsSection.tsx` and `LayersTree.tsx` were rewritten, not
just extended, and any tests that assert their previous shape will need updating too if any exist
(none were found referencing either file directly as of this session, but this was not exhaustively
searched for test files that snapshot rendered output).

## Bookkeeping when bundle C or D lands (commit + housekeeping)

1. Commit bundle C (and/or D) separately from any further work, one `fix(builder42): …` commit per
   bundle, same convention as `e8ecfb4`/`7aa894d`.
2. Update `../builder42-landing/packages/VENDOR.md`'s intro sentence (currently "Forty-four
   divergences") and `../builder42-landing/docs/HANDOFF.md`'s caveat 13 and
   `../builder42-landing/AGENTS.md`'s caveat 7 to note which numbers have been replayed here —
   **do not delete the divergence entries over there**; they document that repo's own history and
   stay valid regardless of what this repo has caught up on. This file (not VENDOR.md) is the
   source of truth for *this repo's* porting status.
3. Update this file's "Status at a glance" table and move completed items from "remaining" to
   "done" in the same commit as the code that ports them.
