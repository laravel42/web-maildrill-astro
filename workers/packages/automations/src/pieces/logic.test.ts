import { describe, expect, it } from 'vitest';
import { ValidationError } from '@maildrill/domain';
import { delayUntil, parseConditionGroups } from './logic';

describe('delayUntil', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('converts each unit', () => {
    expect(delayUntil(now, 30, 'seconds').toISOString()).toBe('2026-01-01T00:00:30.000Z');
    expect(delayUntil(now, 90, 'minutes').toISOString()).toBe('2026-01-01T01:30:00.000Z');
    expect(delayUntil(now, 2, 'hours').toISOString()).toBe('2026-01-01T02:00:00.000Z');
    expect(delayUntil(now, 2, 'days').toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('caps at a year, so a typo cannot park a run until 2140', () => {
    const capped = delayUntil(now, 100_000, 'days');
    expect(capped.getTime() - now.getTime()).toBe(365 * 86_400_000);
  });

  it('refuses a non-positive or unknown duration', () => {
    expect(() => delayUntil(now, 0, 'days')).toThrow(ValidationError);
    expect(() => delayUntil(now, -1, 'days')).toThrow(ValidationError);
    expect(() => delayUntil(now, 1, 'fortnights')).toThrow(ValidationError);
  });
});

describe('parseConditionGroups', () => {
  it('accepts an array or its JSON form', () => {
    expect(parseConditionGroups([[{ firstValue: 'a', operator: 'EXISTS' }]])).toHaveLength(1);
    expect(parseConditionGroups('[[{"firstValue":"a","operator":"EXISTS"}]]')).toHaveLength(1);
  });

  it('is empty when unset, and throws on malformed JSON', () => {
    expect(parseConditionGroups(undefined)).toEqual([]);
    expect(parseConditionGroups('')).toEqual([]);
    expect(() => parseConditionGroups('{oops')).toThrow(ValidationError);
  });
});
