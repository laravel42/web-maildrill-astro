import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  FlowRunStatus,
  type ExecutionJournal,
  type FlowVersionDefinition,
} from '@maildrill/activepieces-core';
import { config } from '@maildrill/config';
import {
  automationRuns,
  automations,
  automationStepRuns,
  automationVersions,
  db,
  type AutomationRunRow,
  type AutomationVersionRow,
} from '@maildrill/database';
import { automationRunJobId, JOB_NAMES, QUEUE_NAMES } from '@maildrill/domain';
import { createLogger, metrics } from '@maildrill/observability';
import { enqueue } from '@maildrill/queues';
import { automationLimits, payloadWithinLimit } from '../domain/limits';
import { MaildrillAutomationEngine } from '../engine/engine';
import type { AutomationExecutionContext, RunJournalSink, StepRunRecord } from '../engine/ports';
import { withAutomationOrigin } from '../events/origin';
import { MaildrillPieceRunner } from '../pieces/runner';
import { isUniqueViolation } from '@maildrill/services';
import { inFlightRunCount } from './repository';

const log = createLogger({ component: 'automation-runs' });

/**
 * Run lifecycle: create → queue → execute → (pause → resume)* → terminal.
 *
 * Nothing here holds state between segments. A run is a row; a worker claims it, executes
 * until the flow ends or parks, writes the outcome, and forgets it.
 */

/**
 * Delays shorter than this also get a BullMQ delayed job, so a two-minute wait resumes in
 * two minutes rather than on the next sweep. Longer waits rely on the sweeper alone: a
 * three-month delayed job in Redis is a liability (it is lost with the instance), and the
 * sweeper is the durable path either way. Both claim atomically, so the overlap is safe.
 */
const DELAYED_JOB_THRESHOLD_MS = 15 * 60_000;

export interface CreateRunInput {
  tenantId: string;
  automationId: string;
  automationVersionId: string;
  source: 'event' | 'webhook' | 'manual' | 'test';
  triggerPayload: Record<string, unknown>;
  /** Deterministic identity of the occurrence; omit for manual/test runs. */
  dedupeKey?: string | null;
}

export interface CreateRunResult {
  runId: string | null;
  /** True when `dedupeKey` collided — the occurrence already has a run. */
  duplicate: boolean;
  /** Set when the workspace is at its concurrency cap. */
  throttled?: boolean;
}

export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  const limits = automationLimits();

  if (!payloadWithinLimit(input.triggerPayload, limits)) {
    log.warn(
      { tenantId: input.tenantId, automationId: input.automationId },
      'automation trigger payload exceeds the size limit; run not created',
    );
    metrics.inc('automation_runs_rejected_total', { reason: 'payload_too_large' });
    return { runId: null, duplicate: false };
  }

  if (limits.maxConcurrentRunsPerTenant > 0) {
    const inFlight = await inFlightRunCount(input.tenantId);
    if (inFlight >= limits.maxConcurrentRunsPerTenant) {
      metrics.inc('automation_runs_rejected_total', { reason: 'tenant_concurrency' });
      log.warn(
        { tenantId: input.tenantId, inFlight },
        'automation run refused: workspace is at its concurrent-run cap',
      );
      return { runId: null, duplicate: false, throttled: true };
    }
  }

  let created: { id: string } | undefined;
  try {
    const rows = await db
      .insert(automationRuns)
      .values({
        tenantId: input.tenantId,
        automationId: input.automationId,
        automationVersionId: input.automationVersionId,
        status: 'queued',
        source: input.source,
        triggerPayload: input.triggerPayload,
        dedupeKey: input.dedupeKey ?? null,
        deadlineAt: new Date(Date.now() + limits.runTimeoutMs),
      })
      .returning({ id: automationRuns.id });
    created = rows[0];
  } catch (err) {
    // `automation_runs_dedupe_uq` is a PARTIAL unique index, which ON CONFLICT can only
    // infer if the predicate is repeated verbatim in the statement. Catching the violation
    // is both simpler and the pattern `submitMessage` already uses for the equivalent
    // partial index on messages.
    if (input.dedupeKey && isUniqueViolation(err)) {
      metrics.inc('automation_runs_deduplicated_total');
      return { runId: null, duplicate: true };
    }
    throw err;
  }
  if (!created) return { runId: null, duplicate: false };

  metrics.inc('automation_runs_total', { source: input.source });
  await enqueueRun(input.tenantId, created.id, 'start', 0, 0);
  return { runId: created.id, duplicate: false };
}

/**
 * Queue one wake-up for a run.
 *
 * `sequence`, when given, makes the BullMQ job id deterministic *per wake-up*: the run's
 * `stepsExecuted` strictly increases (a pause always costs at least one step), so two
 * different pauses in the same run get different ids while a duplicated enqueue of the
 * same pause collapses to one job. Keying it on the delay instead would silently swallow
 * the second of two identical waits, because BullMQ remembers completed ids for a day.
 *
 * Pass `null` from the recovery sweeps. There, a *new* attempt is exactly what is wanted,
 * and a remembered id would make the second recovery a no-op — leaving the run stuck. It
 * is safe because duplicate execution is prevented by the atomic claim in `claimRun`, not
 * by the queue.
 */
export async function enqueueRun(
  tenantId: string,
  runId: string,
  mode: 'start' | 'resume',
  delayMs: number,
  sequence: number | null,
): Promise<void> {
  await enqueue(
    QUEUE_NAMES.automationRun,
    mode === 'start' ? JOB_NAMES.executeAutomationRun : JOB_NAMES.resumeAutomationRun,
    { version: 1 as const, tenantId, runId, mode },
    {
      jobId: sequence === null ? undefined : automationRunJobId(runId, sequence),
      delay: delayMs > 0 ? delayMs : undefined,
      attempts: 1,
    },
  );
}

/** Persist each step as it finishes, so the run inspector is live rather than post-hoc. */
class DatabaseJournalSink implements RunJournalSink {
  constructor(
    private readonly runId: string,
    private readonly tenantId: string,
  ) {}

  async recordStep(record: StepRunRecord): Promise<void> {
    await db.insert(automationStepRuns).values({
      runId: this.runId,
      tenantId: this.tenantId,
      seq: record.seq,
      stepName: record.stepName,
      displayName: record.displayName,
      stepType: record.stepType,
      pieceName: record.pieceName,
      status: mapStepStatus(record.status),
      input: record.input ?? null,
      output: record.output ?? null,
      errorMessage: record.errorMessage ?? null,
      errorCategory: record.errorCategory ?? null,
      attempt: record.attempt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      durationMs: record.durationMs,
    });
    metrics.inc('automation_step_runs_total', { status: record.status });
    // Labelled by PIECE, not by step name: step names are user-authored and unbounded, so
    // labelling by them would grow the metric registry without limit.
    metrics.setGauge('automation_step_duration_ms', record.durationMs, {
      piece: record.pieceName ?? 'trigger',
    });
  }
}

function mapStepStatus(
  status: StepRunRecord['status'],
): 'running' | 'succeeded' | 'failed' | 'paused' | 'skipped' {
  switch (status) {
    case 'SUCCEEDED':
      return 'succeeded';
    case 'FAILED':
      return 'failed';
    case 'PAUSED':
      return 'paused';
    case 'STOPPED':
      return 'skipped';
    default:
      return 'running';
  }
}

/**
 * Atomically take ownership of a run.
 *
 * The status predicate is inside the UPDATE, so the resume sweeper and a delayed BullMQ
 * job racing on the same waiting run resolve to exactly one winner — the loser gets no row
 * and returns. This is the same claim-in-the-write pattern `claimForSending` uses for
 * campaigns, and for the same reason.
 */
async function claimRun(tenantId: string, runId: string): Promise<AutomationRunRow | null> {
  const now = new Date();
  const rows = await db
    .update(automationRuns)
    .set({ status: 'running', claimedAt: now, updatedAt: now })
    .where(
      and(
        eq(automationRuns.id, runId),
        eq(automationRuns.tenantId, tenantId),
        inArray(automationRuns.status, ['queued', 'waiting']),
        sql`(${automationRuns.status} = 'queued' or ${automationRuns.resumeAt} <= now())`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export interface ExecuteResult {
  status: AutomationRunRow['status'];
  /** Null when the run was already claimed, cancelled, or is not due yet. */
  runId: string | null;
}

/**
 * Execute one segment of a run.
 *
 * `tenantId` is taken from the claimed ROW, not from the job payload: the job says which
 * run, the database says whose it is. A forged or stale job therefore cannot make the
 * engine act on another workspace.
 */
export async function executeAutomationRun(
  tenantId: string,
  runId: string,
): Promise<ExecuteResult> {
  const run = await claimRun(tenantId, runId);
  if (!run) return { status: 'queued', runId: null };

  const [version] = await db
    .select()
    .from(automationVersions)
    .where(
      and(
        eq(automationVersions.id, run.automationVersionId),
        eq(automationVersions.tenantId, run.tenantId),
      ),
    )
    .limit(1);

  if (!version) {
    return finishRun(run, 'failed', {
      stepName: null,
      message: 'the automation version this run started under no longer exists',
      category: 'permanent',
    });
  }

  const limits = automationLimits();
  const context: AutomationExecutionContext = {
    tenantId: run.tenantId,
    automationId: run.automationId,
    automationVersionId: run.automationVersionId,
    runId: run.id,
    source: run.source,
    limits,
    dryRun: run.source === 'test',
  };

  const engine = new MaildrillAutomationEngine(
    new MaildrillPieceRunner(),
    new DatabaseJournalSink(run.id, run.tenantId),
  );

  const definition: FlowVersionDefinition = {
    trigger: version.trigger as unknown as FlowVersionDefinition['trigger'],
  };

  const startedAt = Date.now();
  let result;
  try {
    // Mark the async context so any domain event this run emits is attributable back to
    // it — the recursion guard reads this.
    result = await withAutomationOrigin({ automationId: run.automationId, runId: run.id }, () =>
      engine.execute({
        definition,
        journal: (run.executionState ?? {}) as ExecutionJournal,
        triggerPayload: run.triggerPayload,
        resumeAfterStepName: run.resumeStepName,
        stepsAlreadyExecuted: run.stepsExecuted,
        context,
        // Each segment gets a fresh wall-clock budget: a workflow that waits two days has
        // not been "executing" for two days.
        deadline: new Date(Date.now() + limits.runTimeoutMs),
      }),
    );
  } catch (err) {
    // An engine-level throw is infrastructure, not a step failure — the step handler
    // already caught everything a piece can raise.
    log.error(
      {
        runId: run.id,
        tenantId: run.tenantId,
        err: err instanceof Error ? err.message : String(err),
      },
      'automation engine threw',
    );
    return finishRun(run, 'failed', {
      stepName: null,
      message: err instanceof Error ? err.message : String(err),
      category: 'unknown',
    });
  }

  metrics.setGauge('automation_run_duration_ms', Date.now() - startedAt, {
    automation: run.automationId,
  });

  if (result.status === FlowRunStatus.PAUSED && result.pause) {
    const resumeAt = new Date(result.pause.resumeDateTime);
    await db
      .update(automationRuns)
      .set({
        status: 'waiting',
        executionState: result.journal as Record<string, unknown>,
        resumeStepName: result.pause.pausedStepName,
        resumeAt,
        stepsExecuted: result.stepsExecuted,
        claimedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(automationRuns.id, run.id));

    const delayMs = resumeAt.getTime() - Date.now();
    if (delayMs <= DELAYED_JOB_THRESHOLD_MS) {
      await enqueueRun(run.tenantId, run.id, 'resume', Math.max(delayMs, 0), result.stepsExecuted);
    }
    metrics.inc('automation_runs_paused_total');
    return { status: 'waiting', runId: run.id };
  }

  const terminal =
    result.status === FlowRunStatus.SUCCEEDED || result.status === FlowRunStatus.STOPPED
      ? ('succeeded' as const)
      : ('failed' as const);

  return finishRun(run, terminal, result.error ?? null, result.journal, result.stepsExecuted);
}

async function finishRun(
  run: AutomationRunRow,
  status: 'succeeded' | 'failed',
  error: { stepName: string | null; message: string; category: string } | null,
  journal?: ExecutionJournal,
  stepsExecuted?: number,
): Promise<ExecuteResult> {
  const now = new Date();
  await db
    .update(automationRuns)
    .set({
      status,
      error: error ?? null,
      executionState: (journal ?? run.executionState) as Record<string, unknown>,
      stepsExecuted: stepsExecuted ?? run.stepsExecuted,
      resumeAt: null,
      resumeStepName: null,
      claimedAt: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(automationRuns.id, run.id));

  metrics.inc(
    status === 'succeeded' ? 'automation_runs_succeeded_total' : 'automation_runs_failed_total',
  );
  log[status === 'succeeded' ? 'info' : 'warn'](
    {
      runId: run.id,
      tenantId: run.tenantId,
      automationId: run.automationId,
      automationVersionId: run.automationVersionId,
      status,
      stepId: error?.stepName ?? undefined,
      error: error?.message,
    },
    'automation run finished',
  );
  return { status, runId: run.id };
}

/** Start a test or manual run of a specific version, bypassing the trigger. */
export async function startManualRun(input: {
  tenantId: string;
  automationId: string;
  versionId: string;
  payload: Record<string, unknown>;
  test: boolean;
}): Promise<CreateRunResult> {
  const [automation] = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.id, input.automationId), eq(automations.tenantId, input.tenantId)))
    .limit(1);
  if (!automation) return { runId: null, duplicate: false };

  const [version] = await db
    .select({ id: automationVersions.id })
    .from(automationVersions)
    .where(
      and(
        eq(automationVersions.id, input.versionId),
        eq(automationVersions.tenantId, input.tenantId),
        eq(automationVersions.automationId, input.automationId),
      ),
    )
    .limit(1);
  if (!version) return { runId: null, duplicate: false };

  return createRun({
    tenantId: input.tenantId,
    automationId: input.automationId,
    automationVersionId: version.id,
    source: input.test ? 'test' : 'manual',
    triggerPayload: input.payload,
    dedupeKey: null,
  });
}
