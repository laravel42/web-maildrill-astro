import type { Channel, ErrorCategory, ProviderOutcome } from '@maildrill/domain';

export interface SendInput {
  messageId: string;
  tenantId: string;
  channel: Channel;
  to: string;
  content: Record<string, unknown>;
  correlationId: string;
}

export interface ProviderSendError {
  category: ErrorCategory;
  code?: string;
  message: string;
  retryable: boolean;
}

export interface ProviderSendResult {
  accepted: boolean;
  status: 'submitted' | 'rejected';
  providerMessageId?: string;
  providerRequestId?: string;
  error?: ProviderSendError;
}

export interface NormalizedProviderEvent {
  providerEventId?: string;
  /** Stable parts used to fingerprint the event when no provider event id exists. */
  fingerprintParts: ReadonlyArray<string | number | null | undefined>;
  providerMessageId?: string;
  correlationId?: string;
  eventType: string;
  outcome: ProviderOutcome;
  providerStatus?: string;
  occurredAt?: Date;
  raw: Record<string, unknown>;
}

export type WebhookKind = 'delivery' | 'engagement' | 'voice' | 'template';

export interface ProviderWebhookInput {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody: string;
  kind: WebhookKind;
}

// ---------------------------------------------------------------------------
// WhatsApp templates (Meta review, brokered by the provider)
// ---------------------------------------------------------------------------

export type TemplateApprovalStatus =
  'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';

export interface WhatsAppTemplateButton {
  type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface WhatsAppTemplateStructure {
  header?: { format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; text?: string };
  body: { text: string; examples?: string[] };
  footer?: { text: string };
  buttons?: WhatsAppTemplateButton[];
}

export interface RegisterTemplateInput {
  /** Registered WhatsApp sender number, international format without a leading +. */
  sender: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  structure: WhatsAppTemplateStructure;
  /** Infobip `structure.type` — TEXT for body-only, MEDIA when header/footer/buttons exist. */
  structureType?: 'TEXT' | 'MEDIA';
}

export interface RegisterTemplateResult {
  ok: boolean;
  providerTemplateId?: string;
  status?: TemplateApprovalStatus;
  error?: ProviderSendError;
}

export interface RemoteTemplate {
  id: string;
  name: string;
  language: string;
  status: TemplateApprovalStatus;
  category?: string;
  rejectionReason?: string;
}

export interface ListTemplatesResult {
  ok: boolean;
  templates: RemoteTemplate[];
  error?: ProviderSendError;
}

/** A WhatsApp template status change parsed from a provider template webhook. */
export interface TemplateStatusEvent {
  providerTemplateId: string;
  name?: string;
  status: TemplateApprovalStatus;
  rejectionReason?: string;
}

/**
 * Common interface every provider implements. Channel-specific request shaping
 * happens inside `send`; provider-specific status codes never leak upward —
 * results are normalized to these types.
 */
export interface MessagingProvider {
  readonly name: string;
  send(input: SendInput): Promise<ProviderSendResult>;
  normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedProviderEvent[]>;
  getMessageStatus?(providerMessageId: string): Promise<ProviderSendResult>;
  /**
   * Pull latest Infobip status groupName for an outbound message (Messages API
   * reports). Used by campaign-delivery when PostHog has no DLR yet.
   */
  getDeliveryStatusGroup?(channel: Channel, providerMessageId: string): Promise<string | null>;
  /**
   * Drain a batch of recent delivery reports (each Infobip report is returned
   * only once). Prefer over per-id polls when catching up many open messages.
   */
  pullDeliveryReports?(
    channel?: Channel,
    limit?: number,
  ): Promise<Array<{ providerMessageId: string; statusGroup: string }>>;
  /** Register a WhatsApp template with the provider for Meta review. */
  registerWhatsAppTemplate?(input: RegisterTemplateInput): Promise<RegisterTemplateResult>;
  /** List a sender's WhatsApp templates and their current approval statuses. */
  listWhatsAppTemplates?(sender: string): Promise<ListTemplatesResult>;
  /** Parse a provider template-status webhook into a normalized status event. */
  normalizeTemplateWebhook?(input: ProviderWebhookInput): TemplateStatusEvent | null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
