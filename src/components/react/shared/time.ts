/**
 * Deterministic relative-time helpers.
 *
 * `NOW` is a fixed reference instant that matches the MOCK-DATA window, so
 * server render and client hydration agree (no `Date.now()` nondeterminism and
 * no hydration mismatch). It is a fixture clock, not a wall clock.
 *
 * KNOWN DEFECT (audit #11): `ago()` is called on LIVE timestamps by AppLists
 * (card "Updated", table date column, drawer) and AppSubscribers (the
 * SUBSCRIBED and LAST ACTIVITY columns). Every one of those rows is newer than
 * this instant — 1,006 of 1,006 lists and 1,000,223 of 1,000,229 subscribers —
 * so the subtraction goes negative and `Math.max(mins, 1)` below floors it at
 * "1m ago". The live Lists board reads "Updated 1m ago" on every card,
 * including one genuinely updated 4 days 11 hours ago, and the Subscribers
 * roster reads "1m ago" in both date columns on every row.
 *
 * `agoNow()` below is the correct helper for live data and is already used by
 * Media and the Dashboard. The fix is a call-site change, not a change here:
 * this constant still has a legitimate job for the fixture screens.
 */
export const NOW = new Date('2026-07-17T18:00:00Z').getTime();

/**
 * Human "…ago" label: minutes → hours → days → weeks, measured against the
 * FIXTURE instant above. The `Math.max(mins, 1)` floor is what silently turns a
 * future timestamp into "1m ago" rather than a negative — see the defect note.
 */
export function ago(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return days === 1 ? '1d ago' : `${days}d ago`;
  const wks = Math.round(days / 7);
  return wks === 1 ? '1w ago' : `${wks}w ago`;
}

/** Hours elapsed since `iso` relative to `NOW` (used for activity bucketing). */
export function recHrs(iso: string): number {
  return (NOW - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Like `ago`, but against the real wall-clock — for live data with real
 * timestamps (the fixed `NOW` above only fits the mock-data window). Safe to
 * call only from client-rendered, post-mount code (never during SSR).
 */
export function agoNow(input: string | number | Date): string {
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return days === 1 ? '1d ago' : `${days}d ago`;
  const wks = Math.round(days / 7);
  return wks === 1 ? '1w ago' : `${wks}w ago`;
}
