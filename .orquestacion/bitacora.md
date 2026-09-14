# Orchestration log — product tours (driver.js)

Protocol: [`SKILLS/orquestation.en.md`](../SKILLS/orquestation.en.md) — serial, one subagent at a
time, one commit per task, orchestrator runs the gate.

Plan being executed: [`docs/product-tour-driverjs-plan.md`](../docs/product-tour-driverjs-plan.md).

**Branch:** `feat/ui-polish-p1` (do not switch mid-chain).

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
| `pnpm build`                              | Full Astro build. **RED at baseline — see B1.**                                                                     |

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
F6  | e2e Playwright                 | tests/e2e                             | —       | BLOCKED by B1
B1  | fix /404.html prerender        | TBD by diagnosis                      | —       | next
F7  | docs + telemetry               | docs/AGENTS.md, packages/VENDOR.md    | —       | pending
```

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

## Findings

**B1 — `pnpm build` fails prerendering `/404.html`.** `renderScript` cannot resolve the built path
for the inline `<script>` in `src/layouts/MarketingLayout.astro`
(`.../MarketingLayout.astro?astro&type=script&index=0&lang.ts`), followed by a libuv assertion
crash on Windows (`exit 3221226505`). Astro 7.2.10, Node 24.16.0.

Not caused by the tour work: that layout has not changed since 2026-09-06 (`460effd`), the
lockfile did not move `astro`, and the failure reproduces on a clean tree at `3fe09f3` with
`dist/`, `.astro/` and `node_modules/.vite` wiped. **Blocks F6**, since the Playwright e2e needs a
build. Needs its own task before F6.

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
