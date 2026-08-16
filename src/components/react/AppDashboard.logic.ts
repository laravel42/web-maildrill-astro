import type { Campaign } from '@/types/app';
import { fmtDate } from './AppAnalytics.logic';
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
    /**
     * Read receipts / clicked messages on the tracked channels only — the same
     * email + WhatsApp set as `trackedDelivered`, so these are the all-time
     * numerators over that all-time denominator.
     */
    opened?: number;
    clicked?: number;
  };
  /**
   * Daily KPI series, oldest → newest, one entry per day, zero-filled and
   * day-aligned across every series (entry `k` is the same date in all six).
   *
   * Counts, not cumulative stock and not precomputed rates. Every card on the
   * strip slices `-days` of these, which is what makes the range chip mean one
   * thing across the whole row: at weekly resolution the browser rounded a
   * range to whole weeks and "30 days" was really 28.
   */
  trends?: {
    /** Records created that day. */
    subscribers: number[];
    lists: number[];
    /** Campaigns that finished sending that day. */
    campaigns: number[];
    /** Engagement numerator + denominator, tracked channels only. */
    trackedDelivered: number[];
    opened: number[];
    clicked: number[];
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

/**
 * A window of a daily series and the window of equal length before it.
 *
 * Both are exact day counts — `days` entries, and the `days` entries that
 * precede them — because the series is daily and zero-filled. It used to be
 * weekly, and a day-range was rounded to the nearest whole number of weeks, so
 * the chip saying "30 days" bought a 28-day window on three of the six cards
 * while "Sent (30 days)" beside them sliced a true 30 days of the daily
 * activity series. Measured on the seeded tenant: 38,387 signups shown against
 * a true 41,129.
 *
 * `prev` is null when the series does not reach back far enough to hold a
 * second window — 12 months against 365 days of history, which is why that
 * chip's deltas read "—" rather than comparing against a shorter period.
 */
function windows(series: number[], days: number): { cur: number[]; prev: number[] | null } {
  const cur = series.slice(-days);
  const prev = series.length >= days * 2 ? series.slice(-days * 2, -days) : null;
  return { cur, prev };
}

const sum = (nums: number[]): number => nums.reduce((a, b) => a + b, 0);

/**
 * Net additions in the selected window vs the prior window of equal length.
 *
 * The series is per-day adds, so the window value is their sum — the same
 * quantity the card prints and the same quantity its sparkline plots. When the
 * series was cumulative this was a difference of two endpoints, and the spark
 * beside it drew the stock: a card reading "9,596" over a line climbing from
 * ~962,000 to 1,000,229, which says nothing about the number printed on it.
 *
 * The delta is a percentage change between two ADDITION counts, not between two
 * stock levels: it can fall while the record grows.
 */
function periodNetCompare(
  series: number[] | undefined,
  days: number,
): { value: number | null; delta: { text: string; tone: DeltaTone } } {
  if (!series || series.length === 0) {
    return { value: null, delta: { text: '—', tone: 'flat' } };
  }
  const { cur, prev } = windows(series, days);
  const value = sum(cur);
  if (!prev) return { value, delta: { text: '—', tone: 'flat' } };
  return { value, delta: relativeDelta(value, sum(prev)) };
}

/**
 * A rate over the selected window vs the prior window, in percentage POINTS.
 *
 * Σ numerator / Σ denominator across the window — not a mean of daily rates.
 * The two differ whenever volume is uneven (a mean lets a quiet day count as
 * much as a busy one), and only the summed form is the rate the card's
 * headline states, so this returns both the value and its delta and the card
 * has one number computed one way.
 *
 * Both sides come from the same channel set. That is the whole fix: the
 * numerator used to be reads on all four channels while the denominator was
 * deliveries on the two that can report one, which produced weekly "rates" up
 * to 112.47% on the sparkline and a delta of -55.5pp where the honest change
 * was -21.1pp.
 *
 * The delta carries "pp", not "%": it is a difference of two percentages, and
 * the count cards beside it show a relative percentage change. Printing both
 * as "%" made two different operations look like one.
 */
function periodRate(
  hits: number[] | undefined,
  base: number[] | undefined,
  days: number,
): { value: number | null; delta: { text: string; tone: DeltaTone } } {
  const none = { text: '—', tone: 'flat' as const };
  if (!hits || !base || base.length === 0) return { value: null, delta: none };
  const rate = (h: number[], b: number[]): number | null => {
    const denom = sum(b);
    return denom > 0 ? (sum(h) / denom) * 100 : null;
  };
  const h = windows(hits, days);
  const b = windows(base, days);
  const value = rate(h.cur, b.cur);
  if (value == null || !h.prev || !b.prev) return { value, delta: none };
  const before = rate(h.prev, b.prev);
  if (before == null) return { value, delta: none };
  const d = value - before;
  if (Math.abs(d) < 0.05) return { value, delta: { text: 'No change', tone: 'flat' } };
  return {
    value,
    delta: {
      text: `${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}pp`,
      tone: d > 0 ? 'up' : 'down',
    },
  };
}

/**
 * Sum sent over the selected window vs the prior window of equal length.
 * Expects `daily` to cover roughly `2 * days` when a prior comparison is possible.
 *
 * Source: the daily series from /v1/stats/activity, which is zero-filled in SQL
 * over the full set — so `slice(-days)` is exactly `days` calendar days, with
 * no missing-day drift. Every other card on the strip now slices its own daily
 * series the same way, over the same `days`; this one used to be the only one
 * whose window matched the chip above it.
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
 * The calendar date of entry `i` in a daily trend series, as `YYYY-MM-DD`.
 *
 * The series carries no dates — it is `length` consecutive days ending today —
 * so the label is reconstructed from the viewer's clock, walking back from
 * today by local days. Local, because the server anchored the window on local
 * midnight too, and because a date on a sparkline should be the reader's date.
 */
function trendDay(i: number, length: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (length - 1 - i));
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The selected window of a daily count series as spark points, oldest → newest.
 *
 * Plots the same quantity the headline prints — additions per day, which sum to
 * the card's value — and labels each point with its date, exactly like the
 * "Sent" card's spark beside it. It used to plot the CUMULATIVE stock under a
 * net-adds headline: a line that can only ever rise, climbing 962,000 ->
 * 1,000,229 beneath the number 9,596.
 */
function dailySpark(series: number[] | undefined, days: number): SparkPoint[] {
  if (!series || series.length < 2) return [];
  const sliced = series.slice(-days);
  if (sliced.length < 2 || !sliced.some((v) => v !== 0)) return [];
  return sliced.map((value, i) => ({
    value,
    label: fmtDate(trendDay(series.length - sliced.length + i, series.length)),
  }));
}

/**
 * The selected window as a spark of per-day RATES, oldest → newest.
 *
 * Each point is one day's hits over that same day's deliveries on the same two
 * tracked channels, so no point can exceed 100% — the series this replaced
 * divided all-channel reads by tracked deliveries and put a 112.5% point under
 * a card reading 28.9%.
 *
 * Days that delivered nothing trackable are DROPPED rather than plotted as 0%:
 * on those days the rate was not measured, and a zero would read as "nobody
 * opened". Dropping is safe here because the window is sliced first — the gap
 * cannot pull the spark back beyond the days the chip names — and every
 * surviving point carries its own date as its label.
 */
function rateSpark(
  hits: number[] | undefined,
  base: number[] | undefined,
  days: number,
): SparkPoint[] {
  if (!hits || !base || base.length < 2) return [];
  const offset = base.length - Math.min(days, base.length);
  const points: SparkPoint[] = [];
  for (let i = offset; i < base.length; i += 1) {
    const denom = base[i] ?? 0;
    if (denom <= 0) continue;
    points.push({
      value: ((hits[i] ?? 0) / denom) * 100,
      label: fmtDate(trendDay(i, base.length)),
    });
  }
  return points.length >= 2 ? points : [];
}

/**
 * KPI cards scoped to the selected timespan. Headline values and deltas both
 * move with the range — counts are in-range activity; rates are in-range averages.
 *
 * Value, delta and spark on a card are now three views of ONE quantity over
 * ONE window, which is the property this strip did not have:
 *
 *   value   — subscribers/lists/campaigns: Σ of `trends.*` over exactly `days`
 *             days. sent: Σ of the daily activity series over the same `days`.
 *             open/click: Σ hits / Σ tracked deliveries over that window, both
 *             sides restricted to email + whatsapp. Computed here, in the
 *             browser, from server-side aggregates; nothing is sampled.
 *   delta   — the same computation over the `days` immediately before, so it
 *             can never describe a different quantity than the value above it.
 *   spark   — the same window, one point per day (per-day adds for the counts,
 *             per-day rates for the rates).
 *   context — whole-workspace ALL-TIME counters from the same payload, and the
 *             only figure here that is not window-scoped. `opened` / `clicked`
 *             are tracked-channel counts, so the context line under a rate is
 *             the all-time version of that rate's own numerator (140,919, not
 *             the 300,332 all-channel reads it used to print).
 *
 * The open card previously disagreed with itself three ways: a channel-correct
 * value (28.9%), a delta and spark built from all-channel reads over tracked
 * deliveries (-55.5%, with a 112.5% point on the line), and a context line
 * 2.13x its own numerator.
 *
 * A window with no tracked delivery gets "—" and "No deliveries yet" rather
 * than a rate carried in from somewhere else; the previous fallback averaged 52
 * weeks of history under a card labelled with a much shorter range.
 */
export function buildKpis(s: Summary | null, daily: ActivityPoint[] = [], days = 7): Kpi[] {
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
  // Both rates divide the window's tracked hits by the window's tracked
  // deliveries — one series pair, one window, so the headline and its delta are
  // the same arithmetic over adjacent periods.
  const open = periodRate(s.trends?.opened, s.trends?.trackedDelivered, days);
  const click = periodRate(s.trends?.clicked, s.trends?.trackedDelivered, days);
  const deliveredInRange = sent.inRange.reduce((t, d) => t + d.delivered, 0);
  const deliveryPct = sent.total > 0 ? (deliveredInRange / sent.total) * 100 : null;

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
      spark: dailySpark(s.trends?.subscribers, days),
      sparkFormat: 'number',
    },
    {
      key: 'lists',
      label: 'Lists',
      value: lists.value != null ? n(lists.value) : n(s.lists),
      delta: lists.delta.text,
      tone: lists.delta.tone,
      context: lists.value != null ? `${n(s.lists)} total` : null,
      spark: dailySpark(s.trends?.lists, days),
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
      spark: dailySpark(s.trends?.campaigns, days),
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
      value: open.value != null ? `${open.value.toFixed(1)}%` : '—',
      delta: open.value != null ? open.delta.text : 'No deliveries yet',
      tone: open.delta.tone,
      context: s.messages.opened != null ? `${n(s.messages.opened)} total opens` : null,
      spark: rateSpark(s.trends?.opened, s.trends?.trackedDelivered, days),
      sparkFormat: 'percent',
    },
    {
      key: 'click',
      label: 'Click rate',
      value: click.value != null ? `${click.value.toFixed(1)}%` : '—',
      delta: click.value != null ? click.delta.text : 'No deliveries yet',
      tone: click.delta.tone,
      context: s.messages.clicked != null ? `${n(s.messages.clicked)} total clicks` : null,
      spark: rateSpark(s.trends?.clicked, s.trends?.trackedDelivered, days),
      sparkFormat: 'percent',
    },
  ];
}

/**
 * Most recently sent campaigns for the dashboard strip (newest send first).
 *
 * The page this trims is already ordered by `completedAt` in SQL (the caller
 * asks for `sort=completedAt`), so the local sort only re-states the server's
 * order and the top four really are the workspace's four newest sends.
 *
 * It used to ask a completedAt question through an updatedAt door: the server
 * had no `completedAt` sort, so the strip fetched 25 rows ordered by
 * `updated_at` and re-sorted those in the browser. A local sort cannot recover
 * a row that was never in the page — on the seeded tenant the two genuinely
 * newest sends rank 616th and 632nd by `updated_at`, because `completed_at`
 * runs ~20 minutes ahead of it, so the strip showed four campaigns with 0
 * recipients and "—" for every rate while the "Recent activity" feed 200px
 * away, ordered by `completed_at` in SQL, named the right two.
 */
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
