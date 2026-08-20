import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import {
  AutomationStepError,
  classifyStepError,
  shouldRetryStep,
  stepBackoffMs,
  STEP_MAX_ATTEMPTS,
} from './retry';

describe('classifyStepError', () => {
  it('treats provider rate limits and timeouts as worth retrying', () => {
    expect(classifyStepError(new AutomationStepError('429', 'rate_limit')).retryable).toBe(true);
    expect(classifyStepError(new AutomationStepError('504', 'temporary')).retryable).toBe(true);
  });

  it('does not retry the caller getting it wrong', () => {
    // Retrying these produces the identical failure and occupies a worker slot the rest
    // of the workspace is queued behind.
    expect(classifyStepError(new ValidationError('email is required')).retryable).toBe(false);
    expect(classifyStepError(new AutomationStepError('bad key', 'authentication')).retryable).toBe(
      false,
    );
    expect(classifyStepError(new AutomationStepError('gone', 'permanent')).retryable).toBe(false);
  });

  it('classifies the codebase’s plain-Error domain failures as permanent', () => {
    // NotFoundError/ConflictError do not extend DomainError here, so without this branch
    // a deleted template would be retried three times before failing.
    expect(classifyStepError(new NotFoundError('template not found')).category).toBe('permanent');
    expect(classifyStepError(new ConflictError('already sending')).category).toBe('permanent');
  });

  it('treats a socket error as transient', () => {
    const err = Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' });
    expect(classifyStepError(err)).toMatchObject({ category: 'temporary', retryable: true });
  });

  it('gives an unknown failure the benefit of the doubt, but not forever', () => {
    const failure = classifyStepError(new Error('???'));
    expect(failure.retryable).toBe(true);
    expect(shouldRetryStep(failure, STEP_MAX_ATTEMPTS)).toBe(false);
    expect(shouldRetryStep(failure, 1)).toBe(true);
  });

  it('backs off exponentially', () => {
    expect(stepBackoffMs(1)).toBe(2_000);
    expect(stepBackoffMs(2)).toBe(4_000);
  });
});
