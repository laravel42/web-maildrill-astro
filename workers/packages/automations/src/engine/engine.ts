import {
  BranchExecutionType,
  createPropsResolver,
  evaluateConditions,
  FlowActionType,
  FlowRunStatus,
  PauseType,
  StepOutputStatus,
  type DelayPauseMetadata,
  type ExecutionJournal,
  type FlowAction,
  type LoopOnItemsAction,
  type PieceAction,
  type RouterAction,
  type SerializedStepOutput,
} from '@maildrill/activepieces-core';
import { classifyStepError, shouldRetryStep, stepBackoffMs } from '../domain/retry';
import type {
  AutomationEngine,
  EngineRunError,
  EngineRunInput,
  EngineRunResult,
  PieceRunner,
  RunJournalSink,
  StepRunRecord,
} from './ports';

/**
 * The Maildrill flow executor.
 *
 * Semantics are Activepieces': a linear `nextAction` chain, routers that evaluate branch
 * condition groups and descend into the matching branch(es), loops that iterate an
 * expression, a per-step journal of censored input + output, and a verdict that propagates
 * out of nested structures. See docs/architecture/automations-activepieces.md §2 for why
 * the upstream engine is not imported directly.
 *
 * Three properties this file exists to guarantee:
 *
 *  1. **Nothing survives in memory.** Every step commits to the journal; a pause returns a
 *     verdict the caller persists. A worker can die between any two steps.
 *  2. **Resume never re-runs work.** On resume the executor fast-forwards: a step already
 *     SUCCEEDED in the journal is skipped, routers descend using their *recorded* branch
 *     evaluations rather than re-deciding, and normal execution resumes after the parked
 *     step.
 *  3. **A workflow cannot run away.** Step budget, loop budget and wall-clock are checked
 *     before every step, not after.
 */

interface ExecState {
  journal: ExecutionJournal;
  /** Name of the trigger step, so `{{trigger.…}}` never depends on journal key order. */
  triggerName: string;
  scope: Record<string, unknown>;
  stepsExecuted: number;
  seq: number;
  /**
   * `fastforward` replays a resumed run up to the parked step without executing anything;
   * it flips to `run` the moment that step is reached. Mutable and shared by every nested
   * call, because a pause can be parked inside a router branch.
   */
  mode: 'run' | 'fastforward';
  verdict: FlowRunStatus;
  pause?: DelayPauseMetadata;
  error?: EngineRunError;
}

const RESOLVER = createPropsResolver({
  // A connection reference resolves to a secret; the journal must show the reference.
  isSensitiveToken: (name) => name.startsWith('connections.'),
});

function journalEntry(
  type: string,
  status: StepOutputStatus,
  input: unknown,
  output: unknown,
  duration: number,
  errorMessage?: string,
): SerializedStepOutput {
  return { type, status, input, output, duration, errorMessage };
}

export class MaildrillAutomationEngine implements AutomationEngine {
  constructor(
    private readonly pieces: PieceRunner,
    private readonly sink: RunJournalSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: EngineRunInput): Promise<EngineRunResult> {
    const trigger = input.definition.trigger;
    const state: ExecState = {
      journal: { ...input.journal },
      triggerName: trigger.name,
      scope: {},
      stepsExecuted: input.stepsAlreadyExecuted,
      seq: Object.keys(input.journal).length,
      mode: input.resumeAfterStepName ? 'fastforward' : 'run',
      verdict: FlowRunStatus.RUNNING,
    };

    // The trigger's "output" is its payload. On a first run it is journaled so
    // `{{trigger.…}}` resolves; on a resume it is already there.
    if (!state.journal[trigger.name]) {
      state.journal[trigger.name] = journalEntry(
        trigger.type,
        StepOutputStatus.SUCCEEDED,
        {},
        input.triggerPayload,
        0,
      );
      await this.sink.recordStep({
        seq: state.seq++,
        stepName: trigger.name,
        displayName: trigger.displayName,
        stepType: `TRIGGER_${trigger.type}`,
        pieceName: 'pieceName' in trigger.settings ? String(trigger.settings.pieceName) : null,
        status: StepOutputStatus.SUCCEEDED,
        input: {},
        output: input.triggerPayload,
        attempt: 1,
        startedAt: this.now(),
        completedAt: this.now(),
        durationMs: 0,
      });
    }
    rebuildScope(state);

    await this.walk(trigger.nextAction ?? null, state, input);

    if (state.verdict === FlowRunStatus.RUNNING) state.verdict = FlowRunStatus.SUCCEEDED;

    return {
      status: state.verdict,
      journal: state.journal,
      pause: state.pause,
      error: state.error,
      stepsExecuted: state.stepsExecuted,
    };
  }

  /** Execute a `nextAction` chain until it ends or the verdict stops being RUNNING. */
  private async walk(
    first: FlowAction | null,
    state: ExecState,
    input: EngineRunInput,
  ): Promise<void> {
    let action: FlowAction | null | undefined = first;
    while (action && state.verdict === FlowRunStatus.RUNNING) {
      await this.step(action, state, input);
      action = action.nextAction ?? null;
    }
  }

  private async step(action: FlowAction, state: ExecState, input: EngineRunInput): Promise<void> {
    // Fast-forward: replay, don't re-run.
    if (state.mode === 'fastforward') {
      const recorded = state.journal[action.name];
      const isParkedStep = action.name === input.resumeAfterStepName;

      if (isParkedStep) {
        // The delay elapsed. Settle the parked step and start executing again.
        state.journal[action.name] = {
          ...(recorded ?? journalEntry(action.type, StepOutputStatus.SUCCEEDED, {}, undefined, 0)),
          status: StepOutputStatus.SUCCEEDED,
        };
        rebuildScope(state);
        state.mode = 'run';
        return;
      }
      if (recorded?.status === StepOutputStatus.SUCCEEDED) {
        if (action.type === FlowActionType.ROUTER) {
          // Descend using the branch evaluations this router already recorded — the data
          // it decided on is gone, and re-deciding could take a different branch.
          await this.replayRouter(action, recorded, state, input);
        }
        // A parked step can never be inside a loop (publish validation forbids it), so a
        // SUCCEEDED loop needs no replay.
        return;
      }
      // Not yet reached in the replay and not recorded: the flow changed under a running
      // version, which the immutable-version rule makes impossible. Execute it rather
      // than silently skipping work.
      state.mode = 'run';
    }

    if (action.skip) return;

    const guard = this.checkBudgets(state, input);
    if (guard) {
      state.verdict = guard.status;
      state.error = guard.error;
      return;
    }

    switch (action.type) {
      case FlowActionType.PIECE:
        await this.runPiece(action, state, input);
        return;
      case FlowActionType.ROUTER:
        await this.runRouter(action, state, input);
        return;
      case FlowActionType.LOOP_ON_ITEMS:
        await this.runLoop(action, state, input);
        return;
    }
  }

  private checkBudgets(
    state: ExecState,
    input: EngineRunInput,
  ): { status: FlowRunStatus; error: EngineRunError } | null {
    if (state.stepsExecuted >= input.context.limits.maxStepsPerRun) {
      return {
        status: FlowRunStatus.FAILED,
        error: {
          stepName: null,
          message: `automation exceeded its step budget (${input.context.limits.maxStepsPerRun} steps)`,
          category: 'permanent',
        },
      };
    }
    if (this.now().getTime() > input.deadline.getTime()) {
      return {
        status: FlowRunStatus.TIMEOUT,
        error: {
          stepName: null,
          message: 'automation exceeded its execution time budget',
          category: 'temporary',
        },
      };
    }
    return null;
  }

  private async runPiece(
    action: PieceAction,
    state: ExecState,
    input: EngineRunInput,
  ): Promise<void> {
    const startedAt = this.now();
    const started = performance.now();
    const { resolvedInput, censoredInput } = RESOLVER.resolve<Record<string, unknown>>({
      unresolvedInput: action.settings.input,
      scope: state.scope,
    });

    state.stepsExecuted += 1;

    /*
     * Step-level retry.
     *
     * Only transient categories are retried (`shouldRetryStep`): a wrong template id or a
     * rejected credential fails the same way every time, and retrying it just burns the
     * worker slot the rest of the workspace is waiting for. `retryOnFailure` on the step
     * can opt out entirely, matching upstream's error-handling option.
     */
    const retriesAllowed = action.settings.errorHandling?.retryOnFailure !== false;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        const outcome = await this.pieces.run({
          pieceName: action.settings.pieceName,
          pieceVersion: action.settings.pieceVersion,
          actionName: action.settings.actionName,
          propsValue: resolvedInput ?? {},
          step: { name: action.name, displayName: action.displayName },
          connectionId: action.settings.connectionId ?? null,
          context: input.context,
        });
        const durationMs = Math.round(performance.now() - started);

        if (outcome.kind === 'pause') {
          state.journal[action.name] = journalEntry(
            action.type,
            StepOutputStatus.PAUSED,
            censoredInput,
            { resumeAt: outcome.resumeAt.toISOString() },
            durationMs,
          );
          state.verdict = FlowRunStatus.PAUSED;
          state.pause = {
            type: PauseType.DELAY,
            resumeDateTime: outcome.resumeAt.toISOString(),
            pausedStepName: action.name,
          };
          await this.record(
            state,
            action,
            censoredInput,
            { resumeAt: outcome.resumeAt.toISOString() },
            StepOutputStatus.PAUSED,
            startedAt,
            durationMs,
            undefined,
            undefined,
            attempt,
          );
          return;
        }

        const output = outcome.kind === 'stop' ? (outcome.output ?? null) : outcome.output;
        state.journal[action.name] = journalEntry(
          action.type,
          StepOutputStatus.SUCCEEDED,
          censoredInput,
          output,
          durationMs,
        );
        rebuildScope(state);
        await this.record(
          state,
          action,
          censoredInput,
          output,
          StepOutputStatus.SUCCEEDED,
          startedAt,
          durationMs,
          undefined,
          undefined,
          attempt,
        );

        if (outcome.kind === 'stop') state.verdict = FlowRunStatus.STOPPED;
        return;
      } catch (err) {
        const failure = classifyStepError(err);
        if (retriesAllowed && shouldRetryStep(failure, attempt)) {
          await this.sleep(stepBackoffMs(attempt));
          continue;
        }
        const durationMs = Math.round(performance.now() - started);
        state.journal[action.name] = journalEntry(
          action.type,
          StepOutputStatus.FAILED,
          censoredInput,
          undefined,
          durationMs,
          failure.message,
        );
        await this.record(
          state,
          action,
          censoredInput,
          undefined,
          StepOutputStatus.FAILED,
          startedAt,
          durationMs,
          failure.message,
          failure.category,
          attempt,
        );

        // `continueOnFailure` keeps the chain going with a FAILED step recorded, matching
        // upstream's error-handling option.
        if (action.settings.errorHandling?.continueOnFailure) {
          rebuildScope(state);
          return;
        }
        state.verdict = FlowRunStatus.FAILED;
        state.error = {
          stepName: action.name,
          message: failure.message,
          category: failure.category,
        };
        return;
      }
    }
  }

  /** Overridable in tests so backoff does not put seconds on the clock. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runRouter(
    action: RouterAction,
    state: ExecState,
    input: EngineRunInput,
  ): Promise<void> {
    const startedAt = this.now();
    const started = performance.now();
    state.stepsExecuted += 1;

    const { resolvedInput, censoredInput } = RESOLVER.resolve<typeof action.settings>({
      unresolvedInput: action.settings,
      scope: state.scope,
    });
    const branches = resolvedInput?.branches ?? [];

    const rawEvaluations = branches.map((branch) =>
      branch.branchType === BranchExecutionType.FALLBACK
        ? true
        : evaluateConditions(branch.conditions),
    );
    // A fallback branch is taken only when no *condition* branch matched.
    const evaluations = branches.map((branch, index) =>
      branch.branchType === BranchExecutionType.CONDITION
        ? (rawEvaluations[index] ?? false)
        : rawEvaluations.every((value, i) => i === index || !value),
    );

    const output = {
      branches: branches.map((branch, index) => ({
        branchName: branch.branchName,
        branchIndex: index + 1,
        evaluation: evaluations[index] ?? false,
      })),
    };
    const durationMs = Math.round(performance.now() - started);
    state.journal[action.name] = journalEntry(
      action.type,
      StepOutputStatus.SUCCEEDED,
      censoredInput,
      output,
      durationMs,
    );
    rebuildScope(state);
    await this.record(
      state,
      action,
      censoredInput,
      output,
      StepOutputStatus.SUCCEEDED,
      startedAt,
      durationMs,
    );

    for (let i = 0; i < branches.length; i += 1) {
      if (!evaluations[i]) continue;
      await this.walk(action.children[i] ?? null, state, input);
      if (state.verdict !== FlowRunStatus.RUNNING) return;
      if (action.settings.executionType === 'EXECUTE_FIRST_MATCH') return;
    }
  }

  /** Descend a router's recorded branches during fast-forward, deciding nothing anew. */
  private async replayRouter(
    action: RouterAction,
    recorded: SerializedStepOutput,
    state: ExecState,
    input: EngineRunInput,
  ): Promise<void> {
    const output = recorded.output as { branches?: { evaluation?: boolean }[] } | undefined;
    const taken = output?.branches ?? [];
    for (let i = 0; i < action.children.length; i += 1) {
      if (!taken[i]?.evaluation) continue;
      await this.walk(action.children[i] ?? null, state, input);
      if (state.verdict !== FlowRunStatus.RUNNING) return;
      // Once fast-forward has flipped to `run`, the remaining branches of an ALL_MATCH
      // router are live work again and must be executed, so only FIRST_MATCH stops here.
      if (action.settings.executionType === 'EXECUTE_FIRST_MATCH') return;
    }
  }

  private async runLoop(
    action: LoopOnItemsAction,
    state: ExecState,
    input: EngineRunInput,
  ): Promise<void> {
    const startedAt = this.now();
    const started = performance.now();
    state.stepsExecuted += 1;

    const { resolvedInput, censoredInput } = RESOLVER.resolve<{ items: unknown }>({
      unresolvedInput: action.settings,
      scope: state.scope,
    });
    const raw = resolvedInput?.items;
    const items = Array.isArray(raw) ? raw : [];
    const limit = input.context.limits.maxLoopIterations;
    const bounded = items.slice(0, limit);

    const iterations: Record<string, SerializedStepOutput>[] = [];
    for (let index = 0; index < bounded.length; index += 1) {
      const guard = this.checkBudgets(state, input);
      if (guard) {
        state.verdict = guard.status;
        state.error = guard.error;
        break;
      }
      // The loop step's own output is what `{{loop.item}}` reads, so it is refreshed
      // before each iteration rather than only at the end.
      state.journal[action.name] = journalEntry(
        action.type,
        StepOutputStatus.SUCCEEDED,
        censoredInput,
        { item: bounded[index], index: index + 1, iterations },
        0,
      );
      rebuildScope(state);
      await this.walk(action.firstLoopAction ?? null, state, input);
      iterations.push({});
      if (state.verdict !== FlowRunStatus.RUNNING) break;
    }

    const durationMs = Math.round(performance.now() - started);
    const output = {
      item: bounded[bounded.length - 1],
      index: bounded.length,
      iterations,
      /** Surfaced so a truncated loop is visible in the inspector, not silent. */
      truncated: items.length > limit,
    };
    state.journal[action.name] = journalEntry(
      action.type,
      StepOutputStatus.SUCCEEDED,
      censoredInput,
      output,
      durationMs,
    );
    rebuildScope(state);
    await this.record(
      state,
      action,
      censoredInput,
      output,
      StepOutputStatus.SUCCEEDED,
      startedAt,
      durationMs,
    );
  }

  private async record(
    state: ExecState,
    action: FlowAction,
    input: unknown,
    output: unknown,
    status: StepOutputStatus,
    startedAt: Date,
    durationMs: number,
    errorMessage?: string,
    errorCategory?: string,
    attempt = 1,
  ): Promise<void> {
    const record: StepRunRecord = {
      seq: state.seq++,
      stepName: action.name,
      displayName: action.displayName,
      stepType: action.type,
      pieceName: action.type === FlowActionType.PIECE ? action.settings.pieceName : null,
      status,
      input,
      output,
      errorMessage,
      errorCategory,
      attempt,
      startedAt,
      completedAt: new Date(startedAt.getTime() + durationMs),
      durationMs,
    };
    await this.sink.recordStep(record);
  }
}

/**
 * Rebuild the resolver scope from the journal.
 *
 * Three shapes are exposed on purpose:
 *   `{{trigger.…}}`            — the trigger payload, whatever the trigger step is named
 *   `{{steps.<name>.output.…}}` — the documented Maildrill form
 *   `{{<name>.…}}`              — the Activepieces form, so an adapted upstream piece's
 *                                 stored expressions keep working
 */
function rebuildScope(state: ExecState): void {
  const steps: Record<string, unknown> = {};
  const flat: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(state.journal)) {
    steps[name] = { output: entry.output, status: entry.status };
    flat[name] = entry.output;
  }
  state.scope = {
    ...flat,
    steps,
    trigger: state.journal[state.triggerName]?.output,
  };
}
