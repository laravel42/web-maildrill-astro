# Automations — architecture & Activepieces integration

> Status: implemented (v1 vertical slice). Read this before touching anything under
> `workers/packages/activepieces-core`, `workers/packages/automations`, or
> `src/components/react/automations/`.

Maildrill Automations is a native workspace feature: users compose a trigger → steps
workflow on a canvas, publish it, and Maildrill runs it durably in the background.
Activepieces (MIT core) supplies the **automation primitives** — the flow model, the
execution semantics, the piece DSL, the condition operators and the expression syntax.
Maildrill supplies everything else: identity, tenancy, authorization, billing, contacts,
segments, templates, channels, the queue/worker fabric, the UI and the design language.

---

## 1. Maildrill architecture found (the constraints this had to fit)

| Concern | What exists |
| --- | --- |
| Frontend | Astro 7, static-first marketing + SSR app routes (`export const prerender = false`), React 19 islands, hand-authored CSS modules over `src/styles/tokens.css`. No Tailwind/Radix/shadcn in the app shell. |
| App shell | `src/layouts/AppLayout.astro` → `AppShell.tsx` (238px sidebar from `src/config/navigation.ts`, 57px topbar, cmd-K palette, light/dark via `data-theme`). |
| Routing | Workspace lives under `/dashboard/*`; route table in `src/config/routes.ts`. |
| Auth | Auth.js (`auth-astro`) session cookie; `src/middleware.ts` gates `/dashboard/*` and enforces session revocation. |
| BFF | `src/pages/api/v1/[...path].ts` mints a short-lived HS256 JWT (`tenantId`, `userId`, `role`, `sessionId`, `authTime`) and proxies to the backend. **The browser never holds a service credential and never names a tenant.** |
| Backend | `workers/` — Fastify apps (`product-api` :3001, `api` :3002, `email-builder-api` :3003, unified `dev-server`), BullMQ worker roles, Postgres + Drizzle, Redis/Valkey, Pino, Zod, `fastify-type-provider-zod` + Scalar OpenAPI. |
| Tenancy | Shared schema + `tenant_id` discriminator. `authenticate` (`@maildrill/authz`) resolves the tenant **from the credential** and pins `req.tenantId`. Every product service takes `tenantId` as its first argument. |
| Async work | Transactional outbox (`outbox_events`) → poller → BullMQ (`@maildrill/queues`, `QUEUE_NAMES`), worker roles in `workers/apps/workers/src/roles.ts`, `startPoller` for pollers. |
| Sending | `sendCampaign`/`submitMessage` → outbox → dispatch worker → `@maildrill/providers` (Infobip / Cloudflare / mock). Provider results come back via PostHog HogQL polling, not webhooks. |
| Domain events today | `emitAppEvent` (`@maildrill/observability`) — an **in-process observability** sink for the Telescope dashboard, not a durable domain bus. There was no domain event bus before this feature. |
| Migrations | Hand-authored SQL in `workers/migrations/NNNN_name.sql` + a `meta/_journal.json` entry; applied by `drizzle-orm/node-postgres/migrator`. |
| Type gate | `npm run check` (astro check) at the root, `pnpm --dir workers typecheck` for the backend. |

Two of these decided the whole design:

1. **The browser never sends a workspace id.** Any automation surface that accepted one
   would be the first place in the product that did. So `tenantId` is taken from
   `req.tenantId` on every route, and every automation repository function takes it as a
   mandatory first argument — there is no "find automation by id" that isn't scoped.
2. **The API process must stay out of execution.** Campaign sends already work this way
   (outbox → queue → worker). Automations follow the same shape.

## 2. Activepieces architecture (upstream, and what is usable)

Upstream inspected: `https://github.com/activepieces/activepieces`, commit
`71dd1758dc1b04a1ec0349ec23d2424d5055ae05`, `package.json` version `0.88.1`.

```
packages/core/{execution,shared,utils,formula,piece-types}   flow model, step outputs, run status
packages/server/engine                                        the flow executor (not published to npm)
packages/server/worker                                        BullMQ-ish worker + sandbox provisioning
packages/server/sandbox                                       process sandboxing
packages/server/api                                           Fastify + TypeORM app (projects/platforms/users)
packages/pieces/**                                            ~400 integration pieces + the piece framework
packages/web                                                  React app: xyflow, radix/shadcn, tanstack, tiptap, codemirror, i18next
packages/ee/**                                                ENTERPRISE — excluded
packages/server/api/src/app/ee/**                             ENTERPRISE — excluded
```

**Licensing.** Upstream `LICENSE` is MIT Expat *except* `packages/ee/` and
`packages/server/api/src/app/ee/`, which carry a separate commercial license. Nothing from
either path is used, referenced, or copied here. Everything vendored comes from
`packages/core/**` and `packages/server/engine/**`, both MIT.

**What can actually be reused, and what cannot.**

| Upstream asset | Verdict | Why |
| --- | --- | --- |
| Flow/action/trigger model (`core/execution/.../flows`) | **Reused (vendored, adapted)** | Pure schema. Stable, well-designed, and the reason step semantics are worth borrowing at all. |
| `StepOutput` / `GenericStepOutput` / `LoopStepOutput` / `RouterStepOutput` | **Reused (vendored, adapted)** | Pure data classes; they *are* the execution journal contract. |
| `FlowRunStatus`, `PauseType`, `DelayPauseMetadata` | **Reused (vendored, adapted)** | The pause/resume verdict model is exactly what long delays need. |
| `BranchOperator` + `CONDITION_EVALUATORS` (`router-executor.ts`) | **Reused (vendored, adapted)** | 22 operators with settled edge-case behaviour. Re-deriving these would be strictly worse. |
| Mustache token extraction + property-path resolution | **Reused (vendored, adapted, narrowed)** | `{{trigger.x}}` / `{{step.y.z}}` semantics, including the "single token returns the raw value, mixed text returns a string" rule. **The JS-eval fallback (`script-evaluator`, `isolated-vm`) and the formula engine were deliberately NOT ported** — see §9. |
| `pieces-framework` DSL (`createPiece`/`createAction`/`createTrigger`/`Property`) | **Concept reused; a narrowed Maildrill-owned DSL implemented** | The npm-published `@activepieces/pieces-framework` is `0.32.0` against an upstream workspace version far ahead of it, is CommonJS, and drags `ai`, `dayjs`, `nanoid`, `semver`, `socket.io-client` into a package that only needs types. Our `definePiece`/`defineAction`/`defineTrigger` mirrors its shape and prop kinds so upstream pieces can be adapted later, without the dependency tail. |
| `@activepieces/engine` (the executor loop) | **Semantics reused; executor re-implemented in the adapter** | Not published to npm. Its `EngineConstants` *requires* an AP API (`internalApiUrl`, `publicApiUrl` ending in `/api/`, `engineToken`, `projectId`, `platformId`), a socket.io channel back to an AP worker (`worker-socket.ts`), a progress reporter that POSTs to the AP API, piece loading from an AP-managed npm directory, and `isolated-vm`. Importing it means running an Activepieces server beside Maildrill — the exact "thin wrapper" outcome the brief forbids. The **executor loop, verdict propagation, step-output journal, router/loop handling and pause/resume are ported**; the AP-server plumbing is replaced by Maildrill ports. |
| `packages/server/worker` + `packages/server/sandbox` | **Not reused; concept preserved** | They provision AP sandboxes for third-party npm pieces. Maildrill's v1 pieces are first-party in-process code; the untrusted surface (expressions, HTTP) is neutralised differently — see §9. The `PieceRunner` port is the seam where a forked sandbox goes when third-party pieces land. |
| `packages/web` builder UI | **Not reused; re-implemented natively** | xyflow + radix + shadcn + tanstack + tiptap + codemirror + i18next, wired to AP's own auth/projects/routes and its own design system. Dropping it into Maildrill would ship an Activepieces-looking page and ~40 new client dependencies. The canvas is re-implemented in Maildrill's React/CSS-module stack against the **same flow schema**, so the model is shared even though the pixels are not. |
| `packages/pieces/**` integrations | **Deferred, by design** | The registry is namespaced and versioned so upstream pieces can be adapted behind `PieceRunner` without touching the engine, the schema, or the UI. |

This is the brief's option **B for the runtime** (a narrow, isolated, attributed fork) and
option **C for the presentation layer**.

## 3. Target architecture (as built)

```
   Astro SSR page  ──►  React island (lazy)          src/pages/dashboard/automations*
        │                AutomationBuilder                src/components/react/automations/
        │                       │
        │                       ▼  /api/v1/automations…   (same-origin BFF, mints tenant JWT)
        ▼
   Fastify product-api  ──►  routes/automations.ts   ──►  @maildrill/automations (application service)
        │                     routes/automation-webhooks.ts    │
        │                                                     ├─ repository (Drizzle, tenant-scoped)
        │                                                     ├─ validation (publish gate)
        │                                                     └─ enqueue only — never executes
        ▼
   Postgres: automations · automation_versions · automation_runs · automation_step_runs
             automation_events · automation_webhooks · automation_connections
             automation_segment_state
        │
        ▼
   Domain events (@maildrill/domain/events)  ──►  durable sink  ──►  automation_events
        │                                                              │
        │  emitted by subscribers/lists/tags/campaign-delivery         │ poller (automation-dispatch)
        ▼                                                              ▼
   AutomationTriggerDispatcher ── matches active versions ── creates runs ── BullMQ
        │
        ▼
   BullMQ: automation-run · automation-resume            (Redis, @maildrill/queues)
        │
        ▼
   Automation worker role  ──►  AutomationEngine (AP-derived executor)
        │                            │
        │                            ├─ props resolver  ({{trigger.…}} / {{steps.…}}, no eval)
        │                            ├─ router/branch    (AP BranchOperator evaluators)
        │                            ├─ loop / delay     (pause verdict → resume_at + delayed job)
        │                            └─ PieceRunner port
        │                                    │
        ▼                                    ▼
   run + step journal persisted        Maildrill pieces → @maildrill/product · @maildrill/services
                                                            → submitMessage → existing providers
```

Invariants:

* **The engine never imports a Maildrill service.** `@maildrill/automations/engine` depends
  only on `@maildrill/activepieces-core` and its injected ports (`PieceRunner`, `RunJournal`,
  `Clock`). Swapping the engine is a one-file change.
* **The API never executes a flow.** `POST /v1/automations/:id/test` enqueues and returns a
  run id; the UI polls. Every other path is event- or webhook-driven.
* **A waiting workflow occupies nothing.** A delay writes `resume_at` + the serialized
  execution state to Postgres and schedules a delayed BullMQ job. Redis loss is survivable:
  the `automation-resume` poller re-enqueues any run whose `resume_at` has passed.

## 4. Database design

Migration `workers/migrations/0031_automations.sql` (+ journal entry, + Drizzle schema).

| Table | Purpose | Key indexes |
| --- | --- | --- |
| `automations` | Workspace-owned automation, pointing at a draft and (optionally) a published version. | `(tenant_id, updated_at desc)` for the list; `(tenant_id, status)` for filters. |
| `automation_versions` | **Immutable once published.** Holds `trigger` + `flow` JSON, `state`, `valid`. Editing a published automation writes a new draft version. | `(automation_id, version)` unique; `(tenant_id, state)`. |
| `automation_runs` | One row per execution, carrying `execution_state` (the step journal) so a resume needs nothing in memory. | `(tenant_id, automation_id, created_at desc)` for history; `(status, resume_at)` for the resume sweeper; `(tenant_id, dedupe_key)` unique-partial for idempotency. |
| `automation_step_runs` | Per-node input/output/error/timing/attempt. | `(run_id, seq)`. |
| `automation_events` | Durable domain-event log the dispatcher polls (same shape as `outbox_events`). | `(status, available_at)`; `dedupe_key` unique. |
| `automation_webhooks` | One unguessable token per automation; **stored hashed** (SHA-256), with a short lookup prefix. | `token_hash` unique. |
| `automation_connections` | Workspace-scoped external credentials, AES-256-GCM at rest. | `(tenant_id, name)` unique. |
| `automation_segment_state` | Materialised segment membership, so `segment.entered` / `segment.exited` can be derived (segments are rule-derived and have no membership table). | `(tenant_id, segment_id, subscriber_id)` primary key. |

Every table carries `tenant_id`. Every read path filters on it.

## 5. Runtime design

* **Queues** — `automation-run` (execute/resume) and `automation-dispatch` reuse
  `@maildrill/queues`; no new Redis connections beyond BullMQ's own worker connection.
* **Retries** — a step failure is classified through `@maildrill/domain`'s existing
  `ErrorCategory` (`validation`/`authentication`/`permanent` → fail fast;
  `rate_limit`/`temporary`/`unknown` → exponential backoff, capped attempts).
* **Idempotency** — every run carries a deterministic `dedupe_key`
  (`{versionId}:{triggerKey}:{eventDedupeKey}`) with a unique index. A redelivered
  `campaign.delivered` for the same message cannot start the automation twice.
* **Limits** (`AUTOMATION_*` env, all defaulted): max steps per run, max loop iterations,
  max run wall-clock, max trigger payload bytes, max HTTP response bytes, per-workspace
  concurrent runs.
* **Failure recovery** — nothing lives in memory between steps. A worker killed mid-run
  leaves the run `running` with its journal committed; the maintenance sweeper re-queues
  runs that have been `running` past the stall TTL, and re-queues `waiting` runs whose
  `resume_at` has passed.

## 6. Frontend design

* Routes: `/dashboard/automations`, `/dashboard/automations/new`,
  `/dashboard/automations/:id`, `/dashboard/automations/:id/runs`.
* `AppAutomations` (list) hydrates `client:visible`. The composer is **lazy-loaded**
  (`lazyWithRetry`) behind a `LazyBoundary`, so `/dashboard/*` bundles are untouched by its
  existence. Piece metadata is fetched from the server (`GET /v1/automation-pieces`), never
  bundled.
* Composer shell: step library (left) · canvas (centre) · inspector (right), built from
  `src/styles/app.css` primitives and `tokens.css` — same buttons, chips, cards, dialogs,
  drawer, focus ring and dark-mode behaviour as the rest of the workspace. No new UI
  dependency was added to the client bundle; the canvas is hand-rolled SVG + absolutely
  positioned nodes rather than an imported graph library.
* Variables are inserted through a data picker that walks the trigger's sample payload and
  the outputs of preceding steps, so `{{trigger.subscriber.email}}` never has to be typed.
* **Settings → Integrations** (`WorkspaceConnections`) manages the credentials external
  steps authenticate with. The secret is write-only end to end: encrypted on arrival, never
  returned by the API, never rendered, and never written into flow JSON — a flow stores a
  connection id, so rotating a key changes every workflow that uses it without republishing
  any of them.

## 7. Security considerations

* **Tenancy** — routes take `tenantId` from `req.tenantId` only. Repository functions have
  no un-scoped variants. The worker re-reads the automation and version by
  `(tenantId, id)` from the run row rather than trusting the job payload alone.
* **Expressions are not code.** The resolver supports mustache token substitution and
  property-path access. There is no `eval`, no `Function`, no `isolated-vm`, no formula
  engine. This is a deliberate narrowing of upstream's resolver, and it removes the entire
  arbitrary-code-execution surface from v1.
* **No shell, no filesystem, no process access** is reachable from a flow.
* **SSRF** — the HTTP Request action resolves the hostname first and refuses loopback,
  link-local, private, CGNAT, multicast and reserved ranges (v4 and v6); it forbids
  non-http(s) schemes, caps redirects, caps response bytes and enforces a timeout.
* **Secrets** — connection secrets are AES-256-GCM encrypted at rest with the existing
  `SECURITY_ENCRYPTION_KEY` strategy (`@maildrill/identity/security/crypto`), never
  returned by the API, and never written into flow JSON — flows reference a connection id.
  Run inputs/outputs are masked before persistence.
* **Webhook triggers** — 32-byte random tokens, stored hashed; the URL is the credential
  (same reasoning as the unsubscribe token). Body size capped; unknown tokens 404 without
  disclosing whether an automation exists.
* **Runaway protection** — step budget, loop-iteration budget, wall-clock budget, and a
  recursion guard that refuses to re-trigger the same automation from its own effects.

## 8. What was verified

Beyond the type/lint/build gates, the slice was exercised against a live stack (Postgres,
Redis, the unified dev server with all four automation worker roles, and a real browser):

* `packages/automations/src/automations.e2e.test.ts` — event → `automation_events` →
  dispatcher → run → engine → Maildrill action, plus the delay/resume path, exactly-once on
  a redelivered event, cross-workspace isolation, the immutable-published-version rule, a
  paused automation staying inert, and a failing step's error landing on the right node.
* `tests/e2e/automations.spec.ts` — the composer in a browser: create, choose a trigger, add
  and configure a step, publish, then **cause a real `subscriber.created` and watch the
  worker execute the workflow**, ending in the run inspector showing both steps. Also the
  connections screen, asserting the secret appears neither in the DOM nor in the API
  response.

One real defect was found by that work and fixed: the dispatcher compared
`available_at` against the *application's* clock while the column defaults to the
*database's* `now()`, so a few milliseconds of skew made a just-inserted event look
scheduled in the future. It self-healed on the next poll, which is why it presented as a
flaky test rather than an outage.

## 9. Deliberate scope limits (v1)

* Third-party Activepieces pieces are not exposed. The registry supports them; running
  untrusted npm code needs the forked sandbox described in §2, which is not built.
* Code (arbitrary JS) steps are not exposed, for the same reason.
* Segment enter/exit is evaluated by a poller (default 60s), because segments are rule-derived.

## 10. Upgrading the vendored Activepieces code

See `workers/packages/activepieces-core/VENDOR.md` — it records the upstream URL, commit,
the exact files each vendored module derives from, what was changed, and the procedure for
re-syncing.
