import { and, eq } from 'drizzle-orm';
import { createLogger } from '@maildrill/observability';
import { metrics } from '@maildrill/observability';
import {
  db,
  paymentAttempts,
  stripeEvents,
  wallets,
  type PaymentAttemptRow,
  type Tx,
} from '@maildrill/database';
import { appendLedgerEntry } from './ledger';
import { centsToMicro } from './money';
import { getPaymentProvider } from './provider/registry';
import type { PaymentEvent } from './provider/types';

const log = createLogger({ component: 'billing-webhooks' });

/**
 * Payment webhook processing — the ONLY code path that can credit a wallet.
 *
 * Everything runs in one transaction per delivery:
 *   1. Verify the signature (caller passes the raw body untouched).
 *   2. Insert the event id into `stripe_events` — a conflict means this
 *      delivery was already processed, so it's skipped before any effect.
 *   3. Apply the financial effect. Ledger idempotency keys
 *      (`purchase:<attempt>`, `refund:<charge>`) are a second, independent
 *      dedupe layer: even two *different* provider events that would grant
 *      the same attempt (checkout.session.completed + payment_intent.succeeded)
 *      only credit once.
 *
 * Unexpected errors roll the whole transaction back (including the event
 * row) and bubble up as 5xx so the provider redelivers. Permanent
 * impossibilities (e.g. an attempt we've never heard of) mark the event
 * `skipped`/`failed` and return 2xx — redelivery can't fix those.
 */

export interface WebhookOutcome {
  eventId: string;
  eventType: string;
  outcome: 'processed' | 'duplicate' | 'skipped' | 'ignored';
  detail?: string;
}

export async function processPaymentWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<WebhookOutcome> {
  const provider = getPaymentProvider();
  const event = provider.parseWebhook(rawBody, signatureHeader); // throws WebhookVerificationError

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(stripeEvents)
      .values({
        provider: event.provider,
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.raw,
      })
      .onConflictDoNothing({ target: [stripeEvents.provider, stripeEvents.eventId] })
      .returning({ id: stripeEvents.id });
    if (!inserted) {
      metrics.inc('billing_webhook_total', { outcome: 'duplicate' });
      return { eventId: event.eventId, eventType: event.eventType, outcome: 'duplicate' as const };
    }

    const outcome = await applyPaymentEvent(tx, event);
    if (outcome.outcome !== 'processed') {
      await tx
        .update(stripeEvents)
        .set({ status: 'skipped', error: outcome.detail ?? outcome.outcome })
        .where(eq(stripeEvents.id, inserted.id));
    }
    metrics.inc('billing_webhook_total', { outcome: outcome.outcome });
    log.info(
      { eventId: event.eventId, eventType: event.eventType, outcome: outcome.outcome },
      'payment webhook processed',
    );
    return outcome;
  });
}

async function applyPaymentEvent(tx: Tx, event: PaymentEvent): Promise<WebhookOutcome> {
  const base = { eventId: event.eventId, eventType: event.eventType };
  switch (event.kind) {
    case 'checkout_completed':
    case 'payment_succeeded': {
      const attempt = await findAttempt(tx, event);
      if (!attempt) return { ...base, outcome: 'skipped', detail: 'no matching payment attempt' };
      await grantPurchase(tx, attempt, event);
      return { ...base, outcome: 'processed' };
    }
    case 'payment_failed': {
      const attempt = await findAttempt(tx, event);
      if (!attempt) return { ...base, outcome: 'skipped', detail: 'no matching payment attempt' };
      if (attempt.status === 'pending') {
        await tx
          .update(paymentAttempts)
          .set({
            status: 'failed',
            failureReason: event.failureReason ?? 'payment failed',
            providerPaymentIntentId: event.paymentIntentId ?? attempt.providerPaymentIntentId,
            updatedAt: new Date(),
          })
          .where(eq(paymentAttempts.id, attempt.id));
      }
      return { ...base, outcome: 'processed' };
    }
    case 'refund': {
      const attempt = await findAttempt(tx, event);
      if (!attempt) return { ...base, outcome: 'skipped', detail: 'no matching payment attempt' };
      await applyRefund(tx, attempt, event);
      return { ...base, outcome: 'processed' };
    }
    case 'invoice_paid':
    case 'invoice_failed':
      // Recorded in stripe_events for audit; invoices carry no wallet effect
      // (credits move on payment events).
      return { ...base, outcome: 'processed' };
    default:
      return { ...base, outcome: 'ignored', detail: `unhandled event type ${event.eventType}` };
  }
}

async function findAttempt(tx: Tx, event: PaymentEvent): Promise<PaymentAttemptRow | null> {
  if (event.attemptId) {
    const [byId] = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, event.attemptId));
    if (byId) return byId;
  }
  if (event.sessionId) {
    const [bySession] = await tx
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.provider, event.provider),
          eq(paymentAttempts.providerSessionId, event.sessionId),
        ),
      );
    if (bySession) return bySession;
  }
  if (event.paymentIntentId) {
    const [byIntent] = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.providerPaymentIntentId, event.paymentIntentId));
    if (byIntent) return byIntent;
  }
  return null;
}

async function grantPurchase(
  tx: Tx,
  attempt: PaymentAttemptRow,
  event: PaymentEvent,
): Promise<void> {
  const meta = attempt.metadata as {
    baseCreditsMicro?: number;
    bonusMicro?: number;
    grantsTierId?: string | null;
  };
  const bonusMicro = meta.bonusMicro ?? 0;
  const baseMicro = meta.baseCreditsMicro ?? attempt.creditsMicro - bonusMicro;

  // Purchase and bonus land as separate immutable entries so the audit trail
  // distinguishes paid credit from incentive credit. Both are keyed on the
  // attempt id — replays and sibling events no-op here.
  const purchase = await appendLedgerEntry(tx, {
    tenantId: attempt.tenantId,
    walletId: attempt.walletId,
    entryType: 'purchase',
    amountMicro: baseMicro,
    referenceType: 'payment_attempt',
    referenceId: attempt.id,
    idempotencyKey: `purchase:${attempt.id}`,
    description: `Credit purchase — ${attempt.packageCode}`,
    metadata: { packageCode: attempt.packageCode, amountCents: attempt.amountCents },
  });
  if (bonusMicro > 0) {
    await appendLedgerEntry(tx, {
      tenantId: attempt.tenantId,
      walletId: attempt.walletId,
      entryType: 'bonus',
      amountMicro: bonusMicro,
      referenceType: 'payment_attempt',
      referenceId: attempt.id,
      idempotencyKey: `bonus:${attempt.id}`,
      description: `Package bonus — ${attempt.packageCode}`,
    });
  }

  if (!purchase.duplicate && meta.grantsTierId) {
    // Buying a commitment package moves the workspace onto its tier.
    await tx
      .update(wallets)
      .set({ pricingTierId: meta.grantsTierId, updatedAt: new Date() })
      .where(eq(wallets.id, attempt.walletId));
  }

  if (attempt.status === 'pending' || attempt.status === 'failed') {
    await tx
      .update(paymentAttempts)
      .set({
        status: 'succeeded',
        providerPaymentIntentId: event.paymentIntentId ?? attempt.providerPaymentIntentId,
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));
  }
}

async function applyRefund(tx: Tx, attempt: PaymentAttemptRow, event: PaymentEvent): Promise<void> {
  const refundedCents = event.refundedCents ?? attempt.amountCents;
  // Claw back credits proportional to the refunded money, capped at what the
  // attempt granted. May legitimately push the balance negative if credits
  // were already spent — the ledger records reality.
  const proportion = attempt.amountCents > 0 ? refundedCents / attempt.amountCents : 1;
  const clawbackMicro = Math.min(
    Math.round(attempt.creditsMicro * proportion),
    attempt.creditsMicro,
  );
  if (clawbackMicro > 0) {
    await appendLedgerEntry(tx, {
      tenantId: attempt.tenantId,
      walletId: attempt.walletId,
      entryType: 'refund',
      amountMicro: -clawbackMicro,
      referenceType: 'payment_attempt',
      referenceId: attempt.id,
      idempotencyKey: `refund:${event.chargeId ?? attempt.id}`,
      description: `Refund — ${attempt.packageCode}`,
      metadata: { refundedCents, refundedMicro: centsToMicro(refundedCents) },
      allowNegativeBalance: true,
    });
  }
  await tx
    .update(paymentAttempts)
    .set({ status: 'refunded', updatedAt: new Date() })
    .where(eq(paymentAttempts.id, attempt.id));
}
