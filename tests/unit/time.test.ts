import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOW, ago, agoNow, recHrs } from '@/components/react/shared/time';

const iso = (msBeforeNow: number) => new Date(NOW - msBeforeNow).toISOString();

describe('ago (fixed NOW reference)', () => {
  it('floors sub-minute to 1m', () => {
    expect(ago(iso(10_000))).toBe('1m ago');
  });

  it('walks minutes → hours → days → weeks', () => {
    expect(ago(iso(30 * 60_000))).toBe('30m ago');
    expect(ago(iso(5 * 3_600_000))).toBe('5h ago');
    expect(ago(iso(24 * 3_600_000))).toBe('1d ago');
    expect(ago(iso(3 * 86_400_000))).toBe('3d ago');
    expect(ago(iso(7 * 86_400_000))).toBe('1w ago');
    expect(ago(iso(21 * 86_400_000))).toBe('3w ago');
  });
});

describe('recHrs', () => {
  it('measures hours before the fixed reference', () => {
    expect(recHrs(iso(2 * 3_600_000))).toBeCloseTo(2);
  });
});

describe('agoNow (wall clock)', () => {
  afterEach(() => vi.useRealTimers());

  it('handles bad input', () => {
    expect(agoNow('not-a-date')).toBe('—');
  });

  it('reports just now and the same ladder as ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
    expect(agoNow('2026-07-31T11:59:45Z')).toBe('just now');
    expect(agoNow('2026-07-31T11:15:00Z')).toBe('45m ago');
    expect(agoNow('2026-07-30T12:00:00Z')).toBe('1d ago');
    expect(agoNow('2026-07-10T12:00:00Z')).toBe('3w ago');
  });
});
