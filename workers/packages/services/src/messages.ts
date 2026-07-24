import { and, desc, eq, lt } from "drizzle-orm";
import {
  db,
  messageEvents,
  messages,
  type MessageEventRow,
  type MessageRow,
} from "@maildrill/database";

export async function getMessage(
  tenantId: string,
  messageId: string,
): Promise<MessageRow | null> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface ListEventsOptions {
  limit?: number;
  before?: Date;
}

export async function listMessageEvents(
  tenantId: string,
  messageId: string,
  opts: ListEventsOptions = {},
): Promise<MessageEventRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const conds = [
    eq(messageEvents.tenantId, tenantId),
    eq(messageEvents.messageId, messageId),
  ];
  if (opts.before) conds.push(lt(messageEvents.createdAt, opts.before));
  return db
    .select()
    .from(messageEvents)
    .where(and(...conds))
    .orderBy(desc(messageEvents.createdAt))
    .limit(limit);
}
