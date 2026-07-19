import { analyticsSeries } from '@/lib/app/mock-data';
import type { AnalyticsPoint, ChannelType } from '@/types/app';
import type { SeriesKey } from './AppAnalytics.types';

/* ------------------------------------------------------------------ *
 * Pure data + math for the account-wide analytics screen.
 * Every chart is hand-built inline SVG / CSS — no chart library.
 * The hero trend chart is driven by the shared `analyticsSeries`
 * fixture; the remaining panels use the design's account rollup
 * numbers, defined below.
 * ------------------------------------------------------------------ */

/* Fixed reference window label — deterministic across SSR + hydration. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/* Range chips — visual toggle only (source data is static). */
export const RANGES: { key: string; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

/* ---- KPI trend strip (§1.2) ---- */
export const KPIS: { label: string; value: string; delta: string; line: string; spark: number[] }[] =
  [
    {
      label: 'Open rate',
      value: '43%',
      delta: '↑ 4%',
      line: '#4f46e5',
      spark: [32, 34, 33, 38, 36, 40, 39, 43],
    },
    {
      label: 'Click rate',
      value: '12%',
      delta: '↑ 2%',
      line: '#8b5cf6',
      spark: [8, 9, 8, 10, 9, 11, 10, 12],
    },
    {
      label: 'Delivered',
      value: '97.8%',
      delta: '↑ 0.3%',
      line: '#059669',
      spark: [96, 97, 96.5, 97.2, 97, 97.5, 97.6, 97.8],
    },
    {
      label: 'Unsub rate',
      value: '0.4%',
      delta: '↓ 0.1%',
      line: '#d97706',
      spark: [0.7, 0.6, 0.65, 0.55, 0.5, 0.48, 0.45, 0.4],
    },
  ];

/* ---- Per-channel comparison bars (§1.3b) ---- */
export const BY_CHANNEL: {
  ch: ChannelType;
  label: string;
  sent: string;
  pct: string;
  w: number;
  color: string;
}[] = [
  { ch: 'email', label: 'Email', sent: '11,240', pct: '90%', w: 90, color: '#4f46e5' },
  { ch: 'sms', label: 'SMS', sent: '980', pct: '8%', w: 8, color: '#8b5cf6' },
  { ch: 'whatsapp', label: 'WhatsApp', sent: '260', pct: '2%', w: 2, color: '#c4b5fd' },
  { ch: 'voice', label: 'Voice', sent: '95', pct: '0.7%', w: 0.7, color: '#d97706' },
];

/* ---- Channel performance table (§1.4) ---- */
export const CHANNEL_PERF: {
  ch: ChannelType;
  sent: string;
  delivered: string;
  open: string;
  openW: number;
  click: string;
  clickW: number;
}[] = [
  {
    ch: 'email',
    sent: '11,240',
    delivered: '98.6%',
    open: '43.2%',
    openW: 43,
    click: '12.1%',
    clickW: 12,
  },
  {
    ch: 'sms',
    sent: '980',
    delivered: '99.2%',
    open: '61.4%',
    openW: 61,
    click: '24.3%',
    clickW: 24,
  },
  {
    ch: 'whatsapp',
    sent: '260',
    delivered: '99.8%',
    open: '88.5%',
    openW: 88,
    click: '31.2%',
    clickW: 31,
  },
  { ch: 'voice', sent: '95', delivered: '96.4%', open: '71.0%', openW: 71, click: '—', clickW: 0 },
];

/* ---- Engagement funnel (§1.5a) ---- */
export const FUNNEL: { stage: string; value: string; pct: string; w: number; color: string }[] = [
  { stage: 'Sent', value: '12,480', pct: '100%', w: 100, color: '#4f46e5' },
  { stage: 'Delivered', value: '12,210', pct: '97.8%', w: 97.8, color: '#6366f1' },
  { stage: 'Opened', value: '5,240', pct: '42.9%', w: 42.9, color: '#8b5cf6' },
  { stage: 'Clicked', value: '1,490', pct: '12.2%', w: 12.2, color: '#a78bfa' },
];

/* ---- Top devices (§1.5b) ---- */
export const DEVICES: { label: string; pct: string; w: number; color: string }[] = [
  { label: 'Desktop', pct: '58%', w: 58, color: '#4f46e5' },
  { label: 'Mobile', pct: '36%', w: 36, color: '#8b5cf6' },
  { label: 'Tablet', pct: '6%', w: 6, color: '#c4b5fd' },
];

/* ---- Top campaigns (§1.6a) ---- */
export const TOP_CAMPAIGNS: { name: string; open: string; w: number }[] = [
  { name: 'Product Launch', open: '45%', w: 100 },
  { name: 'Welcome Series', open: '42%', w: 93 },
  { name: 'Spring Preview', open: '38%', w: 84 },
  { name: 'Holiday Deals', open: '31%', w: 69 },
];

/* ---- Top links clicked (§1.6b) ---- */
export const TOP_LINKS: { url: string; clicks: string }[] = [
  { url: 'maildrill.app/summer-sale', clicks: '842' },
  { url: 'maildrill.app/shop/new', clicks: '516' },
  { url: 'maildrill.app/blog/tips', clicks: '298' },
  { url: 'maildrill.app/pricing', clicks: '173' },
];

/* ---- Hero trend chart series (over analyticsSeries) ---- */
export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'sent', label: 'Sent', color: '#4f46e5' },
  { key: 'delivered', label: 'Delivered', color: '#6366f1' },
  { key: 'opened', label: 'Opened', color: '#8b5cf6' },
  { key: 'clicked', label: 'Clicked', color: '#a78bfa' },
];

/* Sparkline point generator (§1.2 `spk`): normalize per-series, map to w×h. */
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

/* Reconcile the hero trend with the funnel/channel rollup (§1.5a Sent = 12,480):
   scale the shared daily series so its total matches every other panel. */
const ROLLUP_SENDS = 12_480;
const RAW_TOTAL = analyticsSeries.reduce((s, p) => s + p.sent, 0);
const HERO_SCALE = ROLLUP_SENDS / RAW_TOTAL;
export const HERO_SERIES: AnalyticsPoint[] = analyticsSeries.map((p) => ({
  ...p,
  sent: Math.round(p.sent * HERO_SCALE),
  delivered: Math.round(p.delivered * HERO_SCALE),
  opened: Math.round(p.opened * HERO_SCALE),
  clicked: Math.round(p.clicked * HERO_SCALE),
}));
export const TOTAL_SENDS = HERO_SERIES.reduce((s, p) => s + p.sent, 0);
