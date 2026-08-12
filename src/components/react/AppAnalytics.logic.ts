import type { ChartKey, EngagementKey, SeriesKey } from './AppAnalytics.types';

/* ------------------------------------------------------------------ *
 * Chart math + config for the account-wide analytics screen.
 *
 * The screen reports delivery and engagement, each on its own chart and always
 * scoped to a single channel. They are never combined: SMS and voice cannot
 * report an open or a click at all, so any cross-channel engagement rate would
 * divide real receipts by a denominator that includes channels structurally
 * incapable of producing them.
 *
 * Engagement comes from provider receipts reconciled into Postgres — `opened`
 * is a message that reached `read`, `clicked` one with at least one click
 * event — attributed to the send day so both charts share an x-axis.
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

/**
 * One day of send activity, as returned by /v1/stats/activity. Engagement is
 * optional so cache entries written before it existed still parse; the charts
 * coerce a missing value to 0.
 */
export type ActivityPoint = {
  date: string;
  sent: number;
  delivered: number;
  /** Delivery failures. Surfaced as "Bounced" — the message never arrived. */
  failed: number;
  opened?: number;
  clicked?: number;
  /**
   * Spam complaints. Deliberately not part of `failed`: the message *was*
   * delivered and then reported, so adding the two would double-count a send
   * and overstate the failure rate.
   */
  complained?: number;
};

export type ChannelBreakdown = {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  /** Provider engagement receipts — optional so pre-upgrade cache entries parse. */
  opened?: number;
  clicked?: number;
};

/**
 * Series plotted on the delivery chart. The old single "Failed" line is split
 * into the two outcomes that actually matter to a sender: a bounce (never
 * arrived) and a complaint (arrived and was reported as spam). They are
 * different failure modes with different remedies, and only one of them is a
 * delivery failure at all.
 */
export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'sent', label: 'Sent', color: '#4f46e5' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'bounced', label: 'Bounced', color: '#ef4444' },
  { key: 'complained', label: 'Complained', color: '#1f1e1b' },
];

/** Series plotted on the engagement chart. */
export const ENGAGEMENT_SERIES: { key: EngagementKey; label: string; color: string }[] = [
  { key: 'opened', label: 'Opened', color: '#4f46e5' },
  { key: 'clicked', label: 'Clicked', color: '#f59e0b' },
];

/**
 * Read one series' value off a day. `bounced` is stored as `failed` (the
 * message status) but presented as a bounce, so the mapping lives here rather
 * than being duplicated at every read site.
 */
export function pointValue(p: ActivityPoint, key: ChartKey): number {
  switch (key) {
    case 'sent':
      return p.sent;
    case 'delivered':
      return p.delivered;
    case 'bounced':
      return p.failed;
    case 'complained':
      return p.complained ?? 0;
    case 'opened':
      return p.opened ?? 0;
    case 'clicked':
      return p.clicked ?? 0;
  }
}

/** Channels whose providers report opens and clicks at all. */
export const ENGAGEMENT_CHANNELS = ['email', 'whatsapp'] as const;

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
  const bounced = points.reduce((t, p) => t + p.failed, 0);
  const complained = points.reduce((t, p) => t + (p.complained ?? 0), 0);
  const opened = points.reduce((t, p) => t + (p.opened ?? 0), 0);
  const clicked = points.reduce((t, p) => t + (p.clicked ?? 0), 0);
  return { sent, delivered, bounced, complained, opened, clicked };
}

export type KpiTone = 'muted' | 'success' | 'danger';

export function buildKpis(points: ActivityPoint[]) {
  const { sent, delivered, bounced, complained, opened, clicked } = totalsOf(points);
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
      label: 'Bounced',
      value: fmtCompact(bounced),
      sub: pctOf(bounced, sent),
      tone: 'danger' as KpiTone,
      series: points.map((p) => ({ value: p.failed, label: fmtDate(p.date) })),
    },
    {
      label: 'Complained',
      value: fmtCompact(complained),
      // Against delivered, not sent: only a message that arrived can be reported.
      sub: pctOf(complained, delivered),
      tone: 'danger' as KpiTone,
      series: points.map((p) => ({ value: p.complained ?? 0, label: fmtDate(p.date) })),
    },
    {
      label: 'Opened',
      value: fmtCompact(opened),
      sub: pctOf(opened, delivered),
      tone: 'success' as KpiTone,
      series: points.map((p) => ({ value: p.opened ?? 0, label: fmtDate(p.date) })),
    },
    {
      label: 'Clicked',
      value: fmtCompact(clicked),
      sub: pctOf(clicked, delivered),
      tone: 'success' as KpiTone,
      series: points.map((p) => ({ value: p.clicked ?? 0, label: fmtDate(p.date) })),
    },
  ];
}

/** CSV of the visible series — the export button writes exactly what's shown. */
export function toCsv(points: ActivityPoint[]): string {
  const head = 'date,sent,delivered,bounced,complained,opened,clicked';
  const rows = points.map(
    (p) =>
      `${p.date},${p.sent},${p.delivered},${p.failed},${p.complained ?? 0},` +
      `${p.opened ?? 0},${p.clicked ?? 0}`,
  );
  return [head, ...rows].join('\n');
}

export function channelLabelOf(ch: string): string {
  return ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'voice' ? 'Voice' : 'Email';
}
