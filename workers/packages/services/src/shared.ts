import { sql } from "drizzle-orm";
import { messages, outboxEvents, type MessageRow, type Tx } from "@maildrill/database";

/** `version = version + 1` guard used on every message mutation. */
export const bumpVersion = sql`${messages.version} + 1`;

/** True when a pg error is a unique-constraint violation (23505). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown } | null | undefined)?.code === "23505";
}

/**
 * Insert the transactional-outbox row that will become a dispatch job.
 * Called inside the same tx as the message insert/update (outbox pattern).
 */
export async function insertDispatchOutbox(
  tx: Tx,
  message: Pick<
    MessageRow,
    "id" | "tenantId" | "channel" | "provider" | "generation"
  >,
  correlationId: string,
): Promise<void> {
  await tx.insert(outboxEvents).values({
    tenantId: message.tenantId,
    aggregateType: "message",
    aggregateId: message.id,
    eventType: "message.dispatch",
    payload: {
      messageId: message.id,
      tenantId: message.tenantId,
      channel: message.channel,
      provider: message.provider,
      generation: message.generation,
      correlationId,
    },
    status: "pending",
    availableAt: new Date(),
  });
}
