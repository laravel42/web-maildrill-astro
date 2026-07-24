import { and, desc, eq, getTableColumns } from "drizzle-orm";
import {
  db,
  subscriberTags,
  subscribers,
  tags,
  type Subscriber,
  type TagRow,
} from "@maildrill/database";

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
  return db
    .select()
    .from(tags)
    .where(eq(tags.tenantId, tenantId))
    .orderBy(desc(tags.createdAt));
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
  await db
    .insert(subscriberTags)
    .values({ tagId, subscriberId, tenantId })
    .onConflictDoNothing();
}

export async function unassignTag(tagId: string, subscriberId: string): Promise<void> {
  await db
    .delete(subscriberTags)
    .where(
      and(
        eq(subscriberTags.tagId, tagId),
        eq(subscriberTags.subscriberId, subscriberId),
      ),
    );
}

export async function subscribersWithTag(
  tenantId: string,
  tagId: string,
): Promise<Subscriber[]> {
  return db
    .select(getTableColumns(subscribers))
    .from(subscriberTags)
    .innerJoin(subscribers, eq(subscriberTags.subscriberId, subscribers.id))
    .where(and(eq(subscriberTags.tagId, tagId), eq(subscribers.tenantId, tenantId)));
}
