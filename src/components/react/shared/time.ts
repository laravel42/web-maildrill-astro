/**
 * Deterministic relative-time helpers.
 *
 * `NOW` is a fixed reference instant that matches the mock-data window, so
 * server render and client hydration agree (no `Date.now()` nondeterminism and
 * no hydration mismatch).
 */
export const NOW = new Date('2026-07-17T18:00:00Z').getTime();

/** Human "…ago" label: minutes → hours → days → weeks. */
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
