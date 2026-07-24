/**
 * Optional observer for MessagingProvider.send() results. No-op until a sink
 * is installed (e.g. Node Telescope Mail / Notifications tabs).
 */

import type { Channel } from "@maildrill/domain";
import type { ProviderSendResult, SendInput } from "./core";

export interface ProviderSendEvent {
  provider: string;
  channel: Channel;
  messageId: string;
  tenantId: string;
  to: string;
  correlationId: string;
  accepted: boolean;
  durationMs: number;
  subject?: string;
  from?: string;
  hasHtml?: boolean;
  providerMessageId?: string;
  error?: string;
}

let sink: ((event: ProviderSendEvent) => void) | null = null;

export function setProviderSendSink(fn: ((event: ProviderSendEvent) => void) | null): void {
  sink = fn;
}

export function emitProviderSend(event: ProviderSendEvent): void {
  if (!sink) return;
  try {
    sink(event);
  } catch {
    /* observation must never break a send */
  }
}

export function buildProviderSendEvent(
  provider: string,
  input: SendInput,
  result: ProviderSendResult,
  durationMs: number,
): ProviderSendEvent {
  const subject = typeof input.content.subject === "string" ? input.content.subject : undefined;
  const from = typeof input.content.from === "string" ? input.content.from : undefined;
  return {
    provider,
    channel: input.channel,
    messageId: input.messageId,
    tenantId: input.tenantId,
    to: input.to,
    correlationId: input.correlationId,
    accepted: result.accepted,
    durationMs,
    subject,
    from,
    hasHtml: typeof input.content.html === "string",
    providerMessageId: result.providerMessageId,
    error: result.error?.message,
  };
}
