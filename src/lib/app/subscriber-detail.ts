/**
 * Subscriber detail page — types + helpers that turn API payloads into the
 * shape the AppSubscriberDetail island renders.
 */
import type { RichSubscriber } from '@/lib/app/subscribers-data';

export type ActivityFilter = 'all' | 'open' | 'click' | 'send' | 'life';
export type DetailTab = 'activity' | 'campaigns' | 'links' | 'fields';

export type ApiSubscriberWeeklyPoint = {
  label: string;
  weekStart: string;
  opens: number;
  clicks: number;
};

export type ApiSubscriberActivity = {
  lastActiveAt?: string | null;
  channels?: Array<{
    channel: string;
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
  }>;
  recent?: Array<{
    id: string;
    channel: string;
    status: string;
    campaignName: string | null;
    at: string;
  }>;
  /** Trailing 12 ISO weeks of opens/clicks when provided by the activity API. */
  weekly?: ApiSubscriberWeeklyPoint[];
};

export type DetailEvent = {
  id: string;
  type: Exclude<ActivityFilter, 'all'>;
  title: string;
  meta: string;
  link?: string | null;
  when: string;
  stamp: string;
};

export type DetailCampaignRow = {
  id: string;
  name: string;
  channel: string;
  sentLabel: string;
  opens: number;
  clicks: number;
  result: string;
  resultColor: string;
};

export type DetailLinkRow = {
  id: string;
  label: string;
  href: string;
  campaign: string;
  clicks: number;
  lastClicked: string;
};

export type DetailField = { key: string; value: string };

export type WeeklyEngagement = { label: string; opens: number; clicks: number };

export type SubscriberDetailView = {
  subscriber: RichSubscriber;
  attributes: Record<string, unknown>;
  initials: string;
  subscribedLabel: string;
  score: number;
  scoreTier: string;
  openRate: number | null;
  clickRate: number | null;
  emailsSent: number;
  bounces: number;
  lastActiveLabel: string;
  events: DetailEvent[];
  campaigns: DetailCampaignRow[];
  links: DetailLinkRow[];
  fields: DetailField[];
  weeks: WeeklyEngagement[];
  /** "+6 vs. last month" from the weekly series; null when there is no activity. */
  scoreDeltaLabel: string | null;
  /** How recently they engaged, as a 0–100 meter width. */
  recencyPct: number;
  /** Sends per month over the subscription, e.g. "4.2 / mo". */
  frequencyLabel: string;
  frequencyPct: number;
  /** Messages sent in the trailing 30 days (from the recent feed). */
  sentLast30: number;
  deliveryRate: number | null;
  lastCampaignLabel: string;
};

function fmtAgo(iso?: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  if (min < 10080) return `${Math.round(min / 1440)}d ago`;
  return new Date(t).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtStamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function tenureLabel(createdAt?: string | null): string {
  if (!createdAt) return '—';
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return '—';
  const joined = new Date(start).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const months = Math.max(0, Math.round((Date.now() - start) / (30.44 * 86400000)));
  if (months < 1) return `Subscribed ${joined}`;
  if (months < 12) return `Subscribed ${joined} · ${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `Subscribed ${joined} · ${years} yr${rem ? ` ${rem} mo` : ''}`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function eventFromMessage(m: NonNullable<ApiSubscriberActivity['recent']>[number]): DetailEvent {
  const status = (m.status ?? '').toLowerCase();
  let type: DetailEvent['type'];
  let title: string;
  if (status === 'read') {
    type = 'open';
    title = `Opened ${m.campaignName ?? 'message'}`;
  } else if (status === 'failed' || status === 'rejected') {
    type = 'life';
    title = `Delivery issue on ${m.campaignName ?? 'message'}`;
  } else {
    type = 'send';
    title = `Received ${m.campaignName ?? 'message'}`;
  }
  const channel = m.channel ? m.channel[0]!.toUpperCase() + m.channel.slice(1) : 'Email';
  return {
    id: m.id,
    type,
    title,
    meta: `${channel} · ${status || 'sent'}`,
    when: fmtAgo(m.at),
    stamp: fmtStamp(m.at),
  };
}

function resultFor(status: string): { result: string; resultColor: string } {
  const s = status.toLowerCase();
  if (s === 'read') return { result: 'Opened', resultColor: '#16a34a' };
  if (s === 'delivered' || s === 'sent' || s === 'submitted')
    return { result: 'Delivered', resultColor: 'var(--text3)' };
  if (s === 'failed' || s === 'rejected') return { result: 'Failed', resultColor: '#dc2626' };
  return { result: s || '—', resultColor: 'var(--text3)' };
}

/** Build the detail view model from a rich subscriber + activity payload. */
export function buildSubscriberDetailView(
  subscriber: RichSubscriber,
  activity: ApiSubscriberActivity | null | undefined,
  attributes: Record<string, unknown> = {},
): SubscriberDetailView {
  const channels = activity?.channels ?? [];
  const emailCh = channels.find((c) => c.channel === 'email');
  const sent = channels.reduce((n, c) => n + (c.sent ?? 0), 0);
  const delivered = channels.reduce((n, c) => n + (c.delivered ?? 0), 0);
  const opened = channels.reduce((n, c) => n + (c.read ?? 0), 0);
  const clicked = channels.reduce((n, c) => n + (c.clicked ?? 0), 0);
  const denom = delivered > 0 ? delivered : sent;
  const openRate = denom > 0 ? Math.round((opened / denom) * 100) : null;
  const clickRate = denom > 0 ? Math.round((clicked / denom) * 100) : null;

  const scoreBase =
    openRate == null && clickRate == null
      ? 0
      : Math.min(100, Math.round((openRate ?? 0) * 0.7 + (clickRate ?? 0) * 1.2));
  const score = scoreBase;
  const scoreTier =
    score >= 75
      ? 'Highly engaged'
      : score >= 45
        ? 'Moderately engaged'
        : score > 0
          ? 'Low engagement'
          : 'No engagement yet';

  const recent = activity?.recent ?? [];
  const events = recent.map(eventFromMessage);

  const campaigns: DetailCampaignRow[] = recent.map((m) => {
    const { result, resultColor } = resultFor(m.status);
    return {
      id: m.id,
      name: m.campaignName ?? 'Untitled campaign',
      channel: m.channel || 'email',
      sentLabel: fmtStamp(m.at).split(',')[0] ?? fmtStamp(m.at),
      opens: m.status === 'read' ? 1 : 0,
      clicks: 0,
      result,
      resultColor,
    };
  });

  const fields: DetailField[] = Object.entries(attributes)
    .filter(([k]) => k !== 'tags' && k !== 'notes')
    .map(([key, value]) => ({
      key,
      value:
        value == null || value === ''
          ? '—'
          : Array.isArray(value)
            ? value.join(', ')
            : String(value),
    }));

  const weeks: WeeklyEngagement[] =
    activity?.weekly && activity.weekly.length > 0
      ? activity.weekly.map((w) => ({
          label: w.label,
          opens: w.opens ?? 0,
          clicks: w.clicks ?? 0,
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          label: `W${i + 1}`,
          opens: 0,
          clicks: 0,
        }));

  // Month-over-month movement from the weekly series: last 4 weeks vs the 4 before.
  const sumWindow = (from: number, to: number) =>
    weeks.slice(from, to).reduce((n, w) => n + w.opens + w.clicks, 0);
  const last4 = sumWindow(weeks.length - 4, weeks.length);
  const prev4 = sumWindow(weeks.length - 8, weeks.length - 4);
  const scoreDeltaLabel =
    last4 === 0 && prev4 === 0
      ? null
      : `${last4 - prev4 >= 0 ? '+' : '−'}${Math.abs(last4 - prev4)} vs. last month`;

  const lastActiveAt = activity?.lastActiveAt ?? subscriber.updatedAt;
  const ageDays = lastActiveAt
    ? Math.max(0, (Date.now() - new Date(lastActiveAt).getTime()) / 86400000)
    : Infinity;
  const recencyPct =
    ageDays <= 1 ? 94 : ageDays <= 7 ? 72 : ageDays <= 30 ? 45 : ageDays <= 90 ? 20 : 8;

  const emailsSent = emailCh?.sent ?? sent;
  const tenureMonths = subscriber.createdAt
    ? Math.max(1, (Date.now() - new Date(subscriber.createdAt).getTime()) / (30.44 * 86400000))
    : 1;
  const perMonth = emailsSent / tenureMonths;
  const frequencyLabel = `${perMonth >= 10 ? Math.round(perMonth) : perMonth.toFixed(1)} / mo`;
  const frequencyPct = Math.min(100, Math.round((perMonth / 8) * 100));

  const sentLast30 = recent.filter((m) => {
    const t = new Date(m.at).getTime();
    return !Number.isNaN(t) && Date.now() - t <= 30 * 86400000;
  }).length;

  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : null;

  return {
    subscriber,
    attributes,
    initials: initialsOf(subscriber.name || subscriber.email),
    subscribedLabel: tenureLabel(subscriber.createdAt),
    score,
    scoreTier,
    openRate,
    clickRate,
    emailsSent,
    bounces: subscriber.status === 'bounced' ? 1 : 0,
    lastActiveLabel: fmtAgo(lastActiveAt),
    events,
    campaigns,
    links: [],
    fields,
    weeks,
    scoreDeltaLabel,
    recencyPct:
      Number.isFinite(ageDays) && (last4 > 0 || prev4 > 0 || emailsSent > 0) ? recencyPct : 0,
    frequencyLabel,
    frequencyPct,
    sentLast30,
    deliveryRate,
    lastCampaignLabel: recent.length > 0 ? fmtStamp(recent[0]!.at) : '—',
  };
}

export function scoreArcLength(score: number, radius = 41): string {
  const c = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c;
  return `${filled.toFixed(1)} 999`;
}
