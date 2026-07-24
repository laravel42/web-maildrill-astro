import type { MessageRow } from "@maildrill/database";

export function messageSummary(m: MessageRow) {
  return {
    id: m.id,
    status: m.status,
    channel: m.channel,
    provider: m.provider,
    to: m.toAddress,
    recipientId: m.recipientId,
    campaignId: m.campaignId,
    providerMessageId: m.providerMessageId,
    attemptCount: m.attemptCount,
    generation: m.generation,
    scheduledAt: m.scheduledAt,
    submittedAt: m.submittedAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    failedAt: m.failedAt,
    lastError: m.lastErrorMessage
      ? { code: m.lastErrorCode, message: m.lastErrorMessage }
      : null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}
