/**
 * Run verdicts and pause metadata — adapted from Activepieces (MIT).
 *
 * Upstream: packages/core/execution/src/lib/flow-run/execution/flow-execution.ts
 *
 * `FlowRunStatus` is narrowed to states Maildrill can actually reach (no quota/memory/log
 * variants — those describe Activepieces Cloud's limits), and the pause metadata drops the
 * AP transport fields (`handlerId`, `requestIdToReply`, `streamStepProgress`).
 */
import { z } from 'zod';

export enum FlowRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
  STOPPED = 'STOPPED',
  CANCELED = 'CANCELED',
}

export enum PauseType {
  DELAY = 'DELAY',
}

export const delayPauseMetadataSchema = z.object({
  type: z.literal(PauseType.DELAY),
  /** ISO-8601 instant at which the run may continue. */
  resumeDateTime: z.string(),
  /** Step the executor must resume *after*. */
  pausedStepName: z.string(),
});
export type DelayPauseMetadata = z.infer<typeof delayPauseMetadataSchema>;

export type PauseMetadata = DelayPauseMetadata;

export const TERMINAL_STATUSES: readonly FlowRunStatus[] = [
  FlowRunStatus.SUCCEEDED,
  FlowRunStatus.FAILED,
  FlowRunStatus.INTERNAL_ERROR,
  FlowRunStatus.TIMEOUT,
  FlowRunStatus.STOPPED,
  FlowRunStatus.CANCELED,
];

export function isTerminalStatus(status: FlowRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const FAILED_STATUSES: readonly FlowRunStatus[] = [
  FlowRunStatus.FAILED,
  FlowRunStatus.INTERNAL_ERROR,
  FlowRunStatus.TIMEOUT,
];

export function isFailedStatus(status: FlowRunStatus): boolean {
  return FAILED_STATUSES.includes(status);
}

export interface FlowVerdict {
  status: FlowRunStatus;
  pause?: PauseMetadata;
  /** Populated on FAILED/INTERNAL_ERROR: the step that ended the run. */
  failedStepName?: string;
  errorMessage?: string;
}
