import { sha256Hex, type ProviderOutcome } from "@maildrill/domain";
import {
  asRecord,
  str,
  type MessagingProvider,
  type NormalizedProviderEvent,
  type ProviderWebhookInput,
  type SendInput,
  type ProviderSendResult,
  type RegisterTemplateInput,
  type RegisterTemplateResult,
  type ListTemplatesResult,
  type TemplateApprovalStatus,
  type TemplateStatusEvent,
} from "./core";

const TEMPLATE_STATUSES: ReadonlyArray<TemplateApprovalStatus> = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "paused",
  "disabled",
];

const OUTCOMES: ReadonlyArray<ProviderOutcome> = [
  "submitted",
  "sent",
  "delivered",
  "read",
  "failed",
  "cancelled",
  "expired",
];

function toOutcome(value: unknown): ProviderOutcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value)
    ? (value as ProviderOutcome)
    : "delivered";
}

/**
 * Deterministic, network-free provider for local dev and tests.
 * - a recipient containing "reject@" yields a permanent validation rejection
 * - a recipient containing "boom@" yields a temporary (retryable) error
 * - otherwise the send is accepted with a stable provider message id
 */
export class MockProvider implements MessagingProvider {
  readonly name = "mock";

  async send(input: SendInput): Promise<ProviderSendResult> {
    if (input.to.includes("reject@")) {
      return {
        accepted: false,
        status: "rejected",
        error: {
          category: "validation",
          message: "mock: recipient rejected",
          retryable: false,
        },
      };
    }
    if (input.to.includes("boom@")) {
      return {
        accepted: false,
        status: "rejected",
        error: {
          category: "temporary",
          message: "mock: transient provider error",
          retryable: true,
        },
      };
    }
    return {
      accepted: true,
      status: "submitted",
      providerMessageId: `mock-${sha256Hex(input.messageId).slice(0, 24)}`,
      providerRequestId: input.correlationId,
    };
  }

  async normalizeWebhook(
    input: ProviderWebhookInput,
  ): Promise<NormalizedProviderEvent[]> {
    const body = asRecord(input.body);
    const raw = Array.isArray(body.events) ? body.events : [body];
    return raw.map((entry): NormalizedProviderEvent => {
      const e = asRecord(entry);
      const outcome = toOutcome(e.status);
      const at = str(e.at);
      return {
        providerEventId: str(e.eventId),
        fingerprintParts: [str(e.eventId) ?? str(e.messageId), str(e.status)],
        providerMessageId: str(e.messageId),
        correlationId: str(e.correlationId),
        eventType: str(e.type) ?? "delivery",
        outcome,
        providerStatus: str(e.status),
        occurredAt: at ? new Date(at) : undefined,
        raw: e,
      };
    });
  }

  /** Deterministic: a template name containing "reject" is rejected, else pending. */
  async registerWhatsAppTemplate(
    input: RegisterTemplateInput,
  ): Promise<RegisterTemplateResult> {
    const status: TemplateApprovalStatus = input.name.toLowerCase().includes("reject")
      ? "rejected"
      : "pending";
    return {
      ok: true,
      providerTemplateId: `mock-tpl-${sha256Hex(
        `${input.sender}:${input.name}:${input.language}`,
      ).slice(0, 16)}`,
      status,
    };
  }

  async listWhatsAppTemplates(): Promise<ListTemplatesResult> {
    return { ok: true, templates: [] };
  }

  normalizeTemplateWebhook(input: ProviderWebhookInput): TemplateStatusEvent | null {
    const body = asRecord(input.body);
    const id = str(body.providerTemplateId) ?? str(body.messageTemplateId);
    const status = str(body.status);
    if (!id || !status) return null;
    return {
      providerTemplateId: id,
      name: str(body.name),
      status: (TEMPLATE_STATUSES as readonly string[]).includes(status)
        ? (status as TemplateApprovalStatus)
        : "pending",
    };
  }
}
