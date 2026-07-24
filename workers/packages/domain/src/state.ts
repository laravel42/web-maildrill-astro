export const MESSAGE_STATES = [
  "draft",
  "scheduled",
  "queued",
  "processing",
  "submitted",
  "sent",
  "delivered",
  "read",
  "failed",
  "cancelled",
  "expired",
] as const;
export type MessageState = (typeof MESSAGE_STATES)[number];

export const TERMINAL_STATES = [
  "read",
  "failed",
  "cancelled",
  "expired",
] as const satisfies readonly MessageState[];

export type ProviderOutcome =
  | "submitted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  | "expired";

export function isTerminal(state: MessageState): boolean {
  return (TERMINAL_STATES as readonly MessageState[]).includes(state);
}

/**
 * Message finished for campaign completion / progress (delivered counts as done;
 * `read` is a further engagement state after delivery).
 */
export const CAMPAIGN_COMPLETE_STATES = [
  "delivered",
  "read",
  "failed",
  "cancelled",
  "expired",
] as const satisfies readonly MessageState[];

export function isCampaignDeliveryComplete(state: MessageState): boolean {
  return (CAMPAIGN_COMPLETE_STATES as readonly MessageState[]).includes(state);
}

/** Open message statuses still awaiting a final DLR (or dispatch). */
export const OPEN_DELIVERY_STATES = [
  "queued",
  "processing",
  "submitted",
  "sent",
] as const satisfies readonly MessageState[];

export function isOpenDeliveryState(state: MessageState): boolean {
  return (OPEN_DELIVERY_STATES as readonly MessageState[]).includes(state);
}

/** Map Infobip DLR `status.groupName` to our provider outcome. */
export function outcomeFromInfobipStatusGroup(
  groupName: string | undefined,
): ProviderOutcome {
  switch ((groupName ?? "").toUpperCase()) {
    case "DELIVERED":
      return "delivered";
    case "PENDING":
      return "submitted";
    case "UNDELIVERABLE":
    case "REJECTED":
      return "failed";
    case "EXPIRED":
      return "expired";
    default:
      return "sent";
  }
}

/** Explicit allow-list of forward transitions. Everything else is rejected. */
const ALLOWED: Record<MessageState, readonly MessageState[]> = {
  draft: ["scheduled", "queued", "cancelled"],
  scheduled: ["queued", "cancelled", "expired"],
  queued: ["processing", "cancelled", "expired"],
  processing: ["submitted", "failed", "cancelled"],
  // A provider can accept a message (submitted/sent) and only later report it as
  // EXPIRED — WhatsApp/Voice/SMS routinely expire post-acceptance when they can't
  // deliver within the message TTL. Without `expired` here that terminal DLR is
  // dropped and the row (and its campaign) hangs in "sending" forever.
  submitted: ["sent", "delivered", "read", "failed", "expired"],
  sent: ["delivered", "read", "failed", "expired"],
  delivered: ["read"],
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

export function isRegressiveDeliveryEvent(
  current: MessageState,
  candidate: MessageState,
): boolean {
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
  if (current === "read" || current === "cancelled" || current === "expired") {
    return null;
  }
  if (outcome === "failed") {
    if (current === "delivered" || current === "sent") return null;
    return canTransition(current, "failed") ? "failed" : null;
  }
  if (outcome === "cancelled" || outcome === "expired") {
    return canTransition(current, outcome) ? outcome : null;
  }
  const target: MessageState = outcome;
  if (isRegressiveDeliveryEvent(current, target)) return null;
  return canTransition(current, target) ? target : null;
}
