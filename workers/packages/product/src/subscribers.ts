import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import {
  campaigns,
  db,
  listMembers,
  lists,
  messageEvents,
  messages,
  subscriberEngagement,
  subscriberTags,
  subscribers,
  tags,
  type SegmentRule,
  type Subscriber,
} from '@maildrill/database';
import { seedSubscriberEngagement } from '@maildrill/services';
import { addToList } from './lists';
import { bucketOrdinals, type EngagementBucket } from './engagement';
import { buildSegmentWhere, clamp } from './rules';
import {
  invalidReasonLabel,
  validateEmailAddress,
  validateEmailAddresses,
  type EmailValidation,
} from './email-validation';

const WEEK_MS = 7 * 86_400_000;
const WEEKLY_POINTS = 12;

/** Monday 00:00 UTC of the ISO week containing `d`. */
function startOfIsoWeekUtc(d = new Date()): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** ISO week number (1–53) for a UTC date. */
function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Last `WEEKLY_POINTS` ISO weeks, oldest → newest. */
function lastIsoWeeks(): { start: Date; label: string }[] {
  const thisWeek = startOfIsoWeekUtc();
  return Array.from({ length: WEEKLY_POINTS }, (_, i) => {
    const start = new Date(thisWeek.getTime() - (WEEKLY_POINTS - 1 - i) * WEEK_MS);
    return { start, label: `W${isoWeekNumber(start)}` };
  });
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function bucketByWeek(timestamps: Date[], weeks: { start: Date }[]): number[] {
  return weeks.map((w, i) => {
    const end = i + 1 < weeks.length ? weeks[i + 1]!.start.getTime() : w.start.getTime() + WEEK_MS;
    const from = w.start.getTime();
    return timestamps.filter((t) => {
      const ms = t.getTime();
      return ms >= from && ms < end;
    }).length;
  });
}

type SubscriberStatus = Subscriber['status'];

export interface UpsertSubscriberInput {
  tenantId: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  attributes?: Record<string, unknown>;
  status?: SubscriberStatus;
}

/** Create or update a subscriber, keyed by (tenant, lowercased email). */
/**
 * Attributes recording why an address was rejected, so the `invalid` badge in
 * the CRM can explain itself instead of being an unexplained state.
 */
function invalidAttributes(result: EmailValidation): Record<string, unknown> {
  if (result.valid || !result.reason) return {};
  return {
    invalid_reason: result.reason,
    invalid_detail: invalidReasonLabel(result.reason, result.suggestion),
    ...(result.suggestion ? { did_you_mean: result.suggestion } : {}),
  };
}

export async function upsertSubscriber(input: UpsertSubscriberInput): Promise<Subscriber> {
  const email = input.email.trim().toLowerCase();
  // Validate at the point of entry unless the caller already decided a status
  // (a bulk import passing its own verdict, or an explicit unsubscribe/bounce).
  // Anything the local checks reject is stored as `invalid` — which
  // resolveAudience never sends to — rather than refused, so the row still
  // lands in the CRM with a reason attached.
  const checked = input.status ? null : await validateEmailAddress(email);
  const status: SubscriberStatus =
    input.status ?? (checked?.valid === false ? 'invalid' : 'active');
  const rows = await db
    .insert(subscribers)
    .values({
      tenantId: input.tenantId,
      email,
      phone: input.phone ?? null,
      name: input.name ?? null,
      attributes: {
        ...(input.attributes ?? {}),
        ...(checked ? invalidAttributes(checked) : {}),
      },
      status,
    })
    .onConflictDoUpdate({
      target: [subscribers.tenantId, subscribers.email],
      // Merge, don't clobber: keep prior name/phone when the new value is null,
      // deep-merge attributes (new keys win), and never resurrect status here.
      set: {
        name: sql`coalesce(excluded.name, ${subscribers.name})`,
        phone: sql`coalesce(excluded.phone, ${subscribers.phone})`,
        attributes: sql`${subscribers.attributes} || excluded.attributes`,
        updatedAt: new Date(),
      },
    })
    .returning();
  const row = rows[0]!;
  // Give every subscriber a rollup row the moment it exists, so the `never`
  // bucket — no send yet on a channel that reports opens, which is exactly the
  // people nobody has reached — can actually find them. Idempotent, so the
  // update half of this upsert just pays one index probe. The delivery pipeline
  // can materialise a missing row too, but only once someone is mailed, which
  // is too late for the bucket that means the opposite.
  await seedSubscriberEngagement(db, input.tenantId, row.id);
  return row;
}

export type ImportSubscriberRow = Omit<UpsertSubscriberInput, 'tenantId'>;

export interface ImportSubscribersResult {
  created: number;
  updated: number;
  failed: number;
  /** Per-row detail, capped — `failed` stays a complete count regardless. */
  errors: { index: number; email: string; error: string }[];
}

const IMPORT_ERRORS_CAP = 50;

/**
 * Bulk upsert for file imports. Rows share upsertSubscriber's merge semantics
 * (upsert by email, never clobber existing values with null); every imported
 * subscriber also joins `listIds`. A failing row is reported, not fatal — the
 * rest of the batch still lands.
 *
 * Created vs updated is judged against the emails present before the batch
 * ran, so re-importing the same file reports honestly instead of counting
 * every row as new.
 */
export async function importSubscribers(
  tenantId: string,
  rows: ImportSubscriberRow[],
  listIds: string[] = [],
): Promise<ImportSubscribersResult> {
  const emails = [...new Set(rows.map((r) => r.email.trim().toLowerCase()))];
  const existing = new Set(
    (
      await db
        .select({ email: subscribers.email })
        .from(subscribers)
        .where(and(eq(subscribers.tenantId, tenantId), inArray(subscribers.email, emails)))
    ).map((r) => r.email),
  );

  // Validate the whole batch up front: the MX lookup is the only slow part and
  // it is cached per domain, so one pass over a file of a few hundred domains
  // costs a few hundred DNS queries instead of one per row.
  const verdicts = await validateEmailAddresses(rows.map((r) => r.email));

  const result: ImportSubscribersResult = { created: 0, updated: 0, failed: 0, errors: [] };
  for (const [index, row] of rows.entries()) {
    try {
      const verdict = verdicts.get(row.email.trim().toLowerCase());
      // A file may carry its own status column; an explicit unsubscribe or
      // bounce from the source is respected over our verdict, but an address
      // the file calls active still has to pass validation.
      const status =
        row.status && row.status !== 'active'
          ? row.status
          : verdict?.valid === false
            ? ('invalid' as const)
            : ('active' as const);
      const sub = await upsertSubscriber({
        tenantId,
        ...row,
        status,
        attributes: {
          ...(row.attributes ?? {}),
          ...(verdict ? invalidAttributes(verdict) : {}),
        },
      });
      if (existing.has(sub.email)) {
        result.updated += 1;
      } else {
        result.created += 1;
        existing.add(sub.email);
      }
      for (const listId of listIds) await addToList(tenantId, listId, sub.id);
    } catch (e) {
      result.failed += 1;
      if (result.errors.length < IMPORT_ERRORS_CAP) {
        result.errors.push({
          index,
          email: row.email,
          error: e instanceof Error ? e.message : 'import_failed',
        });
      }
    }
  }
  return result;
}

export async function getSubscriber(tenantId: string, id: string): Promise<Subscriber | null> {
  const rows = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, id), eq(subscribers.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

/** A saved segment as the roster filter needs it: its stored rules and how they join. */
export interface SegmentFilter {
  rules: SegmentRule[];
  matchType: 'all' | 'any';
}

export interface ListSubscribersOptions {
  limit?: number;
  offset?: number;
  status?: SubscriberStatus;
  /** Free-text match on name or email, applied in SQL. */
  q?: string;
  /** Only subscribers addressable on this channel (email needs an address, the rest a phone). */
  channel?: 'email' | 'sms' | 'whatsapp' | 'voice';
  /** Only members of these lists (OR). */
  listIds?: string[];
  /** Only subscribers carrying one of these tag names (OR). */
  tagNames?: string[];
  /** Any of these statuses (OR). Supersedes `status` when both are given. */
  statuses?: SubscriberStatus[];
  /**
   * Saved segments to match against (OR), already resolved to their rules.
   *
   * Rows, not ids: `listConditions` is synchronous so the page query, the count
   * and the channel counts can all share it, and reading `segments` here would
   * make it async and infect all three. The route owns the lookup.
   */
  segments?: SegmentFilter[];
  /**
   * Open-rate buckets to match (OR), read from the `subscriber_engagement`
   * rollup rather than recomputed from `messages`.
   *
   * Buckets, not a rate range: the filter offers five discrete choices, and an
   * equality predicate is what lets one index answer both the bucket and the
   * roster's keyset order. See ./engagement.
   */
  opensBuckets?: EngagementBucket[];
  /** Click-rate buckets to match (OR). Same storage, same index shape. */
  clicksBuckets?: EngagementBucket[];
  sort?: 'name' | 'email' | 'status' | 'created';
  dir?: 'asc' | 'desc';
}

/**
 * Keyset page: rows strictly after `(at, id)` in `created_at, id` order.
 * Constant cost with depth — Postgres walks the composite index and stops at
 * LIMIT, instead of counting past N rows the way OFFSET does.
 *
 * `created_at` is the only key offered. `subscribers_tenant_created_id_idx`
 * covers it in both directions (a btree scans backwards for the ascending
 * case), while ordering by name/email/status under a tenant has no index at
 * all and would sort the whole million-row filtered set per page. The callers
 * that want those orders already re-sort the page they hold in the browser.
 */
export interface KeysetPageOptions extends Omit<ListSubscribersOptions, 'sort'> {
  /** Resume point: `at` is a `cursorAt` from the previous page, never a Date. */
  after?: { at: string; id: string };
  /**
   * Only for an explicit numbered jump to a page never walked to. Sequential
   * paging resumes from `after` and never pays the OFFSET cost.
   */
  offset?: number;
}

/**
 * The exact sort key, rendered in SQL as microsecond-precision text.
 *
 * `created_at` is a microsecond timestamptz but a JS Date only holds
 * milliseconds, so a cursor built from the parsed row would resume up to 999µs
 * *before* the row it names. Descending, that silently skips every row sharing
 * that millisecond (342 of them at one boundary in the 1M-row fixture);
 * ascending, it serves them twice. Round-tripping the key as text keeps the
 * resume point exact, and `::timestamptz` on the way back in keeps the
 * predicate index-friendly.
 */
const cursorAt = sql<string>`to_char(${subscribers.createdAt} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/**
 * The page's WHERE / ORDER BY / LIMIT, shared so the narrow and full selects
 * below can never drift into paginating differently.
 *
 * The ceiling is the page cap plus one, because callers fetch limit+1 to learn
 * whether another page exists.
 */
const MAX_KEYSET_ROWS = 101;

function keysetPlan(tenantId: string, opts: KeysetPageOptions) {
  const ascending = opts.dir === 'asc';
  const conds = listConditions(tenantId, opts);
  if (opts.after) {
    // Row-value comparison: one index-friendly predicate, and the id breaks
    // ties so a page boundary can never repeat or skip a row.
    conds.push(
      ascending
        ? sql`(${subscribers.createdAt}, ${subscribers.id}) > (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`
        : sql`(${subscribers.createdAt}, ${subscribers.id}) < (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`,
    );
  }
  return {
    where: and(...conds),
    order: ascending
      ? [asc(subscribers.createdAt), asc(subscribers.id)]
      : [desc(subscribers.createdAt), desc(subscribers.id)],
    limit: clamp(opts.limit ?? 10, 1, MAX_KEYSET_ROWS),
  };
}

/**
 * The same page as the CRM table needs it: whole rows plus memberships, tags
 * and engagement counters.
 *
 * `attributes` stays in this projection deliberately — the CSV export and the
 * profile's Location field read custom fields straight off it, so trimming it
 * here would blank those columns with no error anywhere to show for it.
 */
export async function listSubscribersKeysetWithRelations(
  tenantId: string,
  opts: KeysetPageOptions = {},
): Promise<SubscriberKeysetRow[]> {
  const plan = keysetPlan(tenantId, opts);
  const rows = await db
    .select({ ...getTableColumns(subscribers), cursorAt })
    .from(subscribers)
    .where(plan.where)
    .orderBy(...plan.order)
    .limit(plan.limit)
    // Set only for an explicit numbered jump to a page never walked to; the
    // sequential path resumes from a cursor and never pays this.
    .offset(Math.max(opts.offset ?? 0, 0));
  const enriched = await withRelations(rows);
  // withRelations is typed on Subscriber, so carry the key across explicitly
  // rather than leaning on the spread that happens to preserve it.
  return enriched.map((row, i) => ({ ...row, cursorAt: rows[i]!.cursorAt }));
}

/**
 * The status predicate on its own, or undefined when no status is selected.
 *
 * Split out because `subscriberChannelCounts` needs the filter set with the
 * status and the filter set without it in the SAME scan: the four channel tabs
 * have to honour it, and the status menu has to ignore it or every unselected
 * option reads zero.
 */
function statusCondition(
  opts: Pick<ListSubscribersOptions, 'status' | 'statuses'>,
): SQL | undefined {
  if (opts.statuses?.length) return inArray(subscribers.status, opts.statuses);
  if (opts.status) return eq(subscribers.status, opts.status);
  return undefined;
}

/**
 * Addressability on one channel, mirroring `addressForChannel` on the send
 * path: email needs an address, everything else needs a phone number.
 *
 * `email` is a real predicate rather than nothing. The column is NOT NULL but
 * it is `text`, so `''` is storable, and the channel-count aggregate has always
 * spelled it `email <> ''` — leaving the page filter empty meant the Email tab
 * could count a row the page then had to show under a filter that excludes it.
 * One expression, so the page, the count and the tab cannot disagree.
 */
function reachCondition(channel: NonNullable<ListSubscribersOptions['channel']>): SQL {
  return channel === 'email'
    ? sql`${subscribers.email} <> ''`
    : sql`${subscribers.phone} is not null and ${subscribers.phone} <> ''`;
}

/** Every filter the list endpoint understands, as SQL. */
function listConditions(tenantId: string, opts: ListSubscribersOptions) {
  const conds = [eq(subscribers.tenantId, tenantId)];
  const status = statusCondition(opts);
  if (status) conds.push(status);
  if (opts.q?.trim()) conds.push(searchCondition(opts.q));
  if (opts.channel) conds.push(reachCondition(opts.channel));
  if (opts.tagNames?.length) {
    // Matched by name because that is what the UI filters on; EXISTS keeps the
    // subscriber row single even when several of its tags match.
    //
    // The selection is bound as one array parameter, not interpolated. Both
    // this and the list filter below used to build the array literal by hand
    // with sql.raw — the tag branch hand-escaped quotes, and the list branch
    // did not escape at all, so it was one non-uuid id away from a caller
    // closing the literal and appending SQL. Route-level uuid validation was
    // the only thing standing in front of it, which puts the safety of a
    // shared filter builder in the hands of every future caller's schema.
    conds.push(
      sql`exists (
        select 1 from subscriber_tags st
        join tags tg on tg.id = st.tag_id
        where st.subscriber_id = ${subscribers.id} and tg.name = any(${sql.param(opts.tagNames)}::text[])
      )`,
    );
  }
  if (opts.listIds?.length) {
    // EXISTS rather than a join: it short-circuits on the first matching
    // membership and cannot duplicate the subscriber row.
    conds.push(
      sql`exists (select 1 from list_members lm where lm.subscriber_id = ${subscribers.id} and lm.list_id = any(${sql.param(opts.listIds)}::uuid[]))`,
    );
  }
  // Open/click rate buckets, read from the rollup rather than recomputed.
  //
  // EXISTS against `subscriber_engagement`, and that is the whole filter — the
  // planner picks its own driver from the two indexes available and gets both
  // ends of the distribution right without any help: for a bucket holding 140k
  // people it walks subscribers_tenant_created_id_idx and index-only-probes
  // subscriber_engagement_opens_idx, stopping at LIMIT (0.62ms, 263 buffers);
  // for one holding 33 it drives from that same index instead and top-N sorts
  // the handful it finds (0.38ms, 143 buffers). An empty bucket costs 0.13ms
  // and never touches `subscribers`. Computed on the fly from `messages`, the
  // same rare-bucket page was 1,122ms and 618,794 buffers.
  //
  // Cost is flat with depth, which is the point: the page at row 140,000 is
  // 0.59ms / 259 buffers against 0.62ms / 263 at row 1.
  if (opts.opensBuckets?.length) {
    conds.push(engagementBucketCondition(tenantId, 'opens_bucket', opts.opensBuckets));
  }
  if (opts.clicksBuckets?.length) {
    conds.push(engagementBucketCondition(tenantId, 'clicks_bucket', opts.clicksBuckets));
  }
  if (opts.segments?.length) {
    // A saved segment is a stored WHERE clause, so it belongs here rather than
    // in the browser: buildSegmentWhere emits a fragment scoped to a single
    // subscribers row (bare columns plus correlated EXISTS), which drops
    // straight into the page predicate — and therefore into the count and the
    // channel counts too, which is the whole reason a filter lives in this
    // function. Filtering the fetched page instead meant a segment matching a
    // third of the workspace emptied the table, because the page and the
    // segment's first 1000 rows are unrelated sets.
    //
    // COST, stated plainly, because this is the one filter here that is not
    // bounded. Unlike the rate buckets above — five fixed ordinals with an
    // index behind them — a segment's rules are whatever the user built, and
    // only some of them are indexable. `email`/`name contains` reaches 0024's
    // trigram GINs (rules.ts spells it `lower(col) like` for exactly that
    // reason: as `ilike` the same predicate was a 1,058ms full scan per page).
    // `phone exists` and `status` reach their own indexes. A rule on
    // `attributes ->>` has no index at all, so the keyset walk degenerates into
    // a scan of the whole tenant on EVERY page — measured at 26ms for a
    // selective attribute and 374-818ms for one matching nothing, per page, on
    // the 1M-row workspace. Bounding that needs an expression index per
    // attribute or a materialised membership table; neither exists yet, so the
    // roster offers it next to a filter engineered to cost 0.5ms and the two
    // are three orders of magnitude apart.
    const wheres = opts.segments.map((s) => buildSegmentWhere(s.rules, s.matchType));
    // Several selected segments read as a union, matching how the chips read.
    // buildSegmentWhere returns undefined for a rule-less segment, which
    // matches everyone: one of those in the selection has to widen the union to
    // everything, not silently narrow it to the segments that do have rules.
    if (wheres.every((w) => w !== undefined)) conds.push(or(...(wheres as SQL[]))!);
  }
  return conds;
}

/**
 * One bucket column against a selection of ordinals.
 *
 * The tenant predicate is restated on the rollup even though `subscriber_id`
 * already implies it through the foreign key: it is what lets the planner use
 * the leading column of subscriber_engagement_opens_idx, which is the
 * difference between an index-only scan of one bucket and a scan of every
 * tenant's. It is also what makes a mis-tenanted rollup row fail closed — the
 * EXISTS needs both `subscriber_id` (already tenant-restricted by the outer
 * query) and this, so a mismatch can only ever hide a row, never leak one.
 */
function engagementBucketCondition(
  tenantId: string,
  column: 'opens_bucket' | 'clicks_bucket',
  buckets: EngagementBucket[],
): SQL {
  // Distinct alias per column so selecting an opens bucket AND a clicks bucket
  // does not produce two subqueries named `e`.
  const alias = sql.raw(column === 'opens_bucket' ? 'eo' : 'ec');
  const col = sql.raw(column);
  return sql`exists (
    select 1 from subscriber_engagement ${alias}
     where ${alias}.subscriber_id = ${subscribers.id}
       and ${alias}.tenant_id = ${tenantId}::uuid
       and ${alias}.${col} = any(${sql.param(bucketOrdinals(buckets))}::smallint[])
  )`;
}

/**
 * How many subscribers match, ignoring pagination.
 *
 * Opt-in only on the keyset path: this is a full scan of the filtered set, so
 * a page must never pay for it unless the caller asked. The signature names
 * every filter `listConditions` actually applies — it previously claimed only
 * status/q while silently honouring channel and listId too.
 */
export async function countSubscribers(
  tenantId: string,
  opts: Pick<
    ListSubscribersOptions,
    | 'status'
    | 'statuses'
    | 'q'
    | 'channel'
    | 'listIds'
    | 'tagNames'
    | 'segments'
    | 'opensBuckets'
    | 'clicksBuckets'
  > = {},
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(subscribers)
    .where(and(...listConditions(tenantId, opts)));
  return Number(row?.n ?? 0);
}

/**
 * Per-channel reach counts for the table's tabs, in ONE scan.
 *
 * The tabs previously counted the rows the browser happened to hold, which was
 * the whole set at 200 rows and is 10 rows once paging moved server-side. Four
 * separate COUNTs would be four scans of a million rows; filtered aggregates
 * get all four from one, and email/phone presence is the same rule
 * `addressForChannel` uses on the send path.
 */
export async function subscriberChannelCounts(
  tenantId: string,
  opts: Pick<
    ListSubscribersOptions,
    | 'status'
    | 'statuses'
    | 'q'
    | 'channel'
    | 'listIds'
    | 'tagNames'
    | 'segments'
    | 'opensBuckets'
    | 'clicksBuckets'
  > = {},
): Promise<{
  email: number;
  sms: number;
  whatsapp: number;
  voice: number;
  byStatus: Record<string, number>;
}> {
  // Two filter sets out of one scan, because the tabs and the status menu need
  // different ones and neither is allowed to cost a second pass:
  //
  //  - The four channel tabs must honour EVERY filter, status included, or the
  //    tab and the footer describe different sets. They did: with Status=Active
  //    selected the Email tab read 1,000,229 against a footer of 920,211,
  //    because the destructure below stripped the status out of the whole
  //    select rather than out of the status counters alone.
  //  - The status menu must ignore the status filter, or a menu that counts
  //    only the status already selected reports every other option as zero.
  //  - The status menu must honour the CHANNEL, or the SMS tab's menu counts
  //    people with no phone number — describing the workspace under a heading
  //    that says otherwise.
  //
  // A selected segment stays in both, even one whose rules mention status: the
  // "don't zero your own options" rule protects the status *menu* from the
  // status *filter*. A segment is a saved audience the user chose, so the menu
  // should describe that audience.
  const { status: _s, statuses: _ss, channel, ...shared } = opts;
  const status = statusCondition(opts);
  // `and(x)` with one operand is just x; the `true` keeps the template legible
  // when a filter is absent and costs nothing — the planner folds it away.
  const st = status ?? sql`true`;
  const reach = channel ? reachCondition(channel) : sql`true`;
  const [row] = await db
    .select({
      email: sql<number>`count(*) filter (where ${subscribers.email} <> '' and ${st})::int`,
      phone: sql<number>`count(*) filter (where ${subscribers.phone} is not null and ${subscribers.phone} <> '' and ${st})::int`,
      active: sql<number>`count(*) filter (where ${subscribers.status} = 'active' and ${reach})::int`,
      unsubscribed: sql<number>`count(*) filter (where ${subscribers.status} = 'unsubscribed' and ${reach})::int`,
      bounced: sql<number>`count(*) filter (where ${subscribers.status} = 'bounced' and ${reach})::int`,
      complained: sql<number>`count(*) filter (where ${subscribers.status} = 'complained' and ${reach})::int`,
      invalid: sql<number>`count(*) filter (where ${subscribers.status} = 'invalid' and ${reach})::int`,
    })
    .from(subscribers)
    // Neither status nor channel in the base predicate: both are applied per
    // aggregate above, to the counters that should see them.
    .where(and(...listConditions(tenantId, shared)));
  const byStatus = {
    active: Number(row?.active ?? 0),
    unsubscribed: Number(row?.unsubscribed ?? 0),
    bounced: Number(row?.bounced ?? 0),
    complained: Number(row?.complained ?? 0),
    invalid: Number(row?.invalid ?? 0),
  };
  const email = Number(row?.email ?? 0);
  // SMS, WhatsApp and voice all address the same phone number, so one count
  // serves all three until per-channel opt-in exists.
  const phone = Number(row?.phone ?? 0);
  return { email, sms: phone, whatsapp: phone, voice: phone, byStatus };
}

/**
 * Name/email match, case-insensitive — the same search the table offers.
 *
 * `lower(col) like` rather than `col ilike` because migration 0024's trigram
 * GINs are built on `lower(email)` and `lower(coalesce(name,''))`; ilike cannot
 * use them.
 *
 * The needle's own LIKE metacharacters are escaped. `?q=%` is not a search, it
 * is "return the workspace" — 1,000,229 rows on the perf tenant — and it also
 * defeats the trigram index, so an unauthenticated-looking typo bought a full
 * scan. Escaped, it searches for a literal per-cent sign, which is what someone
 * typing one means.
 */
function searchCondition(q: string) {
  const like = `%${q
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`(lower(${subscribers.email}) like ${like} or lower(coalesce(${subscribers.name}, '')) like ${like})`;
}

export async function listSubscribers(
  tenantId: string,
  opts: ListSubscribersOptions = {},
): Promise<Subscriber[]> {
  const col =
    opts.sort === 'name'
      ? subscribers.name
      : opts.sort === 'email'
        ? subscribers.email
        : opts.sort === 'status'
          ? subscribers.status
          : subscribers.createdAt;
  const order = opts.dir === 'asc' ? asc(col) : desc(col);
  return (
    db
      .select()
      .from(subscribers)
      .where(and(...listConditions(tenantId, opts)))
      // A stable tiebreak keeps deep pages from repeating or skipping rows.
      .orderBy(order, desc(subscribers.id))
      .limit(clamp(opts.limit ?? 50, 1, 200))
      .offset(Math.max(opts.offset ?? 0, 0))
  );
}

/** A keyset page row: everything the table renders, plus its resume key. */
export type SubscriberKeysetRow = SubscriberWithRelations & { cursorAt: string };

/** A subscriber plus the lists and tags it actually belongs to. */
export interface SubscriberWithRelations extends Subscriber {
  lists: { id: string; name: string }[];
  tagNames: string[];
  /** Message outcomes for this recipient, for open/click rates. */
  delivered: number;
  /**
   * Deliveries on channels with engagement tracking (email, WhatsApp).
   * Open/click rates divide by this, not `delivered` — SMS and voice
   * deliveries can never produce an open, so counting them dilutes the rate.
   */
  trackedDelivered: number;
  opened: number;
  clicked: number;
}

/**
 * Attach list and tag memberships to a page of subscribers.
 *
 * Two extra queries scoped to the ids on the page, rather than a join that
 * would multiply rows or a per-subscriber lookup that would be N+1.
 */
async function withRelations(rows: Subscriber[]): Promise<SubscriberWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [memberships, tagRows, engagementRows] = await Promise.all([
    db
      .select({
        subscriberId: listMembers.subscriberId,
        id: lists.id,
        name: lists.name,
        addedAt: listMembers.addedAt,
      })
      .from(listMembers)
      .innerJoin(lists, eq(lists.id, listMembers.listId))
      .where(inArray(listMembers.subscriberId, ids))
      .orderBy(desc(listMembers.addedAt)),
    db
      .select({ subscriberId: subscriberTags.subscriberId, name: tags.name })
      .from(subscriberTags)
      .innerJoin(tags, eq(tags.id, subscriberTags.tagId))
      .where(inArray(subscriberTags.subscriberId, ids)),
    // Read the rollup, don't recompute. These four counters used to come from
    // two aggregates over `messages` keyed on `recipient_id`, which had no
    // index: every render of a ten-row page parallel-seq-scanned a million
    // messages (66ms, 32,080 buffers) to print two percentages. Ten primary-key
    // lookups now.
    //
    // It also makes the number on screen and the bucket the row was filtered
    // into come from the same place. Computing the display rate separately
    // meant a row could show "0%" while sitting in the 40%+ page, which is
    // exactly the disagreement this filter existed to remove.
    db
      .select({
        subscriberId: subscriberEngagement.subscriberId,
        delivered: subscriberEngagement.delivered,
        trackedDelivered: subscriberEngagement.trackedDelivered,
        opened: subscriberEngagement.opened,
        clicked: subscriberEngagement.clicked,
      })
      .from(subscriberEngagement)
      .where(inArray(subscriberEngagement.subscriberId, ids)),
  ]);

  const listsBySub = new Map<string, { id: string; name: string }[]>();
  for (const m of memberships) {
    const bucket = listsBySub.get(m.subscriberId) ?? [];
    bucket.push({ id: m.id, name: m.name });
    listsBySub.set(m.subscriberId, bucket);
  }
  const tagsBySub = new Map<string, string[]>();
  for (const t of tagRows) {
    const bucket = tagsBySub.get(t.subscriberId) ?? [];
    bucket.push(t.name);
    tagsBySub.set(t.subscriberId, bucket);
  }

  // A subscriber with no rollup row reads as zero engagement. That is the same
  // answer the old aggregate gave for someone who had never been mailed, and
  // the only other population it can describe is a row the backfill has not
  // reached yet.
  const engagementBySub = new Map(engagementRows.map((e) => [e.subscriberId, e]));

  return rows.map((r) => ({
    ...r,
    lists: listsBySub.get(r.id) ?? [],
    tagNames: tagsBySub.get(r.id) ?? [],
    delivered: Number(engagementBySub.get(r.id)?.delivered ?? 0),
    trackedDelivered: Number(engagementBySub.get(r.id)?.trackedDelivered ?? 0),
    opened: Number(engagementBySub.get(r.id)?.opened ?? 0),
    clicked: Number(engagementBySub.get(r.id)?.clicked ?? 0),
  }));
}

export async function listSubscribersWithRelations(
  tenantId: string,
  opts: ListSubscribersOptions = {},
): Promise<SubscriberWithRelations[]> {
  return withRelations(await listSubscribers(tenantId, opts));
}

export async function getSubscriberWithRelations(
  tenantId: string,
  id: string,
): Promise<SubscriberWithRelations | null> {
  const row = await getSubscriber(tenantId, id);
  if (!row) return null;
  return (await withRelations([row]))[0] ?? null;
}

/** Lists a subscriber belongs to, for the membership editor (newest first). */
export async function subscriberLists(
  tenantId: string,
  subscriberId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: lists.id, name: lists.name })
    .from(listMembers)
    .innerJoin(lists, eq(lists.id, listMembers.listId))
    .where(and(eq(listMembers.subscriberId, subscriberId), eq(listMembers.tenantId, tenantId)))
    .orderBy(desc(listMembers.addedAt));
}

export interface UpdateSubscriberInput {
  name?: string | null;
  phone?: string | null;
  status?: SubscriberStatus;
  attributes?: Record<string, unknown>;
}

export async function updateSubscriber(
  tenantId: string,
  id: string,
  patch: UpdateSubscriberInput,
): Promise<Subscriber | null> {
  const set: PgUpdateSetSource<typeof subscribers> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.phone !== undefined) set.phone = patch.phone;
  if (patch.status !== undefined) set.status = patch.status;
  // Shallow-merge attributes rather than replacing the whole blob, matching
  // upsertSubscriber. A PATCH that sends only { tags } must not delete every
  // other attribute the subscriber has — new keys win, untouched keys survive.
  if (patch.attributes !== undefined) {
    set.attributes = sql`${subscribers.attributes} || ${JSON.stringify(patch.attributes)}::jsonb`;
  }

  const rows = await db
    .update(subscribers)
    .set(set)
    .where(and(eq(subscribers.id, id), eq(subscribers.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}

export async function setSubscriberStatus(
  tenantId: string,
  id: string,
  status: SubscriberStatus,
): Promise<Subscriber | null> {
  return updateSubscriber(tenantId, id, { status });
}

export async function deleteSubscriber(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(subscribers)
    .where(and(eq(subscribers.id, id), eq(subscribers.tenantId, tenantId)))
    .returning({ id: subscribers.id });
  return rows.length > 0;
}

// ---- Engagement / activity ------------------------------------------------
//
// A subscriber's real message history, keyed off messages.recipient_id (the
// subscriber id set at send time). Powers the drawer's "Last active", per-channel
// engagement, and recent-activity timeline. Counters come from the delivery
// timestamps so a draft/scheduled row never reads as "sent".

export interface SubscriberChannelStat {
  channel: string;
  sent: number;
  delivered: number;
  read: number;
  /** Messages with at least one click event. */
  clicked: number;
  /** Permanently or temporarily undeliverable to this subscriber. */
  failed: number;
  /** Of those, the ones whose error was permanent — a hard bounce on email. */
  failedPermanent: number;
  /** Spam complaints. Only email reports these; every other channel stays 0. */
  complaints: number;
}
export interface SubscriberActivityEvent {
  id: string;
  channel: string;
  status: string;
  campaignName: string | null;
  /** ISO-8601 UTC timestamp. */
  at: string;
}
export interface SubscriberWeeklyPoint {
  /** ISO week label, e.g. "W31". */
  label: string;
  /** Monday 00:00 UTC of the week (ISO-8601). */
  weekStart: string;
  opens: number;
  clicks: number;
}

export interface SubscriberActivity {
  /** ISO-8601 UTC timestamp, or null when the subscriber has no messages. */
  lastActiveAt: string | null;
  channels: SubscriberChannelStat[];
  recent: SubscriberActivityEvent[];
  /** Opens/clicks per ISO week for the trailing 12 weeks (oldest → newest). */
  weekly: SubscriberWeeklyPoint[];
  /**
   * The same series split by channel, for the channel-filtered detail page.
   * Only email and WhatsApp appear — no other channel reports an open.
   */
  weeklyByChannel: Record<string, SubscriberWeeklyPoint[]>;
}

/** The latest known timestamp for a message row (read → delivered → sent → submitted → created). */
const messageAt = sql`coalesce(${messages.readAt}, ${messages.deliveredAt}, ${messages.sentAt}, ${messages.submittedAt}, ${messages.createdAt})`;
/** Same, formatted as an ISO-8601 UTC string so browsers parse it reliably. */
const isoFmt = sql.raw(`'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`);

export async function subscriberActivity(
  tenantId: string,
  subscriberId: string,
): Promise<SubscriberActivity> {
  const mine = and(eq(messages.tenantId, tenantId), eq(messages.recipientId, subscriberId));
  const weeks = lastIsoWeeks();
  const since = weeks[0]!.start;

  const [channelRows, clickRows, complaintRows, lastRows, recentRows, openTimes, clickTimes] =
    await Promise.all([
      db
        .select({
          channel: messages.channel,
          // Status-based so a message counts even when the pipeline skipped a
          // timestamp (e.g. delivered without a sent_at).
          sent: sql<number>`count(*) filter (where ${messages.status} in ('submitted','sent','delivered','read'))::int`,
          delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered','read'))::int`,
          read: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
          // Per-subscriber failures are the actionable signal on every channel:
          // they say this person's address or number is not reachable.
          failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
          // A permanent failure is the address itself being dead — a hard bounce
          // on email. A transient one (full mailbox, handset off) is not, and the
          // two call for different action, so the deliverability panel splits them.
          failedPermanent: sql<number>`count(*) filter (where ${messages.status} = 'failed' and ${messages.lastErrorPermanent} is true)::int`,
        })
        .from(messages)
        .where(mine)
        .groupBy(messages.channel),
      db
        .select({
          channel: messages.channel,
          clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
        })
        .from(messageEvents)
        .innerJoin(messages, eq(messageEvents.messageId, messages.id))
        .where(and(mine, eq(messageEvents.eventType, 'click')))
        .groupBy(messages.channel),
      db
        .select({
          channel: messages.channel,
          complaints: sql<number>`count(distinct ${messageEvents.messageId})::int`,
        })
        .from(messageEvents)
        .innerJoin(messages, eq(messageEvents.messageId, messages.id))
        .where(and(mine, eq(messageEvents.eventType, 'complaint')))
        .groupBy(messages.channel),
      db
        .select({
          at: sql<string | null>`to_char(max(${messageAt}) at time zone 'utc', ${isoFmt})`,
        })
        .from(messages)
        .where(mine),
      db
        .select({
          id: messages.id,
          channel: messages.channel,
          status: messages.status,
          campaignName: campaigns.name,
          at: sql<string>`to_char(${messageAt} at time zone 'utc', ${isoFmt})`,
        })
        .from(messages)
        .leftJoin(campaigns, eq(campaigns.id, messages.campaignId))
        .where(mine)
        .orderBy(desc(messageAt))
        .limit(10),
      db
        // Channel comes along so the weekly series can be split per channel —
        // the detail page filters by channel and must not credit an email open
        // to WhatsApp.
        .select({ at: messages.readAt, channel: messages.channel })
        .from(messages)
        .where(and(mine, isNotNull(messages.readAt), gte(messages.readAt, since))),
      db
        .select({
          at: sql<Date | null>`coalesce(${messageEvents.occurredAt}, ${messageEvents.createdAt})`,
          channel: messages.channel,
        })
        .from(messageEvents)
        .innerJoin(messages, eq(messageEvents.messageId, messages.id))
        .where(
          and(
            mine,
            eq(messageEvents.eventType, 'click'),
            sql`coalesce(${messageEvents.occurredAt}, ${messageEvents.createdAt}) >= ${since}`,
          ),
        ),
    ]);

  const tsFor = (rows: Array<{ at: unknown; channel?: string | null }>, channel?: string) =>
    rows
      .filter((r) => (channel ? r.channel === channel : true))
      .map((r) => asDate(r.at as never))
      .filter((t): t is Date => t != null);
  const opensByWeek = bucketByWeek(tsFor(openTimes), weeks);
  const clicksByWeek = bucketByWeek(tsFor(clickTimes), weeks);
  // Same buckets, one series per channel that can report engagement at all.
  const ENGAGEMENT_CHANNELS = ['email', 'whatsapp'] as const;
  const weeklyByChannel: Record<string, SubscriberWeeklyPoint[]> = {};
  for (const ch of ENGAGEMENT_CHANNELS) {
    const o = bucketByWeek(tsFor(openTimes, ch), weeks);
    const c = bucketByWeek(tsFor(clickTimes, ch), weeks);
    weeklyByChannel[ch] = weeks.map((w, i) => ({
      label: w.label,
      weekStart: w.start.toISOString(),
      opens: o[i] ?? 0,
      clicks: c[i] ?? 0,
    }));
  }

  return {
    lastActiveAt: lastRows[0]?.at ?? null,
    channels: channelRows.map((r) => ({
      channel: r.channel,
      sent: Number(r.sent),
      delivered: Number(r.delivered),
      read: Number(r.read),
      clicked: Number(clickRows.find((c) => c.channel === r.channel)?.clicked ?? 0),
      failed: Number(r.failed),
      failedPermanent: Number(r.failedPermanent),
      complaints: Number(complaintRows.find((c) => c.channel === r.channel)?.complaints ?? 0),
    })),
    recent: recentRows.map((r) => ({
      id: r.id,
      channel: r.channel,
      status: r.status,
      campaignName: r.campaignName ?? null,
      at: r.at,
    })),
    weeklyByChannel,
    weekly: weeks.map((w, i) => ({
      label: w.label,
      weekStart: w.start.toISOString(),
      opens: opensByWeek[i] ?? 0,
      clicks: clicksByWeek[i] ?? 0,
    })),
  };
}
