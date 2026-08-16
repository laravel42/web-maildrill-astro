import type { Campaign } from '@/types/app';
import { fmtDate, type ChannelBreakdown } from './AppAnalytics.logic';
import type { FeedItem, GetStartedStep, Kpi } from './AppDashboard.types';
import type { IconName } from '@/lib/icons';
import type { SparkPoint } from './shared/Sparkline';

export const statusLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

/** Live workspace counters from /v1/stats/summary. */
export type Summary = {
  subscribers: { total: number; active: number };
  lists: number;
  campaigns: { total: number; sent: number };
  messages: {
    total: number;
    delivered: number;
    /** Deliveries on channels with engagement tracking (email, WhatsApp). */
    trackedDelivered?: number;
    failed: number;
    sentToday: number;
    /** Read receipts / click events, when the service provides them. */
    opened?: number;
    clicked?: number;
  };
  /** Weekly KPI series for the card sparklines (up to 52 weeks), oldest → newest. */
  trends?: {
    subscribers: number[];
    lists: number[];
    campaigns: number[];
    openRate: number[];
    clickRate: number[];
  };
};

/** One day of send activity from /v1/stats/activity. */
export type ActivityPoint = { date: string; sent: number; delivered: number; failed: number };

const n = (v: number) => v.toLocaleString('en-US');

type DeltaTone = Kpi['tone'];

export function rangeSubtitle(days: number): string {
  if (days <= 7) return "Here's what's happening with your workspace this week.";
  if (days <= 30) return "Here's what's happening with your workspace over the last 30 days.";
  if (days <= 90) return "Here's what's happening with your workspace over the last 90 days.";
  return "Here's what's happening with your workspace over the last 12 months.";
}

export function sentLabel(days: number): string {
  if (days <= 7) return 'Sent this week';
  if (days <= 30) return 'Sent (30 days)';
  if (days <= 90) return 'Sent (90 days)';
  return 'Sent (12 months)';
}

/**
 * Quick-action tiles: the workspace's most-used jumps. `?new` opens the create
 * flow on the target screen (wizard / editor modal); the rest are plain
 * navigation and say so in their labels.
 */
export const QUICK_ACTIONS: Array<{
  icon: IconName;
  label: string;
  desc: string;
  tint: string;
  color: string;
  href: string;
}> = [
  {
    icon: 'campaigns',
    label: 'New campaign',
    desc: 'Draft and send in any channel',
    tint: 'var(--accent-tint)',
    color: 'var(--accent-text)',
    href: '/dashboard/campaigns?new',
  },
  {
    icon: 'subscribers',
    label: 'Add subscriber',
    desc: 'Create a contact by hand',
    tint: 'var(--success-bg)',
    color: 'var(--success-text)',
    href: '/dashboard/subscribers?new',
  },
  {
    icon: 'templates',
    label: 'New email template',
    desc: 'Open the visual builder',
    tint: 'var(--ch-email-tint)',
    color: 'var(--ch-email)',
    href: '/dashboard/templates/email',
  },
  {
    icon: 'lists',
    label: 'New list',
    desc: 'Group your audience',
    tint: 'var(--ch-sms-tint)',
    color: 'var(--ch-sms)',
    href: '/dashboard/lists?new',
  },
  {
    icon: 'media',
    label: 'Media library',
    desc: 'Upload images and assets',
    tint: 'var(--ch-voice-tint)',
    color: 'var(--ch-voice)',
    href: '/dashboard/media',
  },
  {
    icon: 'analytics',
    label: 'View analytics',
    desc: 'Volume and engagement',
    tint: 'var(--brand-tint)',
    color: 'var(--brand)',
    href: '/dashboard/analytics',
  },
];

function relativeDelta(cur: number, prev: number): { text: string; tone: DeltaTone } {
  if (prev === 0) {
    if (cur === 0) return { text: 'No change', tone: 'flat' };
    return { text: `↑ ${n(cur)}`, tone: 'up' };
  }
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.05) return { text: 'No change', tone: 'flat' };
  const arrow = pct > 0 ? '↑' : '↓';
  return {
    text: `${arrow} ${Math.abs(pct).toFixed(1)}%`,
    tone: pct > 0 ? 'up' : 'down',
  };
}

function weeksFor(days: number): number {
  return Math.max(1, Math.round(days / 7));
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Net additions in the selected window vs the prior window, from a cumulative
 * weekly series (oldest → newest). Value is activity in-range, not all-time stock.
 */
function periodNetCompare(
  series: number[] | undefined,
  days: number,
): { value: number | null; delta: { text: string; tone: DeltaTone } } {
  if (!series || series.length < 2) {
    return { value: null, delta: { text: '—', tone: 'flat' } };
  }
  const weeks = weeksFor(days);
  const end = series.length - 1;
  const mid = Math.max(0, end - weeks);
  const start = Math.max(0, mid - weeks);
  const curNet = series[end]! - series[mid]!;
  if (mid === start) {
    return { value: curNet, delta: { text: '—', tone: 'flat' } };
  }
  const prevNet = series[mid]! - series[start]!;
  return { value: curNet, delta: relativeDelta(curNet, prevNet) };
}

/**
 * Average rate in the selected window vs the prior window (percentage points).
 */
function periodRateCompare(
  series: number[] | undefined,
  days: number,
): { value: number | null; delta: { text: string; tone: DeltaTone } } {
  if (!series || series.length === 0) {
    return { value: null, delta: { text: '—', tone: 'flat' } };
  }
  const weeks = weeksFor(days);
  const curSlice = series.slice(-Math.min(weeks, series.length));
  const cur = avg(curSlice);
  if (series.length < weeks + 1) {
    return { value: cur, delta: { text: '—', tone: 'flat' } };
  }
  const prevSlice =
    series.length >= weeks * 2
      ? series.slice(-weeks * 2, -weeks)
      : series.slice(0, Math.max(0, series.length - weeks));
  if (prevSlice.length === 0) {
    return { value: cur, delta: { text: '—', tone: 'flat' } };
  }
  const prev = avg(prevSlice);
  const d = cur - prev;
  if (Math.abs(d) < 0.05) {
    return { value: cur, delta: { text: 'No change', tone: 'flat' } };
  }
  const arrow = d > 0 ? '↑' : '↓';
  return {
    value: cur,
    delta: {
      text: `${arrow} ${Math.abs(d).toFixed(1)}%`,
      tone: d > 0 ? 'up' : 'down',
    },
  };
}

/**
 * Sum sent over the selected window vs the prior window of equal length.
 * Expects `daily` to cover roughly `2 * days` when a prior comparison is possible.
 */
function periodSent(
  daily: ActivityPoint[],
  days: number,
): { total: number; inRange: ActivityPoint[]; delta: { text: string; tone: DeltaTone } } {
  const inRange = daily.slice(-days);
  const total = inRange.reduce((t, d) => t + d.sent, 0);
  if (daily.length < days * 2) {
    return { total, inRange, delta: { text: '—', tone: 'flat' } };
  }
  const prevTotal = daily.slice(-days * 2, -days).reduce((t, d) => t + d.sent, 0);
  return { total, inRange, delta: relativeDelta(total, prevTotal) };
}

/** Daily send volume for the performance spark (empty when nothing to plot). */
export function sparkSeries(points: ActivityPoint[]): Array<{ value: number; label: string }> {
  if (points.length < 2) return [];
  const max = Math.max(...points.map((p) => p.sent));
  if (max === 0) return [];
  return points.map((p) => ({ value: p.sent, label: fmtDate(p.date) }));
}

/** Presentation for each KPI card: sparkline accent + destination. */
export const KPI_META: Record<Kpi['key'], { color: string; href: string }> = {
  subscribers: {
    color: 'var(--success-text)',
    href: '/dashboard/subscribers',
  },
  lists: {
    color: 'var(--ch-sms)',
    href: '/dashboard/lists',
  },
  campaigns: {
    color: 'var(--accent-text)',
    href: '/dashboard/campaigns',
  },
  sent: {
    color: 'var(--brand)',
    href: '/dashboard/analytics',
  },
  open: {
    color: 'var(--ch-voice)',
    href: '/dashboard/analytics',
  },
  click: {
    color: 'var(--accent-text)',
    href: '/dashboard/analytics',
  },
};

/**
 * Window slice of a weekly trend series as spark points (oldest → newest).
 * Floored at 5 points so short ranges still draw a real shape — the labels
 * name each week, so the extra history never masquerades as in-window data.
 */
function weeklySpark(series: number[] | undefined, days: number): SparkPoint[] {
  if (!series || series.length < 2) return [];
  const sliced = series.slice(-(Math.max(weeksFor(days), 4) + 1));
  if (sliced.length < 2 || !sliced.some((v) => v !== 0)) return [];
  const last = sliced.length - 1;
  return sliced.map((value, i) => ({
    value,
    label: i === last ? 'This week' : `${last - i}w ago`,
  }));
}

/**
 * KPI cards scoped to the selected timespan. Headline values and deltas both
 * move with the range — counts are in-range activity; rates are in-range averages.
 *
 * Open/click prefer the channel breakdown for the window (Σ opened / Σ
 * tracked deliveries) so quiet weeks don't drop out of an averaged weekly
 * series. Trends still drive the delta and sparkline.
 */
export function buildKpis(
  s: Summary | null,
  daily: ActivityPoint[] = [],
  days = 7,
  channels: ChannelBreakdown[] = [],
): Kpi[] {
  const sent = periodSent(daily, days);
  const sentSpark = sparkSeries(sent.inRange);
  const emptySent = sentLabel(days);
  const bare = { delta: '—', tone: 'flat' as const, context: null, spark: [] as SparkPoint[] };
  if (!s) {
    return [
      { key: 'subscribers', label: 'Subscribers', value: '—', sparkFormat: 'number', ...bare },
      { key: 'lists', label: 'Lists', value: '—', sparkFormat: 'number', ...bare },
      { key: 'campaigns', label: 'Campaigns', value: '—', sparkFormat: 'number', ...bare },
      {
        key: 'sent',
        label: emptySent,
        value: '—',
        sparkFormat: 'number',
        ...bare,
        spark: sentSpark,
      },
      { key: 'open', label: 'Open rate', value: '—', sparkFormat: 'percent', ...bare },
      { key: 'click', label: 'Click rate', value: '—', sparkFormat: 'percent', ...bare },
    ];
  }

  const subs = periodNetCompare(s.trends?.subscribers, days);
  const lists = periodNetCompare(s.trends?.lists, days);
  const camps = periodNetCompare(s.trends?.campaigns, days);
  const openTrend = periodRateCompare(s.trends?.openRate, days);
  const clickTrend = periodRateCompare(s.trends?.clickRate, days);
  const hasTracked = (s.messages.trackedDelivered ?? s.messages.delivered) > 0;
  const deliveredInRange = sent.inRange.reduce((t, d) => t + d.delivered, 0);
  const deliveryPct = sent.total > 0 ? (deliveredInRange / sent.total) * 100 : null;

  // Email + WhatsApp only — SMS/voice deliveries never produce an open/click.
  const tracked = channels.filter((c) => c.channel === 'email' || c.channel === 'whatsapp');
  const trackedDelivered = tracked.reduce((n, c) => n + c.delivered, 0);
  const trackedOpened = tracked.reduce((n, c) => n + (c.opened ?? 0), 0);
  const trackedClicked = tracked.reduce((n, c) => n + (c.clicked ?? 0), 0);
  const openValue =
    trackedDelivered > 0 ? (trackedOpened / trackedDelivered) * 100 : openTrend.value;
  const clickValue =
    trackedDelivered > 0 ? (trackedClicked / trackedDelivered) * 100 : clickTrend.value;

  return [
    {
      key: 'subscribers',
      label: 'Subscribers',
      value: subs.value != null ? n(subs.value) : n(s.subscribers.active),
      delta: subs.delta.text,
      tone: subs.delta.tone,
      context:
        subs.value != null
          ? `${n(s.subscribers.active)} active`
          : `${n(s.subscribers.total)} total`,
      spark: weeklySpark(s.trends?.subscribers, days),
      sparkFormat: 'number',
    },
    {
      key: 'lists',
      label: 'Lists',
      value: lists.value != null ? n(lists.value) : n(s.lists),
      delta: lists.delta.text,
      tone: lists.delta.tone,
      context: lists.value != null ? `${n(s.lists)} total` : null,
      spark: weeklySpark(s.trends?.lists, days),
      sparkFormat: 'number',
    },
    {
      key: 'campaigns',
      label: 'Campaigns',
      value: camps.value != null ? n(camps.value) : n(s.campaigns.total),
      delta: camps.delta.text,
      tone: camps.delta.tone,
      context:
        s.campaigns.total > 0 ? `${n(s.campaigns.sent)} of ${n(s.campaigns.total)} sent` : null,
      spark: weeklySpark(s.trends?.campaigns, days),
      sparkFormat: 'number',
    },
    {
      key: 'sent',
      label: sentLabel(days),
      value: n(sent.total),
      delta: sent.delta.text,
      tone: sent.delta.tone,
      context:
        deliveryPct != null
          ? `${deliveryPct.toFixed(1)}% delivered`
          : s.messages.sentToday > 0
            ? `${n(s.messages.sentToday)} today`
            : null,
      spark: sentSpark,
      sparkFormat: 'number',
    },
    {
      key: 'open',
      label: 'Open rate',
      value: openValue != null ? `${openValue.toFixed(1)}%` : '—',
      delta: openValue != null || hasTracked ? openTrend.delta.text : 'No deliveries yet',
      tone: openTrend.delta.tone,
      context:
        s.messages.opened != null && hasTracked ? `${n(s.messages.opened)} total opens` : null,
      spark: weeklySpark(s.trends?.openRate, days),
      sparkFormat: 'percent',
    },
    {
      key: 'click',
      label: 'Click rate',
      value: clickValue != null ? `${clickValue.toFixed(1)}%` : '—',
      delta: clickValue != null || hasTracked ? clickTrend.delta.text : 'No deliveries yet',
      tone: clickTrend.delta.tone,
      context:
        s.messages.clicked != null && hasTracked ? `${n(s.messages.clicked)} total clicks` : null,
      spark: weeklySpark(s.trends?.clickRate, days),
      sparkFormat: 'percent',
    },
  ];
}

/** Most recently sent campaigns for the dashboard strip (newest send first). */
export function buildRecent(campaigns: Campaign[]): Campaign[] {
  return campaigns
    .filter((c) => c.status === 'sent')
    .sort((a, b) => campaignSentAtMs(b) - campaignSentAtMs(a))
    .slice(0, 4);
}

/** Best-effort send timestamp for a finished campaign. */
export function campaignSentAt(c: Campaign): string {
  return c.completedAt ?? c.startedAt ?? c.scheduledAt ?? c.updatedAt;
}

function campaignSentAtMs(c: Campaign): number {
  return new Date(campaignSentAt(c)).getTime() || 0;
}

/** Presentation for each feed entry type: icon + tinted chip. */
export const FEED_META: Record<FeedItem['type'], { icon: IconName; bg: string; color: string }> = {
  campaign_sent: { icon: 'send', bg: 'var(--accent-tint)', color: 'var(--accent-text)' },
  subscriber_added: { icon: 'users', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  unsubscribed: { icon: 'x', bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
};

/** Where a feed entry leads: the campaign it announces, or the audience it changed. */
export function feedHref(item: FeedItem): string {
  if (item.type === 'campaign_sent') {
    return item.campaignId
      ? `/dashboard/campaigns?open=${encodeURIComponent(item.campaignId)}`
      : '/dashboard/campaigns';
  }
  return '/dashboard/subscribers';
}

/**
 * Onboarding checklist, completed from real workspace state rather than always
 * showing a green tick.
 */
export function buildGetStarted(s: Summary | null): GetStartedStep[] {
  const done = (v: boolean): Pick<GetStartedStep, 'bg' | 'ring' | 'fill' | 'text'> =>
    v
      ? { bg: 'var(--surface2)', ring: '#22c55e', fill: '#22c55e', text: 'var(--text3)' }
      : {
          bg: 'var(--accent-tint)',
          ring: 'var(--accent)',
          fill: 'transparent',
          text: 'var(--accent-text)',
        };
  return [
    { label: 'Import your contacts', ...done((s?.subscribers.total ?? 0) > 0) },
    { label: 'Create your first campaign', ...done((s?.campaigns.total ?? 0) > 0) },
    { label: 'Send your first email', ...done((s?.messages.total ?? 0) > 0) },
  ];
}

/** Steps render a check only once actually complete. */
export function isStepDone(step: GetStartedStep): boolean {
  return step.fill === '#22c55e';
}
