import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, messages } from '@maildrill/database';
import { bumpVersion, insertDispatchOutbox } from './shared';

/**
 * Activate scheduled messages whose time has arrived. Claims rows with
 * SKIP LOCKED so multiple schedulers run safely, and inserts a dispatch outbox
 * row per message (never enqueues all recipients synchronously). Returns count.
 */
export async function activateDueMessages(
  batchSize: number = config.scheduler.batchSize,
): Promise<number> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.status, 'scheduled'), lte(messages.scheduledAt, now)))
      .orderBy(asc(messages.scheduledAt))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    for (const m of rows) {
      await tx
        .update(messages)
        .set({ status: 'queued', queuedAt: now, version: bumpVersion, updatedAt: now })
        .where(eq(messages.id, m.id));
      await insertDispatchOutbox(tx, m, randomUUID());
    }
    return rows.length;
  });
}
