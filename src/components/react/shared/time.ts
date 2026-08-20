/**
 * Relative-time helpers, measured against the real clock.
 *
 * There used to be a second clock here: a frozen `NOW = 2026-07-17T18:00:00Z`
 * that matched a MOCK-DATA window, plus `ago()`/`recHrs()` measured against it.
 * The fixtures it was cut for are gone — `src/lib/app/mock-data.ts` exports
 * empty arrays, and every screen that imported it (Lists, Subscribers, the
 * campaigns board, the campaign report) renders live rows — so the only thing
 * the frozen instant still did was subtract a live timestamp from a date in the
 * past. Every row was newer than it, so `Math.max(mins, 1)` floored the
 * negative at "1m ago": 1,006 of 1,006 lists and 1,000,229 of 1,000,229
 * subscribers rendered "1m ago", including a list genuinely untouched for four
 * days. Deleted rather than fixed, so nothing can call the fixture clock again.
 *
 * `agoNow()` is the whole vocabulary now. Render it through
 * `shared/TimeAgo.tsx` from anything an Astro island server-renders — the
 * component explains why the raw helper must not be called during SSR.
 */

/**
 * Human "…ago" label against the real wall clock: minutes → hours → days →
 * weeks. Returns "—" for a missing or unparseable instant, and "just now"
 * under a minute (never a floored "1m ago", and never a negative for a
 * timestamp a few seconds in the future).
 *
 * Reads `Date.now()`, so it is only safe from client-rendered, post-mount code
 * — during SSR the clock is the host's, not the reader's.
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

/**
 * The instant itself, as "16 Aug 2026, 11:47 UTC".
 *
 * A pure function of its argument: UTC field accessors only, no `Date.now()`
 * and no host zone, so a server render and the first client render of the same
 * timestamp produce byte-identical text. That is what makes it usable as the
 * pre-hydration face of `TimeAgo` — see the component for the full argument —
 * and it doubles as the tooltip, where "1w ago" alone is not an answer.
 */
export function absUtc(input: string | number | Date): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())} UTC`;
}
