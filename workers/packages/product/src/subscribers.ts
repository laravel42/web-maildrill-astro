import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import {
  campaigns,
  db,
  listMembers,
  lists,
  messageEvents,
  messages,
  subscriberTags,
  subscribers,
  tags,
  type Subscriber,
} from '@maildrill/database';
import { addToList } from './lists';
import { clamp } from './rules';
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
  return rows[0]!;
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

export interface ListSubscribersOptions {
  limit?: number;
  offset?: number;
  status?: SubscriberStatus;
}

export async function listSubscribers(
  tenantId: string,
  opts: ListSubscribersOptions = {},
): Promise<Subscriber[]> {
  const conds = [eq(subscribers.tenantId, tenantId)];
  if (opts.status) conds.push(eq(subscribers.status, opts.status));
  return db
    .select()
    .from(subscribers)
    .where(and(...conds))
    .orderBy(desc(subscribers.createdAt))
    .limit(clamp(opts.limit ?? 50, 1, 200))
    .offset(Math.max(opts.offset ?? 0, 0));
}

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

  const [memberships, tagRows, outcomeRows, clickRows] = await Promise.all([
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
    db
      .select({
        recipientId: messages.recipientId,
        delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
        trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`,
        opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
      })
      .from(messages)
      .where(inArray(messages.recipientId, ids))
      .groupBy(messages.recipientId),
    db
      .select({
        recipientId: messages.recipientId,
        clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
      })
      .from(messageEvents)
      .innerJoin(messages, eq(messageEvents.messageId, messages.id))
      .where(and(inArray(messages.recipientId, ids), eq(messageEvents.eventType, 'click')))
      .groupBy(messages.recipientId),
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

  const outcomeBySub = new Map(outcomeRows.map((o) => [o.recipientId, o]));
  const clicksBySub = new Map(clickRows.map((c) => [c.recipientId, c]));

  return rows.map((r) => ({
    ...r,
    lists: listsBySub.get(r.id) ?? [],
    tagNames: tagsBySub.get(r.id) ?? [],
    delivered: Number(outcomeBySub.get(r.id)?.delivered ?? 0),
    trackedDelivered: Number(outcomeBySub.get(r.id)?.trackedDelivered ?? 0),
    opened: Number(outcomeBySub.get(r.id)?.opened ?? 0),
    clicked: Number(clicksBySub.get(r.id)?.clicked ?? 0),
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
