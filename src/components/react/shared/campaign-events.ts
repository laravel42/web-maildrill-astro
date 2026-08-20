import type { Campaign, ChannelType } from '@/types/app';
import type { ReportEventTab } from '@/lib/app/campaign-report';
import { ensureSpark, type SparkPoint } from './Sparkline';

/* Recipient-event + spark-series helpers shared by the campaigns board's
   detail drawer and the campaign report page. */

export type EventKind = Exclude<ReportEventTab, 'all'>;

/** One row from GET /v1/campaigns/:id/messages — a recipient's message outcome. */
export type RecipientEvent = {
  id: string;
  recipientId: string | null;
  name: string | null;
  address: string;
  channel: ChannelType;
  status: string;
  /**
   * Which tab this row belongs to. Decided in SQL (`eventKindExpr` in
   * @maildrill/product), not here, because the server also counts and filters
   * by it — a second definition in the browser is how the tab counts and the
   * rows under them come to disagree.
   */
  kind: EventKind;
  clicked?: boolean;
  unsubscribed?: boolean;
  at: string | null;
};

/** GET /v1/campaigns/:id/messages/counts — the whole campaign, never a page. */
export type CampaignEventSummary = {
  /** Messages in the campaign — the "All" tab. */
  total: number;
  /** Messages per tab; sums to `total`. */
  byKind: Partial<Record<EventKind, number>>;
  /** Cumulative counts, bucketed over the campaign's own timeline. */
  series: CampaignEventPoint[];
};

export type CampaignEventPoint = {
  at: string;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
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
  // Withdrawn before dispatch — not a delivery failure and not still waiting,
  // so it carries neither the bounce badge nor the queued one.
  cancelled: { label: 'Cancelled', cls: 'astatus--draft' },
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
  cancelled: 'Cancelled',
  queued: 'Queued',
};

/**
 * Cumulative rates as the campaign progressed.
 *
 * The counts arrive already aggregated over EVERY message — only the division
 * happens here. This used to fold the fetched rows in the browser, which was
 * survivable while the browser held (a capped sample of) the campaign and is
 * not survivable now that it holds ten rows: a spark drawn from one page would
 * have ended at 0.8% under a card reading 100%.
 *
 * Delivery and unsub are % of recipients; open/seen and click are % of
 * delivered so far — matching the rate cards they sit inside.
 */
export function eventRateSeries(
  points: CampaignEventPoint[],
  recipients: number,
): Record<'delivery' | 'open' | 'click' | 'unsub', SparkPoint[]> {
  const empty = {
    delivery: [] as SparkPoint[],
    open: [] as SparkPoint[],
    click: [] as SparkPoint[],
    unsub: [] as SparkPoint[],
  };
  if (points.length === 0) return empty;

  const recipientBase = Math.max(recipients, 1);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  // A zero point at the first bucket, so even a campaign that landed inside a
  // single bucket has the two points a spark needs to draw.
  const first = fmt(points[0]!.at);
  const out = {
    delivery: [{ value: 0, label: first }] as SparkPoint[],
    open: [{ value: 0, label: first }] as SparkPoint[],
    click: [{ value: 0, label: first }] as SparkPoint[],
    unsub: [{ value: 0, label: first }] as SparkPoint[],
  };
  for (const p of points) {
    const label = fmt(p.at);
    const deliveredBase = Math.max(p.delivered, 1);
    out.delivery.push({ value: (p.delivered / recipientBase) * 100, label });
    out.open.push({ value: (p.opened / deliveredBase) * 100, label });
    out.click.push({ value: (p.clicked / deliveredBase) * 100, label });
    out.unsub.push({ value: (p.unsubscribed / recipientBase) * 100, label });
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

/**
 * Which series a rate card's sparkline draws.
 *
 * Preference order is deliberate: this campaign's own progress if it has enough
 * points, else the same-channel campaigns that preceded it (a peer comparison),
 * else a two-point stub ending on the current value.
 *
 * KNOWN DEFECT (audit #15): the fallback is not labelled as one. A campaign with
 * no messages produces fewer than two event points and silently falls through to
 * `histPts` — OTHER campaigns' rates — under a card showing this campaign's own
 * number. 152 campaigns on the seeded tenant have zero messages, 50 of them with
 * `status = 'sent'`. The spark and the value above it then describe different
 * campaigns, with nothing on screen to distinguish the two cases.
 */
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

/**
 * Same-channel sent campaigns up to `anchor` (chronological), for spark history.
 *
 * A BOUNDED SAMPLE of a window the server chose: the page it filters was fetched
 * with `updatedBefore = anchor.updatedAt`, so this can only narrow what already
 * arrived. Ordered by `updatedAt` — the row's last write — which is a proxy for
 * "sent before this one", not the thing itself.
 *
 * KNOWN DEFECT (audit #7): that server-side bound loses microsecond precision
 * crossing JSON, so it excludes the anchor and its whole same-timestamp cohort
 * (952 of 1,029 campaigns carry sub-millisecond precision). The peers that
 * survive are therefore not the peers that preceded this campaign, and the
 * deltas computed from them belong to campaigns that appear nowhere on the
 * screen. See `updatedBefore` in campaign-crud.ts.
 */
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
