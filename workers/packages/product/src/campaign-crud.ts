import { and, asc, desc, eq, inArray, isNotNull, lte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import {
  campaigns,
  db,
  lists,
  messageEvents,
  messages,
  segments,
  type Campaign,
  type NewCampaign,
} from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { clamp } from './rules';

/**
 * Campaign drafts. The stored shape mirrors the `/v1/campaigns/send` contract
 * (channel + audience selector + template/content + schedule) so a saved draft
 * can be handed straight to the messaging engine.
 *
 * Delivery / open / click / unsub / complaint counters are derived from
 * `messages` + `message_events` (Infobip → PostHog → campaign-delivery poller).
 */

export interface UpsertCampaignInput {
  tenantId: string;
  name: string;
  channel?: Channel;
  status?: string;
  listId?: string | null;
  segmentId?: string | null;
  templateId?: string | null;
  content?: Record<string, unknown>;
  scheduledAt?: Date | null;
}

/** A campaign plus its derived audience label and delivery counters. */
export interface CampaignWithStats extends Campaign {
  /** Human label for the target: list name, segment name, or "All subscribers". */
  audience: string;
  recipients: number;
  delivered: number;
  /** Messages with a provider read/seen receipt — the real "opened" signal. */
  opened: number;
  /** Messages with at least one click event. */
  clicked: number;
  /** Recipients who unsubscribed off this campaign (unsubscribe events). */
  unsubscribed: number;
  /** Recipients who marked the message as spam (email complaint events). */
  complaints: number;
  failed: number;
  /**
   * Messages past the send queue (submitted/sent/terminal). Drives the
   * dispatch progress bar; campaign flips to `sent` when this equals recipients.
   */
  accepted: number;
  /** Most recent provider error when any message failed (detail GET only). */
  lastErrorMessage?: string | null;
}

export interface CampaignEngagementBreakdown {
  devices: Array<{ device: string; count: number }>;
  links: Array<{
    url: string;
    /** All click events on this URL. */
    total: number;
    /** Distinct recipients (messages) that clicked this URL. */
    unique: number;
  }>;
}

/** Per-campaign delivery counters, as the board and the drawer render them. */
export interface CampaignCounters {
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  complaints: number;
  failed: number;
  accepted: number;
}

const NO_COUNTERS: CampaignCounters = {
  recipients: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  unsubscribed: 0,
  complaints: 0,
  failed: 0,
  accepted: 0,
};

/**
 * The status readings, spelled once.
 *
 * Both the page-scoped rollup and the whole-tenant one below have to define
 * "delivered" and "failed" identically — if they ever drifted, sorting the
 * board by a column would reorder it by a different definition of the number
 * printed in it.
 */
const messageCounters = {
  recipients: sql<number>`count(*)::int`.as('recipients'),
  delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`.as(
    'delivered',
  ),
  opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`.as('opened'),
  failed: sql<number>`count(*) filter (where ${messages.status} in ('failed', 'cancelled', 'expired'))::int`.as(
    'failed',
  ),
  // Dispatched: left the send queue (provider handoff or permanent failure).
  accepted: sql<number>`count(*) filter (where ${messages.status} not in ('queued', 'processing', 'draft', 'scheduled'))::int`.as(
    'accepted',
  ),
} as const;

/**
 * Message outcomes grouped by campaign.
 *
 * `campaignIds` is the whole point: with it the plan is an index-only scan of
 * `messages_tenant_campaign_status_idx` over just those campaigns — 2.0ms and
 * 23 buffers for a ten-row page of the heaviest campaigns in the 1M-message
 * workspace, and flat as the table grows because it never reads a message
 * belonging to a campaign nobody asked about. Without it the same aggregate is
 * a 32,094-buffer scan of every message the tenant has ever sent.
 */
function messageRollup(tenantId: string, campaignIds?: string[]) {
  const conds = [eq(messages.tenantId, tenantId)];
  if (campaignIds) conds.push(inArray(messages.campaignId, campaignIds));
  return db
    .select({ campaignId: messages.campaignId, ...messageCounters })
    .from(messages)
    .where(and(...conds))
    .groupBy(messages.campaignId);
}

/**
 * Click / unsubscribe / complaint counts per campaign.
 *
 * These are event rows, not message statuses, so they come from
 * `message_events` — keyed on its denormalised `campaign_id` rather than
 * joined back through `messages`. That join is O(all tenant events) however few
 * campaigns are asked about, and measured 923ms on a 2M-event table against
 * 6.7ms here.
 *
 * The DISTINCT is a subquery rather than `count(distinct message_id) filter
 * (...)` because `message_events_tenant_campaign_type_idx` already emits
 * (campaign, type, message) in order: as a subquery Postgres collapses the
 * duplicates in a Unique node straight off the index scan, where the aggregate
 * form makes it sort 23,540 rows first. Both count the same thing — a
 * recipient who clicked twice is one click.
 */
function eventRollup(tenantId: string, campaignIds?: string[]) {
  const conds = [eq(messageEvents.tenantId, tenantId)];
  if (campaignIds) conds.push(inArray(messageEvents.campaignId, campaignIds));
  else conds.push(isNotNull(messageEvents.campaignId));
  const perRecipient = db
    .selectDistinct({
      campaignId: messageEvents.campaignId,
      eventType: messageEvents.eventType,
      messageId: messageEvents.messageId,
    })
    .from(messageEvents)
    .where(and(...conds))
    .as('campaign_event');
  return db
    .select({
      campaignId: perRecipient.campaignId,
      clicked: sql<number>`count(*) filter (where ${perRecipient.eventType} = 'click')::int`.as(
        'clicked',
      ),
      unsubscribed:
        sql<number>`count(*) filter (where ${perRecipient.eventType} = 'unsubscribed')::int`.as(
          'unsubscribed',
        ),
      complaints:
        sql<number>`count(*) filter (where ${perRecipient.eventType} = 'complaint')::int`.as(
          'complaints',
        ),
    })
    .from(perRecipient)
    .groupBy(perRecipient.campaignId);
}

/** Counters for a bounded set of campaigns — never for the whole workspace. */
async function statsFor(
  tenantId: string,
  campaignIds: string[],
): Promise<Map<string, CampaignCounters>> {
  const map = new Map<string, CampaignCounters>();
  if (campaignIds.length === 0) return map;

  // Independent aggregates over different tables, so they overlap rather than
  // queue.
  const [rows, engagement] = await Promise.all([
    messageRollup(tenantId, campaignIds),
    eventRollup(tenantId, campaignIds),
  ]);

  for (const r of rows) {
    if (!r.campaignId) continue;
    map.set(r.campaignId, {
      ...NO_COUNTERS,
      recipients: Number(r.recipients),
      delivered: Number(r.delivered),
      opened: Number(r.opened),
      failed: Number(r.failed),
      accepted: Number(r.accepted),
    });
  }
  for (const e of engagement) {
    if (!e.campaignId) continue;
    // A campaign can have events but no message rows only if the messages were
    // purged; keep the engagement rather than dropping it on a missing key.
    const base = map.get(e.campaignId) ?? { ...NO_COUNTERS };
    base.clicked = Number(e.clicked);
    base.unsubscribed = Number(e.unsubscribed);
    base.complaints = Number(e.complaints);
    map.set(e.campaignId, base);
  }
  return map;
}

async function lastFailedMessageError(
  tenantId: string,
  campaignId: string,
): Promise<string | null> {
  const rows = await db
    .select({ message: messages.lastErrorMessage })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.campaignId, campaignId),
        eq(messages.status, 'failed'),
      ),
    )
    .orderBy(desc(messages.updatedAt))
    .limit(1);
  const msg = rows[0]?.message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

function audienceLabel(listName: string | null, segmentName: string | null): string {
  return listName ?? segmentName ?? 'All subscribers';
}

// ---------------------------------------------------------------------------
// The board's page
// ---------------------------------------------------------------------------

/** Columns the board offers as a sort. */
export const CAMPAIGN_SORTS = [
  'updatedAt',
  'name',
  'recipients',
  'failed',
  'openRate',
  'clickRate',
] as const;
export type CampaignSort = (typeof CAMPAIGN_SORTS)[number];

/**
 * Open/click rate bands, as four named slugs.
 *
 * The boundaries are the browser's, kept exactly: `none` is a rate of zero
 * (which includes a campaign with nothing delivered), then under 20%, 20–40%
 * and 40%+. They are compared as `hits * 100 vs delivered * 20` rather than as
 * a division, so the band a campaign falls in is exact integer arithmetic and
 * cannot disagree with the browser's float by a rounding step at the boundary.
 */
export const CAMPAIGN_RATE_BUCKETS = ['none', 'low', 'mid', 'high'] as const;
export type CampaignRateBucket = (typeof CAMPAIGN_RATE_BUCKETS)[number];

/**
 * Sorts and filters that read message outcomes rather than the campaign row.
 *
 * This distinction is the whole cost model of the endpoint. Ordering the
 * workspace by a column that is an aggregate over `messages` means aggregating
 * every one of the tenant's messages — there is no way to know the tenth
 * largest campaign without measuring them all. So the page is served two ways:
 * page the campaigns first and roll up only the ten on screen (2ms, flat as
 * `messages` grows), or, when the caller asks for one of these, roll up the
 * whole tenant once and page that (85ms today — an index-only scan, against
 * 32,094 buffers of heap before this index existed).
 *
 * The expensive shape is therefore reached only by explicitly asking to order
 * or filter the workspace by an aggregate, which is inherently that question's
 * cost. The board's default view never pays it.
 */
const STAT_SORTS: ReadonlySet<CampaignSort> = new Set(['recipients', 'failed', 'openRate', 'clickRate']);

export interface CampaignPageOptions {
  channel?: Channel;
  /** Repeatable: any of these statuses. Empty/absent means all. */
  statuses?: string[];
  /** Campaigns targeting one list — the list detail page's strip. */
  listId?: string;
  /** Case-insensitive match on campaign name or audience label. */
  q?: string;
  /**
   * Only campaigns updated at or before this moment.
   *
   * A window that ends somewhere, rather than one that always starts at "now".
   * The report page plots a campaign against the sends that preceded it, so it
   * needs the newest N *up to that campaign* — asking for the newest N of the
   * workspace and filtering in the browser returns nothing at all for any
   * campaign that is not itself among them.
   */
  updatedBefore?: Date;
  opens?: CampaignRateBucket[];
  clicks?: CampaignRateBucket[];
  sort?: CampaignSort;
  dir?: 'asc' | 'desc';
  limit?: number;
  /** Keyset resume point. Only meaningful with the default `updatedAt` sort. */
  after?: { at: string; id: string };
  /** Numbered jump to a page never walked to; sequential paging uses `after`. */
  offset?: number;
}

export interface CampaignPageRow extends CampaignWithStats {
  /** Feed back into a cursor to resume after this row. */
  cursorAt: string;
}

/**
 * The sort key as microsecond-precision text.
 *
 * `updated_at` is a microsecond timestamptz and a JS Date holds milliseconds,
 * so a cursor rebuilt from the parsed row would resume up to 999µs before the
 * row it names — descending, that silently re-serves every campaign sharing
 * that millisecond. Round-tripping the key as text keeps the resume point
 * exact, and `::timestamptz` on the way back in keeps the predicate
 * index-friendly. (Same reasoning, same shape as the subscriber roster's.)
 */
const campaignCursorAt = sql<string>`to_char(${campaigns.updatedAt} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** What the board shows in its Audience column, as SQL. */
const audienceExpr = sql<string>`coalesce(${lists.name}, ${segments.name}, 'All subscribers')`;

/** Everything that narrows the set, except the rate bands (see rateCondition). */
function campaignConditions(tenantId: string, opts: CampaignPageOptions): SQL[] {
  const conds: SQL[] = [eq(campaigns.tenantId, tenantId)];
  if (opts.channel) conds.push(eq(campaigns.channel, opts.channel));
  if (opts.statuses?.length) conds.push(inArray(campaigns.status, opts.statuses));
  if (opts.listId) conds.push(eq(campaigns.listId, opts.listId));
  // Inclusive, so the anchor campaign is inside its own history window.
  if (opts.updatedBefore) conds.push(lte(campaigns.updatedAt, opts.updatedBefore));
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim().toLowerCase()}%`;
    // Name or audience — the two strings the row actually shows.
    conds.push(sql`(lower(${campaigns.name}) like ${like} or lower(${audienceExpr}) like ${like})`);
  }
  if (opts.after) {
    // Row-value comparison: one index-friendly predicate, with the id breaking
    // ties so a page boundary can neither repeat nor skip a campaign.
    conds.push(
      opts.dir === 'asc'
        ? sql`(${campaigns.updatedAt}, ${campaigns.id}) > (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`
        : sql`(${campaigns.updatedAt}, ${campaigns.id}) < (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`,
    );
  }
  return conds;
}

/**
 * A rate band as an exact predicate over the rollup's counters.
 *
 * `hits * 100 < delivered * 20` rather than `hits / delivered < 0.2`: integer
 * multiplication has no representation error, so a campaign is never filed
 * under a band on one side of the wire and a different one on the other.
 */
function rateCondition(hits: SQLWrapper, delivered: SQLWrapper, buckets: CampaignRateBucket[]): SQL {
  const h = sql`coalesce(${hits}, 0)`;
  const d = sql`coalesce(${delivered}, 0)`;
  /*
   * The guard is on both counters, and it is what makes the four bands a
   * partition rather than four overlapping predicates. A campaign with nothing
   * delivered has no rate at all — the browser reads `delivered ? hits /
   * delivered : null` and prints 0% — so it belongs in `none` whatever `hits`
   * says. Without `d > 0` here it also satisfied `h * 100 >= d * 40` (0 >= 0)
   * and was counted twice: 316 email campaigns across four bands, on a channel
   * holding 265.
   */
  const rated = sql`${d} > 0 and ${h} > 0`;
  const per = (b: CampaignRateBucket): SQL => {
    switch (b) {
      case 'none':
        return sql`(${d} = 0 or ${h} = 0)`;
      case 'low':
        return sql`(${rated} and ${h} * 100 < ${d} * 20)`;
      case 'mid':
        return sql`(${rated} and ${h} * 100 >= ${d} * 20 and ${h} * 100 < ${d} * 40)`;
      case 'high':
        return sql`(${rated} and ${h} * 100 >= ${d} * 40)`;
    }
  };
  return sql`(${sql.join(buckets.map(per), sql` or `)})`;
}

/** Does this request have to measure the whole workspace to answer? */
function needsRollup(opts: CampaignPageOptions, sort: CampaignSort): boolean {
  return STAT_SORTS.has(sort) || Boolean(opts.opens?.length) || Boolean(opts.clicks?.length);
}

type Rollups = {
  ms: { recipients: SQLWrapper; delivered: SQLWrapper; opened: SQLWrapper; failed: SQLWrapper };
  es: { clicked: SQLWrapper };
};

function rateConditions(opts: CampaignPageOptions, ms: Rollups['ms'], es: Rollups['es']): SQL[] {
  const conds: SQL[] = [];
  if (opts.opens?.length) conds.push(rateCondition(ms.opened, ms.delivered, opts.opens));
  if (opts.clicks?.length) conds.push(rateCondition(es.clicked, ms.delivered, opts.clicks));
  return conds;
}

/**
 * The stat sorts as SQL.
 *
 * The two rates divide by `delivered`, matching the browser's
 * `opened / delivered` exactly — not by `recipients`, which would order the
 * table by a different number than the one printed in the column. `nullif`
 * turns the no-deliveries case into 0 rather than a division error, which is
 * also where the browser's `null` rate sorts.
 */
function statExpressions(ms: Rollups['ms'], es: Rollups['es']): Record<CampaignSort, SQL> {
  const rate = (hits: SQLWrapper) =>
    sql`coalesce(${hits}::numeric / nullif(${ms.delivered}, 0), 0)`;
  return {
    updatedAt: sql`${campaigns.updatedAt}`,
    name: sql`${campaigns.name}`,
    recipients: sql`coalesce(${ms.recipients}, 0)`,
    failed: sql`coalesce(${ms.failed}, 0)`,
    openRate: rate(ms.opened),
    clickRate: rate(es.clicked),
  };
}

/** The join every campaign query needs to render its audience label. */
function campaignBase() {
  return db
    .select({
      campaign: campaigns,
      listName: lists.name,
      segmentName: segments.name,
      cursorAt: campaignCursorAt,
    })
    .from(campaigns)
    .leftJoin(lists, eq(campaigns.listId, lists.id))
    .leftJoin(segments, eq(campaigns.segmentId, segments.id));
}

function orderBy(sort: CampaignSort, dir: 'asc' | 'desc', stat?: Record<CampaignSort, SQL>) {
  const d = dir === 'asc' ? asc : desc;
  // `id` always trails: two campaigns can share an updated_at (or a name, or a
  // count), and without a tiebreaker the row on a page boundary is free to
  // appear on both pages or neither.
  const tie = d(campaigns.id);
  if (sort === 'name') return [d(campaigns.name), tie];
  if (sort === 'updatedAt') return [d(campaigns.updatedAt), tie];
  return [d(stat![sort]), tie];
}

/**
 * One page of the campaigns board.
 *
 * Two plans, chosen by whether the caller sorts or filters on a message
 * aggregate (see STAT_SORTS). The default plan pages `campaigns` — a small
 * table, indexed by tenant — and then rolls up `messages` for only the ids on
 * that page, so its cost is set by the page and not by the workspace.
 */
export async function listCampaignsPage(
  tenantId: string,
  opts: CampaignPageOptions = {},
): Promise<CampaignPageRow[]> {
  const sort = opts.sort ?? 'updatedAt';
  const dir = opts.dir === 'asc' ? 'asc' : 'desc';
  // Ceiling is the page cap plus one: callers over-fetch by one to learn
  // whether another page exists.
  const limit = clamp(opts.limit ?? 10, 1, 101);
  const offset = opts.offset ?? 0;
  const conds = campaignConditions(tenantId, { ...opts, dir });

  if (!needsRollup(opts, sort)) {
    const rows = await campaignBase()
      .where(and(...conds))
      .orderBy(...orderBy(sort, dir))
      .limit(limit)
      .offset(offset);

    const stats = await statsFor(
      tenantId,
      rows.map((r) => r.campaign.id),
    );
    return rows.map((r) => ({
      ...r.campaign,
      audience: audienceLabel(r.listName, r.segmentName),
      ...(stats.get(r.campaign.id) ?? NO_COUNTERS),
      cursorAt: r.cursorAt,
    }));
  }

  const ms = messageRollup(tenantId).as('message_stats');
  const es = eventRollup(tenantId).as('event_stats');
  const num = (v: SQLWrapper) => sql<number>`coalesce(${v}, 0)::int`;
  const rows = await db
    .select({
      campaign: campaigns,
      listName: lists.name,
      segmentName: segments.name,
      cursorAt: campaignCursorAt,
      recipients: num(ms.recipients),
      delivered: num(ms.delivered),
      opened: num(ms.opened),
      failed: num(ms.failed),
      accepted: num(ms.accepted),
      clicked: num(es.clicked),
      unsubscribed: num(es.unsubscribed),
      complaints: num(es.complaints),
    })
    .from(campaigns)
    .leftJoin(lists, eq(campaigns.listId, lists.id))
    .leftJoin(segments, eq(campaigns.segmentId, segments.id))
    // Left, not inner: a draft has no messages and must still appear.
    .leftJoin(ms, eq(ms.campaignId, campaigns.id))
    .leftJoin(es, eq(es.campaignId, campaigns.id))
    .where(and(...conds, ...rateConditions(opts, ms, es)))
    .orderBy(...orderBy(sort, dir, statExpressions(ms, es)))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r.campaign,
    audience: audienceLabel(r.listName, r.segmentName),
    recipients: Number(r.recipients),
    delivered: Number(r.delivered),
    opened: Number(r.opened),
    clicked: Number(r.clicked),
    unsubscribed: Number(r.unsubscribed),
    complaints: Number(r.complaints),
    failed: Number(r.failed),
    accepted: Number(r.accepted),
    cursorAt: r.cursorAt,
  }));
}

/**
 * How many campaigns match, ignoring pagination.
 *
 * Opt-in: the board needs it for the pager, but it is a scan of the filtered
 * set and a page must never pay for one the caller did not ask for.
 */
export async function countCampaigns(
  tenantId: string,
  opts: CampaignPageOptions = {},
): Promise<number> {
  // `after` is a page boundary, not a filter — counting from it would report
  // "how many are left", which is not what the pager is asking.
  const conds = campaignConditions(tenantId, { ...opts, after: undefined });
  /*
   * Only the rate BANDS need the rollup here, never the sort: reordering a set
   * cannot change its size. Asking `needsRollup` would make "sort by open rate"
   * aggregate every message twice — once to order the page, once to count it —
   * for a number the campaign rows alone already give.
   */
  if (!opts.opens?.length && !opts.clicks?.length) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(campaigns)
      .leftJoin(lists, eq(campaigns.listId, lists.id))
      .leftJoin(segments, eq(campaigns.segmentId, segments.id))
      .where(and(...conds));
    return Number(row?.n ?? 0);
  }
  const ms = messageRollup(tenantId).as('message_stats');
  const es = eventRollup(tenantId).as('event_stats');
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaigns)
    .leftJoin(lists, eq(campaigns.listId, lists.id))
    .leftJoin(segments, eq(campaigns.segmentId, segments.id))
    .leftJoin(ms, eq(ms.campaignId, campaigns.id))
    .leftJoin(es, eq(es.campaignId, campaigns.id))
    .where(and(...conds, ...rateConditions(opts, ms, es)));
  return Number(row?.n ?? 0);
}

export interface CampaignBoardCounts {
  /** Campaigns per channel — the tab counts. */
  byChannel: Record<string, number>;
  /** Campaigns per status within `channel`, for the status menu. */
  byStatus: Record<string, number>;
}

/**
 * Tab and status-filter counts, in one scan of `campaigns`.
 *
 * These describe the workspace, not the page in hand. Counting the fetched
 * rows was right while the browser held every campaign; with the page served
 * server-side it would report ten — the exact bug the subscriber roster's tabs
 * had.
 *
 * No message data is involved: both counts are properties of the campaign row,
 * so this stays a ~2ms read of a small table however large `messages` gets.
 * The status counts deliberately ignore any status filter — a menu that counted
 * only the status already selected would show every other option as zero.
 */
export async function campaignBoardCounts(
  tenantId: string,
  opts: { channel?: Channel } = {},
): Promise<CampaignBoardCounts> {
  const rows = await db
    .select({
      channel: campaigns.channel,
      status: campaigns.status,
      n: sql<number>`count(*)::int`,
    })
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId))
    .groupBy(campaigns.channel, campaigns.status);

  const byChannel: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    const n = Number(r.n);
    byChannel[r.channel] = (byChannel[r.channel] ?? 0) + n;
    if (!opts.channel || r.channel === opts.channel) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + n;
    }
  }
  return { byChannel, byStatus };
}

export async function getCampaign(tenantId: string, id: string): Promise<CampaignWithStats | null> {
  const rows = await campaignBase()
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  /*
   * One campaign, one campaign's messages. This used to roll up the entire
   * tenant and throw away 877 of the 878 groups it built — 96ms and a 251MB
   * heap scan to produce a 656-byte response, on a path the drawer, the
   * post-send refetch, the edit and duplicate actions and a 2s delivery poll
   * all hit.
   */
  const counters = (await statsFor(tenantId, [row.campaign.id])).get(row.campaign.id);
  const failed = counters?.failed ?? 0;
  return {
    ...row.campaign,
    audience: audienceLabel(row.listName, row.segmentName),
    ...(counters ?? NO_COUNTERS),
    lastErrorMessage: failed > 0 ? await lastFailedMessageError(tenantId, row.campaign.id) : null,
  };
}

/**
 * Device + top-link breakdown for a campaign report, sourced from Infobip
 * tracking payloads stored on message_events.
 */
export async function getCampaignEngagement(
  tenantId: string,
  campaignId: string,
): Promise<CampaignEngagementBreakdown> {
  const deviceExpr = sql<string>`coalesce(nullif(${messageEvents.payload}->>'device_type', ''), 'Unknown')`;
  const devices = await db
    .select({
      device: deviceExpr,
      count: sql<number>`count(*)::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.campaignId, campaignId),
        sql`${messageEvents.eventType} in ('click', 'open')`,
        sql`coalesce(${messageEvents.payload}->>'device_type', '') <> ''`,
      ),
    )
    .groupBy(deviceExpr)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const urlExpr = sql<string>`${messageEvents.payload}->>'url'`;
  const links = await db
    .select({
      url: urlExpr,
      total: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${messageEvents.messageId})::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.campaignId, campaignId),
        eq(messageEvents.eventType, 'click'),
        sql`coalesce(${messageEvents.payload}->>'url', '') <> ''`,
      ),
    )
    .groupBy(urlExpr)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    devices: devices.map((r) => ({ device: r.device, count: Number(r.count) })),
    links: links.map((r) => ({
      url: r.url,
      total: Number(r.total),
      unique: Number(r.unique),
    })),
  };
}

export async function createCampaign(input: UpsertCampaignInput): Promise<CampaignWithStats> {
  const rows = await db
    .insert(campaigns)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      status: input.status ?? 'draft',
      channel: input.channel ?? 'email',
      listId: input.listId ?? null,
      segmentId: input.segmentId ?? null,
      templateId: input.templateId ?? null,
      content: input.content ?? {},
      scheduledAt: input.scheduledAt ?? null,
    })
    .returning();
  const created = rows[0]!;
  return (await getCampaign(input.tenantId, created.id))!;
}

export async function updateCampaign(
  tenantId: string,
  id: string,
  patch: Partial<Omit<UpsertCampaignInput, 'tenantId'>>,
): Promise<CampaignWithStats | null> {
  const set: Partial<NewCampaign> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.channel !== undefined) set.channel = patch.channel;
  if (patch.listId !== undefined) set.listId = patch.listId;
  if (patch.segmentId !== undefined) set.segmentId = patch.segmentId;
  if (patch.templateId !== undefined) set.templateId = patch.templateId;
  if (patch.content !== undefined) set.content = patch.content;
  if (patch.scheduledAt !== undefined) set.scheduledAt = patch.scheduledAt;

  const rows = await db
    .update(campaigns)
    .set(set)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning({ id: campaigns.id });
  if (rows.length === 0) return null;
  return getCampaign(tenantId, id);
}

export async function deleteCampaign(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning({ id: campaigns.id });
  return rows.length > 0;
}
