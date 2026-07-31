import { and, eq } from "drizzle-orm";
import {
  db,
  messageEvents,
  messages,
  usageRecords,
  webhookEvents,
  type MessageRow,
} from "@maildrill/database";
import {
  eventFingerprint,
  resolveEventTransition,
  type MessageState,
  type ProviderOutcome,
} from "@maildrill/domain";
import { getProvider, type NormalizedProviderEvent } from "@maildrill/providers";
import { createLogger, emitAppEvent, metrics } from "@maildrill/observability";
import { bumpVersion } from "./shared";
import { applyTemplateStatusEvent } from "./templates-approval";
import type { Tx } from "@maildrill/database";

const log = createLogger({ component: "events" });

async function locateMessage(
  tx: Tx,
  provider: string,
  ev: NormalizedProviderEvent,
): Promise<MessageRow | undefined> {
  if (ev.providerMessageId) {
    const rows = await tx
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.provider, provider),
          eq(messages.providerMessageId, ev.providerMessageId),
        ),
      )
      .limit(1);
    if (rows[0]) return rows[0];
  }
  return undefined;
}

async function applyEventState(
  tx: Tx,
  messageId: string,
  next: MessageState,
  at: Date,
  error?: { code?: string; message?: string },
): Promise<void> {
  const base = { status: next, version: bumpVersion, updatedAt: new Date() };
  const set = (extra: Record<string, unknown>) =>
    tx.update(messages).set({ ...base, ...extra }).where(eq(messages.id, messageId));
  switch (next) {
    case "sent":
      await set({ sentAt: at });
      break;
    case "delivered":
      await set({ deliveredAt: at });
      break;
    case "read":
      await set({ readAt: at });
      break;
    case "failed": {
      const code = error?.code?.trim() || null;
      const message = error?.message?.trim() || null;
      await set({
        failedAt: at,
        ...(code || message
          ? {
              lastErrorCode: code,
              lastErrorMessage:
                message && code && message !== code ? `${message} (${code})` : (message ?? code),
            }
          : {}),
      });
      break;
    }
    case "cancelled":
      await set({ cancelledAt: at });
      break;
    default:
      await set({});
  }
}

/**
 * Apply a provider delivery outcome to a message (PostHog poller path).
 * Dedupes on synthetic fingerprint `posthog:{messageId}:{statusGroup}`.
 * Returns true when the message status changed.
 */
export async function applyProviderOutcome(input: {
  messageId: string;
  tenantId: string;
  channel: MessageRow["channel"];
  provider: string;
  currentStatus: MessageState;
  outcome: ProviderOutcome;
  statusGroup: string;
  /** Infobip `error.name` from the DLR (e.g. EC_FREQUENCY_CAPPING). */
  errorCode?: string;
  /** Infobip `error.description` from the DLR. */
  errorMessage?: string;
  occurredAt?: Date;
}): Promise<boolean> {
  const at = input.occurredAt ?? new Date();
  const fingerprint = `posthog:${input.messageId}:${input.statusGroup.toUpperCase()}`;

  // Resolve the transition BEFORE consuming the dedupe fingerprint. Inserting
  // first would burn the fingerprint on a refused transition (stale snapshot
  // status, transient state-machine mismatch), permanently blocking the retry
  // and leaving the message — and its campaign — stuck open.
  const next = resolveEventTransition(input.currentStatus, input.outcome);
  if (!next || next === input.currentStatus) return false;

  return db.transaction(async (tx) => {
    // Record the synthetic event. A conflict means a previous attempt recorded
    // it but may not have applied the state — the transition guard above is the
    // real dedupe (once applied, `next === current` short-circuits), so apply
    // the state either way instead of treating the row as "already handled".
    await tx
      .insert(messageEvents)
      .values({
        messageId: input.messageId,
        tenantId: input.tenantId,
        provider: input.provider,
        providerEventId: null,
        eventFingerprint: fingerprint,
        eventType: "delivery_report",
        providerStatus: input.statusGroup,
        occurredAt: at,
        receivedAt: new Date(),
        processedAt: new Date(),
        payload: {
          source: "posthog_poller",
          status_group: input.statusGroup,
          outcome: input.outcome,
          ...(input.errorCode ? { error_name: input.errorCode } : {}),
          ...(input.errorMessage ? { error_description: input.errorMessage } : {}),
        },
      })
      .onConflictDoNothing({
        target: [messageEvents.provider, messageEvents.eventFingerprint],
      });

    await applyEventState(tx, input.messageId, next, at, {
      code: input.errorCode,
      message: input.errorMessage,
    });
    emitAppEvent({
      name: "message.status_changed",
      payload: {
        messageId: input.messageId,
        tenantId: input.tenantId,
        from: input.currentStatus,
        to: next,
        outcome: input.outcome,
        provider: input.provider,
      },
      listeners: ["usage", "stats"],
    });
    if (next === "delivered" || next === "sent") {
      await tx
        .insert(usageRecords)
        .values({
          tenantId: input.tenantId,
          messageId: input.messageId,
          channel: input.channel,
          provider: input.provider,
          usageType: "delivery",
        })
        .onConflictDoNothing({
          target: [usageRecords.messageId, usageRecords.usageType],
        });
    }
    return true;
  });
}

export type TrackingNotificationType =
  | "OPENED"
  | "CLICKED"
  | "UNSUBSCRIBED"
  | "COMPLAINED"
  | "LATE_BOUNCE";

/**
 * Apply an Infobip tracking notification (email open/click/unsub/complaint /
 * late bounce, or SMS/WA click) synced from PostHog. Returns true when a
 * message row or engagement event was newly recorded.
 */
export async function applyTrackingOutcome(input: {
  messageId: string;
  tenantId: string;
  channel: MessageRow["channel"];
  provider: string;
  currentStatus: MessageState;
  notificationType: TrackingNotificationType;
  url?: string;
  deviceType?: string;
  deviceName?: string;
  os?: string;
  /** Stable id from PostHog $insert_id / Infobip eventId for dedupe. */
  fingerprint: string;
  occurredAt?: Date;
}): Promise<boolean> {
  const at = input.occurredAt ?? new Date();
  const type = input.notificationType;
  const fingerprint = `posthog:track:${input.fingerprint}`;

  if (type === "OPENED") {
    const statusChanged = await applyProviderOutcome({
      messageId: input.messageId,
      tenantId: input.tenantId,
      channel: input.channel,
      provider: input.provider,
      currentStatus: input.currentStatus,
      outcome: "read",
      statusGroup: "OPENED",
      occurredAt: at,
    });
    // Separate open event keeps Infobip device metadata for report breakdowns.
    const openInserted = await db
      .insert(messageEvents)
      .values({
        messageId: input.messageId,
        tenantId: input.tenantId,
        provider: input.provider,
        providerEventId: null,
        eventFingerprint: fingerprint,
        eventType: "open",
        providerStatus: "OPENED",
        occurredAt: at,
        receivedAt: new Date(),
        processedAt: new Date(),
        payload: {
          source: "posthog_poller",
          notification_type: "OPENED",
          ...(input.deviceType ? { device_type: input.deviceType } : {}),
          ...(input.deviceName ? { device_name: input.deviceName } : {}),
          ...(input.os ? { os: input.os } : {}),
        },
      })
      .onConflictDoNothing({
        target: [messageEvents.provider, messageEvents.eventFingerprint],
      })
      .returning({ id: messageEvents.id });
    return statusChanged || openInserted.length > 0;
  }

  if (type === "LATE_BOUNCE") {
    return applyProviderOutcome({
      messageId: input.messageId,
      tenantId: input.tenantId,
      channel: input.channel,
      provider: input.provider,
      currentStatus: input.currentStatus,
      outcome: "failed",
      statusGroup: "LATE_BOUNCE",
      errorCode: "LATE_BOUNCE",
      errorMessage: "Late bounce after initial acceptance",
      occurredAt: at,
    });
  }

  const eventType =
    type === "CLICKED" ? "click" : type === "UNSUBSCRIBED" ? "unsubscribed" : "complaint";

  const inserted = await db.transaction(async (tx) => {
    const result = await tx
      .insert(messageEvents)
      .values({
        messageId: input.messageId,
        tenantId: input.tenantId,
        provider: input.provider,
        providerEventId: null,
        eventFingerprint: fingerprint,
        eventType,
        providerStatus: type,
        occurredAt: at,
        receivedAt: new Date(),
        processedAt: new Date(),
        payload: {
          source: "posthog_poller",
          notification_type: type,
          ...(input.url ? { url: input.url } : {}),
          ...(input.deviceType ? { device_type: input.deviceType } : {}),
          ...(input.deviceName ? { device_name: input.deviceName } : {}),
          ...(input.os ? { os: input.os } : {}),
        },
      })
      .onConflictDoNothing({
        target: [messageEvents.provider, messageEvents.eventFingerprint],
      })
      .returning({ id: messageEvents.id });

    // First click / open-like engagement also counts as a read when still delivered.
    if (type === "CLICKED" && result.length > 0) {
      const next = resolveEventTransition(input.currentStatus, "read");
      if (next && next !== input.currentStatus) {
        await applyEventState(tx, input.messageId, next, at);
      }
    }

    return result.length > 0;
  });

  return inserted;
}

/**
 * Process one persisted webhook: normalize it, correlate to a message, dedupe
 * on (provider, fingerprint), apply guarded state transitions, and write an
 * idempotent usage record. Late / duplicate / out-of-order events cannot
 * corrupt state (see resolveEventTransition + the message_events unique index).
 *
 */
export async function processWebhookEvent(webhookEventId: string): Promise<void> {
  const whRows = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, webhookEventId))
    .limit(1);
  const wh = whRows[0];
  if (!wh) {
    log.warn({ webhookEventId }, "webhook row not found");
    return;
  }
  if (wh.processingStatus === "processed") return;

  const provider = getProvider(wh.provider);

  // WhatsApp template-status webhooks aren't message-correlated: parse the
  // status change and apply it to the matching template row, then finish.
  if (wh.kind === "template") {
    const event = provider.normalizeTemplateWebhook?.({
      headers: wh.headers as Record<string, string | string[] | undefined>,
      body: wh.payload,
      rawBody: JSON.stringify(wh.payload),
      kind: "template",
    });
    if (event) {
      await applyTemplateStatusEvent(event);
    }
    await db
      .update(webhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, wh.id));
    metrics.inc("provider_webhook_total", { provider: wh.provider });
    return;
  }

  let normalized: NormalizedProviderEvent[];
  try {
    normalized = await provider.normalizeWebhook({
      headers: wh.headers as Record<string, string | string[] | undefined>,
      body: wh.payload,
      rawBody: JSON.stringify(wh.payload),
      kind: (wh.kind as "delivery" | "engagement" | "voice") ?? "delivery",
    });
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({
        processingStatus: "failed",
        processingError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(webhookEvents.id, wh.id));
    throw err;
  }

  await db.transaction(async (tx) => {
    for (const ev of normalized) {
      const message = await locateMessage(tx, wh.provider, ev);
      if (!message) continue; // retained but unmatched — not an error

      const fingerprint =
        ev.providerEventId ?? eventFingerprint(wh.provider, ev.fingerprintParts);

      const insertedEvent = await tx
        .insert(messageEvents)
        .values({
          messageId: message.id,
          tenantId: message.tenantId,
          provider: wh.provider,
          providerEventId: ev.providerEventId ?? null,
          eventFingerprint: fingerprint,
          eventType: ev.eventType,
          providerStatus: ev.providerStatus ?? null,
          occurredAt: ev.occurredAt ?? null,
          receivedAt: wh.receivedAt,
          processedAt: new Date(),
          payload: ev.raw,
        })
        .onConflictDoNothing({
          target: [messageEvents.provider, messageEvents.eventFingerprint],
        })
        .returning({ id: messageEvents.id });

      if (insertedEvent.length === 0) continue; // duplicate event — no state change

      const next = resolveEventTransition(message.status, ev.outcome);
      if (next && next !== message.status) {
        await applyEventState(tx, message.id, next, ev.occurredAt ?? new Date());
        emitAppEvent({
          name: "message.status_changed",
          payload: {
            messageId: message.id,
            tenantId: message.tenantId,
            from: message.status,
            to: next,
            outcome: ev.outcome,
            provider: wh.provider,
          },
          listeners: ["usage", "stats"],
        });
        if (next === "delivered" || next === "sent") {
          await tx
            .insert(usageRecords)
            .values({
              tenantId: message.tenantId,
              messageId: message.id,
              channel: message.channel,
              provider: message.provider,
              usageType: "delivery",
            })
            .onConflictDoNothing({
              target: [usageRecords.messageId, usageRecords.usageType],
            });
        }
      }
    }
    await tx
      .update(webhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, wh.id));
  });

  metrics.inc("provider_webhook_total", { provider: wh.provider });
  emitAppEvent({
    name: "webhook.processed",
    payload: {
      webhookEventId,
      provider: wh.provider,
      kind: wh.kind,
      events: normalized.length,
    },
    listeners: ["message-state"],
  });
}
