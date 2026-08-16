/**
 * List detail page — types + helpers that turn API payloads into the shape the
 * AppListDetail island renders. Mirrors subscriber-detail.ts: everything the
 * backend records is bound; everything it doesn't renders "—" in the island.
 */
import type { ApiList } from '@/lib/app/list-map';
import type { ApiCampaign } from '@/lib/app/campaign-map';
import { EMPTY_TOTALS, type ChannelTotals } from '@/lib/app/channel-kpis';
import type { ChannelType } from '@/types/app';

/** Send outcomes for this list on one channel, across ALL of its campaigns. */
export type ApiListChannelTotals = {
  channel: string;
  attempted: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
};

/** The health bar's partition of the roster, counted over ALL of its members. */
export type ApiListStatusCounts = {
  active: number;
  unsubscribed: number;
  /** The complement of the two above, so the three always sum to the roster. */
  failed: number;
  /** Two statuses inside `failed`, broken out for the rail's rates. */
  bounced: number;
  complained: number;
};

/** One bar of the growth chart: joins in the week starting at `weekStart`. */
export type ApiListWeeklyJoins = {
  /** Monday 00:00 as the API computed it — the edge the count actually used. */
  weekStart: string;
  /** "W31" — named by the API, from that same edge. See `weeks` below. */
  label: string;
  joins: number;
};

/** Members carrying a value for one custom field, out of ALL of them. */
export type ApiListFieldFill = { key: string; filled: number };

/**
 * GET /v1/lists/{id}/stats — the list row plus every counter this page renders.
 *
 * `channelTotals` and `lastCampaignAt` come from SQL over the list's whole
 * campaign history. They used to be summed in the browser from the campaign
 * strip, which is a page: any list with more campaigns than the strip holds had
 * its delivery and failure rates silently under-reported, and "last campaign"
 * was picked by `startedAt` out of a set the server had ordered by `updatedAt`.
 *
 * `statusCounts`, `weeklyJoins` and `fieldFill` are the same correction applied
 * to the roster. All three used to be derived here from
 * `GET /v1/lists/{id}/members?limit=1000`, so a 2,000-member list had its
 * health bar, its growth chart and its field-fill bars all computed from half
 * of itself — and the growth chart from the wrong half, since that endpoint
 * orders by `subscribers.createdAt` while the chart buckets on when a member
 * joined THIS list.
 */
export type ApiListStats = ApiList & {
  channelTotals?: ApiListChannelTotals[] | null;
  lastCampaignAt?: string | null;
  statusCounts?: ApiListStatusCounts | null;
  weeklyJoins?: ApiListWeeklyJoins[] | null;
  fieldFill?: ApiListFieldFill[] | null;
};

/** Custom field definition from /v1/custom-fields. */
export type ApiCustomFieldDef = {
  id: string;
  key: string;
  label: string;
  type: string;
};

/** Segment row from /v1/segments (rules are the jsonb rule array). */
export type ApiSegment = {
  id: string;
  name: string;
  rules?: Array<{ field: string; op: string; value?: unknown }> | null;
};

export type HealthSegment = {
  key: 'active' | 'unsubscribed' | 'failed';
  label: string;
  color: string;
  value: number;
  /** Share of the roster, 0–100 with one decimal. */
  pct: number;
};

export type WeeklyJoins = { label: string; joins: number; left: number };

export type ListCampaignRow = {
  id: string;
  name: string;
  sub: string;
  sent: string;
  delivered: string;
  opens: string;
  clicks: string;
  unsubs: string;
};

export type ListFieldRow = {
  id: string;
  label: string;
  key: string;
  typeLabel: string;
  fillPct: number;
  fillColor: string;
};

export type ListDetailView = {
  total: number;
  growthLabel: string;
  growthUp: boolean;
  deliverableLabel: string;
  health: HealthSegment[];
  weeks: WeeklyJoins[];
  campaigns: ListCampaignRow[];
  fields: ListFieldRow[];
  segments: string[];
  createdLabel: string;
  createdLine: string;
  lastCampaignLabel: string;
  bounceRate: string;
  complaintRate: string;
  unsubRate: string;
  deliveredRate: string;
  failedRate: string;
  /**
   * Send outcomes for this list, split by the channel that carried them —
   * aggregated from the campaigns targeting the list, which each know their
   * own channel. Lets the detail view report per-channel numbers instead of
   * one email-shaped set for a list mailed on all four.
   */
  channelTotals: Record<ChannelType, ChannelTotals>;
  embedSnippet: string;
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDayMonth(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function pctLabel(n: number, denom: number): string {
  if (denom <= 0) return '—';
  return `${((n / denom) * 100).toFixed(1)}%`;
}

/** A list nobody has joined yet — every bucket empty, not "unknown". */
const NO_STATUS_COUNTS: ApiListStatusCounts = {
  active: 0,
  unsubscribed: 0,
  failed: 0,
  bounced: 0,
  complained: 0,
};

/** Build the list-detail view model from the list row + its related data. */
export function buildListDetailView(
  list: ApiListStats,
  campaigns: ApiCampaign[],
  fields: ApiCustomFieldDef[],
  segments: ApiSegment[],
): ListDetailView {
  const total = list.memberCount ?? 0;

  /* Counted in SQL over the whole membership, not tallied here from a page of
     it. `failed` is the server's complement of active + unsubscribed, so the
     three segments always sum to the roster the "Recipients" figure names. */
  const bucket = list.statusCounts ?? NO_STATUS_COUNTS;

  const share = (n: number) => (total > 0 ? n / total : 0);
  const seg = (
    key: HealthSegment['key'],
    label: string,
    color: string,
    count: number,
  ): HealthSegment => ({
    key,
    label,
    color,
    value: count,
    pct: Math.round(share(count) * 1000) / 10,
  });
  /* Server-side totals over the list's whole campaign history. The campaign
     strip below is one page of it, so summing that page would under-report
     every rate as soon as a list outgrows the page. */
  const serverTotals = list.channelTotals ?? [];
  const sumOf = (pick: (t: ApiListChannelTotals) => number) =>
    serverTotals.reduce((n, t) => n + (pick(t) || 0), 0);
  const deliveredCount = list.delivered ?? sumOf((t) => t.delivered);
  const attemptedCount = sumOf((t) => t.attempted);
  const failedCount = sumOf((t) => t.failed);
  const sendRate = (n: number) =>
    attemptedCount > 0 ? `${((n / attemptedCount) * 100).toFixed(2)}%` : '—';

  // Roster partition only — delivery outcomes live on the rail (Delivery /
  // Failed rate). Mixing campaign-attempt % into this bar made the legend
  // look like one whole when the segments used two different denominators.
  const health: HealthSegment[] = [
    seg('active', 'Active', '#4f46e5', bucket.active),
    seg('unsubscribed', 'Unsubscribed', '#a5a39a', bucket.unsubscribed),
    seg('failed', 'Failed', '#dc2626', bucket.failed),
  ];

  /* Week-over-week change in SIGNUP RATE: joins in the trailing 7 days against
     joins in the 7 before, both counted in SQL on `list_members.added_at` over
     the whole membership. Additions only — leaving a list is a delete, so there
     is no departure count to net against.

     KNOWN DEFECT (audit #24): the label built from it says "this week" beside a
     red down-arrow, which reads as the list shrinking. It is not: a list can
     add fewer people this week than last while growing every day. Perf list 629
     renders a red "↓ 10.0%" directly above a green "↑ 27 joined this week" —
     both correct, describing the same 27 joins. Only the drawer names it
     honestly. (The detail header's arrow path is additionally hardcoded
     up-and-right; only its colour is conditional.) */
  const last7 = list.addedLast7 ?? 0;
  const prev7 = list.addedPrev7 ?? 0;
  const growthPct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;
  const growthUp = growthPct >= 0;
  const growthLabel = `${growthUp ? '+' : '−'}${Math.abs(growthPct).toFixed(1)}% this week`;

  /* Joins per week, trailing 12 weeks, bucketed in SQL on when a member joined
     THIS list. The browser used to bucket the member sample instead, which
     answered a different question with a different column: that sample is the
     1,000 subscribers with the newest `subscribers.createdAt`, so importing old
     subscribers into a new list emptied the chart while the list filled up.
     The label is the API's too, for the same reason `subscriber-detail.ts`
     takes its week labels from the API: `weekStart` is an instant, and reading
     its calendar fields here — in the viewer's zone, not the API's — named the
     week before it for anyone west of the API, under bars counted over the
     API's Mondays. "Left" has no data source, so it stays zero. */
  const weeks: WeeklyJoins[] = (list.weeklyJoins ?? []).map((w) => ({
    label: w.label,
    joins: w.joins,
    left: 0,
  }));

  const campaignRows: ListCampaignRow[] = campaigns.map((c) => {
    const channel = c.channel ? c.channel[0]!.toUpperCase() + c.channel.slice(1) : 'Email';
    const when = c.startedAt
      ? fmtDayMonth(c.startedAt)
      : ((c.status ?? 'draft') as string).toLowerCase();
    const recipients = c.recipients ?? 0;
    const delivered = c.delivered ?? 0;
    return {
      id: c.id,
      name: c.name,
      sub: `${channel} · ${when}`,
      sent: recipients > 0 ? recipients.toLocaleString('en-US') : '—',
      delivered: recipients > 0 && delivered > 0 ? pctLabel(delivered, recipients) : '—',
      opens: delivered > 0 ? pctLabel(c.opened ?? 0, delivered) : '—',
      clicks: delivered > 0 ? pctLabel(c.clicked ?? 0, delivered) : '—',
      unsubs: '—',
    };
  });

  /* Fill counts are per key, over the whole membership; the definitions the
     row is labelled with still come from /v1/custom-fields, which is the
     workspace catalogue this list's counts are a slice of. */
  const filledByKey = new Map((list.fieldFill ?? []).map((f) => [f.key, f.filled]));
  const fieldRows: ListFieldRow[] = fields.map((f) => {
    const filled = filledByKey.get(f.key) ?? 0;
    const fillPct = total > 0 ? Math.round((filled / total) * 100) : 0;
    return {
      id: f.id,
      label: f.label,
      key: f.key,
      typeLabel: f.type ? f.type[0]!.toUpperCase() + f.type.slice(1) : 'Text',
      fillPct,
      fillColor: fillPct >= 80 ? '#16a34a' : fillPct >= 40 ? '#4f46e5' : '#c2740a',
    };
  });

  // Segments that reference this list via a membership rule (field "list").
  const segmentNames = segments
    .filter((s) =>
      (s.rules ?? []).some((r) => r.field === 'list' && String(r.value ?? '') === list.id),
    )
    .map((s) => s.name);

  // Grouped by channel in SQL across every campaign the list ever ran, for the
  // same reason as the rates above.
  const channelTotals: Record<ChannelType, ChannelTotals> = {
    email: { ...EMPTY_TOTALS },
    sms: { ...EMPTY_TOTALS },
    whatsapp: { ...EMPTY_TOTALS },
    voice: { ...EMPTY_TOTALS },
  };
  for (const row of serverTotals) {
    const t = channelTotals[row.channel as ChannelType];
    if (!t) continue;
    // `attempted` already counts the failures — it is every message the
    // campaign produced on this channel.
    t.attempted += row.attempted || 0;
    t.delivered += row.delivered || 0;
    t.opened += row.opened || 0;
    t.clicked += row.clicked || 0;
    t.failed += row.failed || 0;
  }

  const lastCampaignAt = list.lastCampaignAt ?? null;
  const createdLabel = fmtDate(list.createdAt);
  const createdLine = lastCampaignAt
    ? `Created ${createdLabel} · last campaign ${fmtDate(lastCampaignAt)}`
    : `Created ${createdLabel}`;
  const lastCampaignLabel = fmtDate(lastCampaignAt);

  return {
    total,
    growthLabel,
    growthUp,
    deliverableLabel: total > 0 ? `${(share(bucket.active) * 100).toFixed(1)}%` : '—',
    health,
    weeks,
    campaigns: campaignRows,
    fields: fieldRows,
    segments: segmentNames,
    createdLabel,
    createdLine,
    lastCampaignLabel,
    /* Two different denominators, adjacent in the rail, and the labels do not
       say which is which (audit #21, #22):

         bounce/complaint/unsubRate — share of the ROSTER carrying that
           subscriber status. Denominator: `memberCount`. A property of the
           people on the list.
         delivered/failedRate — share of MESSAGES ATTEMPTED across every
           campaign that targeted the list. Denominator: `attemptedCount` from
           `channelTotals`. A property of the sends.

       Live consequence on Perf list 877: "Delivery rate 100.00%" and "Failed
       rate 0.00%" (0 of 1,176 messages) sitting either side of "Unsubscribe
       rate 50.00%" (1,000 of 2,000 members). Zero unsubscribe EVENTS exist
       across those 1,176 sends. Both figures are right; the rail reads as one
       series. The same collision appears between the health card's roster
       "Failed" and the rail's message "Failed rate". */
    bounceRate: total > 0 ? `${(share(bucket.bounced) * 100).toFixed(2)}%` : '—',
    complaintRate: total > 0 ? `${(share(bucket.complained) * 100).toFixed(2)}%` : '—',
    unsubRate: total > 0 ? `${(share(bucket.unsubscribed) * 100).toFixed(2)}%` : '—',
    deliveredRate: sendRate(deliveredCount),
    failedRate: sendRate(failedCount),
    channelTotals,
    embedSnippet: `<script src="https://js.maildrill.net/embed.js" data-list="${list.id}"></script>`,
  };
}
