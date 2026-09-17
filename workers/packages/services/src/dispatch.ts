import { and, eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, deadLetters, messageAttempts, messages } from '@maildrill/database';
import {
  jobNameForChannel,
  QUEUE_NAMES,
  sendMessageJobV1,
  type MessageState,
} from '@maildrill/domain';
import { tenantInfobipEntityId, tenantSesTenantName } from '@maildrill/identity';
import { getProvider } from '@maildrill/providers';
import { createLogger, metrics } from '@maildrill/observability';
import { tryCompleteCampaign } from './campaign-delivery';
import { bumpVersion } from './shared';

const log = createLogger({ component: 'dispatch' });

async function maybeCompleteCampaign(campaignId: string | null, tenantId: string): Promise<void> {
  if (!campaignId) return;
  try {
    await tryCompleteCampaign(campaignId, tenantId);
  } catch (err) {
    log.warn({ err, campaignId, tenantId }, 'campaign complete after dispatch failed');
  }
}

/** Thrown to hand a retryable failure back to BullMQ (backoff + attempts). */
export class DispatchRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DispatchRetryError';
  }
}

const ALREADY_SENT: ReadonlySet<MessageState> = new Set<MessageState>([
  'submitted',
  'sent',
  'delivered',
  'read',
]);

/**
 * Process a single dispatch job. Loads the authoritative message from Postgres,
 * verifies it is still eligible, calls the provider exactly once per generation,
 * records the attempt, and advances state. Retryable failures re-throw so BullMQ
 * retries with backoff; permanent failures land in `dead_letters`.
 */
export async function handleDispatch(raw: unknown): Promise<void> {
  const job = sendMessageJobV1.parse(raw);

  const rows = await db.select().from(messages).where(eq(messages.id, job.messageId)).limit(1);
  const message = rows[0];
  if (!message) {
    log.warn({ messageId: job.messageId }, 'dispatch: message not found');
    return;
  }

  // Eligibility / worker idempotency.
  if (message.generation !== job.generation) return; // stale generation
  if (message.status === 'cancelled' || message.status === 'expired') return;
  if (ALREADY_SENT.has(message.status)) return; // already submitted — never resend
  if (message.status !== 'queued' && message.status !== 'processing') return;

  // Claim the message (optimistic lock on version + generation).
  const now = new Date();
  const claimed = await db
    .update(messages)
    .set({
      status: 'processing',
      processingStartedAt: now,
      version: bumpVersion,
      updatedAt: now,
    })
    .where(
      and(
        eq(messages.id, message.id),
        eq(messages.version, message.version),
        eq(messages.generation, job.generation),
      ),
    )
    .returning({ id: messages.id });
  if (claimed.length === 0) return; // another worker won the claim

  const attemptNumber = message.attemptCount + 1;
  const provider = getProvider(message.provider);
  const startedAt = new Date();
  const result = await provider.send({
    messageId: message.id,
    tenantId: message.tenantId,
    channel: message.channel,
    to: message.toAddress,
    content: message.content,
    correlationId: job.correlationId,
    // Tag the send with the workspace's own CPaaS X entity (memoised; falls
    // back to the account-wide INFOBIP_ENTITY_ID when unset).
    entityId: (await tenantInfobipEntityId(message.tenantId)) ?? undefined,
    // SES-only: tag the send with the workspace's own SES Tenant for
    // per-workspace reputation isolation. Looked up only for SES sends —
    // every other provider ignores this field, so there is no reason to
    // spend the lookup on their behalf.
    sesTenantName:
      message.provider === 'ses'
        ? ((await tenantSesTenantName(message.tenantId)) ?? undefined)
        : undefined,
  });
  const completedAt = new Date();

  if (result.accepted) {
    await db.transaction(async (tx) => {
      await tx.insert(messageAttempts).values({
        messageId: message.id,
        tenantId: message.tenantId,
        provider: message.provider,
        channel: message.channel,
        attemptNumber,
        status: 'succeeded',
        providerRequestId: result.providerRequestId ?? null,
        providerResponseCode: 'accepted',
        requestStartedAt: startedAt,
        requestCompletedAt: completedAt,
      });
      await tx
        .update(messages)
        .set({
          status: 'submitted',
          submittedAt: completedAt,
          providerMessageId: result.providerMessageId ?? null,
          attemptCount: attemptNumber,
          lastErrorCode: null,
          lastErrorMessage: null,
          version: bumpVersion,
          updatedAt: completedAt,
        })
        .where(eq(messages.id, message.id));
    });
    metrics.inc('message_dispatch_total', {
      channel: message.channel,
      provider: message.provider,
    });
    metrics.inc('provider_request_total', { provider: message.provider });
    await maybeCompleteCampaign(message.campaignId, message.tenantId);
    return;
  }

  const err = result.error ?? {
    category: 'unknown' as const,
    message: 'provider rejected without error detail',
    retryable: true,
  };

  await db.insert(messageAttempts).values({
    messageId: message.id,
    tenantId: message.tenantId,
    provider: message.provider,
    channel: message.channel,
    attemptNumber,
    status: 'failed',
    providerRequestId: result.providerRequestId ?? null,
    providerErrorCode: err.code ?? null,
    errorCategory: err.category,
    requestStartedAt: startedAt,
    requestCompletedAt: completedAt,
  });
  metrics.inc('provider_error_total', {
    provider: message.provider,
    category: err.category,
  });

  if (err.retryable && attemptNumber < config.dispatch.maxAttempts) {
    await db
      .update(messages)
      .set({
        status: 'queued',
        attemptCount: attemptNumber,
        lastErrorCode: err.code ?? null,
        lastErrorMessage: err.message,
        version: bumpVersion,
        updatedAt: completedAt,
      })
      .where(eq(messages.id, message.id));
    throw new DispatchRetryError(err.message);
  }

  // Permanent, or attempts exhausted → fail + dead letter.
  await db.transaction(async (tx) => {
    await tx
      .update(messages)
      .set({
        status: 'failed',
        failedAt: completedAt,
        attemptCount: attemptNumber,
        lastErrorCode: err.code ?? null,
        lastErrorMessage: err.message,
        version: bumpVersion,
        updatedAt: completedAt,
      })
      .where(eq(messages.id, message.id));
    await tx.insert(deadLetters).values({
      tenantId: message.tenantId,
      messageId: message.id,
      queue: QUEUE_NAMES.dispatch,
      jobName: jobNameForChannel(message.channel),
      payload: { ...job },
      error: `${err.category}: ${err.message}`,
    });
  });
  metrics.inc('message_dispatch_failed_total', {
    channel: message.channel,
    provider: message.provider,
  });
  await maybeCompleteCampaign(message.campaignId, message.tenantId);
}
