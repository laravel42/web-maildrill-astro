import { afterEach, describe, expect, it, vi } from 'vitest';
import { absUtc, agoNow } from '@/components/react/shared/time';

/**
 * The fixture clock (`NOW = 2026-07-17T18:00:00Z`) and the `ago()`/`recHrs()`
 * helpers measured against it are gone — see the header of `shared/time.ts`.
 * Nothing here may reintroduce a second reference instant.
 */
describe('agoNow (wall clock)', () => {
  afterEach(() => vi.useRealTimers());

  it('handles bad input', () => {
    expect(agoNow('not-a-date')).toBe('—');
  });

  it('walks just now → minutes → hours → days → weeks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
    expect(agoNow('2026-07-31T11:59:45Z')).toBe('just now');
    expect(agoNow('2026-07-31T11:30:00Z')).toBe('30m ago');
    expect(agoNow('2026-07-31T11:15:00Z')).toBe('45m ago');
    expect(agoNow('2026-07-31T07:00:00Z')).toBe('5h ago');
    expect(agoNow('2026-07-30T12:00:00Z')).toBe('1d ago');
    expect(agoNow('2026-07-28T12:00:00Z')).toBe('3d ago');
    expect(agoNow('2026-07-24T12:00:00Z')).toBe('1w ago');
    expect(agoNow('2026-07-10T12:00:00Z')).toBe('3w ago');
  });

  it('never floors a future instant into the past', () => {
    // The fixture clock's `Math.max(mins, 1)` turned every timestamp newer than
    // 2026-07-17 into "1m ago" — 1,006 of 1,006 lists, 1,000,229 of 1,000,229
    // subscribers. A clock-ahead row now reads "just now", not an invented age.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
    expect(agoNow('2026-07-31T12:00:30Z')).toBe('just now');
  });
});

describe('absUtc (hydration-safe absolute form)', () => {
  afterEach(() => vi.useRealTimers());

  it('renders the instant itself, in UTC', () => {
    expect(absUtc('2026-08-16T11:47:45.000Z')).toBe('16 Aug 2026, 11:47 UTC');
    expect(absUtc('2025-11-05T09:05:00.000Z')).toBe('5 Nov 2025, 09:05 UTC');
  });

  it('handles bad input', () => {
    expect(absUtc('not-a-date')).toBe('—');
  });

  it('does not depend on the clock — the SSR/hydration contract', () => {
    // TimeAgo puts this string in the server HTML and in the first client
    // render. If it moved with `Date.now()` the two would disagree and React
    // would repaint every row.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
    const early = absUtc('2026-08-16T11:47:45.000Z');
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
    expect(absUtc('2026-08-16T11:47:45.000Z')).toBe(early);
  });
});
