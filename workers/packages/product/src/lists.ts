import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  db,
  listMembers,
  lists,
  subscribers,
  type ListRow,
  type Subscriber,
} from "@maildrill/database";
import { clamp } from "./rules";

export interface CreateListInput {
  tenantId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  tags?: string[];
  notes?: string | null;
}

export async function createList(input: CreateListInput): Promise<ListRow> {
  const rows = await db
    .insert(lists)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
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

/** A list plus how many subscribers are on it. */
export interface ListWithCount extends ListRow {
  memberCount: number;
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
    })
    .from(lists)
    .leftJoin(listMembers, eq(listMembers.listId, lists.id))
    .where(eq(lists.tenantId, tenantId))
    .groupBy(lists.id)
    .orderBy(desc(lists.createdAt));
  return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
}

export async function updateList(
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    color?: string | null;
    tags?: string[];
    notes?: string | null;
  },
): Promise<ListRow | null> {
  const rows = await db
    .update(lists)
    .set({ ...patch, updatedAt: new Date() })
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
  await db
    .insert(listMembers)
    .values({ listId, subscriberId, tenantId })
    .onConflictDoNothing();
}

export async function removeFromList(
  listId: string,
  subscriberId: string,
): Promise<void> {
  await db
    .delete(listMembers)
    .where(
      and(eq(listMembers.listId, listId), eq(listMembers.subscriberId, subscriberId)),
    );
}

export async function listMembersOf(
  tenantId: string,
  listId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Subscriber[]> {
  return db
    .select(getTableColumns(subscribers))
    .from(listMembers)
    .innerJoin(subscribers, eq(listMembers.subscriberId, subscribers.id))
    .where(and(eq(listMembers.listId, listId), eq(subscribers.tenantId, tenantId)))
    .orderBy(desc(subscribers.createdAt))
    .limit(clamp(opts.limit ?? 100, 1, 1000))
    .offset(Math.max(opts.offset ?? 0, 0));
}
