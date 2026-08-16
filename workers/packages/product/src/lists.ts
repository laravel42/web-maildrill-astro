import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  ne,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import {
  campaigns,
  db,
  listMembers,
  lists,
  messageEvents,
  messages,
  subscribers,
  type ListRow,
  type Subscriber,
} from '@maildrill/database';
import { ValidationError, type Channel } from '@maildrill/domain';
import { clamp } from './rules';

export interface CreateListInput {
  tenantId: string;
  name: string;
  color?: string | null;
  tags?: string[];
  /** Channels the list is for. Must hold at least one; defaults to email. */
  channels?: Channel[];
  notes?: string | null;
  gdprConsent?: boolean;
  doubleOptIn?: boolean;
  doubleOptOut?: boolean;
  doubleOptInTemplateId?: string | null;
  doubleOptOutTemplateId?: string | null;
  welcomeEmailTemplateId?: string | null;
  goodbyeEmailTemplateId?: string | null;
}

/**
 * A list with no channel cannot be sent to, so an empty selection is refused
 * rather than quietly defaulted — the caller asked for something impossible.
 * Enforced here as well as in the route schema: this is the invariant, and
 * every writer goes through these two functions.
 */
function assertChannels(channels: Channel[] | undefined): Channel[] | undefined {
  if (channels === undefined) return undefined;
  const unique = [...new Set(channels)];
  if (unique.length === 0) {
    throw new ValidationError('channels_required: pick at least one channel for this list.');
  }
  return unique;
}

export async function createList(input: CreateListInput): Promise<ListRow> {
  const rows = await db
    .insert(lists)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      color: input.color ?? null,
      tags: input.tags ?? [],
      channels: assertChannels(input.channels) ?? ['email'],
      notes: input.notes ?? null,
      gdprConsent: input.gdprConsent ?? false,
      doubleOptIn: input.doubleOptIn ?? false,
      doubleOptOut: input.doubleOptOut ?? false,
      doubleOptInTemplateId: input.doubleOptInTemplateId ?? null,
      doubleOptOutTemplateId: input.doubleOptOutTemplateId ?? null,
      welcomeEmailTemplateId: input.welcomeEmailTemplateId ?? null,
      goodbyeEmailTemplateId: input.goodbyeEmailTemplateId ?? null,
    })
    .returning();
  return rows[0]!;
}

export async function getList(tenantId: string, id: string): Promise<ListRow | null> {
  const rows = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, id), eq(lists.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

/** A list plus its member count and computed engagement/growth stats. */
export interface ListWithCount extends ListRow {
  memberCount: number;
  /**
   * Members a campaign would actually reach. `resolveAudience` mails only
   * subscribers whose status is 'active', so a list whose members have since
   * bounced, complained or unsubscribed reaches fewer people than it holds.
   */
  activeMemberCount: number;
  /** Members added in the trailing 7 days / the 7 days before that. */
  addedLast7: number;
  addedPrev7: number;
  /** Cumulative member count at 7 weekly points, oldest → now. */
  trend: number[];
  /** Message outcomes across campaigns sent to this list. */
  delivered: number;
  /**
   * Deliveries on channels with engagement tracking (email, WhatsApp) — the
   * open/click rate denominator. SMS and voice deliveries can never produce
   * an open, so counting them would dilute the rate.
   */
  trackedDelivered: number;
  opened: number;
  clicked: number;
}

/**
 * Name/colour only, for pickers — no member counts, no growth, no trends.
 *
 * A filter menu or a segment builder needs none of the board's aggregates, so
 * it gets a bounded, searchable projection of `lists` instead. The row width is
 * what makes this cheap, not the row count: `lists` is a small table by design
 * (a workspace holds thousands, not millions), so even asking for all of them
 * is a scan of ~40 pages — against the three whole-workspace aggregates the
 * board's own query runs.
 */
export interface ListOption {
  id: string;
  name: string;
  color: string | null;
  channels: string[] | null;
}

export async function listListOptions(
  tenantId: string,
  opts: { q?: string; limit?: number } = {},
): Promise<ListOption[]> {
  const conds = [eq(lists.tenantId, tenantId)];
  if (opts.q?.trim()) {
    conds.push(sql`${lists.name} ilike ${'%' + opts.q.trim() + '%'}`);
  }
  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      color: lists.color,
      channels: lists.channels,
    })
    .from(lists)
    .where(and(...conds))
    .orderBy(lists.name)
    // Default stays small for a type-ahead menu; the ceiling is high enough to
    // serve a whole workspace's name map to the pages that render one — which
    // used to load the full aggregation just to get it.
    .limit(clamp(opts.limit ?? 10, 1, 1000));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? null,
    channels: (r.channels as string[] | null) ?? null,
  }));
}

/**
 * Statuses that put a member out of reach of a send — the exact complement of
 * 'active' in the subscriber_status enum.
 *
 * Spelled as a list rather than `<> 'active'` because only an IN list becomes a
 * ScalarArrayOp index condition: `<>` is unindexable and degrades to a filter
 * over the whole status index to reach the same 80k rows.
 */
const UNMAILABLE_STATUSES = ['unsubscribed', 'bounced', 'complained', 'invalid'] as const;

// ---------------------------------------------------------------------------
// Aggregate building blocks
//
// Every rollup below takes an optional `listIds`, and that parameter is the
// whole cost model of this file. With it, Postgres reads only the memberships
// and messages belonging to the lists on the page; without it, it reads every
// one the tenant owns. The board's default view always passes it.
// ---------------------------------------------------------------------------

/**
 * The seven weekly cutoffs the growth counters and the trend sparkline bucket on.
 *
 * Computed in JS and bound as parameters rather than written as
 * `now() - interval 'n weeks'`. `now()` is STABLE, so Postgres cannot
 * constant-fold the subtraction and re-evaluates it for every row of every
 * filter: measured on the 2M-membership workspace, the same scan aggregates in
 * 176ms with bound constants and 480ms without.
 */
function weekCutoffs(now = Date.now()): readonly Date[] {
  const WEEK = 7 * 86_400_000;
  const weeksAgo = (n: number) => new Date(now - n * WEEK);
  return [weeksAgo(6), weeksAgo(5), weeksAgo(4), weeksAgo(3), weeksAgo(2), weeksAgo(1), weeksAgo(0)];
}

/** Members already on the list at a given moment — one trend point. */
const addedBy = (cutoff: Date) =>
  sql`count(*) filter (where ${listMembers.addedAt} <= ${cutoff})::int`;

/**
 * Subscribers of this tenant a send cannot reach.
 *
 * Joined and tested for a miss, rather than joining all subscribers and testing
 * `status = 'active'`. Only 8% of subscribers are non-active, so the hash builds
 * from 80k rows in one batch instead of a million rows across eight batches
 * spilling ~120MB to temp files.
 */
function unmailableSubscribers(tenantId: string) {
  return db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(
      and(eq(subscribers.tenantId, tenantId), inArray(subscribers.status, [...UNMAILABLE_STATUSES])),
    );
}

/** Membership counts, growth and the 7-point trend, grouped by list. */
function memberRollup(tenantId: string, cutoffs: readonly Date[], listIds?: string[]) {
  const [w6, w5, w4, w3, w2, w1, w0] = cutoffs as [Date, Date, Date, Date, Date, Date, Date];
  const unmailable = unmailableSubscribers(tenantId).as('unmailable');
  const conds = [eq(listMembers.tenantId, tenantId)];
  if (listIds) conds.push(inArray(listMembers.listId, listIds));
  return db
    .select({
      listId: listMembers.listId,
      memberCount: sql<number>`count(*)::int`.as('member_count'),
      activeMemberCount: sql<number>`count(*) filter (where ${unmailable.id} is null)::int`.as(
        'active_member_count',
      ),
      addedLast7: sql<number>`count(*) filter (where ${listMembers.addedAt} > ${w1})::int`.as(
        'added_last7',
      ),
      addedPrev7:
        sql<number>`count(*) filter (where ${listMembers.addedAt} > ${w2} and ${listMembers.addedAt} <= ${w1})::int`.as(
          'added_prev7',
        ),
      trend: sql<
        number[]
      >`array[${addedBy(w6)}, ${addedBy(w5)}, ${addedBy(w4)}, ${addedBy(w3)}, ${addedBy(w2)}, ${addedBy(w1)}, ${addedBy(w0)}]`.as(
        'trend',
      ),
    })
    .from(listMembers)
    .leftJoin(unmailable, eq(unmailable.id, listMembers.subscriberId))
    .where(and(...conds))
    .groupBy(listMembers.listId);
}

/**
 * Message outcomes across the campaigns that targeted each list.
 *
 * The join to `campaigns` carries its own tenant predicate. It is redundant
 * while every `campaigns.list_id` points inside its own workspace — and that is
 * the point: isolation is then enforced by the query rather than assumed from
 * the data.
 */
function engagementRollup(tenantId: string, listIds?: string[]) {
  const conds = [eq(messages.tenantId, tenantId), isNotNull(campaigns.listId)];
  if (listIds) conds.push(inArray(campaigns.listId, listIds));
  return db
    .select({
      listId: campaigns.listId,
      delivered:
        sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`.as(
          'delivered',
        ),
      trackedDelivered:
        sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`.as(
          'tracked_delivered',
        ),
      opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`.as('opened'),
    })
    .from(messages)
    .innerJoin(
      campaigns,
      and(eq(messages.campaignId, campaigns.id), eq(campaigns.tenantId, tenantId)),
    )
    .where(and(...conds))
    .groupBy(campaigns.listId);
}

/**
 * Distinct recipients who clicked, per list.
 *
 * Keyed on `message_events.campaign_id` — the column migration 0026 added —
 * rather than joining back through `messages`. That join is O(all tenant
 * events) however few lists are asked about, which is the exact shape 0026 was
 * written to remove; this path was still paying it.
 */
function clickRollup(tenantId: string, listIds?: string[]) {
  const conds = [
    eq(messageEvents.tenantId, tenantId),
    eq(messageEvents.eventType, 'click'),
    isNotNull(campaigns.listId),
  ];
  if (listIds) conds.push(inArray(campaigns.listId, listIds));
  return db
    .select({
      listId: campaigns.listId,
      clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`.as('clicked'),
    })
    .from(messageEvents)
    .innerJoin(
      campaigns,
      and(eq(messageEvents.campaignId, campaigns.id), eq(campaigns.tenantId, tenantId)),
    )
    .where(and(...conds))
    .groupBy(campaigns.listId);
}

/** Everything on a board row that is not a `lists` column. */
export type ListStats = Omit<ListWithCount, keyof ListRow>;

/** The zeros a list with no members and no sends renders as. */
function noListStats(): ListStats {
  return {
    memberCount: 0,
    activeMemberCount: 0,
    addedLast7: 0,
    addedPrev7: 0,
    trend: [0, 0, 0, 0, 0, 0, 0],
    delivered: 0,
    trackedDelivered: 0,
    opened: 0,
    clicked: 0,
  };
}

/** Every stat for a bounded set of lists — never for the whole workspace. */
async function statsForLists(tenantId: string, listIds: string[]): Promise<Map<string, ListStats>> {
  const out = new Map<string, ListStats>();
  if (listIds.length === 0) return out;

  // Three independent aggregates over three tables, so they overlap rather
  // than queue.
  const [members, outcomes, clicks] = await Promise.all([
    memberRollup(tenantId, weekCutoffs(), listIds),
    engagementRollup(tenantId, listIds),
    clickRollup(tenantId, listIds),
  ]);

  const take = (id: string): ListStats => {
    const cur = out.get(id) ?? noListStats();
    out.set(id, cur);
    return cur;
  };
  for (const m of members) {
    const row = take(m.listId);
    row.memberCount = Number(m.memberCount);
    row.activeMemberCount = Number(m.activeMemberCount);
    row.addedLast7 = Number(m.addedLast7);
    row.addedPrev7 = Number(m.addedPrev7);
    row.trend = m.trend.map(Number);
  }
  for (const o of outcomes) {
    if (!o.listId) continue;
    const row = take(o.listId);
    row.delivered = Number(o.delivered);
    row.trackedDelivered = Number(o.trackedDelivered);
    row.opened = Number(o.opened);
  }
  for (const c of clicks) {
    if (!c.listId) continue;
    take(c.listId).clicked = Number(c.clicked);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The Lists board's page
// ---------------------------------------------------------------------------

/** Columns the board offers as a sort. */
export const LIST_SORTS = ['updatedAt', 'name', 'subscribers', 'growthPct'] as const;
export type ListSort = (typeof LIST_SORTS)[number];

/**
 * Open/click rate bands, as four named slugs.
 *
 * The boundaries are the browser's, kept exactly — including its rounding. The
 * Lists screen prints `Math.round(hits / trackedDelivered * 100) + '%'` and then
 * buckets *that printed number*, so a list at 19.6% is shown as "20%" and
 * belongs in the 20–40 band. Bucketing the unrounded ratio here would file it
 * under "Under 20%" and disagree with the figure printed in the row.
 */
export const LIST_RATE_BUCKETS = ['none', 'low', 'mid', 'high'] as const;
export type ListRateBucket = (typeof LIST_RATE_BUCKETS)[number];

/**
 * Sorts and filters that read an aggregate rather than the `lists` row.
 *
 * Same cost model as the campaigns board. Ordering the workspace by member
 * count means counting every membership the tenant owns — there is no way to
 * know the tenth largest list without measuring them all. So the page is served
 * two ways: page `lists` first and roll up only the rows on screen (bounded by
 * the page, flat as `list_members` grows), or, when the caller asks for one of
 * these, roll up the whole workspace once and page that.
 *
 * The expensive shape is reached only by explicitly asking to order or filter
 * by an aggregate, which is inherently that question's cost. The board's
 * default view never pays it.
 */
const LIST_STAT_SORTS: ReadonlySet<ListSort> = new Set(['subscribers', 'growthPct']);

export interface ListPageOptions {
  /** Channel tab: lists declared for this channel. */
  channel?: Channel;
  /** Any-of tag filter. */
  tags?: string[];
  /** Token-prefix match on name, tags, and "gdpr" for consent lists. */
  q?: string;
  opens?: ListRateBucket[];
  clicks?: ListRateBucket[];
  sort?: ListSort;
  dir?: 'asc' | 'desc';
  limit?: number;
  /** Keyset resume point. Only meaningful with the default `updatedAt` sort. */
  after?: { at: string; id: string };
  /** Numbered jump to a page never walked to; sequential paging uses `after`. */
  offset?: number;
}

export interface ListPageRow extends ListWithCount {
  /** Feed back into a cursor to resume after this row. */
  cursorAt: string;
}

/**
 * The sort key as microsecond-precision text.
 *
 * `updated_at` is a microsecond timestamptz and a JS Date holds milliseconds,
 * so a cursor rebuilt from the parsed row would resume up to 999µs before the
 * row it names — descending, that silently re-serves every list sharing that
 * millisecond. Round-tripping the key as text keeps the resume point exact, and
 * `::timestamptz` on the way back in keeps the predicate index-friendly. (Same
 * reasoning, same shape as the campaigns board's and the roster's.)
 */
const listCursorAt = sql<string>`to_char(${lists.updatedAt} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/**
 * The list's searchable text, tokenised the way the browser tokenises it.
 *
 * `regexp_replace` collapses every non-alphanumeric run to a single space so
 * that `\m` (Postgres' start-of-word) falls where the browser's
 * `split(/[^a-z0-9]+/)` puts a boundary — otherwise `_` would be a word
 * character here and a separator there.
 */
const listHaystack = sql`regexp_replace(
    lower(
      ${lists.name}
      || ' ' || coalesce((select string_agg(t.value, ' ') from jsonb_array_elements_text(${lists.tags}) t), '')
      || case when ${lists.gdprConsent} then ' gdpr' else '' end
    ), '[^a-z0-9]+', ' ', 'g')`;

/** Everything that narrows the set, except the rate bands (see listRateCondition). */
function listConditions(tenantId: string, opts: ListPageOptions): SQL[] {
  const conds: SQL[] = [eq(lists.tenantId, tenantId)];
  if (opts.channel) {
    // Containment on the jsonb array, with the same empty-means-email default
    // the browser applied.
    conds.push(
      sql`coalesce(nullif(${lists.channels}, '[]'::jsonb), '["email"]'::jsonb) @> ${JSON.stringify([opts.channel])}::jsonb`,
    );
  }
  if (opts.tags?.length) {
    conds.push(
      sql`${lists.tags} ?| array[${sql.join(
        opts.tags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`,
    );
  }
  // Every token must start a word somewhere in the haystack: "art" matches
  // "artwork", "two" does not. Mirrors matchesSearchQuery, which the screen
  // uses in the browser and which a plain `like '%q%'` would contradict.
  for (const t of (opts.q ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)) {
    conds.push(sql`${listHaystack} ~ ${'\\m' + t}`);
  }
  if (opts.after) {
    // Row-value comparison: one index-friendly predicate, with the id breaking
    // ties so a page boundary can neither repeat nor skip a list.
    conds.push(
      opts.dir === 'asc'
        ? sql`(${lists.updatedAt}, ${lists.id}) > (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`
        : sql`(${lists.updatedAt}, ${lists.id}) < (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`,
    );
  }
  return conds;
}

/**
 * A rate band as an exact predicate over the rollup's counters.
 *
 * The `d > 0` guard is what makes the four bands a partition rather than four
 * overlapping predicates: a list with nothing delivered has no rate at all —
 * the browser prints "—" and buckets it as 0 — so it belongs in `none` whatever
 * `hits` says.
 */
function listRateCondition(hits: SQLWrapper, delivered: SQLWrapper, buckets: ListRateBucket[]): SQL {
  const pct = sql`(case when coalesce(${delivered}, 0) > 0
      then round(coalesce(${hits}, 0)::numeric * 100 / ${delivered})
      else 0 end)`;
  const per = (b: ListRateBucket): SQL => {
    switch (b) {
      case 'none':
        return sql`(${pct} = 0)`;
      case 'low':
        return sql`(${pct} > 0 and ${pct} < 20)`;
      case 'mid':
        return sql`(${pct} >= 20 and ${pct} < 40)`;
      case 'high':
        return sql`(${pct} >= 40)`;
    }
  };
  return sql`(${sql.join(buckets.map(per), sql` or `)})`;
}

/** Does this request have to measure the whole workspace to answer? */
function needsListRollup(opts: ListPageOptions, sort: ListSort): boolean {
  return LIST_STAT_SORTS.has(sort) || Boolean(opts.opens?.length) || Boolean(opts.clicks?.length);
}

function listOrderBy(sort: ListSort, dir: 'asc' | 'desc', stat?: Record<ListSort, SQL>) {
  const d = dir === 'asc' ? asc : desc;
  // `id` always trails. The perf workspace's lists share an `updated_at` to the
  // microsecond, and without a tiebreaker the row on a page boundary is free to
  // appear on both pages or neither — and two identical requests can return the
  // same rows in a different order.
  const tie = d(lists.id);
  if (sort === 'name') return [d(lists.name), tie];
  if (sort === 'updatedAt') return [d(lists.updatedAt), tie];
  return [d(stat![sort]), tie];
}

/** The whole-workspace rollups, joined once, for the stat-sort / rate-band path. */
function listRollupJoins(tenantId: string) {
  const ms = memberRollup(tenantId, weekCutoffs()).as('member_stats');
  const es = engagementRollup(tenantId).as('engagement_stats');
  const cs = clickRollup(tenantId).as('click_stats');
  const rateConds = (opts: ListPageOptions): SQL[] => {
    const out: SQL[] = [];
    if (opts.opens?.length) out.push(listRateCondition(es.opened, es.trackedDelivered, opts.opens));
    if (opts.clicks?.length)
      out.push(listRateCondition(cs.clicked, es.trackedDelivered, opts.clicks));
    return out;
  };
  return { ms, es, cs, rateConds };
}

/**
 * One page of the Lists board.
 *
 * Two plans, chosen by whether the caller sorts or filters on an aggregate (see
 * LIST_STAT_SORTS). The default plan pages `lists` — a small table, indexed by
 * tenant — and then rolls up `list_members`, `messages` and `message_events`
 * for only the ids on that page, so the cost of a page is set by the page and
 * not by the size of the workspace's membership.
 */
export async function listListsPage(
  tenantId: string,
  opts: ListPageOptions = {},
): Promise<ListPageRow[]> {
  const sort = opts.sort ?? 'updatedAt';
  const dir = opts.dir === 'asc' ? 'asc' : 'desc';
  // Ceiling is the page cap plus one: callers over-fetch by one to learn
  // whether another page exists.
  const limit = clamp(opts.limit ?? 12, 1, 101);
  const offset = opts.offset ?? 0;
  const conds = listConditions(tenantId, { ...opts, dir });

  if (!needsListRollup(opts, sort)) {
    const rows = await db
      .select({ list: lists, cursorAt: listCursorAt })
      .from(lists)
      .where(and(...conds))
      .orderBy(...listOrderBy(sort, dir))
      .limit(limit)
      .offset(offset);

    const stats = await statsForLists(
      tenantId,
      rows.map((r) => r.list.id),
    );
    return rows.map((r) => ({
      ...r.list,
      ...(stats.get(r.list.id) ?? noListStats()),
      cursorAt: r.cursorAt,
    }));
  }

  const { ms, es, cs, rateConds } = listRollupJoins(tenantId);
  const num = (v: SQLWrapper) => sql<number>`coalesce(${v}, 0)::int`;
  /* The browser's growth formula, exactly: percent change week over week, 100%
     when the previous week was empty and this one is not, 0 when both are. */
  const growth = sql`case
      when coalesce(${ms.addedPrev7}, 0) > 0
        then (coalesce(${ms.addedLast7}, 0) - ${ms.addedPrev7})::numeric * 100 / ${ms.addedPrev7}
      when coalesce(${ms.addedLast7}, 0) > 0 then 100
      else 0 end`;

  const rows = await db
    .select({
      list: lists,
      cursorAt: listCursorAt,
      memberCount: num(ms.memberCount),
      activeMemberCount: num(ms.activeMemberCount),
      addedLast7: num(ms.addedLast7),
      addedPrev7: num(ms.addedPrev7),
      trend: sql<number[]>`coalesce(${ms.trend}, array[0, 0, 0, 0, 0, 0, 0])`,
      delivered: num(es.delivered),
      trackedDelivered: num(es.trackedDelivered),
      opened: num(es.opened),
      clicked: num(cs.clicked),
    })
    .from(lists)
    // Left, not inner: a list with no members and no sends must still appear.
    .leftJoin(ms, eq(ms.listId, lists.id))
    .leftJoin(es, eq(es.listId, lists.id))
    .leftJoin(cs, eq(cs.listId, lists.id))
    .where(and(...conds, ...rateConds(opts)))
    .orderBy(
      ...listOrderBy(sort, dir, {
        updatedAt: sql`${lists.updatedAt}`,
        name: sql`${lists.name}`,
        subscribers: sql`coalesce(${ms.memberCount}, 0)`,
        growthPct: growth,
      }),
    )
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r.list,
    memberCount: Number(r.memberCount),
    activeMemberCount: Number(r.activeMemberCount),
    addedLast7: Number(r.addedLast7),
    addedPrev7: Number(r.addedPrev7),
    trend: r.trend.map(Number),
    delivered: Number(r.delivered),
    trackedDelivered: Number(r.trackedDelivered),
    opened: Number(r.opened),
    clicked: Number(r.clicked),
    cursorAt: r.cursorAt,
  }));
}

/**
 * How many lists match, ignoring pagination.
 *
 * Opt-in, for the pager. Only the rate BANDS need the rollup here, never the
 * sort: reordering a set cannot change its size, so asking `needsListRollup`
 * would make "sort by subscribers" aggregate every membership twice — once to
 * order the page and once to count it — for a number `lists` alone already
 * gives.
 */
export async function countLists(tenantId: string, opts: ListPageOptions = {}): Promise<number> {
  // `after` is a page boundary, not a filter — counting from it would report
  // "how many are left", which is not what the pager is asking.
  const conds = listConditions(tenantId, { ...opts, after: undefined });
  if (!opts.opens?.length && !opts.clicks?.length) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(lists)
      .where(and(...conds));
    return Number(row?.n ?? 0);
  }
  const { es, cs, rateConds } = listRollupJoins(tenantId);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lists)
    .leftJoin(es, eq(es.listId, lists.id))
    .leftJoin(cs, eq(cs.listId, lists.id))
    .where(and(...conds, ...rateConds(opts)));
  return Number(row?.n ?? 0);
}

export interface ListBoardFacets {
  /** Lists per channel — the tab counts. A list counts once per channel it declares. */
  byChannel: Record<string, number>;
  /** Every tag in the workspace, with how many lists carry it. */
  tags: Array<{ name: string; count: number }>;
}

/**
 * Tab counts and the tag menu, from `lists` alone.
 *
 * These describe the workspace, not the page in hand. Deriving them from the
 * fetched rows was right while the browser held every list; with the page
 * served server-side it would report twelve — the exact bug the campaigns
 * board's tabs had.
 *
 * No membership or message data is involved, so this stays a read of a small
 * table however large `list_members` gets.
 */
export async function listBoardFacets(tenantId: string): Promise<ListBoardFacets> {
  const [channelRows, tagRows] = await Promise.all([
    db
      .select({ channel: sql<string>`ch.value`, n: sql<number>`count(*)::int` })
      .from(lists)
      .innerJoin(
        sql`lateral jsonb_array_elements_text(coalesce(nullif(${lists.channels}, '[]'::jsonb), '["email"]'::jsonb)) ch`,
        sql`true`,
      )
      .where(eq(lists.tenantId, tenantId))
      .groupBy(sql`ch.value`),
    db
      .select({ name: sql<string>`t.value`, n: sql<number>`count(*)::int` })
      .from(lists)
      .innerJoin(sql`lateral jsonb_array_elements_text(${lists.tags}) t`, sql`true`)
      .where(eq(lists.tenantId, tenantId))
      .groupBy(sql`t.value`)
      .orderBy(sql`t.value`),
  ]);

  const byChannel: Record<string, number> = {};
  for (const r of channelRows) byChannel[r.channel] = Number(r.n);
  return { byChannel, tags: tagRows.map((r) => ({ name: r.name, count: Number(r.n) })) };
}

// ---------------------------------------------------------------------------
// One list, fully measured
// ---------------------------------------------------------------------------

/** Send outcomes for one list on one channel. */
export interface ListChannelTotals {
  channel: string;
  attempted: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

/** A list with every stat the detail page renders. */
export interface ListWithStats extends ListWithCount {
  /**
   * Outcomes across EVERY campaign that targeted this list, split by the
   * channel that carried them.
   *
   * Computed here rather than summed in the browser from the campaign strip:
   * that strip is a page, so summing it silently under-reports the delivery and
   * failure rates the moment a list has more campaigns than the page holds.
   */
  channelTotals: ListChannelTotals[];
  /**
   * `started_at` of the most recent campaign this list actually sent.
   *
   * Also SQL rather than a browser `max()` over the strip, and for a sharper
   * reason: the strip is ordered by `updated_at` while this is the largest
   * `started_at`, so the two disagree about which campaign is last as soon as
   * one is edited after it sends.
   */
  lastCampaignAt: Date | null;
}

/**
 * One list, one list's memberships, one list's campaigns.
 *
 * The detail page used to load `GET /v1/lists` — the whole workspace's triple
 * aggregate — and keep one row of it. That is the same anti-pattern
 * `getCampaign` removed from the campaigns drawer, left in place here.
 */
export async function getListWithStats(
  tenantId: string,
  id: string,
): Promise<ListWithStats | null> {
  const row = await getList(tenantId, id);
  if (!row) return null;

  const [stats, channelRows, lastRows, clicksByChannel] = await Promise.all([
    statsForLists(tenantId, [id]),
    /* Grouped by the CAMPAIGN's channel, which is what the detail page splits
       on: a campaign's messages all leave on the channel it was sent for. */
    db
      .select({
        channel: campaigns.channel,
        attempted: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
        opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
        failed: sql<number>`count(*) filter (where ${messages.status} in ('failed', 'cancelled', 'expired'))::int`,
      })
      .from(messages)
      .innerJoin(
        campaigns,
        and(eq(messages.campaignId, campaigns.id), eq(campaigns.tenantId, tenantId)),
      )
      .where(and(eq(messages.tenantId, tenantId), eq(campaigns.listId, id)))
      .groupBy(campaigns.channel),
    db
      .select({ at: sql<Date | null>`max(${campaigns.startedAt})` })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, tenantId),
          eq(campaigns.listId, id),
          eq(campaigns.status, 'sent'),
        ),
      ),
    db
      .select({
        channel: campaigns.channel,
        clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
      })
      .from(messageEvents)
      .innerJoin(
        campaigns,
        and(eq(messageEvents.campaignId, campaigns.id), eq(campaigns.tenantId, tenantId)),
      )
      .where(
        and(
          eq(messageEvents.tenantId, tenantId),
          eq(messageEvents.eventType, 'click'),
          eq(campaigns.listId, id),
        ),
      )
      .groupBy(campaigns.channel),
  ]);

  const clickBy = new Map(clicksByChannel.map((c) => [c.channel, Number(c.clicked)]));
  return {
    ...row,
    ...(stats.get(id) ?? noListStats()),
    channelTotals: channelRows.map((c) => ({
      channel: c.channel,
      attempted: Number(c.attempted),
      delivered: Number(c.delivered),
      opened: Number(c.opened),
      clicked: clickBy.get(c.channel) ?? 0,
      failed: Number(c.failed),
    })),
    lastCampaignAt: lastRows[0]?.at ?? null,
  };
}

/** A list as the campaign wizard's audience picker renders it. */
export interface ListAudienceOption {
  id: string;
  name: string;
  color: string | null;
  channels: string[] | null;
  memberCount: number;
  /** Members reachable on a phone channel (SMS / WhatsApp / voice). */
  phoneMemberCount: number;
}

/**
 * The audience picker's lists: name, colour, channels and the two reach counts.
 *
 * Its own query rather than the board's because the picker renders none of what
 * that endpoint is expensive for — no growth, no 7-point trend, no delivered /
 * opened / clicked. What the picker does need, and the board does not return,
 * is phone reach: it decides which lists may be offered at all on SMS, WhatsApp
 * and voice.
 *
 * That number used to be fetched with a `POST /v1/segments/preview` per list —
 * 1,005 round trips and 2,010 queries through a pool of ten on every load of
 * /dashboard/campaigns.
 *
 * Both counts come from ONE pass over `list_members`, which is the whole design
 * of this query: counting members and phone reach separately makes two scans of
 * the same two million rows, and each asks for parallel workers, so they
 * contend rather than overlap.
 *
 * NOTE, measured: the phone side is NOT a bounded join. Postgres executes
 * `with_phone` as a parallel sequential scan of every subscriber in the tenant
 * (1,000,229 rows read to yield 333,533 — no index supports `phone is not null
 * and phone <> ''`), and its row estimate is ~7x low, which resizes the parallel
 * hash. This endpoint is therefore still O(roster). It is called once per
 * /dashboard/campaigns load and is the slowest thing left on that page.
 */
export async function listAudienceOptions(tenantId: string): Promise<ListAudienceOption[]> {
  const withPhone = db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.tenantId, tenantId),
        isNotNull(subscribers.phone),
        ne(subscribers.phone, ''),
      ),
    )
    .as('with_phone');

  const reach = db
    .select({
      listId: listMembers.listId,
      memberCount: sql<number>`count(*)::int`.as('member_count'),
      // count(<nullable>) counts the non-null side of the left join, which is
      // exactly the members that matched a phone-having subscriber.
      phoneMemberCount: sql<number>`count(${withPhone.id})::int`.as('phone_member_count'),
    })
    .from(listMembers)
    .leftJoin(withPhone, eq(withPhone.id, listMembers.subscriberId))
    .where(eq(listMembers.tenantId, tenantId))
    .groupBy(listMembers.listId)
    .as('reach');

  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      color: lists.color,
      channels: lists.channels,
      memberCount: sql<number>`coalesce(${reach.memberCount}, 0)::int`,
      phoneMemberCount: sql<number>`coalesce(${reach.phoneMemberCount}, 0)::int`,
    })
    .from(lists)
    // Left, so a list with no members still appears (and is then hidden by the
    // picker's own zero-reach rule, rather than vanishing without explanation).
    .leftJoin(reach, eq(reach.listId, lists.id))
    .where(eq(lists.tenantId, tenantId))
    .orderBy(lists.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? null,
    channels: (r.channels as string[] | null) ?? null,
    memberCount: Number(r.memberCount),
    phoneMemberCount: Number(r.phoneMemberCount),
  }));
}

export async function updateList(
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    color?: string | null;
    tags?: string[];
    channels?: Channel[];
    notes?: string | null;
    gdprConsent?: boolean;
    doubleOptIn?: boolean;
    doubleOptOut?: boolean;
    doubleOptInTemplateId?: string | null;
    doubleOptOutTemplateId?: string | null;
    welcomeEmailTemplateId?: string | null;
    goodbyeEmailTemplateId?: string | null;
  },
): Promise<ListRow | null> {
  const channels = assertChannels(patch.channels);
  const rows = await db
    .update(lists)
    .set({ ...patch, ...(channels ? { channels } : {}), updatedAt: new Date() })
    .where(and(eq(lists.id, id), eq(lists.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteList(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(lists)
    .where(and(eq(lists.id, id), eq(lists.tenantId, tenantId)))
    .returning({ id: lists.id });
  return rows.length > 0;
}

export async function addToList(
  tenantId: string,
  listId: string,
  subscriberId: string,
): Promise<void> {
  await db.insert(listMembers).values({ listId, subscriberId, tenantId }).onConflictDoNothing();
}

export async function removeFromList(listId: string, subscriberId: string): Promise<void> {
  await db
    .delete(listMembers)
    .where(and(eq(listMembers.listId, listId), eq(listMembers.subscriberId, subscriberId)));
}

/** A list member: the subscriber plus when they joined this list. */
export type ListMember = Subscriber & { joinedAt: Date; lastCampaignAt: Date | null };

const lastMessageAt = sql`coalesce(${messages.readAt}, ${messages.deliveredAt}, ${messages.sentAt}, ${messages.submittedAt}, ${messages.createdAt})`;

export async function listMembersOf(
  tenantId: string,
  listId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ListMember[]> {
  const rows = await db
    .select({ ...getTableColumns(subscribers), joinedAt: listMembers.addedAt })
    .from(listMembers)
    .innerJoin(subscribers, eq(listMembers.subscriberId, subscribers.id))
    .where(and(eq(listMembers.listId, listId), eq(subscribers.tenantId, tenantId)))
    .orderBy(desc(subscribers.createdAt))
    .limit(clamp(opts.limit ?? 100, 1, 1000))
    .offset(Math.max(opts.offset ?? 0, 0));

  if (rows.length === 0) return [];

  const lastRows = await db
    .select({
      recipientId: messages.recipientId,
      at: sql<Date>`max(${lastMessageAt})`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        inArray(
          messages.recipientId,
          rows.map((r) => r.id),
        ),
        sql`${messages.campaignId} is not null`,
      ),
    )
    .groupBy(messages.recipientId);

  const lastById = new Map(lastRows.map((r) => [r.recipientId, r.at]));
  return rows.map((r) => ({ ...r, lastCampaignAt: lastById.get(r.id) ?? null }));
}
