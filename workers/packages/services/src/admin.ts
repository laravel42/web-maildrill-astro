import { desc } from "drizzle-orm";
import { db, deadLetters, type DeadLetterRow } from "@maildrill/database";

export async function listDeadLetters(limit = 50): Promise<DeadLetterRow[]> {
  return db
    .select()
    .from(deadLetters)
    .orderBy(desc(deadLetters.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}
