import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { billingEnforced, expireStaleReservations } from '@maildrill/billing';
import { db, messages, webhookEvents } from '@maildrill/database';
import { bumpVersion, insertDispatchOutbox } from './shared';

/**
 * Billing backstop: sweep credit holds whose campaign never settled (crash
 * between send and completion) back into their wallets after the TTL.
 */
export async function expireStaleCreditHolds(): Promise<number> {
  if (!billingEnforced()) return 0;
  return expireStaleReservations();
}

/**
 * Requeue messages stuck in `processing` past a cutoff (e.g. a worker died
 * mid-send). Conservative and idempotent — the dispatch worker's own idempotency
 * check prevents a duplicate send if the original actually completed.
 */
export async function recoverStalledMessages(
  olderThanMs: number,
  batchSize = 100,
): Promise<number> {
  return db.transaction(async (tx) => {
    const cutoff = new Date(Date.now() - olderThanMs);
    const rows = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.status, 'processing'), lte(messages.processingStartedAt, cutoff)))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    for (const m of rows) {
      await tx
        .update(messages)
        .set({ status: 'queued', version: bumpVersion, updatedAt: new Date() })
        .where(eq(messages.id, m.id));
      await insertDispatchOutbox(tx, m, randomUUID());
    }
    return rows.length;
  });
}

/**
 * Safety net for missing delivery reports. A provider can accept a message
 * (submitted/sent) and then never send a terminal DLR — e.g. a WhatsApp/Voice
 * message that silently expires on the carrier side. Such a row stays "open"
 * forever and pins its campaign in "sending" (the dreaded stuck-at-90%). Once a
 * message has sat past the delivery TTL with no final DLR, mark it `expired` (a
 * campaign-complete terminal state) so completion can proceed. Keyed off
 * `submitted_at` (when the provider accepted it), not `updated_at`. No-op when
 * `olderThanMs <= 0`.
 */
export async function expireStalledDeliveries(olderThanMs: number): Promise<number> {
  if (olderThanMs <= 0) return 0;
  const cutoff = new Date(Date.now() - olderThanMs);
  const res = await db
    .update(messages)
    .set({ status: 'expired', version: bumpVersion, updatedAt: new Date() })
    .where(
      and(
        inArray(messages.status, ['submitted', 'sent']),
        lte(sql`coalesce(${messages.submittedAt}, ${messages.createdAt})`, cutoff),
      ),
    );
  return res.rowCount ?? 0;
}

/** Delete processed webhook rows older than the retention window. */
export async function purgeProcessedWebhooks(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const res = await db
    .delete(webhookEvents)
    .where(
      and(eq(webhookEvents.processingStatus, 'processed'), lte(webhookEvents.receivedAt, cutoff)),
    );
  return res.rowCount ?? 0;
}
