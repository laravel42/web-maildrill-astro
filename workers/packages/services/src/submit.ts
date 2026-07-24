import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { config } from "@maildrill/config";
import { db, messages, type MessageRow } from "@maildrill/database";
import type { Channel } from "@maildrill/domain";
import { insertDispatchOutbox, isUniqueViolation } from "./shared";

export interface SubmitMessageInput {
  tenantId: string;
  channel: Channel;
  to: string;
  content?: Record<string, unknown>;
  provider?: string;
  recipientId?: string;
  campaignId?: string;
  scheduledAt?: Date | null;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface SubmitResult {
  message: MessageRow;
  deduplicated: boolean;
}

async function findByIdempotencyKey(
  tenantId: string,
  key: string,
): Promise<MessageRow | undefined> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.idempotencyKey, key)))
    .limit(1);
  return rows[0];
}

/**
 * Durably accept a message. The message row and its dispatch outbox row are
 * written in a single transaction (transactional outbox). Returns after the
 * commit — never after provider delivery. Idempotent on (tenant, key).
 */
export async function submitMessage(
  input: SubmitMessageInput,
): Promise<SubmitResult> {
  const provider = input.provider ?? config.provider.driver;
  const correlationId = input.correlationId ?? randomUUID();

  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(input.tenantId, input.idempotencyKey);
    if (existing) return { message: existing, deduplicated: true };
  }

  const scheduled =
    input.scheduledAt != null && input.scheduledAt.getTime() > Date.now();
  const status = scheduled ? "scheduled" : "queued";
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(messages)
        .values({
          tenantId: input.tenantId,
          campaignId: input.campaignId ?? null,
          recipientId: input.recipientId ?? null,
          toAddress: input.to,
          content: input.content ?? {},
          channel: input.channel,
          provider,
          status,
          scheduledAt: input.scheduledAt ?? null,
          queuedAt: scheduled ? null : now,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();
      const message = inserted[0]!;

      // Scheduled messages are activated later by the scheduler; only
      // immediate sends get an outbox row now.
      if (!scheduled) {
        await insertDispatchOutbox(tx, message, correlationId);
      }
      return { message, deduplicated: false };
    });
  } catch (err) {
    // Concurrent submit with the same idempotency key: return the winner.
    if (input.idempotencyKey && isUniqueViolation(err)) {
      const existing = await findByIdempotencyKey(input.tenantId, input.idempotencyKey);
      if (existing) return { message: existing, deduplicated: true };
    }
    throw err;
  }
}
