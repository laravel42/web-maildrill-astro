import { and, eq } from 'drizzle-orm';
import { db, messages, type MessageRow } from '@maildrill/database';
import { canTransition } from '@maildrill/domain';
import { bumpVersion } from './shared';

export interface CancelResult {
  message: MessageRow | null;
  cancelled: boolean;
}

/**
 * Cancel a message while it is still eligible (draft/scheduled/queued/processing).
 * Updates Postgres first; the dispatch worker re-checks status immediately before
 * the provider call, so an in-flight job will not send. Cancellation after
 * submission is not possible here (state machine rejects it).
 */
export async function cancelMessage(tenantId: string, messageId: string): Promise<CancelResult> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
    .limit(1);
  const m = rows[0];
  if (!m) return { message: null, cancelled: false };
  if (!canTransition(m.status, 'cancelled')) return { message: m, cancelled: false };

  const upd = await db
    .update(messages)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      version: bumpVersion,
      updatedAt: new Date(),
    })
    .where(and(eq(messages.id, m.id), eq(messages.version, m.version)))
    .returning();
  return { message: upd[0] ?? m, cancelled: upd.length > 0 };
}
