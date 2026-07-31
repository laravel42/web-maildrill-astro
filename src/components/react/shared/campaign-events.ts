import type { Campaign, ChannelType } from '@/types/app';
import type { ReportEventTab } from '@/lib/app/campaign-report';
import { ensureSpark, type SparkPoint } from './Sparkline';

/* Recipient-event + spark-series helpers shared by the campaigns board's
   detail drawer and the campaign report page. */

/** One row from GET /v1/campaigns/:id/messages — a recipient's message outcome. */
export type RecipientEvent = {
  id: string;
  recipientId: string | null;
  name: string | null;
  address: string;
  channel: ChannelType;
  status: string;
  clicked?: boolean;
  unsubscribed?: boolean;
  at: string | null;
};

export type EventKind = Exclude<ReportEventTab, 'all'>;

/** Collapse message status + engagement into glanceable report events.
 *  Furthest stage wins: unsubscribed > clicked > opened/seen > delivered.
 *  Labels adapt: WhatsApp uses Seen; SMS/voice use Failed instead of Bounced. */
export const eventKind = (
  e: Pick<RecipientEvent, 'status' | 'clicked' | 'unsubscribed'>,
  channel: ChannelType,
): EventKind => {
  if (e.unsubscribed) return 'unsubscribed';
  if (e.clicked) return 'clicked';
  if (e.status === 'read') return channel === 'whatsapp' ? 'seen' : 'opened';
  if (e.status === 'delivered') return 'delivered';
  if (e.status === 'failed' || e.status === 'expired') {
    return channel === 'email' ? 'bounced' : 'failed';
  }
  if (e.status === 'sent' || e.status === 'submitted') return 'sent';
  return 'queued';
};

export const EVENT_META: Record<EventKind, { label: string; cls: string }> = {
  delivered: { label: 'Delivered', cls: 'astatus--sent' },
  opened: { label: 'Opened', cls: 'astatus--active' },
  seen: { label: 'Seen', cls: 'astatus--active' },
  clicked: { label: 'Clicked', cls: 'astatus--scheduled' },
  unsubscribed: { label: 'Unsubscribed', cls: 'astatus--unsubscribed' },
  sent: { label: 'Sent', cls: 'astatus--scheduled' },
  bounced: { label: 'Bounced', cls: 'astatus--bounced' },
  failed: { label: 'Failed', cls: 'astatus--bounced' },
  queued: { label: 'Queued', cls: 'astatus--draft' },
};

export const EVENT_TAB_LABEL: Record<ReportEventTab, string> = {
  all: 'All',
  delivered: 'Delivered',
  opened: 'Opened',
  seen: 'Seen',
  clicked: 'Clicked',
  unsubscribed: 'Unsubscribed',
  sent: 'Sent',
  bounced: 'Bounced',
  failed: 'Failed',
  queued: 'Queued',
};

/** Cumulative engagement rates (% of recipients) as recipient events arrive. */
export function buildEventRateSeries(
  events: RecipientEvent[],
  recipients: number,
  channel: ChannelType,
): Record<'delivery' | 'open' | 'click' | 'unsub', SparkPoint[]> {
  const base = Math.max(recipients, 1);
  const timeline = [...events]
    .filter((e) => e.at != null)
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());

  const empty = {
    delivery: [] as SparkPoint[],
    open: [] as SparkPoint[],
    click: [] as SparkPoint[],
    unsub: [] as SparkPoint[],
  };
  if (timeline.length === 0) return empty;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  let delivered = 0;
  let opened = 0;
  let clicked = 0;
  let unsub = 0;
  const out = {
    delivery: [{ value: 0, label: fmt(timeline[0]!.at!) }] as SparkPoint[],
    open: [{ value: 0, label: fmt(timeline[0]!.at!) }] as SparkPoint[],
    click: [{ value: 0, label: fmt(timeline[0]!.at!) }] as SparkPoint[],
    unsub: [{ value: 0, label: fmt(timeline[0]!.at!) }] as SparkPoint[],
  };

  for (const e of timeline) {
    const k = eventKind(e, channel);
    if (k === 'delivered' || k === 'opened' || k === 'seen' || k === 'clicked') delivered += 1;
    if (k === 'opened' || k === 'seen' || k === 'clicked') opened += 1;
    if (k === 'clicked') clicked += 1;
    if (k === 'unsubscribed') unsub += 1;
    const label = fmt(e.at!);
    out.delivery.push({ value: (delivered / base) * 100, label });
    out.open.push({ value: (opened / base) * 100, label });
    out.click.push({ value: (clicked / base) * 100, label });
    out.unsub.push({ value: (unsub / base) * 100, label });
  }
  return out;
}

export function historySparkPoints(
  history: Campaign[],
  pick: (c: Campaign) => number | null,
): SparkPoint[] {
  return history
    .map((c) => {
      const value = pick(c);
      return value == null ? null : { value, label: c.name };
    })
    .filter((p): p is SparkPoint => p != null);
}

export function pickSpark(
  eventPts: SparkPoint[],
  histPts: SparkPoint[],
  current: number,
  currentLabel: string,
): SparkPoint[] {
  if (eventPts.length >= 2) return eventPts;
  if (histPts.length >= 2) return histPts;
  return ensureSpark(histPts.length ? histPts : eventPts, current, currentLabel);
}

/** Same-channel sent campaigns up to `anchor` (chronological), for spark history. */
export function sameChannelHistory(campaigns: Campaign[], anchor: Campaign): Campaign[] {
  const t = new Date(anchor.updatedAt).getTime();
  return campaigns
    .filter(
      (c) =>
        c.channel === anchor.channel &&
        (c.status === 'sent' || c.id === anchor.id) &&
        new Date(c.updatedAt).getTime() <= t,
    )
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}
