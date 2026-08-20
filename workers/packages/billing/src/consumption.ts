import { config } from '@maildrill/config';
import { ConflictError, type Channel } from '@maildrill/domain';
import { createLogger, metrics } from '@maildrill/observability';
import { quoteTenantPrice } from './pricing-data';
import { commitReservedCredits, releaseReservation, reserveCredits } from './reservations';

const log = createLogger({ component: 'billing-consumption' });

/**
 * The send pipeline's billing facade. Every function here is a no-op unless
 * `BILLING_ENFORCEMENT=1`, so the messaging engine behaves exactly as before
 * until billing is switched on — and when it is on, the flow is:
 *
 *   reserveCampaignCredits (fan-out)  →  send  →  chargeMessageDelivered
 *   (per delivered/sent message, idempotent)  →  settleCampaignReservation
 *   (remainder back to the wallet when the campaign completes/fails).
 *
 * One-off messages skip the reservation and debit directly on delivery.
 */

export function billingEnforced(): boolean {
  return config.billing.enforcement;
}

/**
 * Hold the estimated cost of a campaign before any message row exists.
 * Throws `ConflictError('insufficient_credits')` when the wallet can't cover
 * it. Unpriced channels reserve nothing.
 */
export async function reserveCampaignCredits(
  tenantId: string,
  campaignId: string,
  channel: Channel,
  recipients: number,
): Promise<void> {
  if (!billingEnforced() || recipients <= 0) return;
  const quote = await quoteTenantPrice(tenantId, channel, recipients);
  if (!quote || quote.totalMicro <= 0) return;
  await reserveCredits({
    tenantId,
    amountMicro: quote.totalMicro,
    referenceType: 'campaign',
    referenceId: campaignId,
  });
  metrics.inc('billing_reserve_total', { channel });
}

/**
 * Charge one delivered/sent message. Keyed `consume:<messageId>` — retries,
 * duplicate DLRs, and the two outcome paths (webhook + poller) all collapse
 * to a single ledger entry. Never throws: a billing hiccup must not break
 * delivery bookkeeping (drift is caught by reconciliation instead).
 */
export async function chargeMessageDelivered(input: {
  tenantId: string;
  messageId: string;
  channel: Channel;
  campaignId?: string | null;
  units?: number;
}): Promise<void> {
  if (!billingEnforced()) return;
  try {
    const quote = await quoteTenantPrice(input.tenantId, input.channel, input.units ?? 1);
    if (!quote || quote.totalMicro <= 0) return;
    const { duplicate } = await commitReservedCredits({
      tenantId: input.tenantId,
      referenceType: 'campaign',
      referenceId: input.campaignId ?? input.messageId,
      amountMicro: quote.totalMicro,
      channel: input.channel,
      idempotencyKey: `consume:${input.messageId}`,
      messageId: input.messageId,
      description: `${input.channel} delivery`,
    });
    if (!duplicate) metrics.inc('billing_consume_total', { channel: input.channel });
  } catch (err) {
    // insufficient_credits on direct debit means the message already went out
    // (we only charge on delivery) — log loudly, never lose the delivery.
    if (err instanceof ConflictError) {
      log.error(
        { tenantId: input.tenantId, messageId: input.messageId },
        'delivered message could not be charged — wallet empty',
      );
    } else {
      log.error(
        { err, tenantId: input.tenantId, messageId: input.messageId },
        'billing charge failed',
      );
    }
  }
}

/** Return a campaign's unspent hold once it reaches a terminal state. */
export async function settleCampaignReservation(
  tenantId: string,
  campaignId: string,
): Promise<void> {
  if (!billingEnforced()) return;
  try {
    await releaseReservation(tenantId, 'campaign', campaignId);
  } catch (err) {
    log.error({ err, tenantId, campaignId }, 'reservation release failed');
  }
}
