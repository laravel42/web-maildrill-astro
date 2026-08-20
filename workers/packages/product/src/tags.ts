import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import {
  db,
  subscriberTags,
  subscribers,
  tags,
  type Subscriber,
  type TagRow,
} from '@maildrill/database';
import {
  emitMaildrillEvent,
  eventDedupeKey,
  maildrillEventWanted,
  projectSubscriber,
  type MaildrillEventType,
} from '@maildrill/domain';

export async function createTag(
  tenantId: string,
  name: string,
  color?: string | null,
): Promise<TagRow> {
  const rows = await db
    .insert(tags)
    .values({ tenantId, name, color: color ?? null })
    .onConflictDoNothing({ target: [tags.tenantId, tags.name] })
    .returning();
  if (rows[0]) return rows[0];
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.tenantId, tenantId), eq(tags.name, name)))
    .limit(1);
  return existing[0]!;
}

export async function listTags(tenantId: string): Promise<TagRow[]> {
  return db.select().from(tags).where(eq(tags.tenantId, tenantId)).orderBy(desc(tags.createdAt));
}

export async function deleteTag(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.tenantId, tenantId)))
    .returning({ id: tags.id });
  return rows.length > 0;
}

export async function assignTag(
  tenantId: string,
  tagId: string,
  subscriberId: string,
): Promise<void> {
  const inserted = await db
    .insert(subscriberTags)
    .values({ tagId, subscriberId, tenantId })
    .onConflictDoNothing()
    .returning({ tagId: subscriberTags.tagId });
  // Re-applying a tag somebody already has is not "tag added"; a workflow keyed on it
  // would fire every time an importer re-tags its whole audience.
  if (inserted.length > 0) {
    await emitTagEvent('subscriber.tag.added', tenantId, tagId, subscriberId);
  }
}

export async function unassignTag(tagId: string, subscriberId: string): Promise<void> {
  const removed = await db
    .delete(subscriberTags)
    .where(and(eq(subscriberTags.tagId, tagId), eq(subscriberTags.subscriberId, subscriberId)))
    .returning({ tenantId: subscriberTags.tenantId });
  const tenantId = removed[0]?.tenantId;
  if (tenantId) await emitTagEvent('subscriber.tag.removed', tenantId, tagId, subscriberId);
}

/** Tag change → automation trigger. Loads nothing unless something is listening. */
async function emitTagEvent(
  type: Extract<MaildrillEventType, 'subscriber.tag.added' | 'subscriber.tag.removed'>,
  tenantId: string,
  tagId: string,
  subscriberId: string,
): Promise<void> {
  if (!maildrillEventWanted(type, tenantId)) return;
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, subscriberId), eq(subscribers.tenantId, tenantId)))
    .limit(1);
  if (!subscriber) return;
  const [tag] = await db
    .select({ name: tags.name })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.tenantId, tenantId)))
    .limit(1);

  await emitMaildrillEvent({
    type,
    tenantId,
    dedupeKey: eventDedupeKey(type, tenantId, tagId, subscriberId, Date.now()),
    data: {
      subscriber: projectSubscriber(subscriber),
      subscriberId,
      tagId,
      tagName: tag?.name,
    },
  });
}

export async function subscribersWithTag(tenantId: string, tagId: string): Promise<Subscriber[]> {
  return db
    .select(getTableColumns(subscribers))
    .from(subscriberTags)
    .innerJoin(subscribers, eq(subscriberTags.subscriberId, subscribers.id))
    .where(and(eq(subscriberTags.tagId, tagId), eq(subscribers.tenantId, tenantId)));
}
