import { and, eq } from 'drizzle-orm';
import { db, subscribers, suppressions, type Tx } from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { createLogger, metrics } from '@maildrill/observability';

const log = createLogger({ component: 'suppression' });

/**
 * Closing the delivery feedback loop.
 *
 * `resolveAudience` already refuses to send to a suppressed address or a
 * non-active subscriber — but until this existed nothing ever *wrote* to that
 * list. A hard bounce landed as a failed message and was then forgotten, so the
 * same dead mailbox was mailed again on the next campaign, and a workspace's
 * bounce rate could only ever climb. Any rate-based gate on top of that would
 * have been a trap: a number the customer has no way to improve.
 *
 * So a permanent failure or a spam complaint now takes the address out of
 * circulation at both levels — the suppression list (address-level, survives
 * the subscriber being recreated) and the subscriber row (visible in the CRM,
 * which is where someone looks to understand why).
 */

/** Why an address stopped being mailable. Stored on the suppression row. */
export type SuppressionCause = 'hard_bounce' | 'complaint';

const STATUS_FOR_CAUSE = {
  hard_bounce: 'bounced',
  complaint: 'complained',
} as const;

export interface SuppressInput {
  tenantId: string;
  channel: Channel;
  /** The destination that failed — matched case-insensitively on re-send. */
  address: string;
  /** Subscriber id when the message was addressed to one; null for one-offs. */
  recipientId?: string | null;
  cause: SuppressionCause;
  /** Provider error name (e.g. EC_ABSENT_SUBSCRIBER), kept for support. */
  detail?: string | null;
}

/**
 * Suppress an address and mark its subscriber, idempotently.
 *
 * Never throws: this runs inside delivery bookkeeping, and losing a status
 * update must not lose the delivery outcome that triggered it. Failures are
 * logged and the caller carries on.
 */
export async function suppressAddress(input: SuppressInput, tx: Tx | typeof db = db): Promise<void> {
  const address = input.address.trim().toLowerCase();
  if (!address) return;

  try {
    await tx
      .insert(suppressions)
      .values({
        tenantId: input.tenantId,
        address,
        channel: input.channel,
        reason: input.detail ? `${input.cause}: ${input.detail}` : input.cause,
      })
      // Already suppressed — the first reason is the one that matters.
      .onConflictDoNothing();

    // The subscriber row is what the CRM shows. Match on id when the message
    // carried one, otherwise on the address, so one-off sends still land.
    const status = STATUS_FOR_CAUSE[input.cause];
    const where = input.recipientId
      ? and(eq(subscribers.tenantId, input.tenantId), eq(subscribers.id, input.recipientId))
      : and(eq(subscribers.tenantId, input.tenantId), eq(subscribers.email, address));
    await tx.update(subscribers).set({ status, updatedAt: new Date() }).where(where);

    metrics.inc('suppression_added_total', { cause: input.cause, channel: input.channel });
  } catch (err) {
    log.error(
      { err, tenantId: input.tenantId, channel: input.channel, cause: input.cause },
      'could not suppress address after delivery failure',
    );
  }
}
