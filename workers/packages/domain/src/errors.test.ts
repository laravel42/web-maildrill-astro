import { describe, expect, it } from 'vitest';
import { classifyHttpStatus, classifyNetworkError, isRetryable } from './errors';

describe('error classification', () => {
  it('classifies http statuses', () => {
    expect(classifyHttpStatus(429)).toBe('rate_limit');
    expect(classifyHttpStatus(401)).toBe('authentication');
    expect(classifyHttpStatus(403)).toBe('authentication');
    expect(classifyHttpStatus(422)).toBe('validation');
    expect(classifyHttpStatus(400)).toBe('validation');
    expect(classifyHttpStatus(503)).toBe('temporary');
    expect(classifyHttpStatus(500)).toBe('temporary');
    expect(classifyHttpStatus(402)).toBe('permanent');
  });

  it('marks retryable vs non-retryable categories', () => {
    expect(isRetryable('rate_limit')).toBe(true);
    expect(isRetryable('temporary')).toBe(true);
    expect(isRetryable('validation')).toBe(false);
    expect(isRetryable('authentication')).toBe(false);
    expect(isRetryable('permanent')).toBe(false);
  });

  it('classifies network errors by code', () => {
    expect(classifyNetworkError({ code: 'ETIMEDOUT' })).toBe('temporary');
    expect(classifyNetworkError({ code: 'ECONNRESET' })).toBe('temporary');
    expect(classifyNetworkError(new Error('boom'))).toBe('unknown');
  });
});
