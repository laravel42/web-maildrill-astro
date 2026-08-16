import { and, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
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
  /** Name of the most recent sent campaign that targeted this list. */
  recentCampaign: string | null;
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
 * Lists with their member counts. The count is joined rather than stored so it
 * cannot drift, and it is what tells someone how many people a campaign will
 * reach before they send it.
 */
export async function listLists(tenantId: string): Promise<ListWithCount[]> {
  const rows = await db
    .select({
      ...getTableColumns(lists),
      memberCount: sql<number>`count(${listMembers.subscriberId})::int`,
      activeMemberCount: sql<number>`count(*) filter (where ${subscribers.status} = 'active')::int`,
    })
    .from(lists)
    .leftJoin(listMembers, eq(listMembers.listId, lists.id))
    .leftJoin(subscribers, eq(subscribers.id, listMembers.subscriberId))
    .where(eq(lists.tenantId, tenantId))
    .groupBy(lists.id)
    .orderBy(desc(lists.createdAt));

  /* Growth + trend from membership timestamps (small per-tenant volume). */
  const members = await db
    .select({ listId: listMembers.listId, addedAt: listMembers.addedAt })
    .from(listMembers)
    .where(eq(listMembers.tenantId, tenantId));
  const WEEK = 7 * 86_400_000;
  const now = Date.now();
  const byList = new Map<string, number[]>();
  for (const m of members) {
    const bucket = byList.get(m.listId) ?? [];
    bucket.push(m.addedAt.getTime());
    byList.set(m.listId, bucket);
  }

  /* Engagement across campaigns that targeted the list. */
  const outcomes = await db
    .select({
      listId: campaigns.listId,
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
      trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`,
      opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
    })
    .from(messages)
    .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
    .where(eq(messages.tenantId, tenantId))
    .groupBy(campaigns.listId);
  const clicks = await db
    .select({
      listId: campaigns.listId,
      clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
    .where(and(eq(messages.tenantId, tenantId), eq(messageEvents.eventType, 'click')))
    .groupBy(campaigns.listId);
  const outcomeByList = new Map(outcomes.filter((o) => o.listId).map((o) => [o.listId!, o]));
  const clicksByList = new Map(clicks.filter((c) => c.listId).map((c) => [c.listId!, c]));

  /* Most recent sent campaign per list. */
  const sent = await db
    .select({ listId: campaigns.listId, name: campaigns.name, startedAt: campaigns.startedAt })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.status, 'sent')))
    .orderBy(desc(campaigns.startedAt));
  const recentByList = new Map<string, string>();
  for (const c of sent) {
    if (c.listId && !recentByList.has(c.listId)) recentByList.set(c.listId, c.name);
  }

  return rows.map((r) => {
    const added = byList.get(r.id) ?? [];
    const trend = Array.from({ length: 7 }, (_, k) => {
      const cutoff = now - (6 - k) * WEEK;
      return added.filter((t) => t <= cutoff).length;
    });
    return {
      ...r,
      memberCount: Number(r.memberCount),
      activeMemberCount: Number(r.activeMemberCount),
      addedLast7: added.filter((t) => t > now - WEEK).length,
      addedPrev7: added.filter((t) => t > now - 2 * WEEK && t <= now - WEEK).length,
      trend,
      recentCampaign: recentByList.get(r.id) ?? null,
      delivered: Number(outcomeByList.get(r.id)?.delivered ?? 0),
      trackedDelivered: Number(outcomeByList.get(r.id)?.trackedDelivered ?? 0),
      opened: Number(outcomeByList.get(r.id)?.opened ?? 0),
      clicked: Number(clicksByList.get(r.id)?.clicked ?? 0),
    };
  });
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
