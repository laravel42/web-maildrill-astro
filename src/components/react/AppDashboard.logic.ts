import type { Campaign } from '@/types/app';
import type { FeedItem, GetStartedStep, Kpi } from './AppDashboard.types';
import type { IconName } from '@/lib/icons';

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

/** Short prior-period label for the selected range length. */
export function priorPeriodLabel(days: number): string {
  if (days <= 7) return 'vs last week';
  if (days <= 30) return 'vs prior 30d';
  if (days <= 90) return 'vs prior 90d';
  return 'vs prior year';
}

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

export function sparkTitle(days: number): string {
  if (days <= 7) return 'Performance · last 7 days';
  if (days <= 30) return 'Performance · last 30 days';
  if (days <= 90) return 'Performance · last 90 days';
  return 'Performance · last 12 months';
}

function relativeDelta(
  cur: number,
  prev: number,
  prior: string,
): { text: string; tone: DeltaTone } {
  if (prev === 0) {
    if (cur === 0) return { text: `No change ${prior}`, tone: 'flat' };
    return { text: `↑ ${n(cur)} ${prior}`, tone: 'up' };
  }
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.05) return { text: `No change ${prior}`, tone: 'flat' };
  const arrow = pct > 0 ? '↑' : '↓';
  return {
    text: `${arrow} ${Math.abs(pct).toFixed(1)}% ${prior}`,
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
  const prior = priorPeriodLabel(days);
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
  return { value: curNet, delta: relativeDelta(curNet, prevNet, prior) };
}

/**
 * Average rate in the selected window vs the prior window (percentage points).
 */
function periodRateCompare(
  series: number[] | undefined,
  days: number,
): { value: number | null; delta: { text: string; tone: DeltaTone } } {
  const prior = priorPeriodLabel(days);
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
    return { value: cur, delta: { text: `No change ${prior}`, tone: 'flat' } };
  }
  const arrow = d > 0 ? '↑' : '↓';
  return {
    value: cur,
    delta: {
      text: `${arrow} ${Math.abs(d).toFixed(1)}pp ${prior}`,
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
  const prior = priorPeriodLabel(days);
  const inRange = daily.slice(-days);
  const total = inRange.reduce((t, d) => t + d.sent, 0);
  if (daily.length < days * 2) {
    return { total, inRange, delta: { text: '—', tone: 'flat' } };
  }
  const prevTotal = daily.slice(-days * 2, -days).reduce((t, d) => t + d.sent, 0);
  return { total, inRange, delta: relativeDelta(total, prevTotal, prior) };
}

/**
 * KPI cards scoped to the selected timespan. Headline values and deltas both
 * move with the range — counts are in-range activity; rates are in-range averages.
 */
export function buildKpis(s: Summary | null, daily: ActivityPoint[] = [], days = 7): Kpi[] {
  const sent = periodSent(daily, days);
  const emptySent = sentLabel(days);
  if (!s) {
    return [
      { label: 'Subscribers', value: '—', delta: '—', tone: 'flat' },
      { label: 'Lists', value: '—', delta: '—', tone: 'flat' },
      { label: 'Campaigns', value: '—', delta: '—', tone: 'flat' },
      { label: emptySent, value: '—', delta: '—', tone: 'flat' },
      { label: 'Open rate', value: '—', delta: '—', tone: 'flat' },
      { label: 'Click rate', value: '—', delta: '—', tone: 'flat' },
    ];
  }

  const subs = periodNetCompare(s.trends?.subscribers, days);
  const lists = periodNetCompare(s.trends?.lists, days);
  const camps = periodNetCompare(s.trends?.campaigns, days);
  const open = periodRateCompare(s.trends?.openRate, days);
  const click = periodRateCompare(s.trends?.clickRate, days);
  const hasTracked = (s.messages.trackedDelivered ?? s.messages.delivered) > 0;

  return [
    {
      label: 'Subscribers',
      value: subs.value != null ? n(subs.value) : n(s.subscribers.active),
      delta: subs.delta.text,
      tone: subs.delta.tone,
    },
    {
      label: 'Lists',
      value: lists.value != null ? n(lists.value) : n(s.lists),
      delta: lists.delta.text,
      tone: lists.delta.tone,
    },
    {
      label: 'Campaigns',
      value: camps.value != null ? n(camps.value) : n(s.campaigns.total),
      delta: camps.delta.text,
      tone: camps.delta.tone,
    },
    {
      label: sentLabel(days),
      value: n(sent.total),
      delta: sent.delta.text,
      tone: sent.delta.tone,
    },
    {
      label: 'Open rate',
      value: open.value != null ? `${open.value.toFixed(1)}%` : '—',
      delta: open.value != null || hasTracked ? open.delta.text : 'No deliveries yet',
      tone: open.delta.tone,
    },
    {
      label: 'Click rate',
      value: click.value != null ? `${click.value.toFixed(1)}%` : '—',
      delta: click.value != null || hasTracked ? click.delta.text : 'No deliveries yet',
      tone: click.delta.tone,
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

/**
 * Sparkline path over daily sends. Returns empty strings when there is nothing
 * to plot so the caller can show an empty state instead of a flat line that
 * reads as "zero activity measured".
 */
export function buildSpark(points: ActivityPoint[]): { line: string; area: string; max: number } {
  if (points.length < 2) return { line: '', area: '', max: 0 };
  const max = Math.max(...points.map((p) => p.sent));
  if (max === 0) return { line: '', area: '', max: 0 };
  const W = 100;
  const H = 32;
  const step = W / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - (p.sent / max) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return {
    line: coords.join(' '),
    area: `0,${H} ${coords.join(' ')} ${W},${H}`,
    max,
  };
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
