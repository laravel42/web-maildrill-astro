import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import {
  campaigns,
  db,
  listMembers,
  lists,
  messages,
  subscriberTags,
  subscribers,
  tags,
  type Subscriber,
} from "@maildrill/database";
import { clamp } from "./rules";

type SubscriberStatus = Subscriber["status"];

export interface UpsertSubscriberInput {
  tenantId: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  attributes?: Record<string, unknown>;
  status?: SubscriberStatus;
}

/** Create or update a subscriber, keyed by (tenant, lowercased email). */
export async function upsertSubscriber(
  input: UpsertSubscriberInput,
): Promise<Subscriber> {
  const email = input.email.trim().toLowerCase();
  const rows = await db
    .insert(subscribers)
    .values({
      tenantId: input.tenantId,
      email,
      phone: input.phone ?? null,
      name: input.name ?? null,
      attributes: input.attributes ?? {},
      status: input.status ?? "active",
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

export async function getSubscriber(
  tenantId: string,
  id: string,
): Promise<Subscriber | null> {
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

  const [memberships, tagRows] = await Promise.all([
    db
      .select({
        subscriberId: listMembers.subscriberId,
        id: lists.id,
        name: lists.name,
      })
      .from(listMembers)
      .innerJoin(lists, eq(lists.id, listMembers.listId))
      .where(inArray(listMembers.subscriberId, ids)),
    db
      .select({ subscriberId: subscriberTags.subscriberId, name: tags.name })
      .from(subscriberTags)
      .innerJoin(tags, eq(tags.id, subscriberTags.tagId))
      .where(inArray(subscriberTags.subscriberId, ids)),
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

  return rows.map((r) => ({
    ...r,
    lists: listsBySub.get(r.id) ?? [],
    tagNames: tagsBySub.get(r.id) ?? [],
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

/** Lists a subscriber belongs to, for the membership editor. */
export async function subscriberLists(
  tenantId: string,
  subscriberId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: lists.id, name: lists.name })
    .from(listMembers)
    .innerJoin(lists, eq(lists.id, listMembers.listId))
    .where(
      and(
        eq(listMembers.subscriberId, subscriberId),
        eq(listMembers.tenantId, tenantId),
      ),
    );
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
}
export interface SubscriberActivityEvent {
  id: string;
  channel: string;
  status: string;
  campaignName: string | null;
  /** ISO-8601 UTC timestamp. */
  at: string;
}
export interface SubscriberActivity {
  /** ISO-8601 UTC timestamp, or null when the subscriber has no messages. */
  lastActiveAt: string | null;
  channels: SubscriberChannelStat[];
  recent: SubscriberActivityEvent[];
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

  const [channelRows, lastRows, recentRows] = await Promise.all([
    db
      .select({
        channel: messages.channel,
        // Status-based so a message counts even when the pipeline skipped a
        // timestamp (e.g. delivered without a sent_at).
        sent: sql<number>`count(*) filter (where ${messages.status} in ('submitted','sent','delivered','read'))::int`,
        delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered','read'))::int`,
        read: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
      })
      .from(messages)
      .where(mine)
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
  ]);

  return {
    lastActiveAt: lastRows[0]?.at ?? null,
    channels: channelRows.map((r) => ({
      channel: r.channel,
      sent: Number(r.sent),
      delivered: Number(r.delivered),
      read: Number(r.read),
    })),
    recent: recentRows.map((r) => ({
      id: r.id,
      channel: r.channel,
      status: r.status,
      campaignName: r.campaignName ?? null,
      at: r.at,
    })),
  };
}
