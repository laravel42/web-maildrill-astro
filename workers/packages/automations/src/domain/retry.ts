import {
  DomainError,
  classifyNetworkError,
  isRetryable,
  type ErrorCategory,
} from '@maildrill/domain';

/**
 * Which step failures are worth trying again.
 *
 * Reuses `@maildrill/domain`'s existing `ErrorCategory` rather than inventing a second
 * taxonomy — the dispatch worker already classifies provider failures this way, and a step
 * that sends a message fails for exactly the same reasons.
 *
 *   validation / authentication / permanent → the input or the credential is wrong. A
 *                                             retry produces the same failure and burns a
 *                                             worker slot, so the step fails immediately.
 *   rate_limit / temporary / unknown        → exponential backoff.
 */
export class AutomationStepError extends DomainError {
  constructor(
    message: string,
    category: ErrorCategory = 'unknown',
    readonly details?: Record<string, unknown>,
  ) {
    super(message, category);
  }
}

export interface StepFailure {
  message: string;
  category: ErrorCategory;
  retryable: boolean;
}

export function classifyStepError(err: unknown): StepFailure {
  if (err instanceof DomainError) {
    return { message: err.message, category: err.category, retryable: isRetryable(err.category) };
  }
  if (err instanceof Error) {
    // NotFoundError / ConflictError are plain Errors in this codebase and are permanent by
    // nature: the referenced template really is gone, the campaign really is already sent.
    if (err.name === 'NotFoundError' || err.name === 'ConflictError') {
      return { message: err.message, category: 'permanent', retryable: false };
    }
    const network = classifyNetworkError(err);
    if (network === 'temporary') {
      return { message: err.message, category: network, retryable: true };
    }
    return { message: err.message, category: 'unknown', retryable: true };
  }
  return { message: String(err), category: 'unknown', retryable: true };
}

const BASE_BACKOFF_MS = 2_000;
const MAX_ATTEMPTS = 3;

export function shouldRetryStep(failure: StepFailure, attempt: number): boolean {
  return failure.retryable && attempt < MAX_ATTEMPTS;
}

export function stepBackoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** (attempt - 1);
}

export const STEP_MAX_ATTEMPTS = MAX_ATTEMPTS;
