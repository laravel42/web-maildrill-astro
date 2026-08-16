import { sql } from 'drizzle-orm';
import { db, type MessageRow, type Tx } from '@maildrill/database';
import type { MessageState } from '@maildrill/domain';

/**
 * Maintenance for `subscriber_engagement`, the per-subscriber rollup the
 * roster's open/click rate filter reads.
 *
 * Two ways in, and both are needed:
 *  - `applyEngagementDelta`, called from the delivery pipeline inside the
 *    transaction that moves a message's status, so the rollup is current the
 *    moment a webhook lands;
 *  - `reconcileSubscriberEngagement`, a batched recompute from `messages`,
 *    which backfills rows that predate the table and repairs whatever a dropped
 *    webhook or a crash between commit and retry left skewed.
 *
 * The bucket boundaries are NOT duplicated here. `engagement_bucket(hits,
 * tracked)` (migration 0025) owns them, and every writer calls it — three
 * hand-copied CASE expressions would be three chances to file a row under a
 * bucket its displayed rate contradicts.
 */

/** Only these channels can report an open or a click, so only they belong in the rate's denominator. */
const TRACKING_CHANNELS: readonly MessageRow['channel'][] = ['email', 'whatsapp'];

/** A message counts as delivered for rate purposes once it reaches either settled state. */
function isSettled(state: MessageState): boolean {
  return state === 'delivered' || state === 'read';
}

export interface EngagementDelta {
  delivered: number;
  trackedDelivered: number;
  opened: number;
  clicked: number;
}

const NO_DELTA: EngagementDelta = { delivered: 0, trackedDelivered: 0, opened: 0, clicked: 0 };

export function isEmptyDelta(d: EngagementDelta): boolean {
  return d.delivered === 0 && d.trackedDelivered === 0 && d.opened === 0 && d.clicked === 0;
}

/**
 * What one accepted status transition contributes to the rollup.
 *
 * Written as a difference rather than an increment because a message can reach
 * `read` without ever passing through `delivered` (Infobip's SEEN report often
 * arrives first), which still has to count as one delivery. Expressing it as
 * `after - before` gets that right without enumerating the transition table,
 * and stays correct if the state machine ever grows a regression.
 */
export function engagementDeltaFor(
  from: MessageState,
  to: MessageState,
  channel: MessageRow['channel'],
): EngagementDelta {
  const delivered = (isSettled(to) ? 1 : 0) - (isSettled(from) ? 1 : 0);
  const opened = (to === 'read' ? 1 : 0) - (from === 'read' ? 1 : 0);
  return {
    delivered,
    trackedDelivered: TRACKING_CHANNELS.includes(channel) ? delivered : 0,
    opened,
    clicked: 0,
  };
}

/** A click on a message the subscriber had never clicked before. */
export function engagementClickDelta(): EngagementDelta {
  return { ...NO_DELTA, clicked: 1 };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fold one delta into a subscriber's rollup, recomputing both bucket ordinals
 * in the same statement.
 *
 * INSERT … ON CONFLICT rather than UPDATE so the row materialises from
 * `subscribers` if it is missing — a subscriber created by a path that forgot
 * to seed one, or one that predates the backfill, still starts counting the
 * first time it is mailed instead of staying invisible to the filter forever.
 * The `select … from subscribers` is also what enforces tenancy: a
 * `recipient_id` naming another workspace's subscriber matches no row and
 * writes nothing.
 *
 * `recipientId` is `messages.recipient_id`, which is untyped text — anything
 * that is not a uuid is skipped rather than cast, because a `22P02` here would
 * roll back the delivery transaction that is only trying to record a status.
 */
export async function applyEngagementDelta(
  exec: Tx | typeof db,
  input: {
    tenantId: string;
    recipientId: string | null | undefined;
    delta: EngagementDelta;
  },
): Promise<void> {
  const { tenantId, recipientId, delta } = input;
  if (!recipientId || !UUID_RE.test(recipientId)) return;
  if (isEmptyDelta(delta)) return;

  await exec.execute(sql`
    insert into subscriber_engagement (
      subscriber_id, tenant_id, created_at,
      delivered, tracked_delivered, opened, clicked,
      opens_bucket, clicks_bucket, updated_at
    )
    select s.id, s.tenant_id, s.created_at,
           ${delta.delivered}::int, ${delta.trackedDelivered}::int,
           ${delta.opened}::int, ${delta.clicked}::int,
           engagement_bucket(${delta.opened}::int, ${delta.trackedDelivered}::int),
           engagement_bucket(${delta.clicked}::int, ${delta.trackedDelivered}::int),
           now()
      from subscribers s
     where s.id = ${recipientId}::uuid and s.tenant_id = ${tenantId}::uuid
    on conflict (subscriber_id) do update set
      delivered         = subscriber_engagement.delivered + excluded.delivered,
      tracked_delivered = subscriber_engagement.tracked_delivered + excluded.tracked_delivered,
      opened            = subscriber_engagement.opened + excluded.opened,
      clicked           = subscriber_engagement.clicked + excluded.clicked,
      opens_bucket      = engagement_bucket(
                            subscriber_engagement.opened + excluded.opened,
                            subscriber_engagement.tracked_delivered + excluded.tracked_delivered),
      clicks_bucket     = engagement_bucket(
                            subscriber_engagement.clicked + excluded.clicked,
                            subscriber_engagement.tracked_delivered + excluded.tracked_delivered),
      updated_at        = now()
  `);
}

/**
 * Seed a zero row for a brand-new subscriber.
 *
 * Without it a subscriber nobody has mailed yet has no rollup row at all, and
 * the `never` bucket — no send on a channel that reports opens, which is
 * supposed to describe exactly those people — would be the one bucket that
 * cannot find them. Cheap (one index probe) and idempotent, so import paths can
 * call it per row.
 */
export async function seedSubscriberEngagement(
  exec: Tx | typeof db,
  tenantId: string,
  subscriberId: string,
): Promise<void> {
  await exec.execute(sql`
    insert into subscriber_engagement (subscriber_id, tenant_id, created_at)
    select s.id, s.tenant_id, s.created_at
      from subscribers s
     where s.id = ${subscriberId}::uuid and s.tenant_id = ${tenantId}::uuid
    on conflict (subscriber_id) do nothing
  `);
}

/** The subscriber a message was addressed to, for the click path that changes no status. */
export async function recipientOf(exec: Tx | typeof db, messageId: string): Promise<string | null> {
  const rows = await exec.execute<{ recipient_id: string | null }>(sql`
    select recipient_id from messages where id = ${messageId}::uuid
  `);
  return rows.rows?.[0]?.recipient_id ?? null;
}

/** Has this message already been clicked? A second click must not count twice. */
export async function messageAlreadyClicked(exec: Tx | typeof db, messageId: string): Promise<boolean> {
  // `count(distinct message_id)` is what the rate is defined as, so only the
  // FIRST click event on a message moves the counter. Indexed by
  // message_events_message_idx.
  const rows = await exec.execute(sql`
    select 1 from message_events
     where message_id = ${messageId}::uuid and event_type = 'click'
     limit 1
  `);
  return rowCount(rows) > 0;
}

/** node-postgres returns `{ rows, rowCount }`; drizzle's execute passes it through. */
function rowCount(result: unknown): number {
  const r = result as { rowCount?: number | null; rows?: unknown[] } | undefined;
  if (typeof r?.rowCount === 'number') return r.rowCount;
  return r?.rows?.length ?? 0;
}

// ---- Backfill / reconcile -------------------------------------------------

export interface ReconcileOptions {
  /** Limit to one workspace. Omitted = every tenant. */
  tenantId?: string;
  /** Subscribers per batch. Each batch is its own transaction. */
  batchSize?: number;
  /** Stop after this many subscribers (0 = no cap). Lets an operator time-box a run. */
  maxSubscribers?: number;
  /** Resume point: process subscribers with an id strictly greater than this. */
  after?: string;
  /**
   * Only touch subscribers that have no rollup row yet (the backfill). False
   * recomputes every subscriber and rewrites the ones that disagree — the
   * nightly repair.
   */
  onlyMissing?: boolean;
  /** Called after each batch, for progress output. */
  onBatch?: (progress: { scanned: number; written: number; lastId: string }) => void;
}

export interface ReconcileResult {
  scanned: number;
  written: number;
  /** Last subscriber id processed — pass as `after` to resume. */
  lastId: string | null;
  /** True when the scan reached the end of the table rather than a cap. */
  complete: boolean;
  durationMs: number;
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_BATCH = 5_000;

/**
 * Recompute the rollup for a run of subscribers, in bounded batches.
 *
 * Keyset over `subscribers.id` rather than OFFSET so cost per batch is flat,
 * and one transaction per batch rather than one for the run: a million-row
 * backfill inside a single transaction holds locks and bloats for minutes and
 * cannot resume, which is exactly why this is a script and not part of
 * migration 0025.
 *
 * The counters come from a LATERAL per subscriber, which
 * `messages_recipient_idx` answers with an index scan. A single
 * `GROUP BY recipient_id` over all of `messages` is faster in total for a
 * cold full rebuild, but it is not resumable and it spills to disk (95MB at
 * 1M rows) — the batched shape is what makes a re-run after a crash cheap.
 */
export async function reconcileSubscriberEngagement(
  opts: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const started = Date.now();
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? DEFAULT_BATCH, 50_000));
  const cap = opts.maxSubscribers ?? 0;
  const tenantFilter = opts.tenantId
    ? sql`and s.tenant_id = ${opts.tenantId}::uuid`
    : sql``;
  const missingOnly = opts.onlyMissing
    ? sql`and not exists (select 1 from subscriber_engagement e where e.subscriber_id = s.id)`
    : sql``;

  let after = opts.after ?? ZERO_UUID;
  let scanned = 0;
  let written = 0;
  let complete = false;
  let lastId: string | null = null;

  for (;;) {
    const take = cap > 0 ? Math.min(batchSize, cap - scanned) : batchSize;
    if (take <= 0) break;

    const picked = await db.execute<{ id: string }>(sql`
      select s.id
        from subscribers s
       where s.id > ${after}::uuid ${tenantFilter} ${missingOnly}
       order by s.id
       limit ${take}
    `);
    const ids = (picked.rows ?? []).map((r) => r.id);
    if (ids.length === 0) {
      complete = true;
      break;
    }

    // sql.param, not a bare interpolation: drizzle expands a raw JS array into
    // a comma-separated record, which Postgres refuses to cast to uuid[].
    const idList = sql`${sql.param(ids)}::uuid[]`;
    const result = await db.execute(sql`
      insert into subscriber_engagement (
        subscriber_id, tenant_id, created_at,
        delivered, tracked_delivered, opened, clicked,
        opens_bucket, clicks_bucket, updated_at
      )
      select s.id, s.tenant_id, s.created_at,
             m.delivered, m.tracked, m.opened, m.clicked,
             engagement_bucket(m.opened, m.tracked),
             engagement_bucket(m.clicked, m.tracked),
             now()
        from subscribers s
        join lateral (
          select
            count(*) filter (where mm.status in ('delivered','read'))::int as delivered,
            count(*) filter (where mm.status in ('delivered','read')
                               and mm.channel in ('email','whatsapp'))::int as tracked,
            count(*) filter (where mm.status = 'read')::int as opened,
            -- "messages with at least one click" is the same number as
            -- count(distinct message_id) over click events, and it reads the
            -- events index once per message instead of building a distinct set.
            count(*) filter (where exists (
              select 1 from message_events me
               where me.message_id = mm.id and me.event_type = 'click'
            ))::int as clicked
          from messages mm
         where mm.recipient_id = s.id::text
        ) m on true
       where s.id = any(${idList})
      on conflict (subscriber_id) do update set
        delivered         = excluded.delivered,
        tracked_delivered = excluded.tracked_delivered,
        opened            = excluded.opened,
        clicked           = excluded.clicked,
        opens_bucket      = excluded.opens_bucket,
        clicks_bucket     = excluded.clicks_bucket,
        updated_at        = now()
      -- Rewrite only what actually drifted. A no-op UPDATE still writes a new
      -- row version and dirties two index entries; on a nightly pass over a
      -- million unchanged subscribers that is the whole cost of the job.
      where subscriber_engagement.delivered is distinct from excluded.delivered
         or subscriber_engagement.tracked_delivered is distinct from excluded.tracked_delivered
         or subscriber_engagement.opened is distinct from excluded.opened
         or subscriber_engagement.clicked is distinct from excluded.clicked
    `);

    scanned += ids.length;
    written += rowCount(result);
    lastId = ids[ids.length - 1]!;
    after = lastId;
    opts.onBatch?.({ scanned, written, lastId });

    if (ids.length < take) {
      complete = true;
      break;
    }
  }

  return { scanned, written, lastId, complete, durationMs: Date.now() - started };
}
