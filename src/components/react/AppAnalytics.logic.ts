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
 *
 * Everything on this screen is a fold over the daily series from
 * /v1/stats/activity, which is aggregated in SQL over the FULL set of the
 * tenant's messages in the window and zero-filled day by day. Nothing here is a
 * page or a sample; the arithmetic in this file is only summation and division.
 *
 * `failed` in that series is `FAILED_DELIVERY_STATES` — `failed` + `expired`,
 * the one definition the whole product uses (message-status.ts in
 * @maildrill/product, and the matching `FAILED_STATUS_GROUPS` on the HogQL
 * side). An expired send is a terminal non-delivery: the provider accepted it
 * and then gave up. When this counted `status = 'failed'` alone every failure
 * rate on this screen was roughly halved — the Voice tab read "Failed 0.0% / 0"
 * over 1,176 expired calls, WhatsApp read 5.3% / 1,178 against a true 10.5% /
 * 2,354, and 12-month email read 6.2% / 14.7k against 11.73% / 27,684.
 *
 * `cancelled` is in neither line, deliberately: it is only reachable before
 * dispatch, so nothing was attempted. It stays inside `sent`.
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
  /** Delivery failures. Labelled per channel — a failed SMS is not a bounce. */
  failed: number;
  opened?: number;
  clicked?: number;
  /**
   * Spam complaints. Deliberately not part of `failed`: the message *was*
   * delivered and then reported, so adding the two would double-count a send
   * and overstate the failure rate. Email only.
   */
  complained?: number;
  unsubscribed?: number;
  /** Voice only: reconciled talk time in seconds. */
  voiceSeconds?: number;
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
    case 'unsubscribed':
      return p.unsubscribed ?? 0;
    case 'opened':
      return p.opened ?? 0;
    case 'clicked':
      return p.clicked ?? 0;
  }
}

/* ------------------------------------------------------------------ *
 * What each channel can actually report.
 *
 * The channels are not the same product with different transports — their
 * providers emit genuinely different events, and a screen that showed the
 * same six cards everywhere would be inventing four of them for voice. Read
 * off the live account: email produces the full set; WhatsApp has read
 * receipts and link clicks but no spam complaint; SMS has delivery and STOP
 * replies only; voice has delivery plus a call duration nothing else has.
 *
 * Terminology follows the channel too — a failed SMS is not a "bounce", and a
 * WhatsApp receipt is "Read", not "Opened".
 * ------------------------------------------------------------------ */

export type KpiSpec = {
  key: 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked' | 'complained' | 'unsubscribed';
  label: string;
  /** What the percentage is measured against. */
  of: 'sent' | 'delivered' | null;
  tone: KpiTone;
};

export type ChannelAnalytics = {
  /** Cards across the top, in order. */
  kpis: KpiSpec[];
  /** Series on the delivery chart. */
  delivery: { key: SeriesKey; label: string; color: string }[];
  /** Engagement chart, or null when the provider reports nothing to plot. */
  engagement: { title: string; series: { key: EngagementKey; label: string; color: string }[] } | null;
  /** Voice-only talk-time summary. */
  showTalkTime?: boolean;
};

const C = {
  sent: '#4f46e5',
  delivered: '#22c55e',
  failed: '#ef4444',
  complained: '#1f1e1b',
  unsubscribed: '#a5a39a',
  clicked: '#f59e0b',
};

export const CHANNEL_ANALYTICS: Record<string, ChannelAnalytics> = {
  email: {
    kpis: [
      { key: 'sent', label: 'Messages sent', of: null, tone: 'muted' },
      { key: 'delivered', label: 'Delivered', of: 'sent', tone: 'success' },
      { key: 'failed', label: 'Bounced', of: 'sent', tone: 'danger' },
      { key: 'opened', label: 'Opened', of: 'delivered', tone: 'success' },
      { key: 'clicked', label: 'Clicked', of: 'delivered', tone: 'success' },
      { key: 'complained', label: 'Complained', of: 'delivered', tone: 'danger' },
    ],
    delivery: [
      { key: 'sent', label: 'Sent', color: C.sent },
      { key: 'delivered', label: 'Delivered', color: C.delivered },
      { key: 'bounced', label: 'Bounced', color: C.failed },
      { key: 'complained', label: 'Complained', color: C.complained },
    ],
    engagement: {
      title: 'Engagement over time',
      series: [
        { key: 'opened', label: 'Opened', color: C.sent },
        { key: 'clicked', label: 'Clicked', color: C.clicked },
      ],
    },
  },

  whatsapp: {
    // Read receipts and link clicks, but no complaint signal exists.
    kpis: [
      { key: 'sent', label: 'Messages sent', of: null, tone: 'muted' },
      { key: 'delivered', label: 'Delivered', of: 'sent', tone: 'success' },
      { key: 'failed', label: 'Failed', of: 'sent', tone: 'danger' },
      { key: 'opened', label: 'Read', of: 'delivered', tone: 'success' },
      { key: 'clicked', label: 'Clicked', of: 'delivered', tone: 'success' },
      { key: 'unsubscribed', label: 'Unsubscribed', of: 'delivered', tone: 'muted' },
    ],
    delivery: [
      { key: 'sent', label: 'Sent', color: C.sent },
      { key: 'delivered', label: 'Delivered', color: C.delivered },
      { key: 'bounced', label: 'Failed', color: C.failed },
    ],
    engagement: {
      title: 'Read & clicks over time',
      series: [
        { key: 'opened', label: 'Read', color: C.sent },
        { key: 'clicked', label: 'Clicked', color: C.clicked },
      ],
    },
  },

  sms: {
    // Delivery and STOP replies. No opens, no clicks, no complaints.
    kpis: [
      { key: 'sent', label: 'Messages sent', of: null, tone: 'muted' },
      { key: 'delivered', label: 'Delivered', of: 'sent', tone: 'success' },
      { key: 'failed', label: 'Failed', of: 'sent', tone: 'danger' },
      { key: 'unsubscribed', label: 'Unsubscribed', of: 'delivered', tone: 'muted' },
    ],
    delivery: [
      { key: 'sent', label: 'Sent', color: C.sent },
      { key: 'delivered', label: 'Delivered', color: C.delivered },
      { key: 'bounced', label: 'Failed', color: C.failed },
      { key: 'unsubscribed', label: 'Unsubscribed', color: C.unsubscribed },
    ],
    // No open, click or complaint receipt exists to chart.
    engagement: null,
  },

  voice: {
    // A call is answered or not; talk time is the only depth available.
    kpis: [
      { key: 'sent', label: 'Calls placed', of: null, tone: 'muted' },
      { key: 'delivered', label: 'Answered', of: 'sent', tone: 'success' },
      { key: 'failed', label: 'Failed', of: 'sent', tone: 'danger' },
    ],
    delivery: [
      { key: 'sent', label: 'Placed', color: C.sent },
      { key: 'delivered', label: 'Answered', color: C.delivered },
      { key: 'bounced', label: 'Failed', color: C.failed },
    ],
    // A call reports an outcome and a duration; there is nothing to plot.
    engagement: null,
    showTalkTime: true,
  },
};

/**
 * Sparkline colour per KPI. Keyed rather than positional: the cards differ per
 * channel now, so index-matching them to the delivery series would have tinted
 * "Unsubscribed" with whatever happened to be third in the chart.
 */
export function kpiColor(key: KpiSpec['key']): string {
  switch (key) {
    case 'delivered':
      return C.delivered;
    case 'failed':
      return C.failed;
    case 'complained':
      return C.complained;
    case 'unsubscribed':
      return C.unsubscribed;
    case 'clicked':
      return C.clicked;
    default:
      return C.sent;
  }
}

/**
 * Total reconciled talk time in the window.
 *
 * Sums `voiceSeconds` (SQL `sum(messages.voice_seconds)` per day) and divides by
 * answered calls — `delivered`, since an unanswered call has no duration.
 *
 * KNOWN DEFECT (audit #20): `voice_seconds` is populated on 0 of the seeded
 * tenant's 294,204 voice messages, so this renders a confident "Talk time 0s ·
 * avg 0s" next to "Answered 24.1k". That is unmeasured being sold as
 * measured-zero; there is no branch here that can say "not recorded".
 */
export function talkTimeOf(points: ActivityPoint[]): { total: string; avg: string; calls: number } {
  const seconds = points.reduce((t, p) => t + (p.voiceSeconds ?? 0), 0);
  const answered = points.reduce((t, p) => t + p.delivered, 0);
  const fmt = (s: number) => {
    if (s < 60) return `${Math.round(s)}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };
  return {
    total: fmt(seconds),
    avg: answered > 0 ? fmt(seconds / answered) : '—',
    calls: answered,
  };
}

const CHANNEL_COLOR: Record<string, string> = {
  email: '#4f46e5',
  sms: '#06b6d4',
  whatsapp: '#22c55e',
  voice: '#f59e0b',
};

export function channelColor(ch: string): string {
  return CHANNEL_COLOR[ch] ?? 'var(--accent)';
}

/**
 * Round a series maximum up to a readable axis top.
 *
 * KNOWN DEFECT (audit #27): the caller floors the maximum at 1
 * (`Math.max(1, …)`), so an all-zero chart gets `niceMax(1) = 1`, gridlines at
 * 0/.25/.5/.75/1, and `fmtCompact`'s `Math.round` then labels them
 * "0","0","1","1","1" — five lines at five heights carrying three distinct
 * labels. Reproduced live in three clicks by toggling off every series on the
 * email tab.
 */
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

/**
 * Headline totals over the visible window — a plain sum of the daily series, so
 * they cover every message in the range, not a page of them.
 *
 * These are counts of MESSAGES, not events: the server counts distinct message
 * ids for click / complaint / unsubscribe, so a recipient who clicked four
 * links is one click here.
 */
export function totalsOf(points: ActivityPoint[]) {
  const sent = points.reduce((t, p) => t + p.sent, 0);
  const delivered = points.reduce((t, p) => t + p.delivered, 0);
  const bounced = points.reduce((t, p) => t + p.failed, 0);
  const complained = points.reduce((t, p) => t + (p.complained ?? 0), 0);
  const unsubscribed = points.reduce((t, p) => t + (p.unsubscribed ?? 0), 0);
  const opened = points.reduce((t, p) => t + (p.opened ?? 0), 0);
  const clicked = points.reduce((t, p) => t + (p.clicked ?? 0), 0);
  return { sent, delivered, bounced, complained, unsubscribed, opened, clicked };
}

export type KpiTone = 'muted' | 'success' | 'danger';

/**
 * KPI cards for one channel, driven by what that channel can report.
 *
 * Denominators come from each card's `of`: delivery and failure divide by
 * `sent` (everything addressed in the window, failures included), engagement
 * and complaints divide by `delivered`. Both wholes are the window's, so a card
 * and its sparkline describe the same range.
 *
 * The card set is per channel on purpose — `CHANNEL_ANALYTICS` above — so a
 * voice tab never renders an open rate that no provider could ever report. That
 * is the correct handling of "not measured": omit the card rather than print 0%.
 * `pctOf` returns "—" on a zero denominator for the same reason.
 */
export function buildKpis(points: ActivityPoint[], channel: string) {
  const t = totalsOf(points);
  const value: Record<KpiSpec['key'], number> = {
    sent: t.sent,
    delivered: t.delivered,
    failed: t.bounced,
    opened: t.opened,
    clicked: t.clicked,
    complained: t.complained,
    unsubscribed: t.unsubscribed,
  };
  const seriesFor: Record<KpiSpec['key'], (p: ActivityPoint) => number> = {
    sent: (p) => p.sent,
    delivered: (p) => p.delivered,
    failed: (p) => p.failed,
    opened: (p) => p.opened ?? 0,
    clicked: (p) => p.clicked ?? 0,
    complained: (p) => p.complained ?? 0,
    unsubscribed: (p) => p.unsubscribed ?? 0,
  };

  return (CHANNEL_ANALYTICS[channel] ?? CHANNEL_ANALYTICS.email).kpis.map((spec) => ({
    label: spec.label,
    color: kpiColor(spec.key),
    value: fmtCompact(value[spec.key]),
    sub: spec.of === null ? 'in range' : pctOf(value[spec.key], spec.of === 'sent' ? t.sent : t.delivered),
    tone: spec.tone,
    series: points.map((p) => ({ value: seriesFor[spec.key](p), label: fmtDate(p.date) })),
  }));
}

/**
 * CSV of the window's daily series.
 *
 * KNOWN DEFECT (audit #29): the header is fixed while the screen's series are
 * per channel, so the file is neither a superset nor a subset of what is on
 * screen. On SMS it exports an `opened` column (9,409 reads the UI deliberately
 * suppresses, because SMS reports no opens) and omits `unsubscribed`, which is
 * the series the SMS chart actually plots. The button is captioned "Download
 * exactly the series on screen".
 */
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
