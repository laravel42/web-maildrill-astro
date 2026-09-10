import {
  SESv2Client,
  SendEmailCommand,
  CreateTenantCommand,
  GetTenantCommand,
  CreateTenantResourceAssociationCommand,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
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
  type EntityProvisionResult,
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
  send(
    command: SendEmailCommand,
  ): Promise<{ MessageId?: string; $metadata?: { requestId?: string; httpStatusCode?: number } }>;
  send(command: CreateTenantCommand): Promise<{ TenantArn?: string }>;
  send(command: GetTenantCommand): Promise<{ Tenant?: { TenantArn?: string } }>;
  send(command: CreateTenantResourceAssociationCommand): Promise<Record<string, never>>;
  send(command: CreateEmailIdentityCommand): Promise<Record<string, unknown>>;
  send(command: GetEmailIdentityCommand): Promise<SesGetEmailIdentityResult>;
  send(command: DeleteEmailIdentityCommand): Promise<Record<string, never>>;
  send(command: PutEmailIdentityMailFromAttributesCommand): Promise<Record<string, never>>;
}

interface SesGetEmailIdentityResult {
  VerifiedForSendingStatus?: boolean;
  DkimAttributes?: { Status?: string; Tokens?: string[] };
  MailFromAttributes?: { MailFromDomain?: string; MailFromDomainStatus?: string };
}

export interface SesDomainDnsRecord {
  recordType: string;
  name: string;
  expectedValue: string;
  verified: boolean;
}

export interface SesDomainIdentity {
  domainName: string;
  active: boolean;
  dnsRecords: SesDomainDnsRecord[];
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
      TenantName: input.sesTenantName || undefined,
    });

    return this.dispatch(command);
  }

  /**
   * Provision an SES Tenant (SES Multi-Tenant Management) for a workspace and
   * associate it with the account's shared sending identity and configuration
   * set — a tenant can only send using resources explicitly associated with
   * it. One shared identity/configuration set can be associated with many
   * tenants (AWS's own resource-sharing model), so this never provisions
   * per-workspace domains/DNS; isolation comes entirely from tagging every
   * `SendEmail` call with `TenantName`, which gives each workspace its own
   * reputation and sending-status tracking inside the one shared account.
   *
   * Idempotent: an existing tenant (`AlreadyExistsException`) is looked up by
   * name and treated as success so resource association still runs — a
   * tenant created before the shared identity existed, or before this method
   * shipped, ends up fully wired on the next call rather than staying half
   * set up forever.
   *
   * The identity associated is the domain half of `AWS_SES_FROM_EMAIL`,
   * assumed verified as a domain identity per the standard setup — if the
   * verified identity is actually an email address instead, this will fail
   * per-recipient sends until that's corrected, not silently degrade.
   */
  async createEntity(input: { entityId: string; entityName: string }): Promise<EntityProvisionResult> {
    if (!this.settings.region) {
      return { ok: false, error: 'ses tenant: set AWS_SES_REGION' };
    }
    const client = this.getClient();
    let tenantArn: string | undefined;
    let existed = false;
    try {
      const created = await client.send(new CreateTenantCommand({ TenantName: input.entityId }));
      tenantArn = created.TenantArn;
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AlreadyExistsException') {
        existed = true;
        try {
          const got = await client.send(new GetTenantCommand({ TenantName: input.entityId }));
          tenantArn = got.Tenant?.TenantArn;
        } catch (getErr) {
          return { ok: false, error: `ses tenant: lookup after AlreadyExists failed: ${formatSdkError(getErr)}` };
        }
      } else {
        return { ok: false, error: `ses tenant: ${formatSdkError(err)}` };
      }
    }

    const accountId = tenantArn ? accountIdFromArn(tenantArn) : undefined;
    if (!accountId) {
      return { ok: false, error: 'ses tenant: could not determine AWS account id from tenant ARN' };
    }

    // The verified sending identity may be a domain (e.g. maildrill.net) or a
    // single email address (e.g. hello@laravel42.com) — SES treats these as
    // distinct identity resources with no relationship in the ARN, and there
    // is no API to ask "which kind is this From address verified as" without
    // a GetEmailIdentity call this method doesn't otherwise need. Try both;
    // NotFoundException on whichever one isn't real is expected, not fatal —
    // exactly one of the two exists in a correctly configured account.
    const identityDomain = (this.settings.from.split('@')[1] ?? '').trim();
    const identityNames = [this.settings.from, identityDomain].filter(Boolean);
    const resourceArns = identityNames.map(
      (name) => `arn:aws:ses:${this.settings.region}:${accountId}:identity/${name}`,
    );
    if (this.settings.configurationSet) {
      resourceArns.push(
        `arn:aws:ses:${this.settings.region}:${accountId}:configuration-set/${this.settings.configurationSet}`,
      );
    }

    let anyIdentityAssociated = false;
    for (const resourceArn of resourceArns) {
      const isIdentity = resourceArn.includes(':identity/');
      try {
        await client.send(
          new CreateTenantResourceAssociationCommand({ ResourceArn: resourceArn, TenantName: input.entityId }),
        );
        if (isIdentity) anyIdentityAssociated = true;
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === 'AlreadyExistsException') {
          if (isIdentity) anyIdentityAssociated = true;
          continue;
        }
        // Expected for whichever of the two identity guesses isn't real —
        // only fatal for the configuration-set ARN, which has no guesswork.
        if (name === 'NotFoundException' && isIdentity) continue;
        return { ok: false, error: `ses tenant: associate ${resourceArn} failed: ${formatSdkError(err)}` };
      }
    }

    if (!anyIdentityAssociated) {
      return {
        ok: false,
        error: `ses tenant: neither "${this.settings.from}" nor "${identityDomain}" matched a real SES identity — this tenant has no usable sending identity`,
      };
    }

    return { ok: true, existed };
  }

  /**
   * Register (or re-fetch) a domain sending identity — Settings → Domains
   * when `PROVIDER_EMAIL_DRIVER=ses`. Easy DKIM is on by default for a new
   * domain identity (no separate ownership-verification TXT record; the 3
   * DKIM CNAMEs double as proof of control), and a custom MAIL FROM
   * subdomain is set in the same call so both DNS batches are returned
   * together on first registration instead of a second round trip.
   *
   * `mailFromDomain` defaults to `mkt.<domain>` — an SES custom MAIL FROM
   * domain can never equal the identity domain itself (SES rejects that
   * combination), so a subdomain is mandatory, not stylistic.
   */
  async createDomainIdentity(
    domainName: string,
    mailFromDomain: string = `mkt.${domainName}`,
  ): Promise<{ ok: true; domain: SesDomainIdentity } | { ok: false; error: string }> {
    if (!this.settings.region) {
      return { ok: false, error: 'ses: set AWS_SES_REGION' };
    }
    const client = this.getClient();
    try {
      await client.send(new CreateEmailIdentityCommand({ EmailIdentity: domainName }));
    } catch (err) {
      if ((err as { name?: string } | null)?.name !== 'AlreadyExistsException') {
        return { ok: false, error: `ses: create identity failed: ${formatSdkError(err)}` };
      }
    }
    try {
      await client.send(
        new PutEmailIdentityMailFromAttributesCommand({
          EmailIdentity: domainName,
          MailFromDomain: mailFromDomain,
          BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
        }),
      );
    } catch (err) {
      return { ok: false, error: `ses: set mail-from domain failed: ${formatSdkError(err)}` };
    }
    const domain = await this.getDomainIdentity(domainName);
    if (!domain) {
      return { ok: false, error: 'ses: identity created but could not be re-fetched' };
    }
    return { ok: true, domain };
  }

  /** `null` on a domain that has no SES identity (never registered, or already deleted). */
  async getDomainIdentity(domainName: string): Promise<SesDomainIdentity | null> {
    const client = this.getClient();
    try {
      const res = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domainName }));
      return toSesDomainIdentity(domainName, res, this.settings.region);
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'NotFoundException') return null;
      throw err;
    }
  }

  /** Irreversible: destroys the DKIM keys, so re-adding the domain later issues new DNS records. */
  async deleteDomainIdentity(domainName: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.send(new DeleteEmailIdentityCommand({ EmailIdentity: domainName }));
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'NotFoundException') return;
      throw err;
    }
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

/**
 * SES only reports one aggregate DKIM status for all 3 tokens (no
 * per-record verification), so every DKIM CNAME is marked verified/not
 * together. MAIL FROM's MX + SPF-TXT pair share `MailFromDomainStatus` the
 * same way.
 */
function toSesDomainIdentity(
  domainName: string,
  res: SesGetEmailIdentityResult,
  region: string,
): SesDomainIdentity {
  const dkim = res.DkimAttributes;
  const dkimVerified = dkim?.Status === 'SUCCESS';
  const dnsRecords: SesDomainDnsRecord[] = (dkim?.Tokens ?? []).map((token) => ({
    recordType: 'CNAME',
    name: `${token}._domainkey.${domainName}`,
    expectedValue: `${token}.dkim.amazonses.com`,
    verified: dkimVerified,
  }));

  const mailFromDomain = res.MailFromAttributes?.MailFromDomain;
  if (mailFromDomain) {
    const mailFromVerified = res.MailFromAttributes?.MailFromDomainStatus === 'SUCCESS';
    dnsRecords.push(
      {
        recordType: 'MX',
        name: mailFromDomain,
        expectedValue: `10 feedback-smtp.${region}.amazonses.com`,
        verified: mailFromVerified,
      },
      {
        recordType: 'TXT',
        name: mailFromDomain,
        expectedValue: '"v=spf1 include:amazonses.com ~all"',
        verified: mailFromVerified,
      },
    );
  }

  return {
    domainName,
    active: Boolean(res.VerifiedForSendingStatus) && dkimVerified,
    dnsRecords,
  };
}

/** `arn:aws:ses:{region}:{account-id}:tenant/{name}` — account id is field index 4. */
function accountIdFromArn(arn: string): string | undefined {
  const parts = arn.split(':');
  return parts[4] || undefined;
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
