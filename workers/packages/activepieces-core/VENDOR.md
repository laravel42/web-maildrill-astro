# Vendored: Activepieces core (MIT)

This package holds a **narrow, adapted subset** of Activepieces' MIT core — the automation
primitives Maildrill reuses: the flow model, the execution journal, the run/pause verdicts,
the branch-condition operators, and the mustache/property-path expression semantics.

Nothing here talks to Activepieces. It has one runtime dependency (`zod`) and imports no
Maildrill code, so it can be re-synced against upstream without touching the product.

## Upstream

| | |
| --- | --- |
| Repository | https://github.com/activepieces/activepieces |
| Commit | `71dd1758dc1b04a1ec0349ec23d2424d5055ae05` |
| Version at that commit | `0.88.1` |
| Vendored on | 2026-08-20 |
| License | MIT Expat — see `LICENSE.activepieces` |

## License boundary

Upstream's `LICENSE` places `packages/ee/**` and `packages/server/api/src/app/ee/**` under a
separate **commercial** license; everything else is MIT Expat.

**No file in this package derives from either enterprise path.** Every module below comes
from `packages/core/**` or `packages/server/engine/**`, both MIT. A re-sync must re-check
this: if upstream moves a file into an `ee/` path, it stops being usable here.

## What is vendored, and from where

| This package | Upstream source | Adaptation |
| --- | --- | --- |
| `src/flow-model.ts` | `packages/core/execution/src/lib/flows/actions/action.ts`, `.../triggers/trigger.ts`, `.../flow-version.ts` | Rewritten as Zod v4 schemas + ESM. `FlowActionType.CODE` dropped (Maildrill exposes no arbitrary-code step). `PropertySettings`, `SampleDataSetting`, agent/MCP/table settings dropped. Trigger reduced to `PIECE` + `EMPTY`. Step names constrained by the same `STEP_NAME_REGEX` shape. |
| `src/step-output.ts` | `packages/core/execution/src/lib/flow-run/execution/step-output.ts` | Ported near-verbatim: `StepOutputStatus`, `GenericStepOutput`, `LoopStepOutput`, `RouterStepOutput`. Log-slice/file-manifest members dropped (Maildrill journals to Postgres, not to S3-backed log files). |
| `src/flow-execution.ts` | `packages/core/execution/src/lib/flow-run/execution/flow-execution.ts`, `.../execution-output.ts` | `FlowRunStatus` narrowed to the states Maildrill can actually reach; `PauseType`/`DelayPauseMetadata` kept; AP transport fields (`handlerId`, `requestIdToReply`, `streamStepProgress`) dropped. |
| `src/conditions.ts` | `packages/server/engine/src/lib/handler/router-executor.ts` (the `CONDITION_EVALUATORS` table and its helpers) | Operator set and per-operator behaviour ported faithfully. `dayjs` replaced with `Date` parsing; `tryCatchSync` inlined. |
| `src/property-path.ts` | `packages/server/engine/src/lib/variables/property-path.ts` | Same segment semantics and the same `__proto__`/`constructor`/`prototype` blocklist, but the `jsep` AST parse is replaced by a hand-rolled path scanner — Maildrill's resolver does not accept expressions, only paths, so a JS parser would widen the surface it exists to narrow. |
| `src/mustache.ts` | `packages/core/utils/src/lib/mustache-utils.ts`, `.../object-utils.ts` (`applyFunctionToValues`) | Ported verbatim in behaviour (brace counting, untrimmed `inner`), retyped. |
| `src/props-resolver.ts` | `packages/server/engine/src/lib/variables/props-resolver.ts` | Structure and the "single token → raw value, mixed text → string" rule ported. **The `script-evaluator` / `isolated-vm` fallback and the `@activepieces/core-formula` engine were deliberately NOT ported** — an unresolvable token yields `undefined` instead of being handed to a JS evaluator. This is the single most important divergence: it removes arbitrary code execution from the product. |
| `src/flow-structure.ts` | `packages/core/execution/src/lib/flows/util/flow-structure-util.ts` | Traversal helpers (`getAllSteps`, `getStep`, `transferStep`) reimplemented for the reduced model. |
| `src/piece-framework.ts` | `packages/pieces/community/framework` (the `createPiece`/`createAction`/`createTrigger`/`Property` DSL) | **Concept ported, code not copied.** Same shape and prop kinds so an upstream piece can be adapted mechanically, without pulling `@activepieces/pieces-framework`'s dependency tail (`ai`, `dayjs`, `nanoid`, `semver`, `socket.io-client`) into the backend. |

## What is deliberately NOT vendored

* `@activepieces/engine`'s executor plumbing — `EngineConstants`, `worker-socket.ts`,
  `flow-run-progress-reporter`, `piece-path`/`piece-runner` (npm piece loading),
  `v8-isolate-code-sandbox`. All of it assumes an Activepieces API server, an engine token
  and an AP-managed piece directory. Maildrill's executor
  (`@maildrill/automations/engine`) implements the same semantics against injected ports.
* `packages/server/worker`, `packages/server/sandbox` — Maildrill runs flows on its own
  BullMQ worker roles.
* `packages/web` — the composer is re-implemented in Maildrill's React/CSS-module stack.
* Anything under `packages/ee/**`.

## Re-syncing against a newer Activepieces

1. `git clone --depth 1 https://github.com/activepieces/activepieces` and note the commit.
2. Confirm the `LICENSE` boundary is unchanged and that none of the files in the table
   above moved under an `ee/` path.
3. Diff each upstream source in the table against its counterpart here. The adaptations are
   listed per file above; re-apply them rather than taking upstream wholesale.
4. Pay particular attention to `conditions.ts` (operator semantics are user-visible — a
   changed evaluator changes what published automations do) and to `flow-model.ts` (a new
   action type must be either implemented in the executor or rejected by validation).
5. Update the commit/version/date in this file.
6. Run `pnpm --dir workers test` — `conditions.test.ts` and `props-resolver.test.ts` are
   the characterization tests for the ported behaviour.
