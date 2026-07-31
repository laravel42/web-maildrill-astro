import type { SeriesKey } from './AppAnalytics.types';

/* ------------------------------------------------------------------ *
 * Chart math + config for the account-wide analytics screen.
 *
 * The screen reports delivery, not engagement. Opens and clicks are absent
 * on purpose: nothing in the product records them yet (no tracking pixel, no
 * link rewriting, no normalized provider engagement events), so any number
 * here would be invented. Add them back when there is a source.
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** Range chips. `days` is sent to /v1/stats/activity, so these really refilter. */
export const RANGES: { key: string; label: string; days: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '12m', label: '12 months', days: 365 },
];

/** One day of send activity, as returned by /v1/stats/activity. */
export type ActivityPoint = { date: string; sent: number; delivered: number; failed: number };

export type ChannelBreakdown = {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  /** Provider engagement receipts — optional so pre-upgrade cache entries parse. */
  opened?: number;
  clicked?: number;
};

/** Series plotted on the hero chart — delivery outcomes only. */
export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'sent', label: 'Sent', color: '#4f46e5' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'failed', label: 'Failed', color: '#ef4444' },
];

const CHANNEL_COLOR: Record<string, string> = {
  email: '#4f46e5',
  sms: '#06b6d4',
  whatsapp: '#22c55e',
  voice: '#f59e0b',
};

export function channelColor(ch: string): string {
  return CHANNEL_COLOR[ch] ?? 'var(--accent)';
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

export function pctOf(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';
}

/** Headline totals over the visible window. */
export function totalsOf(points: ActivityPoint[]) {
  const sent = points.reduce((t, p) => t + p.sent, 0);
  const delivered = points.reduce((t, p) => t + p.delivered, 0);
  const failed = points.reduce((t, p) => t + p.failed, 0);
  return { sent, delivered, failed };
}

export type KpiTone = 'muted' | 'success' | 'danger';

export function buildKpis(points: ActivityPoint[]) {
  const { sent, delivered, failed } = totalsOf(points);
  return [
    {
      label: 'Messages sent',
      value: fmtCompact(sent),
      sub: 'in range',
      tone: 'muted' as KpiTone,
      series: points.map((p) => ({ value: p.sent, label: fmtDate(p.date) })),
    },
    {
      label: 'Delivered',
      value: fmtCompact(delivered),
      sub: pctOf(delivered, sent),
      tone: 'success' as KpiTone,
      series: points.map((p) => ({ value: p.delivered, label: fmtDate(p.date) })),
    },
    {
      label: 'Failed',
      value: fmtCompact(failed),
      sub: pctOf(failed, sent),
      tone: 'danger' as KpiTone,
      series: points.map((p) => ({ value: p.failed, label: fmtDate(p.date) })),
    },
  ];
}

/** CSV of the visible series — the export button writes exactly what's shown. */
export function toCsv(points: ActivityPoint[]): string {
  const head = 'date,sent,delivered,failed';
  const rows = points.map((p) => `${p.date},${p.sent},${p.delivered},${p.failed}`);
  return [head, ...rows].join('\n');
}

export function channelLabelOf(ch: string): string {
  return ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'voice' ? 'Voice' : 'Email';
}
