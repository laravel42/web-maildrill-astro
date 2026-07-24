import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, messages, type MessageRow } from "@maildrill/database";
import { bumpVersion, insertDispatchOutbox } from "./shared";

export interface RetryResult {
  message: MessageRow | null;
  retried: boolean;
}

/**
 * Retry a failed message under a new execution generation. History (attempts,
 * events) is preserved; a fresh generation means a new deterministic job id.
 */
export async function retryMessage(
  tenantId: string,
  messageId: string,
  correlationId?: string,
): Promise<RetryResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
      .limit(1);
    const m = rows[0];
    if (!m) return { message: null, retried: false };
    if (m.status !== "failed") return { message: m, retried: false };

    const upd = await tx
      .update(messages)
      .set({
        status: "queued",
        generation: m.generation + 1,
        queuedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        version: bumpVersion,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, m.id))
      .returning();
    const nm = upd[0]!;
    await insertDispatchOutbox(tx, nm, correlationId ?? randomUUID());
    return { message: nm, retried: true };
  });
}
