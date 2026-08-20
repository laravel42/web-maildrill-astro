import type { Piece } from '@maildrill/activepieces-core';
import type { AutomationLimits } from '../domain/limits';

/**
 * What a Maildrill piece is handed at run time.
 *
 * Deliberately a *capability object*, not ambient access: a piece can act on the workspace
 * it was given and nothing else. `tenantId` comes from the run row, which the worker
 * re-reads from the database — never from the job payload alone.
 */
export interface MaildrillPieceContext {
  tenantId: string;
  automationId: string;
  automationVersionId: string;
  runId: string;
  /** Flow step this invocation belongs to. Part of every send's idempotency key. */
  stepName: string;
  /** `event` | `webhook` | `manual` | `test`. */
  source: string;
  /**
   * A test run. Side-effecting pieces must describe what they would do and return
   * `{ dryRun: true, … }` instead of sending — testing a workflow may not mail a customer.
   */
  dryRun: boolean;
  limits: AutomationLimits;
  /** Park the run until `resumeAt`; the runner converts this into a pause outcome. */
  pause(resumeAt: Date): void;
  /** End the run successfully at this step. */
  stop(output?: unknown): void;
  /** Decrypted secret for the connection this step references, or null when unset. */
  connection(): Promise<Record<string, unknown> | null>;
}

export type MaildrillPiece = Piece<MaildrillPieceContext>;
