# Orchestration log — product tours (driver.js)

Protocol: [`SKILLS/orquestation.md`](../SKILLS/orquestation.md) — serial, one subagent at a
time, one commit per task, orchestrator runs the gate.

Plan being executed: [`docs/product-tour-driverjs-plan.md`](../docs/product-tour-driverjs-plan.md).

**Branch:** `feat/ui-polish-p1` (do not switch mid-chain).

---

# START HERE — next session

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
B7  | duplicate tour instances       | both tour hooks                       | —       | next
B8  | Escape does not dismiss tour   | product-tour escape guard             | —       | next (with B7)
B9  | landings has no relaunch entry | builder42 embed chrome                | —       | next (with B7)
F7  | docs + telemetry               | docs/AGENTS.md, packages/VENDOR.md    | —       | pending
```

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

## Findings

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
