import { and, asc, eq, lte } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, outboxEvents } from '@maildrill/database';
import {
  dispatchJobId,
  jobNameForChannel,
  QUEUE_NAMES,
  sendMessageJobV1,
  type SendMessageJobV1,
} from '@maildrill/domain';
import { enqueue } from '@maildrill/queues';
import { emitAppBatch, emitAppEvent, metrics } from '@maildrill/observability';

/**
 * Publish pending outbox rows to BullMQ. Safe to run concurrently: rows are
 * claimed with `FOR UPDATE SKIP LOCKED`. The dispatch job uses a deterministic
 * job id, so re-publishing the same row never causes a duplicate send.
 */
export async function publishOutbox(batchSize: number = config.outbox.batchSize): Promise<number> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.availableAt, now)))
      .orderBy(asc(outboxEvents.availableAt))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    let published = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const payload = sendMessageJobV1.parse({
          version: 1,
          ...(row.payload as Record<string, unknown>),
        }) satisfies SendMessageJobV1;

        await enqueue(QUEUE_NAMES.dispatch, jobNameForChannel(payload.channel), payload, {
          jobId: dispatchJobId(payload.tenantId, payload.messageId, payload.generation),
          attempts: config.dispatch.maxAttempts,
          backoffMs: config.dispatch.backoffMs,
        });

        await tx
          .update(outboxEvents)
          .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
          .where(eq(outboxEvents.id, row.id));
        metrics.inc('outbox_published_total');
        published += 1;
        emitAppEvent({
          name: 'outbox.published',
          payload: {
            outboxId: row.id,
            messageId: payload.messageId,
            channel: payload.channel,
            tenantId: payload.tenantId,
          },
          listeners: ['message-dispatch'],
        });
      } catch (err) {
        await tx
          .update(outboxEvents)
          .set({
            status: 'failed',
            attemptCount: row.attemptCount + 1,
            lastError: err instanceof Error ? err.message : String(err),
            updatedAt: new Date(),
          })
          .where(eq(outboxEvents.id, row.id));
        metrics.inc('outbox_publish_failed_total');
        failed += 1;
      }
    }

    if (rows.length > 0) {
      emitAppBatch({
        name: 'outbox-publish',
        totalJobs: rows.length,
        pendingJobs: 0,
        failedJobs: failed,
        completedJobs: published,
        data: { batchSize },
      });
    }

    return rows.length;
  });
}
