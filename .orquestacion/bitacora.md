# Orchestration log â€” product tours (driver.js)

Protocol: [`SKILLS/orquestation.en.md`](../SKILLS/orquestation.en.md) â€” serial, one subagent at a
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
| `pnpm --filter builder42 build:runtime`    | Compiles the runtime shipped inside published landings. Guards plan Â§1.4.7.                                          |
| `pnpm build`                              | Full Astro build. **RED at baseline â€” see B1.**                                                                     |

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

Already RED at baseline â€” **by name**, so a new red stands out:

- `src/components/react/CampaignsBoard.tsx:199` â€” `Definition for rule
  'react-hooks/exhaustive-deps' was not found`.
- `src/components/react/automations/AutomationBuilder.tsx:91` â€” `'past' is assigned a value but
  never used`.
- `src/components/react/automations/AutomationBuilder.tsx:92` â€” `'future' is assigned a value but
  never used`.
- `pnpm build` â€” fails prerendering `/404.html`. See B1.
- 3 `astro check` hints: `LandingPageBuilder.tsx`, `AutomationBuilder.tsx`.

Known ignorable dirt in `git status`: `.cursor/hooks/`, `.kiro/` (untracked local tooling).

---

## Contract decisions (orchestrator's, not delegated)

- **D1** â€” `@md/product-tour` stays domain- and host-agnostic: no PostHog, no Maildrill, no
  "email"/"landing". Its only outlet is `onEvent`. Storage prefix is always injected by the
  consumer (`eb:` / `pb:`). Plan Â§0.
- **D2** â€” Anchor keys (`data-tour`) are a stable contract owned by one registry per editor
  (`tourAnchors.ts`). No `.tsx` hardcodes a key.
- **D3** â€” Builder42 must stay extractable: zero imports from `packages/builder42` into the Astro
  host, nothing under `src/builder/runtime/**`, and tour copy that describes only the editor.
  Plan Â§0.6/Â§1.4.7.
- **D4** â€” The PostHog mapping lives only in `src/components/react/{VisualEmailBuilder,
  LandingPageBuilder}.tsx`. An injected `onTourEvent` is forwarded on top of it, not instead of it.
- **D5** â€” `driver.js` and the popover CSS load lazily, at tour start. They must never enter an
  editor's initial chunk. Plan Â§1.3.
- **D6** â€” Already-implemented phases are never reverted by an agent that reads them as
  out-of-scope. It reports. (Learned the hard way â€” see incident I1.)

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
the bypass is on â€” `login.spec.ts` "code request â†’ 6-digit entry â†’ dashboard" and "the dashboard is
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
â€”   | plan status note               | docs/product-tour-driverjs-plan.md    | 18cfe17 | green
F3a | steps + copy EmailBuilder      | email-builder-standalone/src/tour     | 48a39c7 | green
F3b | steps + copy Builder42         | builder42/src/app/tour                | 0bc74b1 | green
F4  | entry points + persistence     | both packages + 2 host wrappers       | 9ce4192 | green
F5  | popover theme                  | builder42 chrome css + EB runtime map | 267adbc | green
B1  | fix /404.html prerender        | astro.config.ts                       | 68c32ae | green
B5  | fix e2e auth setup            | tests/e2e/**                          | â€”       | stopped: cause outside scope (B6)
F6  | e2e Playwright                 | tests/e2e                             | â€”       | BLOCKED by B6
F7  | docs + telemetry               | docs/AGENTS.md, packages/VENDOR.md    | â€”       | pending
```

Gate run for F5 (orchestrator, `8dec9dd..267adbc`): scope respected; **zero deleted lines in the
whole commit**; history intact; lint/check/tests identical to baseline plus the new suites
(builder42 12 files/112 tests, email-builder 7/45). Both new test files are pure additions
(178/0 and 190/0), so no pre-existing assertion was touched.

Mutation-tested that the new tests bite, then restored:

- removed the `tour.css` line from `chrome.css` â†’ 3 failures in `tour-theme-barrels.test.ts`;
  file restored to an identical SHA256.
- reverted `useEmailBuilderTour.ts` to its pre-F5 version â†’ 6 of 7 failures in
  `useEmailBuilderTour.tour-theme.test.tsx`, with real assertions
  (`expected '' to be '#4f46e5'`); tree restored with an empty `git diff`.

---

## Incidents

**I1 (2026-09-14, during F2)** â€” An auditor subagent read F1 (already implemented in a previous
session, uncommitted) as "scope overreach" and instructed the implementer to delete it.
`packages/product-tour/` was removed along with its workspace deps. Recovered from a dangling
`git stash --include-untracked` commit (`77a936c7`) and committed immediately as `74bb344`.

Root causes, both now closed: (a) the work was uncommitted, therefore unprotected â€” every phase
since has its own commit; (b) verification had been delegated to a subagent with authority to
change the tree. Per the protocol, **the gate is now run by the orchestrator only**, and no
auditor subagent is launched.

---

## Findings

**B1 â€” RESOLVED (`68c32ae`).** `pnpm build` failed prerendering `/404.html`: `renderScript` could
not resolve the built path for the inline `<script>` in `src/layouts/MarketingLayout.astro`,
followed by a libuv assertion on Windows (`exit 3221226505`).

Root cause was ours, not Astro's config surface: the `@/` alias is resolved by our own Vite plugin
`waTemplateStudioAlias` in `astro.config.ts`, which returned `path.join(root, subpath)` â€” backslashes
on Windows. Astro builds the `entryModules` manifest key from that raw id, but its compiled output
always queries `renderScript()` with forward slashes, and the lookup is an exact string comparison.
`MarketingLayout.astro` was the only casualty because it is the only `.astro` file that both declares
a `<script>` and arrives through this resolver â€” pages under `src/pages/**` come from Astro's route
scanner, already normalized. Measured in the failing build: 1 backslash script key vs 7
forward-slash ones. Fixed by normalizing at the single chokepoint both resolver paths funnel
through; a no-op on POSIX.

Two dead ends ruled out empirically before finding it, worth not repeating: the `<script>`'s position
relative to `</BaseLayout>` is irrelevant (moving it inside changes nothing), and
`experimental.incrementalBuild` is not enabled. It was also not a dirty cache: it reproduced at
`3fe09f3` with `dist/`, `.astro/` and `node_modules/.vite` wiped.

**B6 â€” `AUTH_SECRET` has no value in this environment's `.env`, so Auth.js 500s and login is broken
locally.** Not just the e2e: any sign-in attempt in this dev environment dies the same way.

Symptom: the whole Playwright suite is unusable. `tests/e2e/auth.setup.ts` fails and, because the
`chromium` project depends on `setup`, **64 tests never run**:

```
[setup] > auth.setup.ts:17 > authenticate
  TimeoutError: page.waitForURL ... navigated to "http://localhost:4321/login?error=expired"
  1 failed, 64 did not run
```

`error=expired` is misleading. Traced with a real request capture: the mint works
(`POST /api/login-verify` â†’ 200 with a ticket, and the `magic_link_tokens` row comes back with
`consumed_at` populated ~70 ms later, so `verifyLoginCode` accepted it), and a matching
`auth_tickets` row is issued with `purpose='login'`. The failure is one layer later:
`GET /api/auth/csrf` â†’ **500** "There was a problem with the server configuration", and
`POST /api/auth/callback/credentials` â†’ 500. The ticket is never exchanged.

Cause: `.env` line 9 is `AUTH_SECRET=` followed only by the hint comment
(`# Auth.js session secret - openssl rand -base64 32`), so the effective value is empty and
`@auth/core` (via `auth-astro`, wired in `auth.config.ts`) refuses to operate. `auth.config.ts`
itself is correct â€” it reads `import.meta.env.AUTH_SECRET ?? process.env.AUTH_SECRET`; the value is
what is missing. Ruled out: a stale server process (the :4321 listener started today, `.env` was
last modified 2026-09-02) and clock drift (Postgres `now()` and the host agree to the second).
Worth recording: a first reading of that line measured a 50-character value, which was the comment
text, not a secret â€” the shape of the line is what fooled it.

Two hypotheses were refuted along the way, both with direct evidence, so nobody re-walks them: the
orchestrator's guess that the row shape no longer matched the verifier (schema is
`id, email, token_hash, expires_at, consumed_at, created_at` â€” exactly what the mint writes, and
`sha256Hex` is byte-identical to the harness's hash), and the login allowlist (consulted only when
*requesting* a code, never in `verifyLoginCode`, and `PUBLIC_LOGIN_ALLOWLIST` is empty i.e. open).

The fix is one line in `.env`, but that file holds credentials and belongs to whoever runs this
environment, so it is not being changed autonomously: generate a real secret
(`openssl rand -base64 32`) and assign it to `AUTH_SECRET`. Since sign-in is currently 500ing there
are no valid sessions to invalidate by setting it. **The e2e baseline cannot be measured, and F6
cannot be verified, until this is resolved.**

**B4 â€” verification greps must never recurse into `node_modules`.** A handoff's boundary checks were
written as `Get-ChildItem -Path packages\builder42 -Recurse -Include *.ts,*.tsx | Select-String ...`.
On Windows that walks each package's `node_modules` and effectively hangs the session; it had to be
cancelled mid-task (the B1 retry), leaving work uncommitted. Use `git grep` (tracked files only) or a
path-scoped search instead, and keep `-Recurse` off any directory that can contain `node_modules`.
Applies to every future handoff, not just tour work.

**B2 â€” `@md/product-tour`'s `createTour` has no `onPopoverRender` passthrough.** Verified: the
engine only accepts `popoverClass` (`packages/product-tour/src/createTour.ts:53,128`). Plan Â§2
assumed EmailBuilder would stamp its runtime theme variables inside driver.js's
`onPopoverRender`, so F5 had to locate the popover wrapper with a `MutationObserver` on
`document.body` instead (`useEmailBuilderTour.ts:138-148`, documented in that file's own header).
It works and is unit-tested, but a small engine passthrough would delete the observer entirely.
Candidate follow-up task, not a defect. The engine was out of F5's scope, correctly reported
rather than changed.

**B3 â€” F5's light/dark visual review is still owed.** Nobody has seen the themed popover render:
the subagent had no browser and said so. Plan Â§4 F5 asks for a light/dark comparison and a check
of stage clipping over compact rails and absolutely-positioned panels (Â§1.4.8). The code-level
part is verified (full `--md-tour-*` coverage against `theme.css`, APCA clean); the eyes-on part
is pending and cannot be closed by a subagent.
