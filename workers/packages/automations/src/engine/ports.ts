import type {
  DelayPauseMetadata,
  ExecutionJournal,
  FlowRunStatus,
  FlowVersionDefinition,
  StepOutputStatus,
} from '@maildrill/activepieces-core';
import type { AutomationLimits } from '../domain/limits';

/**
 * Ports the engine executes against.
 *
 * `@maildrill/automations/engine` imports nothing from the product: it takes a flow, a
 * journal and these two interfaces. That is the compatibility boundary the architecture
 * note calls for — replacing the executor means reimplementing `AutomationEngine`, not
 * touching pieces, persistence, routes or UI.
 */

/** Identity of the run, handed to every piece. Carries no ambient authority. */
export interface AutomationExecutionContext {
  tenantId: string;
  automationId: string;
  automationVersionId: string;
  runId: string;
  /** `event` | `webhook` | `manual` | `test`. Pieces may refuse to send on `test`. */
  source: string;
  limits: AutomationLimits;
  /** Set on a test run: side-effecting pieces describe what they *would* do. */
  dryRun: boolean;
}

export type PieceRunOutcome =
  | { kind: 'output'; output: unknown }
  /** Park the run. The engine writes the pause verdict; nothing stays in memory. */
  | { kind: 'pause'; resumeAt: Date }
  /** End the run successfully at this step (the Stop action). */
  | { kind: 'stop'; output?: unknown };

export interface PieceRunner {
  run(params: {
    pieceName: string;
    pieceVersion: string;
    actionName: string;
    propsValue: Record<string, unknown>;
    step: { name: string; displayName: string };
    connectionId?: string | null;
    context: AutomationExecutionContext;
  }): Promise<PieceRunOutcome>;
}

/** One persisted line of the run inspector. */
export interface StepRunRecord {
  seq: number;
  stepName: string;
  displayName: string;
  stepType: string;
  pieceName: string | null;
  status: StepOutputStatus;
  /** Already censored by the resolver — secrets never reach the journal. */
  input: unknown;
  output: unknown;
  errorMessage?: string;
  errorCategory?: string;
  attempt: number;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

/** Live progress sink. Persisting per step is what makes test mode pollable. */
export interface RunJournalSink {
  recordStep(record: StepRunRecord): Promise<void>;
}

export interface EngineRunInput {
  definition: FlowVersionDefinition;
  /** Journal carried forward from previous segments of this run. */
  journal: ExecutionJournal;
  triggerPayload: unknown;
  /**
   * Step the run was parked on, or null for a first execution. Everything already marked
   * SUCCEEDED before it is fast-forwarded, not re-run.
   */
  resumeAfterStepName: string | null;
  stepsAlreadyExecuted: number;
  context: AutomationExecutionContext;
  /** Wall-clock ceiling for THIS segment; a delay resets it on the next segment. */
  deadline: Date;
}

export interface EngineRunError {
  stepName: string | null;
  message: string;
  category: string;
}

export interface EngineRunResult {
  status: FlowRunStatus;
  journal: ExecutionJournal;
  pause?: DelayPauseMetadata;
  error?: EngineRunError;
  /** Cumulative across segments, so the step budget spans a whole workflow. */
  stepsExecuted: number;
}

/**
 * The seam the architecture note names. Anything that can execute an Activepieces-shaped
 * flow against these ports is a drop-in replacement.
 */
export interface AutomationEngine {
  execute(input: EngineRunInput): Promise<EngineRunResult>;
}
