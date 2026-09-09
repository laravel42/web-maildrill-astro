import {
  SESv2Client,
  SendEmailCommand,
  type MessageHeader,
  type MessageTag,
} from '@aws-sdk/client-sesv2';
import {
  classifyHttpStatus,
  classifyNetworkError,
  isRetryable,
  type ErrorCategory,
  type ProviderOutcome,
} from '@maildrill/domain';
import { config } from '@maildrill/config';
import { emitProviderHttp } from './http-observer';
import {
  asRecord,
  str,
  type MessagingProvider,
  type NormalizedProviderEvent,
  type ProviderSendError,
  type ProviderSendResult,
  type ProviderWebhookInput,
  type SendInput,
} from './core';

export interface SesEmailSettings {
  region: string;
  from: string;
  /** SES Configuration Set — required for event-destination (delivery/bounce/…) notifications. */
  configurationSet?: string;
}

/** Only the subset of SESv2Client used here, so tests can inject a fake. */
export interface SesClientLike {
  send(command: SendEmailCommand): Promise<{ MessageId?: string; $metadata?: { requestId?: string; httpStatusCode?: number } }>;
}

const SES_TAG_NAME = /^[a-zA-Z0-9_-]{1,256}$/;

/** SES message-tag values are restricted to `[a-zA-Z0-9_-]`; sanitize rather than reject. */
function sanitizeTagValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
}

/** `from`/`replyTo` may arrive as `Display Name <user@domain>` or a bare address; SES wants the bare address in ReplyToAddresses/FromEmailAddress, both forms are already accepted by SES for From. */
function firstAddress(value: string): string {
  const match = /<\s*([^<>\s]+@[^<>\s]+)\s*>/.exec(value);
  return match?.[1] ?? value.trim();
}

function formatSdkError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * AWS SES adapter (SES v2 `SendEmail`) — email only. Selecting it for another
 * channel is a permanent validation error, same convention as
 * CloudflareProvider, so pair it with PROVIDER_EMAIL_DRIVER=ses to keep
 * SMS/WhatsApp/Voice on their existing driver.
 *
 * Credentials come from the standard AWS SDK v3 credential provider chain
 * (env vars, shared config/profile, ECS/EC2/EKS role, etc.) — the client is
 * constructed with only a region, never inline keys, so IAM roles work with
 * zero extra configuration and nothing secret has to live in `config.ses`.
 *
 * SES v2's Simple content natively supports custom headers and attachments
 * (`Message.Headers` / `Message.Attachments`), so this never needs to fall
 * back to hand-built raw MIME — unlike SES v1, which only accepted attachments
 * and arbitrary headers through `SendRawEmail`.
 *
 * Delivery visibility: the send response only carries a `MessageId` (SES
 * queued the message; nothing about delivery yet). Real lifecycle events
 * (Send/Delivery/Bounce/Complaint/Reject/Open/Click/DeliveryDelay/
 * RenderingFailure/Subscription) arrive asynchronously via a Configuration Set
 * → Event Destination → SNS topic, pushed to `/webhooks/ses/sns` (see
 * `ses-webhook.ts` in @maildrill/api), unwrapped there, and normalized by
 * `normalizeWebhook` below like every other provider.
 */
export class SesProvider implements MessagingProvider {
  readonly name = 'ses';

  private client: SesClientLike | undefined;

  constructor(
    private readonly settings: SesEmailSettings = config.ses,
    client?: SesClientLike,
  ) {
    this.client = client;
  }

  private getClient(): SesClientLike {
    if (!this.client) {
      this.client = new SESv2Client({ region: this.settings.region });
    }
    return this.client;
  }

  async send(input: SendInput): Promise<ProviderSendResult> {
    if (input.channel !== 'email') {
      return this.validationError(
        `ses: ${input.channel} is not supported (email only) — use PROVIDER_EMAIL_DRIVER=ses so other channels keep their driver`,
      );
    }
    if (!this.settings.region) {
      return this.validationError('ses email: set AWS_SES_REGION');
    }

    const c = input.content;
    const html = str(c.html);
    const text = str(c.text);
    const subject = str(c.subject) ?? '';
    const fromRaw = str(c.from) ?? this.settings.from;
    if (!fromRaw) {
      return this.validationError(
        'ses email: no From address (set AWS_SES_FROM_EMAIL or provide one per-campaign)',
      );
    }
    const replyToRaw = str(c.replyTo);

    const headers: MessageHeader[] = [];
    for (const [name, value] of Object.entries(asRecord(c.headers))) {
      if (typeof value === 'string' && value) headers.push({ Name: name, Value: value });
    }

    const tags: MessageTag[] = [
      { Name: 'maildrill_message_id', Value: sanitizeTagValue(input.messageId) },
      { Name: 'maildrill_tenant_id', Value: sanitizeTagValue(input.tenantId) },
    ];
    if (input.campaignReferenceId) {
      tags.push({ Name: 'maildrill_campaign_id', Value: sanitizeTagValue(input.campaignReferenceId) });
    }

    const command = new SendEmailCommand({
      FromEmailAddress: fromRaw,
      Destination: { ToAddresses: [input.to] },
      ReplyToAddresses: replyToRaw ? [firstAddress(replyToRaw)] : undefined,
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}),
            ...(text || !html ? { Text: { Data: text ?? '', Charset: 'UTF-8' } } : {}),
          },
          Headers: headers.length > 0 ? headers : undefined,
        },
      },
      ConfigurationSetName: this.settings.configurationSet || undefined,
      EmailTags: tags,
    });

    return this.dispatch(command);
  }

  private validationError(message: string): ProviderSendResult {
    return {
      accepted: false,
      status: 'rejected',
      error: { category: 'validation', message, retryable: false },
    };
  }

  private async dispatch(command: SendEmailCommand): Promise<ProviderSendResult> {
    const start = Date.now();
    const requestBody = safeStringify(command.input);
    try {
      const client = this.getClient();
      const response = await client.send(command);
      emitProviderHttp({
        provider: this.name,
        method: 'POST',
        url: `ses:SendEmail:${this.settings.region}`,
        requestHeaders: {},
        requestBody,
        status: 200,
        responseHeaders: {},
        responseBody: safeStringify({ MessageId: response.MessageId }),
        durationMs: Date.now() - start,
      });
      return {
        accepted: true,
        status: 'submitted',
        providerMessageId: response.MessageId,
        providerRequestId: response.$metadata?.requestId,
      };
    } catch (err) {
      const status = extractHttpStatus(err);
      emitProviderHttp({
        provider: this.name,
        method: 'POST',
        url: `ses:SendEmail:${this.settings.region}`,
        requestHeaders: {},
        requestBody,
        status: status ?? 0,
        responseHeaders: {},
        durationMs: Date.now() - start,
        error: formatSdkError(err),
      });
      return {
        accepted: false,
        status: 'rejected',
        providerRequestId: extractRequestId(err),
        error: classifySesError(err),
      };
    }
  }

  /**
   * Normalize an SES event-destination notification (already unwrapped from
   * its SNS envelope by the caller — see `ses-webhook.ts`). Accepts the
   * SESv2 event-publishing shape keyed by `eventType`
   * (Send/Reject/Bounce/Complaint/Delivery/Open/Click/DeliveryDelay/
   * RenderingFailure/Subscription), with `notificationType` (classic
   * Bounce/Complaint/Delivery notifications) as a fallback for accounts still
   * on the older subscription shape.
   */
  async normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedProviderEvent[]> {
    const e = asRecord(input.body);
    const name = str(e.eventType) ?? str(e.notificationType);
    if (!name) return [];

    const mail = asRecord(e.mail);
    const providerMessageId = str(mail.messageId);
    const timestamp = eventTimestamp(e, name) ?? str(mail.timestamp);
    const tags = asRecord(mail.tags);
    const maildrillMessageId = firstTagValue(tags.maildrill_message_id);

    return [
      {
        // SES assigns no stable per-notification id; fingerprint on the
        // message + event name + timestamp instead.
        fingerprintParts: [providerMessageId, name, timestamp],
        providerMessageId,
        correlationId: maildrillMessageId,
        eventType: `email.${SES_EVENT_TYPE[name] ?? name.toLowerCase()}`,
        outcome: SES_EVENT_OUTCOMES[name] ?? 'submitted',
        providerStatus: providerStatus(e, name),
        occurredAt: timestamp ? new Date(timestamp) : undefined,
        raw: e,
      },
    ];
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function firstTagValue(value: unknown): string | undefined {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

/** Each SES event type nests its own timestamp under a same-named lowercase-first key. */
function eventTimestamp(e: Record<string, unknown>, name: string): string | undefined {
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  const nested = asRecord(e[key]);
  return str(nested.timestamp);
}

/** A short human-readable status per event, mirroring providerStatus on other adapters. */
function providerStatus(e: Record<string, unknown>, name: string): string | undefined {
  switch (name) {
    case 'Bounce': {
      const b = asRecord(e.bounce);
      return [str(b.bounceType), str(b.bounceSubType)].filter(Boolean).join('/') || 'Bounce';
    }
    case 'Complaint': {
      const c = asRecord(e.complaint);
      return str(c.complaintFeedbackType) ?? 'Complaint';
    }
    case 'Reject':
      return str(asRecord(e.reject).reason) ?? 'Reject';
    case 'DeliveryDelay':
      return str(asRecord(e.deliveryDelay).delayType) ?? 'DeliveryDelay';
    case 'Rendering Failure':
      return str(asRecord(e.failure).errorMessage) ?? 'RenderingFailure';
    default:
      return name;
  }
}

/**
 * SES event → outcome. `DeliveryDelay` stays `submitted` (retries still
 * pending, mirrors Cloudflare's `deferred`), and `Complaint`/`Subscription`
 * map to `delivered` because both only happen after delivery — the same
 * reasoning CloudflareProvider uses for spam complaints. The SES-specific
 * name is preserved in `eventType`/`raw` either way.
 */
const SES_EVENT_OUTCOMES: Record<string, ProviderOutcome> = {
  Send: 'sent',
  Delivery: 'delivered',
  Bounce: 'failed',
  Complaint: 'delivered',
  Reject: 'failed',
  Open: 'read',
  Click: 'read',
  DeliveryDelay: 'submitted',
  'Rendering Failure': 'failed',
  Subscription: 'delivered',
};

/** `eventType` names are already close to canonical; only reshape the two multi-word ones. */
const SES_EVENT_TYPE: Record<string, string> = {
  Send: 'sent',
  Delivery: 'delivered',
  Bounce: 'bounced',
  Complaint: 'complained',
  Reject: 'rejected',
  Open: 'opened',
  Click: 'clicked',
  DeliveryDelay: 'delayed',
  'Rendering Failure': 'rendering_failed',
  Subscription: 'subscription',
};

function extractHttpStatus(err: unknown): number | undefined {
  const status = (err as { $metadata?: { httpStatusCode?: number } } | null | undefined)?.$metadata
    ?.httpStatusCode;
  return typeof status === 'number' ? status : undefined;
}

function extractRequestId(err: unknown): string | undefined {
  return (err as { $metadata?: { requestId?: string } } | null | undefined)?.$metadata?.requestId;
}

/** SESv2 exception names that mean "this will never succeed" — never retried. */
const PERMANENT_EXCEPTIONS = new Set([
  'AccountSuspendedException',
  'SendingPausedException',
  'MailFromDomainNotVerifiedException',
  'MessageRejected',
  'BadRequestException',
  'LimitExceededException',
  'NotFoundException',
]);

function classifySesError(err: unknown): ProviderSendError {
  const name = (err as { name?: unknown } | null | undefined)?.name;
  const message = formatSdkError(err);

  if (typeof name === 'string') {
    if (name === 'TooManyRequestsException') {
      return { category: 'rate_limit', code: name, message: `ses: ${message}`, retryable: true };
    }
    if (name === 'InternalServiceErrorException') {
      return { category: 'temporary', code: name, message: `ses: ${message}`, retryable: true };
    }
    if (PERMANENT_EXCEPTIONS.has(name)) {
      // MessageRejected/BadRequestException cover invalid recipients, an
      // unverified sender identity, and (in a sandbox account) sending to an
      // unverified recipient — all validation-shaped, none retryable.
      return { category: 'validation', code: name, message: `ses: ${message}`, retryable: false };
    }
  }

  const status = extractHttpStatus(err);
  if (typeof status === 'number' && status > 0) {
    const category: ErrorCategory = classifyHttpStatus(status);
    return {
      category,
      code: typeof name === 'string' ? name : String(status),
      message: `ses: ${message}`,
      retryable: isRetryable(category),
    };
  }

  const category = classifyNetworkError(err);
  return { category, message: `ses: ${message}`, retryable: isRetryable(category) };
}
