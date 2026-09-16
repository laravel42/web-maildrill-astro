# Orchestration log — product tours (driver.js)

Protocol: [`SKILLS/orquestation.md`](../SKILLS/orquestation.md) — serial, one subagent at a
time, one commit per task, orchestrator runs the gate.

Plan being executed: [`docs/product-tour-driverjs-plan.md`](../docs/product-tour-driverjs-plan.md).

**Branch:** `feat/ui-polish-p1` (do not switch mid-chain).

---

# START HERE — next session

**NEXT ACTION, verbatim: run T6 (e2e coverage in `tests/e2e/tour.spec.ts` + `helpers/tour.ts` for
what T1–T5 added — see "After T5" item 2 below). B35/B36 (the Next-button label/click routing bug
in driver.js itself) needs an orchestrator decision before it is fixed — read both before doing
anything else, but they do not block T6.**

**State at hand-off (2026-09-16, sixth session): `HEAD = 316c490`, branch `feat/ui-polish-p1`, tree
clean** except the pre-existing untracked `.cursor/hooks/` and `.kiro/` (not this chain's).
**Not pushed.** T5 landed green: `@md/product-tour` **11 files / 84 tests** (was 10/81 — +3 new
tests in `waitForStepAnchor.test.ts`, per T5's DONE WHEN), `builder42` **14 files / 153 tests**
(unchanged), `email-builder-standalone` **13 files / 123 tests** (unchanged), `pnpm check` 339
files 0 errors / 0 warnings / 3 hints (unchanged). `tests/e2e/tour.spec.ts` NOT re-run this session
— still last measured 22 passed at `22d2b10`, before T1–T5. Re-measure before trusting.

**T5, what actually happened (read before touching this area again):** the relaunch went smoothly
for the code T5's contract described (`waitForStepAnchor()`, wired at both call sites, using the
already-exported `waitForAnchor()` from `anchors.ts` with a 25 ms interval per the contract). The
two obsolete fixtures in `anchorResolutionConcurrency.test.ts` were fixed exactly as the
orchestrator had pre-decided (first step's anchor stamped into the DOM, the rest left missing) —
both assertions stand unchanged. **What the contract did NOT anticipate, found while writing test
(a) of the three new DONE WHEN cases:** this package's own D21 keyboard guard
(`if (driverInstance.isLastStep()) return;`) reads a driver.js internal that is NOT a plain
bounds check — see **B35** below, now fixed for the keyboard path (same commit, same file, still
inside T5's declared scope: `createTour.ts`) but NOT for driver.js's own popover Next-button
click, which is a separate, not-yet-fixed instance of the same defect shape. A pre-existing
baseline test (`stepActivation.test.ts`, the "D35.5 reconciliation poll loop" T8b test) had to be
corrected as a result — documented inline in that file and in the log entry for T5, per rule 7:
its old assertion (`before(never-appears-landing)` must be ABSENT) was silently passing for the
wrong reason (the D21 bug swallowing the ArrowRight before `transitionTo()` ever ran), not for the
reconciliation guarantee its comment described. The corrected assertion
(`expect(log).toEqual(['before(never-appears-landing)'])`) still proves that guarantee, just
without the bug's help.

| Task | What                                                                          | Scope (files)                                                                                             | Commit    | Gate  |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------- | ----- |
| T5   | engine: wait for the incoming step's anchor after `before()` (**D43**)          | `packages/product-tour/src/createTour.ts` + `tests/anchorResolutionConcurrency.test.ts` (fixtures) + `tests/waitForStepAnchor.test.ts` (new) + `tests/stepActivation.test.ts` (one obsolete assertion, see B35) | `316c490` | green — 11 files / 84 tests (was 10/81) |
| T6   | e2e: one control per toolbar step, templates tab really opens, sections open     | `tests/e2e/tour.spec.ts`, `tests/e2e/helpers/tour.ts`                                                     | —         | — (unblocked, not yet started) |

## After T5

1. **T4 re-verified in the browser — DONE, this session.** Threw away a probe spec (deleted after
   use, per its own doc comment) that walked `/dashboard/landings/editor` with `ArrowRight` against
   the live dev server (mtimes bumped first, per B32). Confirmed by the actual step order/anchors
   logged: `pbx.header.identity` → `pbx.toolbar.views` → `pbx.toolbar.viewport` →
   `pbx.toolbar.history` → `pbx.sidebar.tabs` → `pbx.sidebar.palette` → `pbx.sidebar.templates` →
   `pbx.canvas.frame` → `pbx.settings.tabs` → **`pbx.settings.layers`** ("Capas") →
   **`pbx.settings.pages`** ("Páginas") → **`pbx.settings.languages`** ("Idiomas", B33) — all four
   `pbx.settings.*` steps T4 added are reached, each with its own tab open (title text matches the
   section). The tour genuinely ends at "Idiomas" (title stops advancing there), consistent with
   D42 (`pages.breadcrumb`/`profileMenu` are standalone-only, skipped in the embed). T4 is closed.
2. **T6 — e2e coverage** for what this chain added, in `tests/e2e/tour.spec.ts` +
   `tests/e2e/helpers/tour.ts`: the two toolbar steps highlight one control each (assert the
   highlighted element contains Edit/Preview but NOT the viewport switch, and vice versa); the
   templates step really shows the Templates tab; each site-section step reaches its anchor with the
   matching tab active. The orchestrator verified all of these by throwaway probe this session (see
   item 1 above and B36) — T6 is about making them permanent.
3. **B35 (this session) needs a decision before it is fixed** — and is now CONFIRMED live, not just
   read from source (see **B36**): driver.js's own popover Next-button click can still route to
   `onDoneClick` instead of this package's `onNextClick` when the next step's anchor is not yet
   mounted — the same D43 bug, for clicks instead of arrow keys. Read B35's entry in full before
   proposing a fix; it names two candidate approaches and neither is a small, obviously-safe change
   (both touch how this package owns driver.js's popover button wiring, similar in spirit to
   D8/D18's Escape/arrow takeover).
4. **Owed to the user, still open:** **B33** (the tour speaks Spanish while the embedded editor
   speaks English — `tourSteps.ts` resolves copy from the global i18next singleton instead of the
   editor's per-instance i18n; fix shape recorded in the finding), **B23** and **B3** (eyes-on
   dark-mode / popover review).

**Reading of the request (verified against the source, not guessed):** "layers / pages / languages"
are not sidebar tabs at all — they are tabs of `SiteSettingsPanel` (`SITE_TABS` =
layers · pages · themes · seo · languages · publish · settings), rendered in the RIGHT panel
(`Inspector.tsx`) whenever no node is selected. The left sidebar has only
components · tokens · templates (`SideTab`), with tokens hidden in the simple embed. So the chain
touches both panels.

**The landing tour is now 18 registered anchors / 14 eligible steps in the embed** (18 − 3 that need
a selected node on an empty canvas − `publish` while the host reports it disabled), in this order:
header identity · **view mode** · **screen size** · history · sidebar tabs · palette ·
**page templates** · canvas · node actions · inspector tabs · inspector breakpoints ·
**site sections** · **layers** · **pages** · **languages** · pages breadcrumb · publish · profile
menu. The last two of that list plus the breadcrumb are standalone-only surfaces (**B9**) and are
skipped in the embed by design (**D42**).

**Contract decisions for this chain (orchestrator's, not delegable):**

- **D37 — the landing tour highlights one control per step** (extends D16/D17, won for the email
  editor under B17). `pbx.toolbar.views` is re-pointed from the whole centre block of
  `HostCanvasToolbar` (which contains Edit/Preview **and** the viewport dropdown) to the
  Edit/Preview group alone; the viewport switch gets its own anchor `pbx.toolbar.viewport` and its
  own step. Same defect shape B17 described for `eb.header.identity`.
- **D38 — the sidebar's active tab moves into the document store** (`sidebarTab: SideTab`,
  `setSidebarTab`), mirroring **D28** in the email editor. A tour `before()` runs outside React and
  cannot touch a component's `useState`, so "show the Templates tab" is unreachable while
  `Sidebar.tsx` owns that state locally. The `SideTab` type moves to the ui slice, next to `SiteTab`.
- **D39 — the site sections reuse the store's EXISTING one-shot seam, `openSiteSettings(tab)`; no
  second mechanism is introduced.** `SiteSettingsPanel`'s own `tab` stays local `useState`: the store
  already exposes `openSiteSettings(tab)` (deselects the node **and** sets `requestedSiteTab`), and
  the panel already consumes it and calls `clearRequestedSiteTab()`. Deselecting is not incidental —
  the panel switches to `"element"` whenever `selectedId` is set, so a section step MUST deselect or
  it lands on the element form.
- **D40 — a tour step that flips an editor preference must go through `writeConfig`, never
  `localStorage.setItem`.** Read in `hooks/useLocalConfig.ts`: subscribers are notified ONLY from
  `writeConfig` (`notify(key)`), so the existing `before()` hooks that raw-set `pb:sidebarMode` and
  `pb:inspectorCollapsed` do not re-render anything in the live session — they only take effect on a
  later mount (finding **B29**). Corrected in T4, same file.
- **D41 — section anchors are stamped on each section's own root, never on a wrapper added for the
  tour**: `pbx.settings.tabs` → the `role="tablist"` in `SiteSettingsPanel`; `pbx.settings.layers` →
  the existing `<section>` around `LayersTree`; `pbx.settings.pages` → `PageManager`'s root
  `<section>`; `pbx.settings.languages` → `I18nSettings`'s root `<section>`. No new DOM nodes.
- **D42 — nothing is removed from the existing tour.** `pbx.pages.breadcrumb` and `pbx.profileMenu`
  live in `app/layout/Header.tsx`/`ProfileMenu.tsx`, which the embed never mounts (**B9**), so both
  are silently skipped there; they stay untouched for the standalone editor, and the new
  `pbx.settings.pages` covers "pages" for the embed. The resulting redundancy is a product call for
  the user, not an agent's to make.

- **D43 — the engine waits for the INCOMING step's anchor after running its `before()`, and only then
  tells driver.js to move.** Forced by **B34**: `waitForElement` is dead config in driver.js@1.8.0, so a
  `before()` that flips a React panel loses the race and its step is skipped instantly (and a run of
  missing steps ends the tour as "completed"). This does **not** revert D35: nothing goes back to
  resolving every anchor up front, and `before()` still runs only when the tour reaches its step \u2014 the
  wait is per-step, bounded by that step's own `waitForElementMs`, and happens between `before()` and
  `moveNext()`/`drive()`.

**Three bindings every task in this chain must respect (this is what incident I2 was about):** the
package enforces a 1:1 registry↔steps mapping through its own tests, so an anchor and its step and
its copy MUST land in the SAME commit — `tests/tourSteps.flags.test.ts` compares
`buildBuilder42TourSteps(...)` against `Object.values(BUILDER42_TOUR_ANCHORS)`;
`tests/tourSteps.i18n-parity.test.ts` carries a hardcoded `stepIdByAnchor` map that must gain an
entry per new anchor, and demands `steps.<id>.title/description` in **es, en and it** (see **B24**:
that test cannot tell an untranslated string from a translated one — translate for real);
`tests/tour-anchors-coverage.test.ts` carries a `filesByAnchor` map and asserts each anchor's
`dataTourAttr(BUILDER42_TOUR_ANCHORS.x)` call-site appears exactly once in the file(s) listed.

---

# Older hand-off (2026-09-15, fourth session, D36 popover fix — done, superseded)

**State at hand-off (2026-09-15, fourth session): `HEAD = c239d1e`, branch `feat/ui-polish-p1`, tree
clean** except the untracked `.cursor/hooks/` and `.kiro/`. **Not pushed.**

**The user reported: pressing the landing editor's tour button does nothing — the overlay/highlight
lands on the name field, but no popover ever appears.** The email tour was believed done. Diagnosed
by the orchestrator **in a real browser** (throwaway Playwright specs against the running dev
server, since this is not reproducible in any headless unit environment): the popover WAS being
created, with correct content (`Nombre y autoguardado`, `1 de 8`) — it was parked **outside the
viewport**, at `[1280, 1242, 250, 164]` in a 1280x720 viewport, inline style
`inset: auto auto -686px 1280px`, and never repositioned.

Cause, measured at the exact moment driver.js inserts the node: `driver.css` (imported by this
package's `theme.css`) **had not been applied yet** — the popover computed `position: static`,
`padding: 0px`, rect `[0, 720, 1280, 126]`, an unstyled full-width block whose arrow `<div>` was
also 1280px wide. driver.js's own positioning helper then produced, arithmetically exactly:
`left = Math.max(Math.min(anchorLeft − padding, innerWidth − realWidth − arrowWidth), arrowWidth)`
→ `1280`, and `bottom = Math.min(…, innerHeight − realHeight − arrowWidth)` → `720 − 126 − 1280`
→ `−686`. Milliseconds later the stylesheet landed, `position: fixed` applied **with those inline
offsets frozen in**, and nothing ever recomputed them (no scroll, no resize, no `refresh()`).

Both call sites do `ensureTourThemeCss(); void tour.start();` where `ensureTourThemeCss()` is a
fire-and-forget `void import('@md/product-tour/style.css')`, and `start()` only awaited
`import('driver.js')` — a pre-bundled dep that resolves first. **So this was never landing-specific:
measured the same day on `/dashboard/templates/email`, the email popover was equally off-screen
(`inset: auto auto -677.953px 1280px`, `[1280, 1234, 250, 164]`).** It is a race, which is why the
email tour looked "concluded" — a warm module cache wins it sometimes.

| Task | What                                                                 | Scope                                              | Commit    | Gate  |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------- | --------- | ----- |
| L1   | engine awaits its own stylesheet before `drive()` (**D36**)           | `packages/product-tour/src/createTour.ts`, new `tests/styleLoadOrdering.test.ts` | `c612d35` | green |
| L2   | e2e: the popover must render INSIDE the viewport, both editors        | `tests/e2e/tour.spec.ts`, `tests/e2e/helpers/tour.ts` | `c239d1e` | green |

**Measured by the orchestrator (re-run, not taken from any report):** `@md/product-tour` **10 files
/ 81 tests** (was 9/79) · `pnpm --filter @md/product-tour typecheck` 0 errors · `builder42` 13/119
unchanged · `email-builder-standalone` 13/123 unchanged · `pnpm check` **339 files, 0 errors / 0
warnings / 3 hints** · `tests/e2e/tour.spec.ts` **22 passed** (baseline 20, and the landing «×» test
was RED before L1 — "element is outside of the viewport", the first automated symptom of this bug).
Browser proof after L1: landing popover `[452, 67, 340, 144]`, email `[372, 65, 340, 144]`, both
inside the viewport, both «×»-clickable. Mutation-tested twice: reverting L1 to the fire-and-forget
form turns the new unit test red at its exact assertion, and turns the new **email** e2e test red
with the literal off-screen numbers.

**New contract decision — D36: the ENGINE owns the guarantee that the tour is styled before it is
positioned.** `createTour` takes `loadStyles?: () => Promise<unknown>` (default
`() => import('./theme.css')`, injectable for tests) and `start()` awaits it **concurrently** with
the driver.js import (`Promise.all`), re-checking the D7 generation right after. Rationale:
`driver.css` is not optional for driver.js and `theme.css` lives inside this package, so a consumer
cannot be trusted to sequence it — and the previous consumer-side `ensureTourThemeCss()` had no way
to make `start()` wait. No post-`drive()` `refresh()`, `rAF` or `MutationObserver` net was added on
purpose: with the ordering fixed, driver.js measures a styled popover the first time.

**Owed to the user, now:** re-open BOTH editors' tours in the browser (hard reload). The popover
should appear next to the highlighted control on step 1 in each. The dark-mode review (**B23**) and
the light/dark popover review (**B3**) are still owed.

---

# Older hand-off (2026-09-15, third session, after the user's first browser test — superseded)

**State at hand-off (2026-09-15, third session, after the user's first browser test): `HEAD = 0a6bb37`,
branch `feat/ui-polish-p1`, tree clean** except the untracked `.cursor/hooks/` and `.kiro/`. **Not
pushed.**

**The user opened the tour and reported a real bug: the command palette appeared immediately and its
full-screen overlay covered the controls the first steps point at** (the preview/edit tab group, the
desktop/mobile switch). Diagnosed by the orchestrator: the engine ran **every** step's `before()`
inside `start()` (the loop over `eligibleSteps` that also resolved anchors), so every precondition —
palette open, library drawer open, inspector forced open — was applied before the first popover
rendered. This was **not** new to this session (F1 built it that way); the palette step added in T5
just made it impossible to miss. A second, latent instance of the same defect: the four library steps
each opened the drawer on their own tab in `before()`, so the last one won and the *blocks* group
anchors resolved to nodes React had already unmounted.

- **T8 (`b2b2885`) — D35: `before()` runs when the tour reaches the step, and anchors resolve
  lazily.** Each `DriveStep.element` is now a function (`() => resolveAnchor(...)`), so driver.js
  resolves it at drive time and does its own waiting/skipping (`waitForElement` +
  `skipMissingElement` are real per-step driver.js features — read in `driver.js@1.8.0`'s internals
  `f()`, `m()`, `p()`, `F()`). The engine owns transitions through one `transitionTo(intendedIndex,
  move)` helper shared by the global `onNextClick`/`onPrevClick` and the arrow-key handler: it runs
  the outgoing `after()`, then awaits the incoming `before()`, then calls `moveNext()`/
  `movePrevious()`. `after()` still fires from `onDeselected` (that is what covers ×, overlay,
  Escape, `stop()`, Done) with a marker so it never runs twice. **D35 supersedes D23/D24 entirely**:
  there is no start-time anchor resolution left to make concurrent.
- **T8b (`0a6bb37`)** — two defects the orchestrator found gating T8: `transitionTo()` dereferenced
  `driverInstance` after its awaits (a tour closed mid-transition would throw inside a `void`-called
  async function), now re-checked after every await together with the generation; and
  `tour_step_viewed` had been emitting **`stepIndex: -1` since F1**, because driver.js hands hooks a
  *clone* of the step (`{...step, popover:{…}}`), so `driveSteps.indexOf(driveStep)` never matched.
  The index now resolves through the stable `data.tourStep` reference. The orchestrator reproduced
  the telemetry bug independently (`AssertionError: expected -1 to be +0`).

**Measured by the orchestrator at `0a6bb37`:** `@md/product-tour` **9 files / 79 tests** (was 8/68) ·
`tsc -p packages/product-tour` 0 errors · `builder42` 13/119 unchanged · `email-builder-standalone`
13/123 unchanged · `pnpm check` 339 files 0/0/3 · `pnpm lint` the same 3 pre-existing errors by name.
Mutation-tested: restoring the eager `before()` loop turns **4** of the new tests red (in both
`stepActivation.test.ts` and the rewritten `anchorResolutionConcurrency.test.ts`); removing the
duplicate-`after()` suppression turns 1 red; reverting the step-index fix reproduces `expected -1 to
be +0`.

**Owed to the user, now:** re-open the email editor tour in the browser. Expected after T8: nothing
opens at step 1 — the palette appears only when the tour reaches its own step (17 of 18), the library
drawer only from the library steps onwards, and the *Basics* / *Structure* groups highlight while the
drawer is actually on the Blocks tab. The dark-mode review (finding **B23**) is still owed too.

---

# Older hand-off (2026-09-15, third session, before the browser test — superseded)

**State at hand-off (2026-09-15, third session): `HEAD = 63c26f4`, branch `feat/ui-polish-p1`,
tree clean** except the known untracked `.cursor/hooks/` and `.kiro/`. Nothing is half-finished:
every task has its own commit and the chain is green end to end. **Not pushed** — the branch stays
local by the user's choice.

**Plan executed this session:** [`docs/email-tour-steps-and-dark-mode-plan.md`](../docs/email-tour-steps-and-dark-mode-plan.md)
(Parte A dark mode + Parte B six new tour steps), T1–T7, one subagent per task, orchestrator gate
between each. The plan is now marked implemented in its own file.

| Task | What                                                        | Scope                                                                 | Commit    | Gate  |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------- | --------- | ----- |
| T1   | host theme hook + `darkMode` to the vendored editor          | `src/components/react/hooks/useHostTheme.ts` (new), `VisualEmailBuilder.tsx`, `tests/unit/host-theme.test.ts` (new) | `8e4a79e` | green |
| T2   | library drawer's active tab moves into the editor store      | `ComponentsLibraryDrawer.tsx`, `EditorContext.tsx` (1 line), new test  | `11c3baf` | green |
| T3   | Blocks tab grouped Basics/Structure + 2 group anchors        | `BlocksCategoryContent.tsx`, `tourAnchors.ts`, `inspector.json` ×3, 2 tests | `4953ce1` | green |
| T4   | steps + copy for basics / structure / template gallery       | `tourSteps.ts`, `tourAnchors.ts`, drawer wrapper, `tour.json` ×3, 3 tests | `1b24bcc` | green |
| T4b  | the 3 new step titles had shipped in English in es-419/it-IT | `tour.json` es-419 + it-IT (6 strings)                                 | `3ebfea1` | green |
| T5   | the command palette step actually opens (and restores) it    | `tour/commandPaletteControl.ts` (new), `tourSteps.ts`, new test        | `c9e389a` | green |
| T6   | `eb.canvas.textBlock` + `eb.inspector.tabs` steps & anchors  | `tour/textBlockStepControl.ts` (new), `tourAnchors.ts`, `tourSteps.ts`, `InspectorDrawer/index.tsx`, `block-notion-text/src/index.tsx`, `tour.json` ×3, 3 tests | `a799e03` | green |
| T7   | docs: tour contracts in `AGENTS.md` + plan marked implemented | `docs/AGENTS.md`, `docs/email-tour-steps-and-dark-mode-plan.md`        | `63c26f4` | green |

**The email tour is now 18 steps**, in this order: header identity, header save, header status,
toolbar views, viewport screen size, toolbar history, library rail, library tabs, **blocks basics**,
**blocks structure**, **templates gallery**, canvas root, **canvas text block**, inspector panel,
**inspector tabs**, image sources, command palette (now really opens), header actions.

**Measured by the orchestrator at `63c26f4`** (re-run, not taken from any report):
`email-builder-standalone` **13 files / 123 tests** (baseline was 8/47) · root `pnpm test` **44/313**
(was 43/303) · `builder42` 13/119 · `@md/product-tour` 8/68 · `pnpm check` **339 files, 0 errors /
0 warnings / 3 hints** · `pnpm lint` the same **3 pre-existing errors by name** (CampaignsBoard.tsx
199:5 rule-not-found, AutomationBuilder.tsx 91:10 `past`, 92:10 `future`) · **`pnpm build` Complete!
(server built in 56.67 s)**, log `.orquestacion/build-T7.log`. Every task's new tests were
mutation-tested twice by the orchestrator (product code broken on purpose, the new tests went red,
tree restored clean each time).

**New contract decisions this session — D31 to D34** (D25–D30 were fixed in the plan itself):

- **D31 — a host hook that must observe the DOM exposes a DOM-free, injectable core.** The root
  Vitest environment is `node` with no jsdom/happy-dom/`@testing-library`, so `useHostTheme` ships
  `normalizeHostTheme` / `readHostTheme` / `observeHostTheme(target, onChange, createObserver?)`
  and the React hook is a thin wrapper. Without the injection point the observer logic would have
  had zero coverage.
- **D32 — block grouping returns ORIGINAL `BUTTONS` indices and never re-indexes.** The drag
  payload (`buttonIndex`) and click-to-insert both resolve against that array, so a grouped UI that
  renumbered tiles would insert the wrong block. `groupBuiltInBlockIndices` also sends unknown
  labels to *Basics*, so a future 9th block cannot silently vanish from the drawer.
- **D33 — the four consecutive library steps share ONE deferred-restore drawer guard.** Per-step
  snapshot/restore (the old `eb.library.tabs` pattern) would close and reopen the drawer between
  every step; instead `enterLibraryStep` / `leaveLibraryStep` snapshot once and restore on a
  `setTimeout(0)` that the next library step cancels. The engine calls the leaving step's `after()`
  before the entering step's `before()`, which is what makes the cancellation deterministic.
- **D34 — a tour hook never persists a user preference.** `setInspectorDrawerMode` sets
  `inspectorModeUserOverride` **and** writes localStorage, so the inspector-tabs step writes its
  transient state with `editorStateStore.setState(...)` and restores it on the way out. A tour must
  not leave behind a setting the user never chose.

**What is left, in this order:**

- **Owed to a person, not a subagent: look at the editor in dark mode.** T1 is proven only at the
  unit level (finding **B23**). The §A.3 risks of the plan are still unverified by eyes: the email
  canvas must not go dark (`.dark-email-builder .preview-container` in `global.css` has never been
  checked), switching theme must not lose an unsaved document (the MUI theme is memoised on
  `darkMode`, so it should not remount — confirm in a browser), and the inspector's contrast in dark
  is MUI's, not Maildrill's warm ramp.
- **The e2e suite was NOT run this round, by the user's decision.** `tests/e2e/tour.spec.ts` walks
  the tour with a 20-iteration cap and asserts concrete step titles; 18 steps still fit, but the
  spec needs a read before that suite is trusted again — and it now has to survive steps that open
  the drawer, the palette and the inspector. **B21** (how the e2e suite is served) is still the
  blocking decision, and **B22** (no browser coverage for arrow keys) is still open.
- Optional, recorded and deliberately not done: the third `eb.library.sections` anchor for saved
  composed blocks (plan §B.3, marked optional), a third inspector step that switches to *Styles*
  (Q5 was answered "one step"), and the older optional items below (B2's `onPopoverRender`
  passthrough, unifying the host `AppShell` ⌘K palette with the editor-scoped ones).

**Re-establish the preconditions before delegating anything** — they are environment state, not repo
state: ports 4321/3001/5432/6379 up; `tests/e2e/.auth/user.json` present; e2e as
`npx playwright test --project=chromium --no-deps <spec> --workers=1 --retries=0`. Astro dev binds
`[::1]:4321` only, so probe it over HTTP, not with an IPv4 port check.

---

# Older hand-off (2026-09-15, second session — superseded, kept for context)

**State at hand-off (2026-09-15, second session): `HEAD = 7c96b7a` + this log commit, branch
`feat/ui-polish-p1`, tree clean** except the known untracked `.cursor/hooks/` and `.kiro/`. Nothing is
half-finished; every task has its own commit and the chain is green end to end. **Not pushed** — the
branch is local by choice; pushing is the user's call.

**Closed in this second session, each gated by the orchestrator:** the two verification gaps
(`tour.spec.ts` 20/20 in 2.5 min on a fresh dev server, `pnpm build` green), **B18** (arrow-key step
navigation restored and owned by the engine — D18/D21/D22, `252afea`) and **B19** (concurrent anchor
resolution — D23/D24, `7c96b7a`: 925 ms → **308 ms** for three missing anchors). New finding from B18's
gate: **B22**. Full-gate state at `7c96b7a`: `@md/product-tour` 8 files/68 tests · `builder42` 13/119 ·
`email-builder-standalone` 8/47 · root `pnpm test` 43/303 · `pnpm check` 337 files 0/0/3 hints ·
`pnpm lint` the same 3 pre-existing errors by name · `tour.spec.ts` 20/20 · **`pnpm build` Complete!
(1m 0s, re-run after B19)**.

**What is left, in this order:**

- **B21 — decide how the e2e suite is served. Needs the user, not a subagent** (finding B20): the full
  suite costs 12 min on a fresh dev server and over 40 min on a degraded one. Option 1 (run e2e against
  a production build) is the real fix and would likely let `fullyParallel` come back, but it changes
  what CI does.
- **B22 — arrows have no browser-level coverage** (finding below). Cheap: one e2e in `tour.spec.ts` plus
  one unit case dispatching from a child node.
- Optional, recorded and deliberately not done: a tour step + copy teaching the landings relaunch
  button (D14 corollary), the `onPopoverRender` passthrough that would delete `useEmailBuilderTour`'s
  `MutationObserver` (B2), unifying the host `AppShell`'s ⌘K palette with the editor-scoped ones
  (B10's finding).

**Still owed to a person, not a subagent:** **B3** (nobody has *looked* at the popover in light/dark,
or at stage clipping over compact rails and absolute panels), **B6** (`AUTH_SECRET` is empty in this
`.env`, so real login 500s here for humans too; the dev bypass is the only reason e2e runs), **B13**
(the suite's instability under `fullyParallel`).

**Re-establish the preconditions before delegating anything** — they are environment state, not repo
state: ports 4321/3001/5432/6379 up; `tests/e2e/.auth/user.json` present (an empty
`{"cookies":[],"origins":[]}` is enough while the auth bypass is on); e2e run as
`npx playwright test --project=chromium --no-deps <spec> --workers=1 --retries=0`. Astro dev binds
`[::1]:4321` only, so probe it with an HTTP request, not an IPv4 port check.

**Read the contract decisions (D1–D24) before writing a handoff.** Two incidents in this chain came
from a contract that contradicted a package's own tests — see **I2**.

---

# Older hand-off (2026-09-15, first session — superseded, kept for context)

**State at hand-off: `HEAD = be29bff`**, branch `feat/ui-polish-p1`, tree clean except the
known untracked `.cursor/hooks/` and `.kiro/`. Nothing is half-finished: every task below has its own
commit, and the last one that landed red (B17) was closed by B17b in the same session. 28 commits since
`89a3bce`. **Not pushed** — the branch is local by choice; pushing is the user's call.

The plan (`docs/product-tour-driverjs-plan.md`) is **implemented, F1–F7**. What came after F7 is user
feedback on the real thing, which is where the next session picks up.

**Done this session, each gated by the orchestrator:** B7B8 (single live tour per `tourId` +
Escape dismisses), B10 (⌘K palette entry was broken for keyboard users; also fixed the swallowed
restart, B11), B12 (Escape yields to an open modal), B14 (only a *visible* modal counts), B9/B9b/B9c
(reachable relaunch button in the landings embed, no tour anchor, highlight precision), F7 (docs +
telemetry + export boundary), then from the user's own testing: B16 (the «×» and the overlay click
never closed the tour) and B17/B17b (one control per step in the email header: new steps for
"Save template", the autosave indicator and the desktop/mobile switch, with `identity` and `actions`
re-pointed to single controls; copy in all three locales).

**Measured at `fb40a42`** (the two commits after it touch only a test file and this log):
`@md/product-tour` 6 files/50 tests · `builder42` 13/119 · `email-builder-standalone` 8/47 ·
root `pnpm test` 43/303 · `pnpm check` 337 files 0 errors/0 warnings/3 hints · `pnpm lint` the same
3 pre-existing errors by name. All green.

**Two verification gaps — BOTH CLOSED (2026-09-15, at `9ebdaf0`, by the orchestrator):**

1. `tests/e2e/tour.spec.ts` → **20 passed / 0 failed / 0 skipped in 2.5 min**, on a freshly started
   dev server (`--project=chromium --no-deps --workers=1 --retries=0`). The B16 overlay-click test
   that had failed inside the 9.1-min run passes here, which settles it as the flake B13/B20 describe,
   not a regression. Log: `.orquestacion/e2e-tour-2026-09-15.log`.
2. `pnpm build` → **Complete!**, server built in **1m 43s** — first full build since B16/B17/B17b.
   Log: `.orquestacion/build-2026-09-15.log`.

Environment as re-established for those runs: Postgres 5432 and Redis 6379 were already up; 4321 and
3001 were **down** and were started fresh (`pnpm dev` + `pnpm dev:workers`, logs in `.orquestacion/`).
Note for whoever checks ports: Astro dev binds **`[::1]:4321` only**, so a `127.0.0.1` reachability
probe reports it down while it is serving 200s — check with an HTTP request, not with the IPv4 port.

**Then, in this order:**

- **B18 — DONE (2026-09-15, `252afea`, gated green).** Arrow-key step navigation is back, owned by the
  engine's own capture-phase handler (D18), with the two boundary no-ops (D21) and the
  editable-target/modifier bail-out (D22). `allowKeyboardControl` stays `false`. New finding from its
  gate: **B22** (no browser-level coverage for arrows).
- **B21 — decide how the e2e suite is served (needs the user, not a subagent).** This is the live
  question the session ended on: the full suite costs 12 min on a fresh dev server and **over 40 min**
  on a degraded one, which is why D19 now forbids running it as a per-task reflex. The cause is Vite
  **dev** hydrating heavy `client:only` editor islands against a single server — see finding B20 for
  the measurements and the three options (run e2e against a production build, selective parallelism, or
  just restart the dev server before long runs). Option 1 is the real fix and would likely let
  `fullyParallel` come back, but it changes what CI does, so it is a decision, not a task.
- **B18 — restore arrow-key step navigation (D18).** B16 had to set `allowKeyboardControl: false`;
  that flag also governed driver.js's `ArrowLeft`/`ArrowRight`, so the engine must now own arrows the
  way it already owns Escape. Nothing is unreachable today (Tab + Enter still work), so this is
  capability restoration, not a break. — **closed by `252afea`, see above.**
- **B19 — anchor resolution is sequential at 2 s per missing anchor** (see finding). Cheap to improve,
  and it is the reason the tour takes seconds to appear. — **closed by `7c96b7a`** (D23/D24): 3 missing
  anchors at 300 ms went from 925 ms to **308 ms**, one shared window instead of the sum.
- Optional, recorded and deliberately not done: a tour step + copy teaching the landings relaunch
  button (D14 corollary), the `onPopoverRender` passthrough that would delete
  `useEmailBuilderTour`'s `MutationObserver` (B2), unifying the host `AppShell`'s ⌘K palette with the
  editor-scoped ones (B10's finding).

**Needs a person, not a subagent:** **B3** (nobody has *looked* at the popover in light/dark, or at
stage clipping over compact rails and absolute panels), **B6** (`AUTH_SECRET` is empty in this `.env`,
so real login 500s here for humans too; the dev bypass is the only reason e2e runs at all), **B13**
(the suite's instability under `fullyParallel`).

**Re-establish the preconditions before delegating anything** — they are environment state, not repo
state: ports 4321/3001/5432/6379 up; `tests/e2e/.auth/user.json` present (an empty
`{"cookies":[],"origins":[]}` is enough while the auth bypass is on); e2e run as
`npx playwright test --project=chromium --no-deps <spec> --workers=1 --retries=0`. **Consider
restarting the dev server**: this session ended with one that had degraded to ~3× its own earlier
timings. Re-measure rather than trusting any number above that is older than the last commit.

**Read the contract decisions (D1–D20) before writing a handoff.** Two of this session's three
incidents came from a contract that contradicted a package's own tests — see **I2**, and the lesson
recorded with it: before forbidding a file in a handoff, check whether the package's tests bind that
file to something the task must change.

---

# Older hand-off (superseded, kept for context)

**State at hand-off (2026-09-14):** `HEAD = 89a3bce`, branch `feat/ui-polish-p1`, tree clean except
the known untracked `.cursor/hooks/` and `.kiro/`. Nothing is half-finished: every phase below has
its own commit, and the one task that stopped without a fix (B5) left no changes behind.

**Done:** F1 (engine), F2a/F2b (anchors), F3a/F3b (steps + copy), F4 (entry points, persistence,
host seam), F5 (popover theme), plus two blockers cleared along the way — B1 (the build had been
red all session) and the e2e harness characterisation.

**The guided tour is wired end to end and the build and every suite are green, but the tour is not
yet correct in the browser.** F6's e2e proved it: see B7, B8, B9 below. That is the next session's
work, in this order:

1. **B7 — the tour starts twice** (two live driver.js instances, different active steps, overlapping
   overlays). The user-visible bug; fix first. Cause confirmed for landings (two mounted call sites
   of `useBuilder42Tour`); the email side still needs its cause proven by execution, not by reading.
2. **B8 — Escape does not dismiss the tour.** Small, and it shares the same files as B7.
3. **B9 — landings has no reachable relaunch entry point in the embed.** Decide *where* it belongs
   (host `EditorHeader.tsx` is the obvious candidate, since it already does it for the email
   channel) before delegating: that is a contract decision, not a subagent's call.
4. **F7 — docs + telemetry** (plan §4 F7): tours section in `docs/AGENTS.md`, the `data-tour`
   contract, the exportability note in `packages/VENDOR.md`, and marking the plan implemented.

The proof that B7/B8 are fixed already exists and must be used: F6 left **two `test.fixme` tests**
in `tests/e2e/tour.spec.ts` (full step-by-step walk to completion, and Escape closing the tour while
the editor stays open). Turning those into passing assertions is the acceptance criterion — do not
accept a fix that is only asserted in a unit test.

**Two items need a person, not a subagent:**

- **B3** — nobody has *looked* at the themed popover in light and dark, or checked stage clipping
  over compact rails and absolute panels (plan §1.4.8). Code-level coverage is done; eyes are owed.
- **B6** — `AUTH_SECRET` has no value in this `.env`, so **login is broken in this environment for
  humans too**, not just for the e2e. Left untouched on purpose: it is a credential file. Auth is
  currently bypassed in dev (`SKIP_AUTH_FOR_BUILDER_WORK=true`), which is why F6 could proceed.

**Before delegating anything, re-establish the preconditions** (they are environment state, not repo
state, so they may have changed): ports 4321/3001/5432/6379 up; an empty
`tests/e2e/.auth/user.json` present; and run e2e as
`npx playwright test --project=chromium --no-deps`. Re-measure the baseline rather than trusting the
numbers below — a dev server restart or seeded-data change moves them.

---

## Verification commands and what each one actually covers

| Command                                   | Real coverage                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                              | `astro check` over 335 files: `src/**` (Astro + TS/TSX reachable from routes). **Does not** typecheck `packages/**`. |
| `pnpm typecheck`                          | `astro check` + `scripts/typecheck.mjs` + `tsc -p` for wa-template-studio, builder42 and product-tour.               |
| `npx tsc -p packages/builder42 --noEmit`   | builder42 only.                                                                                                     |
| `npx tsc -p packages/product-tour --noEmit`| product-tour only.                                                                                                  |
| `pnpm lint`                               | ESLint over the repo (+ jsx-a11y).                                                                                  |
| `pnpm test`                               | Root vitest: `tests/**` only. **Does not** run the packages' own suites.                                             |
| `pnpm --filter <pkg> test`                | That package's own suite. Must be run per package; the root run does not cover them.                                |
| `pnpm --filter builder42 build:runtime`    | Compiles the runtime shipped inside published landings. Guards plan §1.4.7.                                          |
| `pnpm build`                              | Full Astro build. Was RED at baseline (**B1**, fixed in `68c32ae`); green at `9ebdaf0` (2026-09-15, 1m 43s). ~2 min. |
| `npx playwright test --project=chromium --no-deps <spec> --workers=1 --retries=0` | The only reliable e2e invocation here (`--no-deps` because the `setup` project is red by design — B6). **Per D19 pass the affected spec(s), and `-g` for a single test: one test is 20–45 s, the whole suite is 12–40 min.** |

`tsc --noEmit` repo-wide carries ~460 pre-existing errors in the vendored packages (documented in
`docs/AGENTS.md`): never "fixed", only checked for new ones.

`pnpm format:check` is **not** a live gate: 1841 files are already unformatted repo-wide.

---

## Baseline

Taken at `9ce4192` (F4), 2026-09-14.

Green, with counts:

| Suite                          | Files | Tests |
| ------------------------------ | ----- | ----- |
| root (`pnpm test`)             | 43    | 303   |
| `builder42`                    | 11    | 100   |
| `email-builder-standalone`     | 6     | 38    |
| `@md/product-tour`             | 4     | 27    |

`pnpm check`: 0 errors, 0 warnings, 3 hints. `tsc` builder42 / product-tour: 0.
`builder42 build:runtime`: compiles.

Already RED at baseline — **by name**, so a new red stands out:

- `src/components/react/CampaignsBoard.tsx:199` — `Definition for rule
  'react-hooks/exhaustive-deps' was not found`.
- `src/components/react/automations/AutomationBuilder.tsx:91` — `'past' is assigned a value but
  never used`.
- `src/components/react/automations/AutomationBuilder.tsx:92` — `'future' is assigned a value but
  never used`.
- `pnpm build` — fails prerendering `/404.html`. See B1.
- 3 `astro check` hints: `LandingPageBuilder.tsx`, `AutomationBuilder.tsx`.

Known ignorable dirt in `git status`: `.cursor/hooks/`, `.kiro/` (untracked local tooling).

---

## Contract decisions (orchestrator's, not delegated)

- **D1** — `@md/product-tour` stays domain- and host-agnostic: no PostHog, no Maildrill, no
  "email"/"landing". Its only outlet is `onEvent`. Storage prefix is always injected by the
  consumer (`eb:` / `pb:`). Plan §0.
- **D2** — Anchor keys (`data-tour`) are a stable contract owned by one registry per editor
  (`tourAnchors.ts`). No `.tsx` hardcodes a key.
- **D3** — Builder42 must stay extractable: zero imports from `packages/builder42` into the Astro
  host, nothing under `src/builder/runtime/**`, and tour copy that describes only the editor.
  Plan §0.6/§1.4.7.
- **D4** — The PostHog mapping lives only in `src/components/react/{VisualEmailBuilder,
  LandingPageBuilder}.tsx`. An injected `onTourEvent` is forwarded on top of it, not instead of it.
- **D5** — `driver.js` and the popover CSS load lazily, at tour start. They must never enter an
  editor's initial chunk. Plan §1.3.
- **D6** — Already-implemented phases are never reverted by an agent that reads them as
  out-of-scope. It reports. (Learned the hard way — see incident I1.)
- **D7** (B7) — **The "at most one live tour" invariant belongs to the engine, not to the call
  sites.** `@md/product-tour` must guarantee that at most one driver.js instance is active per
  `tourId` process-wide (module-level registry), and that a second `start()` while the first is
  still awaiting its lazy `import('driver.js')` cannot produce a second instance. Semantics:
  **last start wins** — a relaunch destroys the previous instance before driving, so an explicit
  restart always shows freshly built steps. Reason: the defect showed up in *both* editors with
  *different* call-site shapes; a per-hook fix leaves the invariant unenforced and unfalsifiable by
  unit test. Call-site fixes are still required where a cause is proven, but they are the second
  line, not the first.
- **D8** (B8) — **While a tour is active, Escape closes the tour and nothing else.** The
  capture-phase guard keeps `stopPropagation()`/`preventDefault()` (the host editor must not act on
  that key — the F4 host tests stay valid) but must now perform the dismissal itself instead of
  hoping driver.js's own bubble-phase handler is reached, because a window-capture
  `stopPropagation()` makes that impossible by construction. `tour_dismissed` must still be emitted
  through the existing `onDestroyStarted` path.
- **D9** (B9) — **The landings relaunch entry point stays inside `packages/builder42`, in the
  chrome the embed actually mounts (`app/layout/HostToolbar.tsx` → `HostCanvasToolbar`), not in the
  host's `EditorHeader.tsx`.** Verified while deciding: `EditorHeader.tsx` has **no** tour-restart
  button for any channel — it only stamps `data-tour` anchors — so the email side is not the
  precedent B9 assumed. Email's relaunch lives in its *own* package chrome
  (`App/TemplatePanel/index.tsx` help button + `App/CommandPalette`). Mirroring that keeps D3
  (builder42 stays extractable, its tour reachable in the standalone too) and keeps the host free of
  editor-specific tour wiring. The B9 `test.skip` reason text must be rewritten accordingly — it
  currently repeats the wrong premise about `EditorHeader.tsx`.
- **D10** — Also corrected while deciding B7's handoff: `packages/builder42/src/app/App.tsx` is
  **standalone-only** (`git grep "app/App"` → imported solely by `src/main.tsx`). The embed mounts
  `Builder42Editor.tsx` alone. So B7's "two mounted call sites in the embed" is **refuted**: the
  landing editor has exactly one call site at `/dashboard/landings/editor`, and the duplicate has an
  as-yet-unproven cause there too. Nobody should re-walk that dead end.
- **D11** (B12) — **Escape belongs to the topmost thing, not unconditionally to the tour.** D8 stands
  for the plain case (tour open over the editor: Escape closes the tour, the host editor never sees
  the key), but the guard must **let Escape through** when another modal surface is open on top of
  the page — detected generically, with no host knowledge: an element matching
  `[aria-modal="true"], dialog[open], [role="dialog"]` that is **not** driver.js's own popover. In
  that state the tour stays open and the modal closes, which is what a user means. The engine stays
  host-agnostic (D1): no Maildrill/MUI selectors, no per-editor lists.
- **D12** (B14) — **A competing modal only counts if it is actually visible.** D11's detection must
  skip candidates that are in the DOM but not rendered (`display:none`, `visibility:hidden`, the
  `hidden` attribute, zero-size). Use the platform check where available
  (`Element.checkVisibility({ checkVisibilityCSS: true, checkOpacity: false })`) with a conservative
  fallback for environments that lack it — and the fallback must fail **towards** the D8 plain case
  (treat an undecidable candidate as *not* competing), because "Escape does nothing" is the worse
  failure for a user than "Escape closed the tour". Still host-agnostic (D1): no class or component
  names.
- **D14** (B9/B9b) — **`BUILDER42_TOUR_ANCHORS` is the set of *tour-step* anchors, and stays 1:1 with
  the steps.** A control that no step highlights does **not** get a `data-tour` key: this package's
  own tests bind the registry to the step list and to copy parity in every locale
  (`tourSteps.flags.test.ts`, `tourSteps.i18n-parity.test.ts`), and that invariant is worth more than
  stamping an attribute on a button nothing points at. So the landings relaunch button carries no
  anchor; the e2e finds it by accessible name (`getByRole('button', { name: … })`), which is also the
  stronger assertion — it proves the control is reachable the way a user reaches it. D2 is unchanged:
  no `.tsx` may hardcode an anchor key; there simply is no key here. Corollary, if the tour should
  ever *teach* the relaunch button, that is a step + copy in en/es/it and belongs in its own task, not
  smuggled in through the registry.
- **D15** (B16) — **Every close path destroys the tour, and each close emits exactly one event.**
  `onDestroyStarted` must destroy (that is driver.js's contract when the hook is overridden), so the
  «×» and the overlay click behave like Escape. Exactly one `tour_dismissed` per dismissal — the
  Escape path already emits before destroying, so the two paths must not double-emit — and finishing
  with "Done" stays a `tour_completed`, never also a dismissal.
- **D16** (B17) — **One step, one control.** A tour step highlights the single control its copy talks
  about, never the container that happens to hold it (plan §1.4.8; same defect class as B15). For the
  email header that means: `eb.header.identity` re-pointed to the name field alone, a new
  `eb.header.save` on the "Save template" button, a new `eb.header.status` on the autosave indicator,
  a new anchor on the desktop/mobile switch, and `eb.header.actions` re-pointed to the "Send test"
  button alone. Every new key needs its step **and** its copy in every locale — the email package
  enforces that too (`tourSteps.flags.test.ts`, `tourSteps.i18n-parity.test.ts`), which is the same
  invariant D14 records for builder42.
- **D17** (B17) — **Step order follows the eye, not the registry.** Insert the new steps where the
  controls actually are: identity → save → autosave status, and the desktop/mobile switch immediately
  after the existing `eb.toolbar.views` step (both are canvas-toolbar view controls). "Send test"
  stays the last step. Copy that currently describes saving inside the identity step moves to the save
  step — after this change no step may describe a control it does not highlight.
- **D18** (B18) — **The engine owns the tour's keyboard, all of it.** Since `allowKeyboardControl` is
  now `false`, `ArrowRight`/`ArrowLeft` step navigation must be reimplemented in this package's own
  capture-phase key handler (driving `moveNext()`/`movePrevious()`), under the same rules the Escape
  guard follows: only while a tour is active, never when a visible competing modal is open on top
  (D11/D12), and never leaking the key to the host editor. Do not re-enable
  `allowKeyboardControl` — one listener per key, owned here (that is what B16 had to fix).
- **D19** — **The gate runs the affected specs, never the whole e2e suite by default.** Measured cost
  of the old habit: the full suite at `--workers=1` is 12 min on a fresh dev server and **over 40 min**
  on a degraded one, and this chain ran it three times. From now on: the spec(s) the change can
  plausibly reach, and `-g` down to individual tests when the change is narrow (a single test is
  20–45 s). The full suite is a deliberate, occasional act — before a merge, or when a change touches
  something shared enough to warrant it — not a per-task reflex. When a targeted run goes red, re-run
  **that test alone** before believing it: this environment produces flakes under load, and an isolated
  pass is what distinguishes a flake from a regression.
- **D20** — **An e2e assertion about "the dialog" must exclude the tour's popover.** driver.js's
  popover legitimately carries `role="dialog"`, so `getByRole('dialog').first()` can resolve to the
  tour instead of the dialog under test, and the outcome then depends on DOM order and on whether the
  tour happened to be open. Any such locator uses `[role="dialog"]:not(.driver-popover)` (the pattern
  `tests/e2e/tour.spec.ts` already uses). Applied to `workspace-tour.spec.ts:186`, whose green/red
  history was luck rather than evidence.
- **D23** (B19) — **`before()` hooks stay sequential and in declaration order; only the waiting is
  concurrent.** Each step's `waitForAnchor()` starts right after its own `before()` has run and is
  kept as a pending promise; all of them are awaited together after the loop. Reason: `before()`
  hooks mutate host UI (switch the canvas view, open the components-library drawer, flip
  `pb:sidebarMode`, select a block) and their `after()` counterparts restore it, so running them
  concurrently would interleave those mutations. Waiting, by contrast, is passive polling with no
  side effects (`anchors.ts`), which is what makes it safe to overlap.
- **D24** (B19) — **The per-anchor timeout is unchanged (2000 ms default, `waitForElementMs` per
  step) and is now measured from the moment that step's own `before()` ran.** Accepted consequence,
  written into the code: an anchor mounting later than its own window is now skipped where the old
  sequential code might have caught it by accident, because step 3's window used to start only after
  steps 1–2 had each burned theirs. A step that genuinely needs longer sets `waitForElementMs`; the
  default is not raised to compensate.
- **D21** (B18) — **Arrows navigate between existing steps only; they never finish the tour.**
  `ArrowRight` on the last step and `ArrowLeft` on the first are no-ops (checked with
  `isLastStep()` / `getActiveIndex() === 0` *before* consuming the key, so a no-op arrow does not
  swallow the event either). Reason: `moveNext()` on the last step routes into driver.js's own
  advance handler, which we replaced with `onDoneClick` — the path that persists completion and
  emits `tour_completed` — and a keypress must never silently finish and persist the tour.
  Completing stays the Done button's job, reachable with Tab + Enter.
- **D22** (B18) — **The engine does not steal arrows from text entry.** If any modifier is held
  (`alt`/`ctrl`/`meta`/`shift`) or the event `target` is an editable surface (`<input>`,
  `<textarea>`, `<select>`, or `isContentEditable`), the handler returns without consuming: there
  the key means caret or option movement to whoever is focused. Generic DOM shapes only, no class
  or component names — still host-agnostic (D1).

---

## e2e baseline (under the dev auth bypass)

Auth is deliberately disabled in this environment: `SKIP_AUTH_FOR_BUILDER_WORK=true` makes
`src/middleware.ts` inject a dev session (`dev-user` / `dev@local.test` / `dev-tenant` / `owner`),
so `/dashboard`, `/dashboard/templates/email` and `/dashboard/landings/editor` all answer 200 with
no session. Verified by direct request.

Consequences for the harness:

- The `setup` project stays red (B6), so specs run with
  `npx playwright test --project=chromium --no-deps`.
- `chromium` declares `storageState: tests/e2e/.auth/user.json`; with the file absent every test
  errors before starting (`ENOENT ... user.json`). An **empty** state
  (`{"cookies":[],"origins":[]}`) is enough while the bypass is on. The directory is gitignored:
  the file is a local artifact, never committed.

Measured with that command, 2026-09-14: **40 passed / 22 failed / 2 skipped** (64 tests).

The 22 failures are pre-existing and unrelated to the tour work. Two of them fail *by design* while
the bypass is on — `login.spec.ts` "code request → 6-digit entry → dashboard" and "the dashboard is
closed to anonymous visitors", which assert the real login flow and the anonymous gate. The rest
depend on seeded workspace data or on flows the bypass changes: `automations.spec.ts` (5),
`dashboard.spec.ts` (1), `lists.spec.ts` (2), `registration.spec.ts` (2), `smoke.spec.ts` (contact
form), `subscribers.spec.ts` (3), `workspace-tour.spec.ts` (6). Notably the template builders
("the email/sms/whatsapp/voice builder opens and can be left") **pass**, so the editors do load
under e2e.

Any future run must keep that exact set: a different name failing is a regression even if the
count matches.

---

## Tasks

```
F1  | @md/product-tour engine        | packages/product-tour/**              | 74bb344 | green
F2a | anchors EmailBuilder           | email-builder-standalone, EditorHeader | 8db4457 | green (with F2b)
F2b | anchors Builder42              | builder42 src/app, src/builder        | 8db4457 | green
—   | plan status note               | docs/product-tour-driverjs-plan.md    | 18cfe17 | green
F3a | steps + copy EmailBuilder      | email-builder-standalone/src/tour     | 48a39c7 | green
F3b | steps + copy Builder42         | builder42/src/app/tour                | 0bc74b1 | green
F4  | entry points + persistence     | both packages + 2 host wrappers       | 9ce4192 | green
F5  | popover theme                  | builder42 chrome css + EB runtime map | 267adbc | green
B1  | fix /404.html prerender        | astro.config.ts                       | 68c32ae | green
B5  | fix e2e auth setup            | tests/e2e/**                          | —       | closed: not a harness bug (see B6)
F6  | e2e Playwright                 | tests/e2e/tour.spec.ts                | 860212c | green (8 pass, 2 fixme, 1 skip → B7/B8/B9)
B7  | duplicate tour instances       | engine registry + EB hook             | 4e842fd | green
B8  | Escape does not dismiss tour   | product-tour escape guard             | 4e842fd | green (same commit)
B10 | ⌘K palette relaunch entry red  | EB CommandPalette + EB tour hook      | 46c3a3f | green (closes B7B8's red; B11 fixed too)
B12 | Escape vs an open host modal   | product-tour escape guard             | a0afd05 | green (closes the last red)
B14 | modal detection counts hidden  | product-tour escape guard             | 46d9557 | green
B9  | landings has no relaunch entry | builder42 HostToolbar (D9)            | eb9b7bf | WIP/red: my contract was contradictory — see I2
B9b | drop the anchor, keep the button| same files, minus the registry        | f229159 | green (chain back to green)
B9c | button sits inside the history anchor | HostToolbar only                | 22fc29e | green
F7  | docs + telemetry               | AGENTS.md, VENDOR.md, plan, engine doc | a31a1ef | green — **plan implemented**
B16 | «×» / overlay click don't close | product-tour destroy paths           | fdace56 | green (see finding B18)
B17 | email header steps: one per control | EditorHeader + EB anchors/steps/copy | 64668ac | red on landing: 3 obsolete expectations
B17b| close B17's obsolete expectations | 2 EB hook fixtures + 2 e2e assertions + identity copy | fb40a42 | green
—   | disambiguate a dialog locator  | workspace-tour.spec.ts (orchestrator, 2 lines) | —   | see D20 / note below
B18 | arrow-key step navigation lost | product-tour key handler              | 252afea | green (D18/D21/D22)
B19 | anchors resolved sequentially  | product-tour start()/buildDriveStep   | 7c96b7a | green (D23/D24) — 925 ms → 308 ms
B21 | the e2e suite costs 40 min     | playwright.config.ts + how we serve the app | —  | pending — needs a decision (finding B20)
```

Gate run for B19 (orchestrator, `152fa3d..7c96b7a`): 2 files, both in scope; `80 6` on `createTour.ts`
and `273 0` on the new `tests/anchorResolutionConcurrency.test.ts` (pure addition). No file deleted
(`--diff-filter=D` empty), `152fa3d` still an ancestor. The 6 removed lines are the body of the old
`buildDriveStep()`, split — as the handoff authorised — into `beginAnchorWait()` (awaits `before()`,
then STARTS the wait and hands back the pending promise) and `finishDriveStep()` (awaits it and
assembles the `DriveStep`). Read line by line: the `skipMissingElement` branches, the
`element ?? step.anchorKey` fallback, the `onDeselected` wiring and both `isCurrentGeneration()`
guards are unchanged; the `Promise.all` preserves order, so `driveSteps` stays in declared order.

Mutation-tested by the orchestrator: restored `createTour.ts` from `152fa3d` → the timing case failed
with a real number, `AssertionError: expected 925 to be less than 700` (3 missing anchors × 300 ms =
the additive cost the finding described). With the fix: **308 ms**, i.e. one shared window instead of
three. The other 5 cases pass both ways by design — they assert *preserved* behaviour (`before()`
order, declared step order, late anchor still caught, missing anchor still dropped,
`skipMissingElement: false` still never waits), so they are regression cover, not proof of the fix.

Re-measured: `@md/product-tour` **8 files / 68 tests**, `npx tsc -p packages/product-tour` 0,
`builder42` 13/**119**, `email-builder-standalone` 8/**47**, root `pnpm test` 43/**303**,
`pnpm check` 337 files 0/0/3, `pnpm lint` the same 3 pre-existing errors by name. e2e per D19 — the
change is in the `start()` path both editors use: `tests/e2e/tour.spec.ts` → **20 passed / 0 failed /
0 skipped in 2.1 min** (`.orquestacion/e2e-tour-B19.log`).

Worth recording from this gate: the subagent's final report did **not** follow the required format (it
answered "Implemented and verified" with no VERIFICATION section, no commit hash, no numbers). The work
turned out correct, but the report was worthless as evidence — every figure above was measured by the
orchestrator from scratch, which is exactly why the gate exists.

Gate run for B18 (orchestrator, `e2d0058..252afea`): 2 files, both in scope; `99 27` on
`createTour.ts` and `316 0` on the new `tests/keyboardNavigation.test.ts` (pure addition, nothing to
read for weakened assertions). **Zero deletions in the whole commit** (`--diff-filter=D` empty), and
`e2d0058` is still an ancestor of `HEAD`. Read the 27 removed lines of `createTour.ts` one by one: they
are the Escape block re-indented one level inside a new `if (e.key === 'Escape')` branch plus two
comment blocks rewritten in place — **no logic and no condition removed**; the Escape path keeps the
same order (`isActive()` → `hasCompetingModalOpen()` → `stopPropagation`/`preventDefault` →
`dismissActiveInstance()`).

Mutation-tested by the orchestrator, not taken from the report: restored `createTour.ts` from
`e2d0058` → **4 of 12** new cases failed by name (`ArrowRight moves … forward`, `ArrowLeft moves …
back`, `ArrowRight on the last step is a no-op`, `full walk to the end, then ArrowLeft back to
start`), all with real assertions (`expected 'Step A' to be 'Step B'`). Restored with
`git checkout HEAD --` → `git status` clean and 62/62 green again. Recorded honestly: the other **8
cases pass against the pre-change engine too**, because they assert that nothing happens (gating,
modifiers, editable targets, no active tour) — real coverage of the new guards, but they do not bite
on their own.

Re-measured: `@md/product-tour` **7 files / 62 tests** (was 6/50), `npx tsc -p packages/product-tour`
0 errors, `pnpm check` 337 files 0 errors / 0 warnings / 3 hints, `pnpm lint` the same 3 pre-existing
errors by name. e2e per D19 — the shared key handler is what changed, so the spec that covers both
editors' Escape paths: `tests/e2e/tour.spec.ts` → **20 passed / 0 failed / 0 skipped in 2.5 min**
(`.orquestacion/e2e-tour-B18.log`).

Gate run for B17+B17b (orchestrator, `7403b7c..fb40a42`): 13 files, all in scope. Every pre-existing
test file touched is an **addition only** — `tourAnchors.render.test.tsx` `1 0` (one more anchor in
`ALWAYS_PRESENT_ANCHORS`), `tourSteps.flags.test.ts` `4 1` (three more anchors in the
`arrayContaining`, and its title reworded), the two hook fixtures `3 0` each (the three missing stub
anchors). In `tests/e2e/tour.spec.ts` exactly **two** lines were removed, and they are the two
authorised ones: the `'Name and autosave'` title and the `filter({ has: sendTest })` locator. Nothing
was weakened: `.and(sendTest)` is a stricter statement than the old `filter`, and the title assertion
is still an exact `toHaveText`.

`EditorHeader.tsx` (`18 12`) is anchor placement only — attribute spreads moved onto the name field,
the Save button, the status span and the Send-test button, with the Landings `dataTourAttrPbx` branch
on `.center` left intact and no class, element or style touched. Re-measured: email-builder 8 files/47
tests, product-tour 6/50, builder42 13/119, root 43/303, check 0/0/3, lint the same 3 by name.

e2e, under the **new reduced policy (D19)**: `tour.spec.ts` → 19 passed / 1 failed, and the failure
(`clicking the overlay outside the popover…`, B16's own new test) **passes in isolation** — a flake in
a run that took 9.1 min where the same spec had taken 2.8 min earlier, i.e. the degraded-environment
instability B13 already describes. Header consumers (`workspace-tour.spec.ts -g "builder opens and can
be left|send-test dialog"`) → 4 passed / 1 failed, and that one was **not** a flake: see D20. After
the two-line fix it passes in 22.5 s.

**Orchestrator wrote code, deliberately, once:** the D20 fix is two lines in a test file. Per the
protocol the orchestrator does not implement, but the alternative was a full subagent round (handoff +
report + gate) for a locator change, right after the user objected to wasted verification time. Logged
here rather than left implicit; if this becomes a habit, it is a smell.

Gate run for B16 (orchestrator, `105dde1..fdace56`): 3 files, all in scope; `57 8` on the engine (the
8 removed lines are the stale re-entrancy comment and the `allowKeyboardControl: true` line), `235 0`
and `80 0` pure additions. No deletions, history intact. Mutation-tested: restored `createTour.ts`
from `105dde1` → **3 of 5** new unit cases failed (close button, overlay click, last-step gating);
the Escape and Done cases pass both ways by design. Restored, 50/50 green. Re-measured: product-tour
6 files/50 tests, `tsc` 0, email-builder 8/46, builder42 13/119, check 0/0/3, lint the same 3 by name,
and `tour.spec.ts` **18 passed** (14 + 4 new: «×» and overlay click, in **both** editors).

The root cause is now documented in the engine with the actual driver.js source read into the comment:
`h(e=!0)` returns early when an `onDestroyStarted` is configured and the close came from driver.js
itself, so the hook owns the teardown — while the public `destroy()` is `()=>{h(!1)}`, which is why it
can never re-enter that hook. The old comment asserting the opposite is gone.

Gate run for B9c (orchestrator, `1223782..22fc29e`): 2 files, `5 11` and `32 0`. The anchor moved onto
a new inner wrapper so `pbx.toolbar.history` now contains only undo/redo, and the redundant
`role="group"`/`aria-label` around the single button is gone. Re-measured: builder42 13 files/**119**
tests, `tsc` 0, `tour.spec.ts` **14 passed / 0 skipped / 0 failed**, check 0/0/3, lint the same 3 by
name. No CSS touched. Its two new static cases were mutation-checked by the implementer against the
pre-fix source (2 failed → 7 passed).

Gate run for F7 (orchestrator, `22fc29e..a31a1ef`): 4 files, all in scope. `createTour.ts` is
`10 8` and **every changed line is a comment** — verified mechanically by filtering the diff for
non-comment `+`/`-` lines (empty result). Docs read for accuracy against the code, and the one claim
the orchestrator had not personally confirmed — the PostHog property names — checked directly:
`LandingPageBuilder.tsx:118` does `window.posthog?.capture(event.event, { tour_id: event.tourId, … })`.
Suites identical to baseline (45 / 119 / 46 / 303, check 0/0/3, lint 3 by name); this task added no
tests, as required.

---

## Chain closed (2026-09-14)

`HEAD = a31a1ef` on `feat/ui-polish-p1`. **Nothing is half-finished and nothing is red that was not
red before this work started.**

Final measurements taken by the orchestrator at that commit:

| Gate                                              | Result                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `pnpm build`                                      | **Complete!** (server built in 2m 2s) — first full build since B1 fixed it |
| `pnpm check`                                      | 337 files, 0 errors, 0 warnings, 3 hints              |
| `pnpm lint`                                       | 3 errors, the same pre-existing names                 |
| `pnpm test` (root)                                | 43 files / 303 tests                                  |
| `@md/product-tour`                                | 5 files / 45 tests (was 4/27 at F4)                   |
| `builder42`                                       | 13 files / 119 tests (was 12/112)                     |
| `email-builder-standalone`                        | 8 files / 46 tests (was 7/45)                         |
| e2e `tour.spec.ts`                                | **14 passed / 0 skipped / 0 failed**                   |
| e2e full suite (`--workers=1 --retries=0`)        | **54 passed / 22 failed / 2 skipped** of 78 — the 22 are exactly the pre-existing names |

The tour contributes **zero** e2e failures and **zero** skips. What the chain actually fixed, beyond
the three defects F6 found: a "Done" button that never closed the tour (B7B8), a ⌘K palette entry that
was broken for keyboard users and only appeared to work because of the duplicate-start race (B10), a
restart request silently swallowed when the tour flag was still false (B11), Escape stealing a host
modal's key (B12), and two latent traps caught by reading diffs rather than by tests (B11, B14).

**Still owed to a person, not to a subagent:**

- **B3** — the light/dark visual review of the popover, plus stage clipping over compact rails and
  absolute panels (plan §1.4.8). Nobody has looked at it in a browser. B9c's claim that the moved
  button is pixel-identical is also reasoning + green tests, not eyes.
- **B6** — `AUTH_SECRET` is empty in this `.env`, so real login 500s here for humans too. Auth is
  bypassed in dev (`SKIP_AUTH_FOR_BUILDER_WORK=true`), which is the only reason the e2e can run.
- **B13** — the e2e suite is unstable under `fullyParallel: true`; `--workers=1` is the reliable
  gate configuration. Worth deciding whether to fix the config or record the constraint permanently.

**Optional follow-ups, deliberately not done:** a tour step + copy (en/es/it) teaching the landings
relaunch button (D14 corollary), the `onPopoverRender` passthrough that would delete
`useEmailBuilderTour`'s `MutationObserver` (B2), and unifying the host `AppShell`'s ⌘K palette with
the editor-scoped ones (B10's finding — two global palettes on the same hotkey, worked around from
the editor side only).

Gate run for B9+B9b (orchestrator, net `2cbef01..f229159`): the **net** effect is exactly the intended
one — `tourAnchors.ts` and `tour-anchors-coverage.test.ts` show an **empty** diff against pre-B9 (the
registry is back to its 12 step anchors), `HostToolbar.tsx` is `25 1`, the new unit test `53 0`, and
`tour.spec.ts` `16 21` where the 21 removed lines are the obsolete `test.skip` block and its
partly-wrong reason text. The two `tourSteps.*` tests went green **by the key removal alone** — neither
appears in the diff. Re-measured by the orchestrator: builder42 **13 files / 117 tests** green,
`tsc -p packages/builder42` 0, and `tests/e2e/tour.spec.ts` → **14 passed / 0 skipped / 0 failed**.

The landings relaunch test is real coverage, not a source scan: it marks the tour seen, opens the
embed, asserts zero popovers, clicks the button **by accessible name**
(`getByRole('button', { name: 'View the guided tour' })`) and asserts exactly one popover. The new
builder42 unit test is a static source scan — weak by nature, and honest about it in its own header
(this package has no DOM environment); the e2e is what actually bites.

Gate run for B14 (orchestrator, `ae30cb0..46d9557`): 2 files, both in scope; `61 6` and `107 0`. The
6 deleted lines are the old `hasCompetingModalOpen()` doc block, rewritten in place — **no code and
no assertion removed** (read line by line). History intact. Mutation-tested: restored `createTour.ts`
from `ae30cb0` → the 3 new D12 cases failed by name (`display:none`, `visibility:hidden`, `hidden`
attribute); restored, 45/45 green. Re-measured: `@md/product-tour` 5 files/45 tests, `tsc` 0,
`pnpm check` 337 files 0/0/3, `pnpm lint` the same 3 by name.

e2e gate deliberately **targeted, not the full suite**: B14 can only change the Escape path, which
lives on the two editor routes. `tests/e2e/tour.spec.ts` → **13 passed / 1 skipped**;
`workspace-tour.spec.ts -g "send-test dialog"` → **1 passed** (the test B12 closed stays closed).

Worth recording from B14's report: happy-dom (this package's test environment) **does** implement
`checkVisibility`, so the platform branch is the one exercised for `display:none` /
`visibility:hidden`, but it never inspects the `hidden` attribute — which is why that attribute is
checked explicitly and unconditionally before `checkVisibility` is consulted. The no-`checkVisibility`
fallback branch is therefore **not covered by any test**; stated plainly rather than implied.

Gate run for B12 (orchestrator, `080c6ed..a0afd05`): 3 files, all in scope, and all three are **pure
additions** — `47 0` (engine), `133 0` (unit tests), `48 0` (e2e). Zero deleted lines in the whole
commit, so no pre-existing assertion was touched anywhere; nothing to read in the test diff beyond
the new cases. History intact.

Mutation-tested: restored `createTour.ts` from `080c6ed` → the 2 new D11 cases that assert *yielding*
failed (`aria-modal="true"` propagates; `dialog[open]` also detected); the other 2 new cases pass both
ways **by design**, since they assert the unchanged D8 plain case and that driver.js's own
`role="dialog"` popover must not count as a competitor. Restored, 42/42 green.

Re-measured by the orchestrator: `@md/product-tour` 5 files/42 tests, email-builder 8/46,
builder42 12/112, root 43/303, `pnpm check` 337 files 0/0/3, `pnpm lint` the same 3 errors by name.
Full e2e `--workers=1 --retries=0`: **53 passed / 22 failed / 3 skipped** of 78 (77 + B12's new test),
and the 22 are exactly the baseline names — automations 5, dashboard 1, lists 2, login 2,
registration 2, smoke 1, subscribers 3, workspace-tour 6. `workspace-tour.spec.ts:186` is no longer
among them. **The tour chain no longer contributes a single e2e failure.**

Gate run for B10 (orchestrator, `b57c634..46c3a3f`): 3 files, all in scope; zero deletions; `b57c634`
still an ancestor. The new unit test is a pure `116 0` addition and the two source files are
`35 1` / `9 1` — nothing rewritten. Re-measured: email-builder 8 files/46 tests (was 7/45),
`pnpm check` 337 files 0/0/3, `pnpm lint` the same 3 errors by name.

Mutation-tested that the new test bites: restored `useEmailBuilderTour.ts` from `b57c634` →
`useEmailBuilderTour.restart-before-enabled.test.tsx` failed (`Test timed out in 5000ms`, i.e. the
restart never fired after the flag flip); restored, tree clean.

**tests/e2e/tour.spec.ts is fully green:** in the orchestrator's own full-suite run (below) no test
from that spec failed, so 12 passed / 1 skipped / 0 failed — the palette test passes **unmodified**,
which is the outcome the handoff demanded. B11 (the swallowed restart) is fixed in the same commit,
with the bookkeeping assignment moved below the `tourEnabled` gate and the comment corrected.

Full-suite e2e re-measured by the orchestrator, `--workers=1 --retries=0`:
**51 passed / 23 failed / 3 skipped** of 77. The 23 are the 22 baseline names **plus one**:
`workspace-tour.spec.ts:186 › templates › the send-test dialog opens and cancels without sending`
→ tracked as finding **B12**, and it passes in isolation (12.2 s), so it is timing-dependent, not a
hard break.

Gate run for B7B8 (orchestrator, `3588311..4e842fd`): 4 files, all inside the declared scope; **zero deletions**; `3588311` still an ancestor of `HEAD`. Re-measured by the orchestrator, not taken from the report: `pnpm check` → 337 files, 0/0/3 (identical); `pnpm lint` → the same 3 baseline errors **by name**, no new ones; `@md/product-tour` 5 files/38 tests (was 4/27 — the new file is a pure `317 0` addition), builder42 12/112, email-builder 7/45, root 43/303, `tsc -p packages/product-tour` 0.

Read the test diff: `tests/e2e/tour.spec.ts` is `141 63`, and every deleted line is either the two `test.fixme` wrappers (replaced by four real tests) or the file-level comment that documented the bug. The only touched pre-existing assertions are the authorised `.first()` → `toHaveCount(1)` tightenings in the landings block. **No assertion was lowered.**

Mutation-tested that the new engine tests bite: restored `createTour.ts` from `3588311` → **6 of 11** new tests failed (both D7 sequential/concurrent-start cases, the relaunch case, the post-`stop()` resurrection case, and both D8 Escape cases); restored, `git status` clean again and 38/38 green.

e2e re-measured by the orchestrator (`--project=chromium --no-deps --workers=1 --retries=0`):
**11 passed / 1 skipped / 1 failed** of 13. The four new tests pass in **both** editors — single instance throughout, a full step walk to Done with real clicks (no `force`, no pointer interception), and Escape closing the tour with the editor still open. B7 and B8 are fixed and proven.

The one failure is a **new red by name** and is tracked as **B10**:
`tour.spec.ts:106 › email editor tour › relaunches from the command palette`.

Not reverted, deliberately: the commit is verified correct on its own subject, the failure is isolated to one relaunch entry point, and the evidence says that test was passing for the wrong reason before (see B10). Reverting would trade a proven fix for a false green. The chain is **red with one task**; the cap is two, and B10 closes it.

Gate run for F6 (orchestrator, `9fedf77..860212c`): two new files under `tests/e2e/` only, 340
insertions, **zero deletions**, history intact. Full suite re-measured with
`--project=chromium --no-deps`: 48 passed / 22 failed / 5 skipped of 75. The 22 failures are the
same baseline set by name; 48 = 40 baseline + 8 new; 5 skipped = 2 baseline + 3 new. `astro check`,
`eslint` and `vitest` unchanged.

Mutation-tested that the new spec bites: replaced `popoverClass: 'md-tour'` with a bogus class in
`useEmailBuilderTour.ts` → 4 email tests failed, including the computed-style theme assertion;
restored with an empty `git diff`.

F6 earned its keep: it found three real defects that every unit test in F1–F5 had missed, which is
exactly what the plan predicted — the anchors and the running tour only exist at runtime.

Gate run for F5 (orchestrator, `8dec9dd..267adbc`): scope respected; **zero deleted lines in the
whole commit**; history intact; lint/check/tests identical to baseline plus the new suites
(builder42 12 files/112 tests, email-builder 7/45). Both new test files are pure additions
(178/0 and 190/0), so no pre-existing assertion was touched.

Mutation-tested that the new tests bite, then restored:

- removed the `tour.css` line from `chrome.css` → 3 failures in `tour-theme-barrels.test.ts`;
  file restored to an identical SHA256.
- reverted `useEmailBuilderTour.ts` to its pre-F5 version → 6 of 7 failures in
  `useEmailBuilderTour.tour-theme.test.tsx`, with real assertions
  (`expected '' to be '#4f46e5'`); tree restored with an empty `git diff`.

---

## Incidents

**I1 (2026-09-14, during F2)** — An auditor subagent read F1 (already implemented in a previous
session, uncommitted) as "scope overreach" and instructed the implementer to delete it.
`packages/product-tour/` was removed along with its workspace deps. Recovered from a dangling
`git stash --include-untracked` commit (`77a936c7`) and committed immediately as `74bb344`.

Root causes, both now closed: (a) the work was uncommitted, therefore unprotected — every phase
since has its own commit; (b) verification had been delegated to a subagent with authority to
change the tree. Per the protocol, **the gate is now run by the orchestrator only**, and no
auditor subagent is launched.

---

## Incidents (cont.)

**I2 (2026-09-14, during B9) — the orchestrator wrote a self-contradictory contract, and the
subagent was right to stop.** The handoff said both "every `data-tour` key must live in
`app/tour/tourAnchors.ts`" (D2) and "do NOT add a tour step for the new control". But this package
enforces a **1:1 mapping between registry keys and tour steps**: `tests/tourSteps.flags.test.ts`
("emite exactamente las 12 anclas del registro…") and `tests/tourSteps.i18n-parity.test.ts` ("cada
ancla del registro tiene un par `steps.<id>.title/description`…"). Adding a key without a step turns
both red by construction, and every escape route was outside the authorised set. The subagent
implemented the whole feature, hit the wall, committed `wip(B9): … blocked on tourSteps invariant`
(`eb9b7bf`), left the two failures named, and asked which constraint yields — exactly what rule 6
asks for. Verified by the orchestrator: `pnpm --filter builder42 test` → 2 files failed / 111 passed,
those two tests by name.

Lesson for future handoffs: before forbidding a file, check whether the package's own tests bind that
file to something the task must change. The registry↔steps invariant was discoverable in the test
names alone and should have been in the contract, not discovered by the implementer. Resolution:
**D14**, and the work is salvaged by a narrow follow-up (B9b) rather than reverted.

## Findings

**B36 — B35 (driver.js's Next-button label lying about "Done") is confirmed LIVE, in the real
browser, not just read from source.** Walking `/dashboard/landings/editor`'s tour with the throwaway
probe (see "After T5" item 1): at the `pbx.settings.pages` step ("Páginas"), the popover's Next
button already read "Listo" (Done) — one full step before the tour actually ends at
`pbx.settings.languages` ("Idiomas"). `ArrowRight` still correctly advanced past it (because this
package's own keyboard handler never consults driver.js's button label, only `currentDriveSteps`
array bounds — the D21 fix from T5), so keyboard navigation is unaffected. A real user reading the
button, though, sees "Done" one step early and could stop there believing the tour finished, or —
per B35's still-open half — click it and have driver.js route to `onDoneClick` for real, ending the
tour a step short. Same root cause as B35 (`B()`'s `nextBtnText: o ? undefined : c`, `o` computed
from a synchronous, anchor-existence-dependent `I()`/`F()` walk), same fix candidates, same owner.

**B35 — driver.js@1.8.0's `isLastStep()` (and its internal Next-button click routing, `L()`) is
NOT a plain index-bounds check: it synchronously re-evaluates whether the NEXT step's anchor
currently exists.** Found while writing T5's test (a) — an ArrowRight dispatched toward a step
whose anchor genuinely does not exist yet (the exact D43 scenario) was silently swallowed, never
reaching `transitionTo()`. Traced to `dist/driver.js.mjs`: `isLastStep()` calls `I(t, activeIndex+1,
1)`, which walks forward calling `F(e, step)` — `F` returns "skip this candidate" based on
`skipMissingElement` AND a synchronous `f(step.element)` resolution — for every candidate, live,
right now. The SAME `I()`/`F()` pair backs driver.js's own Next-button click routing (`L()`,
called both by the popover's built-in click handler and by `B()`, which additionally uses it to
choose the button's label — Next vs Done). This package's own D21 guard
(`if (driverInstance.isLastStep()) return;`, written under D35, before D43 existed) inherited that
same anchor-dependent read, so on the very steps D43 exists to fix, ArrowRight was dropped BEFORE
D43's wait ever ran — masking the bug this task was meant to close. Fixed in `316c490` (T5) by
replacing the D21 check with the plain array-bounds test this package already uses everywhere else
(`activeIndex + 1 >= currentDriveSteps.length`), independent of anchor existence. **Not yet fixed,
and out of T5's scope (arrow-key navigation only, per the T5 handoff): the same defect shape for
MOUSE clicks on driver.js's own popover Next button.** Read directly in `dist/driver.js.mjs`: the
click handler recomputes `L(t, activeStep)` itself, at click time, and if `I()` says "no reachable
next step right now" it invokes `onDoneClick` INSTEAD of this package's `onNextClick` — meaning a
real user clicking "Next" toward a step whose anchor a slow `before()` hasn't mounted yet would
complete/destroy the tour instead of transitioning, with no code of this package's ever running to
prevent it (D43's `waitForStepAnchor()` lives inside `transitionTo()`, called FROM `onNextClick` —
but `onNextClick` is never invoked in that case). Not proven against a live click in this session
(T5's contract scoped the new tests to keyboard navigation, matching the contract's own DONE WHEN
list) — this is a reading of `dist/driver.js.mjs`, not yet an executed repro. Needs a decision from
the orchestrator before any fix: candidates include disabling driver.js's built-in
`nextBtnText`/click wiring entirely and routing the popover's Next button through this package's
own click listener (mirroring how Escape/arrows already bypass driver.js's internals per D8/D18),
or eagerly warming the anchor check some other way. Owner: **B35**, follow-up to D43/T5.


the DOM when the engine calls `moveNext()` is skipped instantly \u2014 and if all remaining steps are
missing, the tour reports itself COMPLETED.** Measured by the orchestrator while gating T4, first in the
browser and then by reading `driver.js@1.8.0`'s `dist/driver.js.mjs` directly:
`[regex]::Matches(src,"waitForElement").Count` is **3**, and all three are the same occurrence \u2014 the
`waitForElement: 0` entry of the defaults object in `ne()`; the option is never read anywhere else.
`skipMissingElement` IS implemented (`F(e,t)` returns "skip this step" when the flag is set and
`f(t.element)` resolves falsy, and `I(e,from,dir)` walks to the next non-skippable index), so the skip
is immediate and synchronous, with no waiting of any kind. When `I()` finds no further index, `L()`
routes to `onDoneClick` \u2014 which in this engine persists completion and emits `tour_completed`. This
invalidates part of what **D35** documented ("driver.js does its own polling/timeout with a
MutationObserver + setTimeout in its internal `m()`/`p()` and decides to omit the step"): the omission is
real, the waiting is fiction. Observed consequence in the landing editor: at the `pbx.settings.layers`
step, clicking Next ran `before()` (which flips a React panel), and 227 ms later the overlay and popover
were gone \u2014 driver.js had skipped `settings.pages`, `settings.languages`, `pages.breadcrumb` and
`profileMenu` in one synchronous sweep because React had not committed the new panel yet. Closed by
**D43** (engine waits for the incoming step's anchor before moving); the dead `waitForElement` we still
pass to driver.js is harmless but must not be trusted again.

**B33 — the landing tour speaks Spanish while the embedded editor speaks English.** Measured in the
browser during the T3/T4 gates: the popovers read "Nombre y autoguardado" / "Plantillas de p\u00e1gina" while
the editor chrome around them reads "Edit" / "Preview" / "Components" / "Templates". Cause, read in
`app/tour/tourSteps.ts`: its `t()` resolves against the **global i18next singleton** (`import i18n from
"@/i18n"`, whose `lng` comes from `readConfig("editorLang")`, default `"es"`), but the embed renders with
a per-instance i18n created by `createEditorI18n(locale)` from the host's locale \u2014 the instance
`useBuilder42Tour` already receives and watches for `languageChanged`. So the copy is resolved from a
different catalogue than every other string on screen. Fix shape (not attempted, needs its own task):
pass the i18n instance into `buildBuilder42TourSteps(config, i18nInstance)` and resolve copy from it,
keeping the singleton as the standalone default. Owner: unassigned.

**B32 — a browser gate run right after a subagent edits package source can read a STALE module and
report a phantom crash.** During the T2 gate the orchestrator measured `ReferenceError: dataTourAttr is
not defined` from `ViewportDropdown.tsx` and opened a corrective task (T2b) \u2014 but the import was already
present in the committed file (`git show HEAD:\u2026` confirmed it): the long-running `astro dev` server
(started 10:15, per **B20**'s note that it degrades over hours) was still serving a transform from an
intermediate save. Touching the changed files' mtimes and re-running showed the editor mounting cleanly.
**Procedure for this environment: before any browser verification of a package-source change, bump the
mtimes of the touched files (or restart the dev server) \u2014 otherwise the observation is not about the
committed code.** T2b was not wasted (its guard test is real and bites), but the diagnosis that
justified it was an artefact.

**B31 — nothing type-checks `packages/builder42`.** The root `tsconfig.json` lists `packages` under
`exclude`, so neither `pnpm check` (astro check) nor `tsc --noEmit` sees that tree, and the package has
no `typecheck` script of its own (`package.json` has only `test` and `build:runtime`) \u2014 unlike
`@md/product-tour`, which does. A missing import or a type error inside `packages/builder42` is caught
only by a runtime crash in the browser (see **B32** for how that played out) or, indirectly, by the
static-source assertions in `tests/tour-anchors-coverage.test.ts`. Cheap to close: add
`\"typecheck\": \"tsc --noEmit\"` to that package and wire it into the gate \u2014 but it must be its own task,
because nobody has measured how many pre-existing errors that would surface. Owner: unassigned.

**B30 — the \"initial value\" case of `tests/ui.sidebarTab.test.ts` does not bite.** Measured by the
orchestrator gating T1: changing the slice's initial `sidebarTab` from `\"components\"` to `\"templates\"`
leaves that file 3/3 green, because its own `beforeEach` calls
`useDocumentStore.setState({ sidebarTab: \"components\" })` \u2014 so the assertion checks the reset, not the
default. The two cases that matter (the setter, called from outside React \u2014 the seam D38 exists for) DO
bite. Closing it properly needs `vi.resetModules()` + a dynamic re-import to observe a fresh store, which
is more machinery than the value justifies. Owner: unassigned.

**B29 — every tour `before()` that opens a panel by writing `localStorage` directly is a no-op in the
live session.** Found by the orchestrator reading `hooks/useLocalConfig.ts` while planning the landing
step redesign. That hook is a shared external store: instances subscribe per key and are woken ONLY by
`notify(key)`, which only `writeConfig()` calls. `app/tour/tourSteps.ts` sets
`localStorage.setItem("pb:sidebarMode", "open")` and `localStorage.setItem("pb:inspectorCollapsed",
"false")` in three `before()` hooks — the value persists, but no mounted component re-reads it, so the
sidebar stays compact and the inspector stays collapsed until the next mount. The steps only appeared
to work because the panels are usually already open. Closed for those hooks by T4 under **D40**; worth
remembering as a shape: in this package, "write the preference" and "the UI reacts" are the same call
only if it is `writeConfig`.

**B28 — this environment can only run the authenticated e2e specs through the DEV-ONLY auth bypass,
and `auth.setup.ts` always fails (refines B6).** Measured: `AUTH_SECRET` in `.env` is still just the
hint comment (the line is 78 chars, contains `#` and spaces; the "value" is the comment text), so
`GET /api/auth/csrf` → **500** and `[setup] auth.setup.ts › authenticate` times out on
`/login?error=expired` — exactly B6, unresolved. The dashboard is reachable anyway because `.env`
sets `SKIP_AUTH_FOR_BUILDER_WORK=true` (the TEMP dev bypass in `src/middleware.ts`, which injects a
fake session). **So the working invocation for any editor spec here is
`npx playwright test tests/e2e/<file>.spec.ts --project=chromium --no-deps --workers=1 --retries=0`**
— `--no-deps` skips the failing setup project, and the exact path matters (`tour.spec.ts` alone also
matches `workspace-tour.spec.ts` and drags in ~6 min of unrelated, baseline-red tests). Two
consequences worth keeping: the suite is currently **not** exercising the real login path at all, and
nothing here proves the tour works for a genuinely authenticated session. Owner: unassigned (the
`.env` fix belongs to whoever runs this environment).

**B27 — the new landing-side "inside the viewport" e2e test does not bite; only the email one does.**
Measured while gating L2: with L1 reverted in the working tree, the EMAIL test fails with the literal
off-screen rect (`{"left":1280,"top":1234,…}`), while the LANDING test passes — on that route the
stylesheet happened to win the race. That is the same non-determinism that made the bug look
editor-specific in the first place, so the landing assertion is real coverage but a weak probe: it
will catch a permanent regression, not a re-introduced race. Closing it properly would need a
test-only seam to delay the stylesheet (product code changed for a test's benefit), which is why it
was not done. The unit test in `packages/product-tour/tests/styleLoadOrdering.test.ts` is the
deterministic guard; treat the two e2e tests as the end-to-end smoke on top of it. Owner: unassigned.

**B26 — T8b's two \"tour destroyed mid-transition\" tests do not bite, so that guard is covered only by
reading.** Measured by the orchestrator: removing the liveness re-check from inside the D35.5
reconciliation poll loop (`instance = driverInstance; if (!instance || !isLive()) return;`) leaves
`stepActivation.test.ts` **15/15 green**, and no `TypeError` appears anywhere in the output — i.e. the
test never actually reaches the state where the loop polls while `driverInstance` has already been
nulled by `onDestroyed`. The guard itself is correct and cheap (verified by reading: every dereference
after an `await` now reads the closure variable into a local and checks it plus the generation), but
the assertion protecting it is theatre, so a future refactor could delete it and stay green. The
consequence of the unguarded code was modest — an unhandled promise rejection from a `void`-called
async function, plus a `before()` mutating host UI for a tour that no longer exists — which is why
this was not sent back for a third round. To close it properly, a test would have to hold the
transition open at a known point (a `before()` that never resolves until the test says so) and close
the tour precisely while the loop is polling. Owner: unassigned.

**B25 — `tour_step_viewed` had been reporting `stepIndex: -1` since F1** (fixed in `0a6bb37`, recorded
because it says something about the coverage, not just the bug). `onHighlighted` compared the object
driver.js hands back against the array this package configured, but driver.js's internal `B()` builds
a fresh `{...step, popover: {…}}` clone per drive, so `indexOf` never matched. Nothing caught it for
three sessions because no test asserted that event's payload — `closeAndOverlayDismissal.test.ts`
asserts `stepIndex: 0` only for `tour_dismissed`, which is emitted by this package's own code path with
an index read from `getActiveIndex()`. Lesson worth keeping: telemetry that nothing asserts is
telemetry nobody can trust, and the same clone behaviour also invalidated the first
`alreadyHandledAfterStep` implementation in T8 — the same trap twice in one file.

**B24 — the tour i18n parity test cannot tell a translated string from an untranslated one, and it
let three English titles through into Spanish and Italian.** Found by the orchestrator reading T4's
diff. `tests/tourSteps.i18n-parity.test.ts` checks that every key exists in all three catalogues and
that each value is a non-empty string (`value.trim().length === 0`) — nothing more. T4 shipped
`steps.blocksBasics.title`, `steps.blocksLayout.title` and `steps.libraryTemplates.title` as
`"Basics"`, `"Structure"` and `"Templates"` in `es-419` and `it-IT` while their descriptions WERE
translated, and the suite stayed green; the drawer's own headings right next to those popovers already
said "Básicos"/"Estructura". Closed for those six strings by **T4b** (`3ebfea1`), but the hole in the
test remains: any future step can do the same. Cheap partial guard if wanted: assert that a step's
title differs from the `en-US` one for locales where the English word is not a legitimate loanword —
which is exactly why it was not done blind (some values, like Italian "Template", *are* correct as-is).
Owner: unassigned. Meanwhile it is a diff-reading duty, and it is now written into `docs/AGENTS.md`.

**B23 — the host side of dark mode has no automated coverage at all, by construction.** Found by the
orchestrator gating T1. The wiring that actually matters to a user — `VisualEmailBuilder.tsx` passing
`darkMode={hostTheme === 'dark'}` into the vendored editor — is a React island, and this repo has no
way to mount one in tests: the root Vitest environment is `node`, with no jsdom, no happy-dom and no
`@testing-library` in devDependencies (`vitest.config.ts`, `package.json`). `tests/unit/host-theme.test.ts`
covers the hook's DOM-free core (10 cases, mutation-tested) and nothing else, so "the editor turns dark
when the host does" rests on reading the code. Two ways to close it, neither taken: an e2e that toggles
the theme on `/dashboard/templates/email` and asserts a computed style inside the editor (cheapest,
but the e2e suite is the subject of **B21**), or adding happy-dom + a host-island test lane at the root
(a build-infrastructure change, not a task inside this chain). Related to **B3**, which is the same
debt for the tour popover. Owner: unassigned; the visual check is owed to a person.

**B22 — arrow-key navigation has no browser-level coverage, and nothing asserts that a *consumed*
arrow is contained.** Found by the orchestrator reading B18's tests. The 12 new unit cases prove
navigation against real driver.js under happy-dom, but two things are still unproven: (a) no e2e
presses `ArrowRight`/`ArrowLeft` in either real editor, so "the tour advances by keyboard in the
browser" rests on the unit layer alone; (b) on the happy path no test asserts the host never sees the
key — the tests dispatch on `window`, where `stopPropagation()` cannot hide the event from another
`window` listener (that would need `stopImmediatePropagation()`, which the guard deliberately does not
use), so containment would have to be asserted by dispatching from a descendant element. Neither is a
defect: the capture-phase listener on `window` runs before any document/element handler in a real DOM,
and the F4 host tests already cover Escape containment. Cheap to close if wanted: one e2e in
`tests/e2e/tour.spec.ts` (the spec is 2.5 min) plus one unit case dispatching from a child node.
Owner: unassigned.

**B19 — the engine resolves anchors one at a time, waiting up to 2 s for each one that is missing, so a
tour with absent anchors takes seconds to appear.** `buildDriveStep` in
`packages/product-tour/src/createTour.ts` `await`s `waitForAnchor(...)` per step inside a sequential
loop, with `skipMissingElement` defaulting to `true` and a 2000 ms timeout. Every anchor that is not in
the DOM therefore costs a full 2 s **before the first popover renders**, and the cost is additive.
Measured indirectly twice: B10 clocked 5–6.5 s to the first popover in this dev environment, and B17's
three new anchors pushed two unit tests past their 5 s budget purely by adding 3 × 2 s of waiting
(the fixtures were missing the stubs — B17b added them). Nothing is broken, and the `when()` filter
already removes steps whose preconditions fail, but resolving the surviving anchors concurrently (or
with a shorter per-anchor timeout) would cut the tour's time-to-first-paint directly. Not attempted;
the engine was out of scope for both tasks that noticed it. Owner: **B19**.

**B20 — the e2e suite is too expensive to use as a gate, and the cause is how we serve the app, not
the tests.** Measured today: the full suite at `--workers=1` took 12.3 min, then 11.7 min, and by the
end of the session a single spec that had run in 2.8 min took **9.1 min** — the same dev server, hours
older. Under the config's own `fullyParallel: true` the suite is unusable for a different reason (B13:
four `tour.spec.ts` tests fail on load contention). So the current choice is slow-and-reliable or
fast-and-lying. Root causes, in order of size: (1) every editor test hydrates a heavy `client:only`
React island through **Vite dev**, transforming on demand, against **one** dev server — the 45 s
timeouts in these specs exist because of that; (2) the same dev server degrades the longer it runs
(HMR churn), so the numbers are not even stable within a session; (3) each test loads `/dashboard/*`
fresh, and the shell fires a wallet call per mount, so the backend is in the loop too.
Options worth weighing, cheapest first: run the e2e against a **production build** (`astro build` +
the Node server) instead of the dev server, which removes on-demand transforms and would also let
`fullyParallel` come back; keep `--workers=1` only for the specs that genuinely contend; or restart the
dev server before a long run as environment hygiene (it is the user's process — not restarted
autonomously). Owner: **B21**, and it needs a decision from the user, not a subagent: it changes how the
suite is served and therefore what CI would do.

**B18 — B16 fixed the «×» at the cost of arrow-key step navigation, and nobody asked for that
trade.** Found by the orchestrator reading B16's diff. Setting `allowKeyboardControl: false` was the
right call for the *conflict* it solved (with `onDestroyStarted` now destroying, driver.js's own
bubble-phase Escape listener would close the tour in the D11 case where our guard deliberately lets the
key through to a modal), but that flag also governs driver.js's `ArrowLeft`/`ArrowRight` step
navigation, which is now gone. Keyboard users can still Tab to "Next" and press Enter, so nothing is
unreachable — but a capability was removed as a side effect, which is exactly the kind of silent loss
this log exists to catch. Per **D18**, the engine should own arrows the same way it already owns Escape.
Owner: B18.

**B16 — driver.js's own «×» (and the overlay click) never close the tour.** Reported by the user for
the email editor. Cause, read in `packages/product-tour/src/createTour.ts`: when a consumer overrides
`onDestroyStarted`, driver.js hands the responsibility for closing over to that hook — it does not
destroy anything itself. Our hook only emits `tour_dismissed` and deliberately returns without
destroying, with a comment claiming a re-entrancy risk. That reading was wrong: B7B8 already
established (by reading `driver.js@1.8.0`) that the public `destroy()` **skips** `onDestroyStarted`,
so calling it from inside that hook cannot loop. Same hook serves `overlayClickBehavior: 'close'`, so
clicking the overlay is broken too. Escape (D8/D11) and "Done" both work because each destroys
explicitly. Owner: B16, per **D15**.

**B17 — the email tour's header steps highlight groups instead of controls.** Reported by the user,
and confirmed by reading the anchors: `eb.header.identity` is stamped on the whole centre block of
`src/components/react/shared/EditorHeader.tsx`, which contains the name field **and** the "Save
template" button, so the step about naming draws its box around Save too; `eb.header.actions` is
stamped on the right-hand block, which contains the autosave indicator **and** "Send test", so
autosave is never explained on its own. The desktop/mobile switch (`ScreenSizeSelector`,
`InspectorDrawer/.../helpers/inputs/SelectScreen.tsx`, rendered from `TemplatePanel/index.tsx`) has
**no anchor at all** and no step. Note `eb.toolbar.views` is the Edit/Preview/HTML/JSON tab group
(`MainTabsGroup.tsx`), not the viewport switch — easy to confuse. Owner: B17, per **D16**/**D17**.

**B15 — the new relaunch button sits *inside* the element that carries the `pbx.toolbar.history`
anchor, so the history tour step now highlights it too.** Found by the orchestrator reading B9b's
diff. `HostCanvasToolbar` renders
`<div {...dataTourAttr(toolbarHistory)}><HostHistory /><HostTourRestart /></div>`, and driver.js
highlights that whole wrapper — so the step whose copy talks about undo/redo draws its box around a
help button it never mentions (plan §1.4.8 is explicit about highlight precision). Secondary, same
place: `HostTourRestart` wraps a single button in its own `role="group"` reusing the `pbx-history`
class, which is redundant labelling for one control. Cosmetic, not a break — the button works and its
e2e passes. Owner: B9c, moving it out of the anchored wrapper without changing its look or wiring.


**B14 — B12's modal detection counts modals that are in the DOM but not open, which would silently
disable Escape-dismiss.** Found by the orchestrator reading B12's diff. `hasCompetingModalOpen()`
(`packages/product-tour/src/createTour.ts`) accepts **any** node matching
`[aria-modal="true"], dialog[open], [role="dialog"]` outside `.driver-popover`, with no check that it
is actually rendered. Plenty of UI kits keep a closed dialog mounted and merely hidden
(`display:none`, `visibility:hidden`, `hidden`, zero-size). The moment any editor mounts one of those,
the guard would yield on **every** Escape and the tour could never be dismissed by keyboard again —
i.e. a silent regression of B8, in the one place we have just proven users need. Not a live defect
today: measured, both editors' "Escape dismisses the tour" e2e tests pass at `a0afd05`, so no such
node exists on either route right now. It is a trap, not a bug — and the cheap fix (a visibility
check, per D12) is worth taking while the file is fresh. Owner: B14.


**B12 — with the tour active, Escape closes the tour instead of an open host modal, and that is on
the tour's own happy path.** Surfaced as the one non-baseline e2e failure after B10:
`workspace-tour.spec.ts:186 › the send-test dialog opens and cancels without sending` opens the
send-test dialog and closes it with a single `Escape`. D8 gave Escape to the tour whenever a tour is
active, so that key now dismisses the tour and the dialog stays open; the test then fails on
`expect(dialog).not.toBeVisible()`. Measured: it **passes in isolation** (12.2 s) and fails inside the
full run, i.e. it depends on whether the tour's lazily-imported popover has mounted yet (~5–6.5 s in
this dev environment) by the time Escape is pressed. Not a build break — but not a test artifact
either: the email tour's `eb.header.actions` step **highlights the very "Send test" button** that
opens that dialog, so a real user is invited into exactly this state. Neither the old guard (which
swallowed Escape and closed nothing) nor the new one (which closes the tour) does what a user
pressing Escape over an open modal means. Owner: B12, per **D11** below.

**B13 — the e2e suite is unstable under `fullyParallel: true`, so the F6-era "22 failures by name"
baseline is not reproducible with the default worker count.** Measured today at `46c3a3f`, same
`--project=chromium --no-deps` command as the F6 gate: **47 passed / 27 failed / 3 skipped**, and the
27 include four `tour.spec.ts` tests (auto-start, header help button, command palette, popover theme)
that pass reliably at `--workers=1` — several heavy `client:only` editor islands hydrating
concurrently against a single dev server blow the 45 s budgets. The same commit at `--workers=1`:
51 passed / 23 failed / 3 skipped, stable across runs. **From here on the gate's e2e configuration is
`--project=chromium --no-deps --workers=1 --retries=0`**, and the comparison set is the 22 baseline
names (+ B12 until it is closed). Anyone comparing against the older 48/22/5 figure must re-measure
with `--workers=1` first; the numbers are not interchangeable.


**B10 — the ⌘K command-palette relaunch entry is red, and the evidence says it was passing for the
wrong reason.** `tour.spec.ts:106 › relaunches from the command palette` was green at baseline and
fails after B7B8, with the popover never appearing within 10 s of the click. Measured by the
orchestrator, not reported: the *header help button* relaunch test (`tour.spec.ts:90`) still passes,
so `requestTourRestart()` → nonce → rebuild → `start()` works end to end; only the palette path
fails. The B7B8 subagent reports (by execution) that in this environment the palette input never
takes focus after `Ctrl+K`, that neither typed filtering nor `ArrowDown`/`Enter` navigate the list,
and that even a raw `page.mouse.click()` on the visible "View the guided tour" row never reaches
`onSelect`/`runCommand('tour:restart')`. Under the old code the tour auto-started ~2–3 s after mount
*regardless of any click* (the restart-nonce effect fired on the mount's own `tourEnabled` false→true
flip and ignored persistence entirely), which is exactly long enough to satisfy this test after its
instant `toHaveCount(0)` check — and the test's own pre-existing `force: true` comment ("the tour's
own overlay appears the instant this click is delivered") describes that same masking. Still to
determine by execution: whether the defect is in `CommandPalette/index.tsx`'s
`@josecortez1/c42-react` wiring (broken for real users too) or in the test's `force: true` click
strategy, which was only ever justified by the masking. Owner: B10.

**B11 — B7B8's own fix swallows a restart requested while the tour flag is still false.** Found by
the orchestrator reading the diff, not reported by the subagent. In
`useEmailBuilderTour.ts` the new guard is ordered:

```ts
if (restartNonce === lastHandledRestartNonce.current) return;
lastHandledRestartNonce.current = restartNonce;   // ← marked handled…
if (!tourEnabled) return;                          // ← …then dropped
```

The nonce is marked handled *before* the `tourEnabled` gate, so a relaunch requested while
`tourEnabled` is `false` is consumed and never fires: when the flag flips true the effect re-runs,
sees the nonce as already handled, and returns. The old code did fire in that case (its guard only
skipped the very first render), and the new comment in that file claims this case still works — it
does not. Not user-visible on the current routes (`tourEnabled` is already `true` by the time either
entry point is reachable, which is why the header-button test still passes), so it is a latent
regression, not the cause of B10. Fix: move the bookkeeping assignment below the `tourEnabled` gate.
Owner: B10 (same file).


**B1 — RESOLVED (`68c32ae`).** `pnpm build` failed prerendering `/404.html`: `renderScript` could
not resolve the built path for the inline `<script>` in `src/layouts/MarketingLayout.astro`,
followed by a libuv assertion on Windows (`exit 3221226505`).

Root cause was ours, not Astro's config surface: the `@/` alias is resolved by our own Vite plugin
`waTemplateStudioAlias` in `astro.config.ts`, which returned `path.join(root, subpath)` — backslashes
on Windows. Astro builds the `entryModules` manifest key from that raw id, but its compiled output
always queries `renderScript()` with forward slashes, and the lookup is an exact string comparison.
`MarketingLayout.astro` was the only casualty because it is the only `.astro` file that both declares
a `<script>` and arrives through this resolver — pages under `src/pages/**` come from Astro's route
scanner, already normalized. Measured in the failing build: 1 backslash script key vs 7
forward-slash ones. Fixed by normalizing at the single chokepoint both resolver paths funnel
through; a no-op on POSIX.

Two dead ends ruled out empirically before finding it, worth not repeating: the `<script>`'s position
relative to `</BaseLayout>` is irrelevant (moving it inside changes nothing), and
`experimental.incrementalBuild` is not enabled. It was also not a dirty cache: it reproduced at
`3fe09f3` with `dist/`, `.astro/` and `node_modules/.vite` wiped.

**B6 — `AUTH_SECRET` has no value in this environment's `.env`, so Auth.js 500s and login is broken
locally.** Not just the e2e: any sign-in attempt in this dev environment dies the same way.

Symptom: the whole Playwright suite is unusable. `tests/e2e/auth.setup.ts` fails and, because the
`chromium` project depends on `setup`, **64 tests never run**:

```
[setup] > auth.setup.ts:17 > authenticate
  TimeoutError: page.waitForURL ... navigated to "http://localhost:4321/login?error=expired"
  1 failed, 64 did not run
```

`error=expired` is misleading. Traced with a real request capture: the mint works
(`POST /api/login-verify` → 200 with a ticket, and the `magic_link_tokens` row comes back with
`consumed_at` populated ~70 ms later, so `verifyLoginCode` accepted it), and a matching
`auth_tickets` row is issued with `purpose='login'`. The failure is one layer later:
`GET /api/auth/csrf` → **500** "There was a problem with the server configuration", and
`POST /api/auth/callback/credentials` → 500. The ticket is never exchanged.

Cause: `.env` line 9 is `AUTH_SECRET=` followed only by the hint comment
(`# Auth.js session secret - openssl rand -base64 32`), so the effective value is empty and
`@auth/core` (via `auth-astro`, wired in `auth.config.ts`) refuses to operate. `auth.config.ts`
itself is correct — it reads `import.meta.env.AUTH_SECRET ?? process.env.AUTH_SECRET`; the value is
what is missing. Ruled out: a stale server process (the :4321 listener started today, `.env` was
last modified 2026-09-02) and clock drift (Postgres `now()` and the host agree to the second).
Worth recording: a first reading of that line measured a 50-character value, which was the comment
text, not a secret — the shape of the line is what fooled it.

Two hypotheses were refuted along the way, both with direct evidence, so nobody re-walks them: the
orchestrator's guess that the row shape no longer matched the verifier (schema is
`id, email, token_hash, expires_at, consumed_at, created_at` — exactly what the mint writes, and
`sha256Hex` is byte-identical to the harness's hash), and the login allowlist (consulted only when
*requesting* a code, never in `verifyLoginCode`, and `PUBLIC_LOGIN_ALLOWLIST` is empty i.e. open).

The fix is one line in `.env`, but that file holds credentials and belongs to whoever runs this
environment, so it is not being changed autonomously: generate a real secret
(`openssl rand -base64 32`) and assign it to `AUTH_SECRET`. Since sign-in is currently 500ing there
are no valid sessions to invalidate by setting it. **The e2e baseline cannot be measured, and F6
cannot be verified, until this is resolved.**

**B7 — the tour starts TWICE in both editors: two live driver.js instances at once.** Found by F6's
e2e, invisible to every unit test in F1–F5. Two `.driver-popover.md-tour` and two `.driver-overlay`
nodes, stable over 5 s, with only ONE editor DOM tree (the anchor count stayed at 1, so it is not a
duplicated render). Not cosmetic: the two instances hold *different* active steps — in the landing
editor `pbx.header.identity` and `pbx.toolbar.views` were highlighted simultaneously — and one
overlay intercepts pointer events over the other, so clicking "Next" advances one instance while the
other stays put. A user would see two competing popovers.

Cause confirmed for the landing editor: `useBuilder42Tour` has **two call sites** —
`packages/builder42/src/Builder42Editor.tsx:265` and `packages/builder42/src/app/App.tsx:42` — and
both are mounted in the embed. For the email editor there is a single call site
(`src/App/index.tsx:160`), so its duplicate has a different origin; the strongest candidate is the
restart-nonce effect in `useEmailBuilderTour.ts`, whose `isFirstRestartRender` guard only protects
the very first render and would fire a second `start()` when `tourEnabled` transitions
false → true. That last part is a reading of the code, not yet proven by execution.

**B8 — Escape does not dismiss the tour by keyboard, in either editor.** Observed directly: the
popover count did not change across repeated Escape presses. The F4 unit test only proves the host's
close-on-Escape listener never fires — which still holds — so the editor is safe, but the user is
left with no keyboard way out of the tour. Likely the capture-phase guard in `createTour.ts`
unconditionally calling `stopPropagation()`/`preventDefault()` also starves driver.js's own
bubble-phase Escape handler. Plausible and consistent with both the code and the behaviour, but not
confirmed against driver.js internals.

**B9 — the landing editor has no reachable way to relaunch the tour in the Maildrill embed.** F4
wired the entry point into `app/layout/ProfileMenu.tsx`, but the embed mounts `Builder42Editor.tsx`,
which never renders `app/layout/Header.tsx`/`ProfileMenu.tsx` — that chrome only exists in the
standalone `app/App.tsx` tree, as `LandingPageBuilder.tsx`'s own comment states ("Builder42's own
document header is not mounted in embed"). The host's `EditorHeader.tsx` wires a tour-restart button
for the email channel only. So `pbx.profileMenu` is unreachable here and F4's landings entry point
is effectively dead in this product. F6 covered it with a documented `test.skip`.

**B4 — verification greps must never recurse into `node_modules`.** A handoff's boundary checks were
written as `Get-ChildItem -Path packages\builder42 -Recurse -Include *.ts,*.tsx | Select-String ...`.
On Windows that walks each package's `node_modules` and effectively hangs the session; it had to be
cancelled mid-task (the B1 retry), leaving work uncommitted. Use `git grep` (tracked files only) or a
path-scoped search instead, and keep `-Recurse` off any directory that can contain `node_modules`.
Applies to every future handoff, not just tour work.

**B2 — `@md/product-tour`'s `createTour` has no `onPopoverRender` passthrough.** Verified: the
engine only accepts `popoverClass` (`packages/product-tour/src/createTour.ts:53,128`). Plan §2
assumed EmailBuilder would stamp its runtime theme variables inside driver.js's
`onPopoverRender`, so F5 had to locate the popover wrapper with a `MutationObserver` on
`document.body` instead (`useEmailBuilderTour.ts:138-148`, documented in that file's own header).
It works and is unit-tested, but a small engine passthrough would delete the observer entirely.
Candidate follow-up task, not a defect. The engine was out of F5's scope, correctly reported
rather than changed.

**B3 — F5's light/dark visual review is still owed.** Nobody has seen the themed popover render:
the subagent had no browser and said so. Plan §4 F5 asks for a light/dark comparison and a check
of stage clipping over compact rails and absolutely-positioned panels (§1.4.8). The code-level
part is verified (full `--md-tour-*` coverage against `theme.css`, APCA clean); the eyes-on part
is pending and cannot be closed by a subagent.
