import { describe, expect, it, vi } from 'vitest';
import {
  BranchExecutionType,
  BranchOperator,
  FlowActionType,
  FlowRunStatus,
  FlowTriggerType,
  RouterExecutionType,
  StepOutputStatus,
  type ExecutionJournal,
  type FlowAction,
  type FlowVersionDefinition,
} from '@maildrill/activepieces-core';
import { MaildrillAutomationEngine } from './engine';
import type {
  AutomationExecutionContext,
  PieceRunner,
  PieceRunOutcome,
  RunJournalSink,
  StepRunRecord,
} from './ports';
import { AutomationStepError } from '../domain/retry';
import type { AutomationLimits } from '../domain/limits';

const LIMITS: AutomationLimits = {
  maxStepsPerRun: 20,
  maxLoopIterations: 5,
  runTimeoutMs: 60_000,
  maxPayloadBytes: 100_000,
  httpMaxResponseBytes: 1000,
  httpTimeoutMs: 1000,
  httpMaxRedirects: 1,
  httpAllowPrivate: false,
  maxConcurrentRunsPerTenant: 10,
};

const CONTEXT: AutomationExecutionContext = {
  tenantId: 't1',
  automationId: 'a1',
  automationVersionId: 'v1',
  runId: 'r1',
  source: 'event',
  limits: LIMITS,
  dryRun: false,
};

function piece(name: string, input: Record<string, unknown> = {}, next?: FlowAction): FlowAction {
  return {
    name,
    displayName: name,
    valid: true,
    type: FlowActionType.PIECE,
    settings: {
      pieceName: '@test/piece',
      pieceVersion: '1.0.0',
      actionName: name,
      input,
    },
    nextAction: next ?? null,
  };
}

function definition(first: FlowAction | null): FlowVersionDefinition {
  return {
    trigger: {
      name: 'trigger',
      displayName: 'Trigger',
      valid: true,
      type: FlowTriggerType.PIECE,
      settings: {
        pieceName: '@test/trigger',
        pieceVersion: '1.0.0',
        triggerName: 'thing_happened',
        input: {},
      },
      nextAction: first,
    },
  };
}

class RecordingSink implements RunJournalSink {
  readonly records: StepRunRecord[] = [];
  async recordStep(record: StepRunRecord): Promise<void> {
    this.records.push(record);
  }
}

/** A runner driven by a map of action name → behaviour. */
function runnerFrom(
  behaviours: Record<
    string,
    (props: Record<string, unknown>) => PieceRunOutcome | Promise<PieceRunOutcome>
  >,
  seen?: { calls: { name: string; props: Record<string, unknown> }[] },
): PieceRunner {
  return {
    async run({ actionName, propsValue }) {
      seen?.calls.push({ name: actionName, props: propsValue });
      const behaviour = behaviours[actionName];
      if (!behaviour) return { kind: 'output', output: null };
      return behaviour(propsValue);
    },
  };
}

/** Engine with instant backoff, so retry tests do not put seconds on the clock. */
class TestEngine extends MaildrillAutomationEngine {
  protected override sleep(): Promise<void> {
    return Promise.resolve();
  }
}

const run = (
  engine: MaildrillAutomationEngine,
  def: FlowVersionDefinition,
  over: Partial<Parameters<MaildrillAutomationEngine['execute']>[0]> = {},
) =>
  engine.execute({
    definition: def,
    journal: {},
    triggerPayload: { subscriber: { id: 's1', email: 'ada@example.com' } },
    resumeAfterStepName: null,
    stepsAlreadyExecuted: 0,
    context: CONTEXT,
    deadline: new Date(Date.now() + 60_000),
    ...over,
  });

describe('MaildrillAutomationEngine', () => {
  it('journals the trigger and walks the action chain in order', async () => {
    const sink = new RecordingSink();
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(
      runnerFrom({ first: () => ({ kind: 'output', output: { ok: 1 } }) }, seen),
      sink,
    );

    const result = await run(engine, definition(piece('first', {}, piece('second'))));

    expect(result.status).toBe(FlowRunStatus.SUCCEEDED);
    expect(seen.calls.map((c) => c.name)).toEqual(['first', 'second']);
    expect(sink.records.map((r) => r.stepName)).toEqual(['trigger', 'first', 'second']);
    expect(result.journal.trigger?.output).toEqual({
      subscriber: { id: 's1', email: 'ada@example.com' },
    });
    expect(result.stepsExecuted).toBe(2);
  });

  it('resolves expressions from the trigger and from earlier steps', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(
      runnerFrom({ lookup: () => ({ kind: 'output', output: { id: 'sub-9' } }) }, seen),
      new RecordingSink(),
    );

    await run(
      engine,
      definition(
        piece(
          'lookup',
          { email: '{{trigger.subscriber.email}}' },
          piece('send', {
            to: '{{steps.lookup.output.id}}',
            greeting: 'Hi {{trigger.subscriber.email}}',
          }),
        ),
      ),
    );

    expect(seen.calls[0]?.props).toEqual({ email: 'ada@example.com' });
    expect(seen.calls[1]?.props).toEqual({ to: 'sub-9', greeting: 'Hi ada@example.com' });
  });

  it('parks on a pause and reports where to resume', async () => {
    const resumeAt = new Date(Date.now() + 86_400_000);
    const engine = new TestEngine(
      runnerFrom({
        wait: () => ({ kind: 'pause', resumeAt }),
      }),
      new RecordingSink(),
    );

    const result = await run(
      engine,
      definition(piece('before', {}, piece('wait', {}, piece('after')))),
    );

    expect(result.status).toBe(FlowRunStatus.PAUSED);
    expect(result.pause?.pausedStepName).toBe('wait');
    expect(result.pause?.resumeDateTime).toBe(resumeAt.toISOString());
    // The step after the pause must NOT have run.
    expect(result.journal.after).toBeUndefined();
  });

  it('fast-forwards on resume without re-running completed steps', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(runnerFrom({}, seen), new RecordingSink());

    const journal: ExecutionJournal = {
      trigger: { type: 'PIECE', status: StepOutputStatus.SUCCEEDED, input: {}, output: { n: 1 } },
      before: {
        type: 'PIECE',
        status: StepOutputStatus.SUCCEEDED,
        input: {},
        output: { sent: true },
      },
      wait: { type: 'PIECE', status: StepOutputStatus.PAUSED, input: {}, output: {} },
    };

    const result = await run(
      engine,
      definition(piece('before', {}, piece('wait', {}, piece('after')))),
      {
        journal,
        resumeAfterStepName: 'wait',
        stepsAlreadyExecuted: 2,
      },
    );

    expect(result.status).toBe(FlowRunStatus.SUCCEEDED);
    // Only the step AFTER the pause executed — a re-run of `before` would send twice.
    expect(seen.calls.map((c) => c.name)).toEqual(['after']);
    expect(result.journal.wait?.status).toBe(StepOutputStatus.SUCCEEDED);
  });

  it('takes the matching router branch and skips the others', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(runnerFrom({}, seen), new RecordingSink());

    const router: FlowAction = {
      name: 'branch',
      displayName: 'Opened?',
      valid: true,
      type: FlowActionType.ROUTER,
      settings: {
        executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
        branches: [
          {
            branchName: 'Yes',
            branchType: BranchExecutionType.CONDITION,
            conditions: [
              [
                {
                  firstValue: '{{trigger.subscriber.email}}',
                  secondValue: 'ada@example.com',
                  operator: BranchOperator.TEXT_EXACTLY_MATCHES,
                },
              ],
            ],
          },
          { branchName: 'Otherwise', branchType: BranchExecutionType.FALLBACK, conditions: [] },
        ],
      },
      children: [piece('yes_path'), piece('no_path')],
      nextAction: piece('after_branch'),
    };

    const result = await run(engine, definition(router));

    expect(result.status).toBe(FlowRunStatus.SUCCEEDED);
    expect(seen.calls.map((c) => c.name)).toEqual(['yes_path', 'after_branch']);
    const output = result.journal.branch?.output as { branches: { evaluation: boolean }[] };
    expect(output.branches.map((b) => b.evaluation)).toEqual([true, false]);
  });

  it('falls through to the fallback branch when nothing matched', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(runnerFrom({}, seen), new RecordingSink());

    const router: FlowAction = {
      name: 'branch',
      displayName: 'Opened?',
      valid: true,
      type: FlowActionType.ROUTER,
      settings: {
        executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
        branches: [
          {
            branchName: 'Yes',
            branchType: BranchExecutionType.CONDITION,
            conditions: [
              [
                {
                  firstValue: '{{trigger.subscriber.email}}',
                  secondValue: 'someone-else@example.com',
                  operator: BranchOperator.TEXT_EXACTLY_MATCHES,
                },
              ],
            ],
          },
          { branchName: 'Otherwise', branchType: BranchExecutionType.FALLBACK, conditions: [] },
        ],
      },
      children: [piece('yes_path'), piece('no_path')],
      nextAction: null,
    };

    await run(engine, definition(router));
    expect(seen.calls.map((c) => c.name)).toEqual(['no_path']);
  });

  it('iterates a loop and stops at the iteration budget', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(
      runnerFrom(
        { source: () => ({ kind: 'output', output: { items: [1, 2, 3, 4, 5, 6, 7] } }) },
        seen,
      ),
      new RecordingSink(),
    );

    const loop: FlowAction = {
      name: 'each',
      displayName: 'For each',
      valid: true,
      type: FlowActionType.LOOP_ON_ITEMS,
      settings: { items: '{{steps.source.output.items}}' },
      firstLoopAction: piece('body', { value: '{{steps.each.output.item}}' }),
      nextAction: null,
    };

    const result = await run(engine, definition(piece('source', {}, loop)));

    // maxLoopIterations is 5 in these tests, so 7 items yield 5 iterations.
    const bodyCalls = seen.calls.filter((c) => c.name === 'body');
    expect(bodyCalls).toHaveLength(5);
    expect(bodyCalls.map((c) => c.props.value)).toEqual([1, 2, 3, 4, 5]);
    expect((result.journal.each?.output as { truncated: boolean }).truncated).toBe(true);
  });

  it('fails the run at the failing step and names it', async () => {
    const engine = new TestEngine(
      runnerFrom({
        boom: () => {
          throw new AutomationStepError('template "promo-august" not found', 'permanent');
        },
      }),
      new RecordingSink(),
    );

    const result = await run(engine, definition(piece('boom', {}, piece('never_runs'))));

    expect(result.status).toBe(FlowRunStatus.FAILED);
    expect(result.error).toEqual({
      stepName: 'boom',
      message: 'template "promo-august" not found',
      category: 'permanent',
    });
    expect(result.journal.never_runs).toBeUndefined();
  });

  it('retries a transient failure and gives up on a permanent one', async () => {
    const transient = vi
      .fn<() => PieceRunOutcome>()
      .mockImplementationOnce(() => {
        throw new AutomationStepError('provider timed out', 'temporary');
      })
      .mockImplementation(() => ({ kind: 'output', output: { ok: true } }));
    const permanent = vi.fn<() => PieceRunOutcome>().mockImplementation(() => {
      throw new AutomationStepError('bad credentials', 'authentication');
    });

    const engine = new TestEngine(
      runnerFrom({ flaky: transient, denied: permanent }),
      new RecordingSink(),
    );

    const ok = await run(engine, definition(piece('flaky')));
    expect(ok.status).toBe(FlowRunStatus.SUCCEEDED);
    expect(transient).toHaveBeenCalledTimes(2);

    const failed = await run(engine, definition(piece('denied')));
    expect(failed.status).toBe(FlowRunStatus.FAILED);
    // An authentication failure is the same next time; retrying it just burns a slot.
    expect(permanent).toHaveBeenCalledTimes(1);
  });

  it('continues past a failure when the step opts in', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(
      runnerFrom(
        {
          optional: () => {
            throw new AutomationStepError('nope', 'permanent');
          },
        },
        seen,
      ),
      new RecordingSink(),
    );

    const optional = piece('optional', {}, piece('after'));
    if (optional.type === FlowActionType.PIECE) {
      optional.settings.errorHandling = { continueOnFailure: true };
    }

    const result = await run(engine, definition(optional));
    expect(result.status).toBe(FlowRunStatus.SUCCEEDED);
    expect(seen.calls.map((c) => c.name)).toEqual(['optional', 'after']);
  });

  it('stops the run when a step asks to', async () => {
    const seen = { calls: [] as { name: string; props: Record<string, unknown> }[] };
    const engine = new TestEngine(
      runnerFrom({ gate: () => ({ kind: 'stop', output: { passed: false } }) }, seen),
      new RecordingSink(),
    );
    const result = await run(engine, definition(piece('gate', {}, piece('after'))));
    expect(result.status).toBe(FlowRunStatus.STOPPED);
    expect(seen.calls.map((c) => c.name)).toEqual(['gate']);
  });

  it('refuses to exceed the step budget', async () => {
    const engine = new TestEngine(runnerFrom({}), new RecordingSink());
    // Chain of 25 steps against a 20-step budget.
    let chain: FlowAction | null = null;
    for (let i = 25; i > 0; i -= 1) chain = piece(`step_${i}`, {}, chain ?? undefined);

    const result = await run(engine, definition(chain));
    expect(result.status).toBe(FlowRunStatus.FAILED);
    expect(result.error?.message).toContain('step budget');
    expect(result.stepsExecuted).toBe(LIMITS.maxStepsPerRun);
  });

  it('times out rather than running past its deadline', async () => {
    const engine = new TestEngine(runnerFrom({}), new RecordingSink());
    const result = await run(engine, definition(piece('anything')), {
      deadline: new Date(Date.now() - 1),
    });
    expect(result.status).toBe(FlowRunStatus.TIMEOUT);
  });

  it('censors secret-shaped inputs in the journal', async () => {
    const sink = new RecordingSink();
    const engine = new TestEngine(runnerFrom({}), sink);
    await run(
      engine,
      definition(piece('call', { headers: { Authorization: 'Bearer super-secret' } })),
    );
    const record = sink.records.find((r) => r.stepName === 'call');
    expect(JSON.stringify(record?.input)).not.toContain('super-secret');
  });
});
