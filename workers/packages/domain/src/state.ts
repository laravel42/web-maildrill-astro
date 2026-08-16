export const MESSAGE_STATES = [
  'draft',
  'scheduled',
  'queued',
  'processing',
  'submitted',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
  'expired',
] as const;
export type MessageState = (typeof MESSAGE_STATES)[number];

export const TERMINAL_STATES = [
  'read',
  'failed',
  'cancelled',
  'expired',
] as const satisfies readonly MessageState[];

export type ProviderOutcome =
  'submitted' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled' | 'expired';

export function isTerminal(state: MessageState): boolean {
  return (TERMINAL_STATES as readonly MessageState[]).includes(state);
}

/**
 * Still waiting in/before the send queue — not yet handed off to the provider
 * (or permanently failed out of dispatch). Campaigns flip to `sent` once no
 * messages remain in these states.
 */
export const QUEUE_PENDING_STATES = [
  'draft',
  'scheduled',
  'queued',
  'processing',
] as const satisfies readonly MessageState[];

export function isCampaignDispatched(state: MessageState): boolean {
  return !(QUEUE_PENDING_STATES as readonly MessageState[]).includes(state);
}

/**
 * Message reached a terminal delivery outcome (DLR / engagement). Used for
 * analytics completeness — campaign status itself completes on dispatch.
 */
export const CAMPAIGN_COMPLETE_STATES = [
  'delivered',
  'read',
  'failed',
  'cancelled',
  'expired',
] as const satisfies readonly MessageState[];

export function isCampaignDeliveryComplete(state: MessageState): boolean {
  return (CAMPAIGN_COMPLETE_STATES as readonly MessageState[]).includes(state);
}

/**
 * THE definition of a delivery failure, for every counter the product renders.
 *
 * A message failed when the provider tried and the message never arrived:
 *   - `failed`  — rejected or undeliverable (Infobip UNDELIVERABLE / REJECTED)
 *   - `expired` — accepted, then abandoned when the TTL ran out (EXPIRED)
 *
 * `cancelled` is deliberately NOT here. Cancellation happens only from the
 * pre-dispatch states (`ALLOWED` below: draft/scheduled/queued/processing), so
 * nothing was ever attempted — the sender withdrew the send, or the in-flight
 * breaker stopped the queue draining into a bad list. Counting a withdrawal as
 * a bounce charges the recipient list for a decision the sender made.
 *
 * This is exactly the set `FAILED_STATUS_GROUPS` in posthog-stats maps to
 * (UNDELIVERABLE + REJECTED -> failed, EXPIRED -> expired), so the Postgres and
 * HogQL sources of the same chart now agree on what the word means.
 *
 * Every SQL counter reads this through `failedStatusesSql` in
 * @maildrill/product; no site spells the statuses out again.
 */
export const FAILED_DELIVERY_STATES = [
  'failed',
  'expired',
] as const satisfies readonly MessageState[];

export function isFailedDelivery(state: MessageState): boolean {
  return (FAILED_DELIVERY_STATES as readonly MessageState[]).includes(state);
}

/** Open message statuses still awaiting a final DLR (or still in the send queue). */
export const OPEN_DELIVERY_STATES = [
  'queued',
  'processing',
  'submitted',
  'sent',
] as const satisfies readonly MessageState[];

export function isOpenDeliveryState(state: MessageState): boolean {
  return (OPEN_DELIVERY_STATES as readonly MessageState[]).includes(state);
}

/** Map Infobip DLR `status.groupName` to our provider outcome. */
export function outcomeFromInfobipStatusGroup(groupName: string | undefined): ProviderOutcome {
  switch ((groupName ?? '').toUpperCase()) {
    case 'DELIVERED':
      return 'delivered';
    case 'PENDING':
      return 'submitted';
    case 'UNDELIVERABLE':
    case 'REJECTED':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    default:
      return 'sent';
  }
}

/** Explicit allow-list of forward transitions. Everything else is rejected. */
const ALLOWED: Record<MessageState, readonly MessageState[]> = {
  draft: ['scheduled', 'queued', 'cancelled'],
  scheduled: ['queued', 'cancelled', 'expired'],
  queued: ['processing', 'cancelled', 'expired'],
  processing: ['submitted', 'failed', 'cancelled'],
  // A provider can accept a message (submitted/sent) and only later report it as
  // EXPIRED — WhatsApp/Voice/SMS routinely expire post-acceptance when they can't
  // deliver within the message TTL. Without `expired` here that terminal DLR is
  // dropped and the row (and its campaign) hangs in "sending" forever.
  submitted: ['sent', 'delivered', 'read', 'failed', 'expired'],
  sent: ['delivered', 'read', 'failed', 'expired'],
  delivered: ['read'],
  read: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: MessageState, to: MessageState): boolean {
  return ALLOWED[from].includes(to);
}

export function allowedTransitions(from: MessageState): readonly MessageState[] {
  return ALLOWED[from];
}

/** Monotonic ordering for delivery/engagement signals (higher = more advanced). */
const DELIVERY_ORDER: Partial<Record<MessageState, number>> = {
  submitted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

export function isRegressiveDeliveryEvent(current: MessageState, candidate: MessageState): boolean {
  const c = DELIVERY_ORDER[current];
  const n = DELIVERY_ORDER[candidate];
  if (c === undefined || n === undefined) return false;
  return n <= c;
}

/**
 * Resolve the next message state for a provider-driven event, or `null` to ignore it.
 * Guards against late, duplicate, out-of-order, and regressive provider events:
 *  - never resurrects a hard-terminal state (read/cancelled/expired)
 *  - never regresses a positive delivery signal into `failed`
 *  - never moves backwards along submitted < sent < delivered < read
 */
export function resolveEventTransition(
  current: MessageState,
  outcome: ProviderOutcome,
): MessageState | null {
  if (current === 'read' || current === 'cancelled' || current === 'expired') {
    return null;
  }
  if (outcome === 'failed') {
    if (current === 'delivered' || current === 'sent') return null;
    return canTransition(current, 'failed') ? 'failed' : null;
  }
  if (outcome === 'cancelled' || outcome === 'expired') {
    return canTransition(current, outcome) ? outcome : null;
  }
  const target: MessageState = outcome;
  if (isRegressiveDeliveryEvent(current, target)) return null;
  return canTransition(current, target) ? target : null;
}
