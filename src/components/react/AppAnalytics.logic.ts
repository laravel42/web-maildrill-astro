import type { AnalyticsPoint, ChannelType } from '@/types/app';
import type { SeriesKey } from './AppAnalytics.types';

/* ------------------------------------------------------------------ *
 * Chart math + config for the account-wide analytics screen. All rollup
 * numbers were removed — the screen shows an empty state until analytics
 * are wired to real send/engagement data. Only the pure helpers and the
 * chart/series/range config remain.
 * ------------------------------------------------------------------ */

/* Fixed reference window label — deterministic across SSR + hydration. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/* Range chips — visual toggle only. */
export const RANGES: { key: string; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

/* Panels below are data-driven and empty until wired. */
export const KPIS: { label: string; value: string; delta: string; line: string; spark: number[] }[] =
  [];
export const BY_CHANNEL: {
  ch: ChannelType;
  label: string;
  sent: string;
  pct: string;
  w: number;
  color: string;
}[] = [];
export const CHANNEL_PERF: {
  ch: ChannelType;
  sent: string;
  delivered: string;
  open: string;
  openW: number;
  click: string;
  clickW: number;
}[] = [];
export const FUNNEL: { stage: string; value: string; pct: string; w: number; color: string }[] = [];
export const DEVICES: { label: string; pct: string; w: number; color: string }[] = [];
export const TOP_CAMPAIGNS: { name: string; open: string; w: number }[] = [];
export const TOP_LINKS: { url: string; clicks: string }[] = [];

/* Hero trend chart series config. */
export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'sent', label: 'Sent', color: '#4f46e5' },
  { key: 'delivered', label: 'Delivered', color: '#6366f1' },
  { key: 'opened', label: 'Opened', color: '#8b5cf6' },
  { key: 'clicked', label: 'Clicked', color: '#a78bfa' },
];

/* Sparkline point generator: normalize per-series, map to w×h. */
export function sparkPoints(pts: number[], w: number, h: number): string {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const rng = max - min || 1;
  return pts
    .map(
      (p, i) =>
        `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((p - min) / rng) * h).toFixed(1)}`,
    )
    .join(' ');
}

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const f =
    n <= 1
      ? 1
      : n <= 1.5
        ? 1.5
        : n <= 2
          ? 2
          : n <= 3
            ? 3
            : n <= 4
              ? 4
              : n <= 5
                ? 5
                : n <= 6
                  ? 6
                  : n <= 8
                    ? 8
                    : 10;
  return f * pow;
}

export function fmtCompact(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return `${k % 1 === 0 ? k.toString() : k.toFixed(1)}k`;
  }
  return String(Math.round(v));
}

/* Hero trend series — empty until analytics are wired. */
export const HERO_SERIES: AnalyticsPoint[] = [];
export const TOTAL_SENDS = 0;
