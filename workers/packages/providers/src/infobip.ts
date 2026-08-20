import {
  classifyHttpStatus,
  classifyNetworkError,
  isRetryable,
  type Channel,
  type ProviderOutcome,
} from '@maildrill/domain';
import { config } from '@maildrill/config';
import https from 'node:https';
import { URL } from 'node:url';
import { emitProviderHttp, redactHeaders } from './http-observer';
import {
  asRecord,
  str,
  type MessagingProvider,
  type NormalizedProviderEvent,
  type ProviderWebhookInput,
  type SendInput,
  type ProviderSendResult,
  type ProviderSendError,
  type AddressValidation,
  type EntityProvisionResult,
  type RegisterTemplateInput,
  type RegisterTemplateResult,
  type ListTemplatesResult,
  type RemoteTemplate,
  type TemplateApprovalStatus,
  type TemplateStatusEvent,
} from './core';

/** Overall abort for Infobip calls. Template create can wait on Meta sync. */
const REQUEST_TIMEOUT_MS = 60_000;
/** TCP connect / first-byte budget — undici's default 10s is too aggressive to Infobip. */
const CONNECT_TIMEOUT_MS = 30_000;

function safeJson(text: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return {};
  }
}

/** Flatten `Error.cause` so operators see ConnectTimeoutError / ETIMEDOUT, not just "fetch failed". */
function formatFetchError(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur; i++) {
    if (cur instanceof Error) {
      const bit = cur.name && cur.name !== 'Error' ? `${cur.name}: ${cur.message}` : cur.message;
      if (bit && !parts.includes(bit)) parts.push(bit);
      cur = cur.cause;
    } else {
      const bit = String(cur);
      if (bit && !parts.includes(bit)) parts.push(bit);
      break;
    }
  }
  return parts.join(' — ') || 'network error';
}

/**
 * WhatsApp / Infobip template names: lowercase letters, digits, underscores only.
 * Display names like "WA1" must be sent as "wa1".
 */
function normalizeWhatsAppTemplateName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Infobip phone APIs expect E.164 digits without a leading +. */
function e164Digits(value: string): string {
  return value.replace(/\D/g, '');
}

function phoneSender(contentFrom: unknown, configured: string): string {
  const explicit = str(contentFrom);
  if (explicit) return e164Digits(explicit) || explicit.trim();
  return e164Digits(configured);
}

/** Map an Infobip WhatsApp template status to our approval enum. */
function mapTemplateStatus(raw: unknown): TemplateApprovalStatus {
  switch (str(raw)?.toUpperCase()) {
    case 'APPROVED':
    case 'REINSTATED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'FLAGGED':
    case 'FIRST_PAUSED':
    case 'SECOND_PAUSED':
      return 'paused';
    case 'DISABLED':
    case 'DELETED':
    case 'PENDING_DELETION':
      return 'disabled';
    // PENDING / IN_APPEAL / unknown → still awaiting a terminal decision.
    default:
      return 'pending';
  }
}

import { outcomeFromInfobipStatusGroup } from '@maildrill/domain';

/** Map an Infobip delivery status groupName to our provider outcome. */
function mapInfobipGroup(groupName: string | undefined): ProviderOutcome {
  return outcomeFromInfobipStatusGroup(groupName);
}

// ---------------------------------------------------------------------------
// Infobip request bodies
//
// Declarative shapes for the JSON posted to Infobip's channel endpoints, so the
// `build*` helpers and `post()` describe each body explicitly instead of the old
// `Record<string, unknown>`. Kept as `type` aliases (not `interface`) and the
// optional identity/notify blocks mirror what `platformFields()` /
// `notifyFields()` spread in.
// ---------------------------------------------------------------------------

/**
 * CPaaS X identity (`platformFields`). The FIELDS are the same everywhere; the
 * PLACEMENT is per-endpoint and not interchangeable — verified against
 * Infobip's OpenAPI spec on 2026-08-17:
 *
 *   `/sms/2/text/advanced`            → `messages[].entityId`      (flat)
 *   `/whatsapp/1/message/template`    → `messages[].entityId`      (flat)
 *   `/whatsapp/1/message/text`        → `entityId`                 (top level)
 *   `/email/4/messages`               → `messages[].options.platform.entityId`
 *   `/calls/1/calls`                  → `platform.entityId`
 *   `/whatsapp/2/senders/…/templates` → `platform.entityId`
 *   `/email/1/domains` (POST)         → `entityId`                 (top level)
 *
 * `/tts/3/advanced` publishes NO entity field at all, so voice traffic cannot
 * be attributed to a workspace through this API; the spread below is inert
 * there and kept only so voice picks it up if Infobip ever adds support.
 */
type InfobipPlatformFields = {
  applicationId?: string;
  entityId?: string;
};

/** Optional per-message DLR push target (`notifyFields`). */
type InfobipNotifyFields = {
  notifyUrl?: string;
};

/**
 * Infobip's campaign tag. Present on the message for `/sms/2/text/advanced`
 * and nested under `messages[].options` for `/email/4/messages` — the two
 * placements are NOT interchangeable, which is why this is spread explicitly
 * per builder rather than folded into a shared helper like platformFields.
 */
type InfobipCampaignFields = {
  campaignReferenceId?: string;
};

/** Email v4 message content (`POST /email/4/messages`). */
type InfobipEmailContent = {
  subject: string;
  html?: string;
  text?: string;
};

/** Per-message DLR webhook config for email v4 (`messages[].webhooks`). */
type InfobipEmailWebhooks = {
  delivery?: {
    url: string;
    notify: boolean;
  };
  contentType: string;
  callbackData: string;
};

/** Email open/click tracking (`options.tracking` on `/email/4/messages`). */
export type InfobipEmailTracking = {
  track: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  /** Omitted on explicit opt-outs — there is nothing to call back about. */
  trackingUrl?: string;
};

/**
 * Per-message tracking options from campaign flags riding the message content
 * (`trackOpens` / `trackClicks`; absent = on, matching Infobip's domain-level
 * default). Pure and exported for tests.
 *
 * Both off returns an explicit `track: false` block — merely omitting
 * `options.tracking` would leave the sending domain's default (tracking ON)
 * in charge, and the whole point of the opt-out is deliverability: no open
 * pixel, no links rewritten through the tracking subdomain.
 */
/** Placeholders people leave in `.env`; Infobip answers UNAUTHORIZED for them. */
const PLACEHOLDER_ENTITY_RE = /^(local|test|example|changeme)$/i;

/**
 * CPaaS X identity stamped on every Infobip request.
 *
 * The workspace's own entity wins; `INFOBIP_ENTITY_ID` is the account-wide
 * fallback for workspaces provisioned before per-workspace entities existed.
 * Empty and placeholder values are dropped rather than sent, because Infobip
 * rejects the whole message for an unknown entity even when every API-key
 * scope is correct.
 */
export function resolvePlatformFields(
  applicationId: string,
  configuredEntityId: string,
  tenantEntityId?: string,
): InfobipPlatformFields {
  const out: InfobipPlatformFields = {};
  const app = applicationId.trim();
  const entity = (tenantEntityId ?? '').trim() || configuredEntityId.trim();
  if (app) out.applicationId = app;
  if (entity && !PLACEHOLDER_ENTITY_RE.test(entity)) out.entityId = entity;
  return out;
}

export function resolveEmailTracking(
  content: Record<string, unknown>,
  trackingUrl: string,
): InfobipEmailTracking | undefined {
  const trackOpens = content.trackOpens !== false;
  const trackClicks = content.trackClicks !== false;
  if (!trackOpens && !trackClicks) {
    return { track: false, trackOpens: false, trackClicks: false };
  }
  if (!trackingUrl) {
    // No engagement callback configured: stamp only explicit downgrades so
    // flag-less sends keep today's behavior (domain-level settings apply).
    if (!trackOpens || !trackClicks) return { track: true, trackOpens, trackClicks };
    return undefined;
  }
  return { track: true, trackOpens, trackClicks, trackingUrl };
}

/** SMS / WhatsApp URL shorten + click tracking. */
type InfobipUrlOptions = {
  shortenUrl: boolean;
  trackClicks: boolean;
  trackingUrl: string;
  removeProtocol?: boolean;
};

/** `POST /email/4/messages` */
type InfobipEmailBody = {
  messages: Array<{
    sender: string;
    destinations: Array<{ to: Array<{ destination: string }> }>;
    content: InfobipEmailContent;
    callbackData: string;
    webhooks: InfobipEmailWebhooks;
    /**
     * Per-message options. `/email/4/messages` nests BOTH the campaign tag and
     * the CPaaS X identity here — `messages[].options.platform.entityId`, not
     * the message-level `entityId` that SMS and WhatsApp take.
     */
    options?: {
      campaignReferenceId?: string;
      platform?: InfobipPlatformFields;
    };
  }>;
  options?: {
    tracking?: InfobipEmailTracking;
  };
};

/** `POST /sms/2/text/advanced` */
type InfobipSmsBody = {
  messages: Array<
    {
      from: string;
      destinations: Array<{ to: string }>;
      text: string;
      callbackData: string;
      urlOptions?: InfobipUrlOptions;
    } & InfobipNotifyFields &
      InfobipPlatformFields &
      InfobipCampaignFields
  >;
  bulkId: string;
};

/** WhatsApp free-text message content. */
type InfobipWhatsAppTextContent = {
  text: string;
  previewUrl?: boolean;
};

/** `POST /whatsapp/1/message/text` */
type InfobipWhatsAppTextBody = {
  from: string;
  to: string;
  messageId: string;
  content: InfobipWhatsAppTextContent;
  callbackData: string;
  urlOptions?: InfobipUrlOptions;
} & InfobipNotifyFields &
  InfobipPlatformFields;

/** `POST /whatsapp/1/message/template` */
type InfobipWhatsAppTemplateBody = {
  messages: Array<
    {
      from: string;
      to: string;
      messageId: string;
      callbackData: string;
      content: {
        templateName: string;
        templateData: { body: { placeholders: string[] } };
        language: string;
      };
      urlOptions?: InfobipUrlOptions;
    } & InfobipNotifyFields &
      InfobipPlatformFields
  >;
};

/** Text-to-speech voice selection for `POST /tts/3/single`. */
type InfobipVoiceConfig = {
  gender: 'male' | 'female';
  name: string;
};

/**
 * Voice message for `POST /tts/3/advanced` — either a recorded `audioFileUrl`
 * OR a text-to-speech body (`text` + `language` + `voice`). Built
 * incrementally, so the mutually exclusive fields are optional.
 * Advanced (not `/tts/3/single`) because only it honors `callbackData` and
 * `notifyUrl` — single silently drops both, so voice DLRs never reach PostHog
 * and carry no tenant mapping.
 */
type InfobipVoiceMessage = {
  from: string;
  destinations: Array<{ to: string; messageId: string }>;
  callbackData: string;
  audioFileUrl?: string;
  text?: string;
  language?: string;
  voice?: InfobipVoiceConfig;
  /** TTS reproduction speed, `[0.5 – 2]`; omitted → Infobip default `1`. */
  speechRate?: number;
} & InfobipNotifyFields &
  InfobipPlatformFields;

/** `POST /tts/3/advanced` */
type InfobipVoiceBody = {
  bulkId: string;
  messages: InfobipVoiceMessage[];
};

/** Any channel send body handed to `post()`. */
type InfobipSendBody =
  | InfobipEmailBody
  | InfobipSmsBody
  | InfobipWhatsAppTextBody
  | InfobipWhatsAppTemplateBody
  | InfobipVoiceBody;

/**
 * Infobip delivery adapter. Auth is `Authorization: App <key>`.
 *
 * Email uses the v4 JSON API (POST /email/4/messages). SMS/WhatsApp/Voice use
 * channel-specific endpoints. Email `from` defaults to INFOBIP_FROM; phone
 * channels need INFOBIP_PHONE_FROM (or per-channel overrides).
 *
 * When Infobip CPaaS X binds senders (or the API key) to an Application /
 * Entity, set INFOBIP_APPLICATION_ID / INFOBIP_ENTITY_ID — otherwise WhatsApp
 * and SMS return FORBIDDEN "forbidden application id and/or entity id".
 */
export class InfobipProvider implements MessagingProvider {
  readonly name = 'infobip';
  private readonly base = config.infobip.baseUrl;
  private readonly key = config.infobip.apiKey;

  /**
   * CPaaS X identity fields for traffic APIs (top-level on the message).
   * Omits empty values and common `.env` placeholders for entityId (e.g. `local`)
   * that produce Infobip UNAUTHORIZED even when every API-key scope is checked.
   */
  private platformFields(entityId?: string): InfobipPlatformFields {
    return resolvePlatformFields(
      config.infobip.applicationId,
      config.infobip.entityId,
      entityId,
    );
  }

  /**
   * CPaaS X identity for WhatsApp template management — Infobip expects a nested
   * `platform: { applicationId, entityId }` object on create/edit.
   */
  private platformBlock(entityId?: string): { platform?: InfobipPlatformFields } {
    const platform = this.platformFields(entityId);
    return Object.keys(platform).length > 0 ? { platform } : {};
  }

  /**
   * The campaign tag Infobip bills against.
   *
   * `campaignReferenceId` is what makes `POST /billing/1/usage/query` able to
   * answer "what did campaign X cost" instead of only "what did the account
   * spend this month" — the Billing Usage API filters on
   * `campaignReferenceIds` and can aggregate by `CAMPAIGN_REFERENCE`, but only
   * for traffic that carried the tag at send time. Untagged traffic is
   * unattributable forever; there is no backfill.
   *
   * Gated per channel because the placement of this field is only *documented*
   * for `/sms/2/text/advanced` (message level) and `/email/4/messages`
   * (`messages[].options`). The WhatsApp v1 and TTS v3 request schemas do not
   * publish it, and a rejected unknown property would fail the send itself —
   * a far worse outcome than missing cost attribution. Flip
   * `INFOBIP_CAMPAIGN_REF_CHANNELS` once it is confirmed against a live
   * account.
   */
  private campaignFields(input: SendInput): InfobipCampaignFields {
    const ref = input.campaignReferenceId?.trim();
    if (!ref) return {};
    if (!config.infobip.campaignRefChannels.includes(input.channel)) return {};
    return { campaignReferenceId: ref };
  }

  /**
   * The entity to filter a reports query by: the message's own workspace, or
   * the account-wide `INFOBIP_ENTITY_ID` when the caller has none. Placeholder
   * values are dropped exactly as on the send path — filtering by a string
   * Infobip never saw would return an empty report set rather than an error.
   */
  private reportEntityFilter(entityId?: string): string | undefined {
    return this.platformFields(entityId).entityId;
  }

  /**
   * Compact callback echoed on Infobip DLRs → PostHog Hog extracts tenant/channel.
   * Format: `{tenantId}|{channel}|{maildrillMessageId}` (no pipes in those fields).
   */
  private callbackData(input: SendInput): string {
    return `${input.tenantId}|${input.channel}|${input.messageId}`;
  }

  /**
   * Optional per-message DLR push target. When `INFOBIP_NOTIFY_URL` is set,
   * Infobip pushes the delivery report to it (typically the PostHog Infobip
   * webhook `?kind=delivery`); paired with `callbackData` above, that's what lets
   * PostHog/the poller reconcile the DLR back to the Maildrill message. Empty →
   * rely on portal subscriptions + Messages API report pull. `notifyUrl` is the
   * field name used by the WhatsApp / SMS / Voice send APIs (camelCase).
   */
  private notifyFields(): InfobipNotifyFields {
    const notifyUrl = config.infobip.notifyUrl.trim();
    return notifyUrl ? { notifyUrl } : {};
  }

  /** PostHog (or portal) URL for open/click/unsub/complaint callbacks. */
  private trackingUrl(): string {
    return config.infobip.trackingUrl.trim();
  }

  private emailTrackingOptions(content: Record<string, unknown>): InfobipEmailTracking | undefined {
    return resolveEmailTracking(content, this.trackingUrl());
  }

  /**
   * Only stamp urlOptions when the body has a URL Infobip can shorten/track
   * and the campaign didn't opt out of click tracking (content.trackClicks
   * === false; absent = on, matching email semantics).
   */
  private urlOptionsForText(
    text: string,
    content: Record<string, unknown>,
  ): InfobipUrlOptions | undefined {
    if (content.trackClicks === false) return undefined;
    const trackingUrl = this.trackingUrl();
    if (!trackingUrl) return undefined;
    if (!/https?:\/\//i.test(text)) return undefined;
    return {
      shortenUrl: true,
      trackClicks: true,
      trackingUrl,
      removeProtocol: true,
    };
  }

  async send(input: SendInput): Promise<ProviderSendResult> {
    switch (input.channel) {
      case 'email':
        return this.post('/email/4/messages', this.buildEmailV4(input));
      case 'sms':
        return this.post('/sms/2/text/advanced', this.buildSms(input));
      case 'whatsapp': {
        const from = phoneSender(input.content.from, config.infobip.whatsappFrom);
        const missing = this.requirePhoneSender('whatsapp', from);
        if (missing) return missing;
        // A referenced approved template sends via the template endpoint; free
        // text (session messages) via the plain text endpoint.
        const templateName = normalizeWhatsAppTemplateName(str(input.content.templateName) ?? '');
        if (templateName) {
          return this.post(
            '/whatsapp/1/message/template',
            this.buildWhatsAppTemplate(input, from, templateName),
          );
        }
        const body = this.buildWhatsApp(input);
        if (!body.content.text) {
          return this.validationError('whatsapp: message text is required');
        }
        return this.post('/whatsapp/1/message/text', body);
      }
      case 'voice': {
        const message = this.buildVoice(input);
        const missing = this.requirePhoneSender('voice', message.from);
        if (missing) return missing;
        if (!message.text && !message.audioFileUrl) {
          return this.validationError('voice: text or audioFileUrl is required');
        }
        return this.post('/tts/3/advanced', {
          bulkId: input.correlationId,
          messages: [message],
        });
      }
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `App ${this.key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private validationError(message: string): ProviderSendResult {
    return {
      accepted: false,
      status: 'rejected',
      error: { category: 'validation', message, retryable: false },
    };
  }

  private requirePhoneSender(channel: string, from: string): ProviderSendResult | null {
    if (from) return null;
    return this.validationError(
      `infobip ${channel}: set INFOBIP_PHONE_FROM or INFOBIP_${channel.toUpperCase()}_FROM`,
    );
  }

  private buildEmailV4(input: SendInput): InfobipEmailBody {
    const c = input.content;
    const content: InfobipEmailContent = { subject: str(c.subject) ?? '' };
    const html = str(c.html);
    const text = str(c.text);
    if (html) content.html = html;
    if (text || !html) content.text = text ?? '';
    const webhooks: InfobipEmailWebhooks = {
      contentType: 'application/json',
      callbackData: this.callbackData(input),
    };
    // Empty notifyUrl → omit delivery so portal subscription settings apply.
    const notifyUrl = config.infobip.notifyUrl.trim();
    if (notifyUrl) webhooks.delivery = { url: notifyUrl, notify: true };
    const tracking = this.emailTrackingOptions(c);
    const platform = this.platformFields(input.entityId);
    const messageOptions: NonNullable<InfobipEmailBody['messages'][number]['options']> = {
      ...(this.campaignFields(input).campaignReferenceId
        ? { campaignReferenceId: input.campaignReferenceId }
        : {}),
      ...(Object.keys(platform).length > 0 ? { platform } : {}),
    };
    return {
      messages: [
        {
          sender: str(c.from) ?? config.infobip.from,
          destinations: [{ to: [{ destination: input.to }] }],
          content,
          callbackData: this.callbackData(input),
          webhooks,
          // Email v4 nests the campaign tag AND the CPaaS X identity under the
          // MESSAGE's options — distinct from the request-level
          // `options.tracking` below, and a different placement from the
          // message-level fields SMS/WhatsApp use, hence the separate build.
          ...(Object.keys(messageOptions).length > 0 ? { options: messageOptions } : {}),
        },
      ],
      ...(tracking ? { options: { tracking } } : {}),
    };
  }

  private buildSms(input: SendInput): InfobipSmsBody {
    const c = input.content;
    const from = str(c.from) ?? (config.infobip.smsFrom || 'Maildrill');
    const text = str(c.text) ?? '';
    const urlOptions = this.urlOptionsForText(text, c);
    return {
      messages: [
        {
          from,
          destinations: [{ to: e164Digits(input.to) }],
          text,
          callbackData: this.callbackData(input),
          ...(urlOptions ? { urlOptions } : {}),
          ...this.notifyFields(),
          ...this.platformFields(input.entityId),
          ...this.campaignFields(input),
        },
      ],
      bulkId: input.correlationId,
    };
  }

  private buildWhatsApp(input: SendInput): InfobipWhatsAppTextBody {
    const c = input.content;
    const text = str(c.text) ?? '';
    const content: InfobipWhatsAppTextContent = { text };
    if (c.previewUrl === true) content.previewUrl = true;
    const urlOptions = this.urlOptionsForText(text, c);
    return {
      from: phoneSender(c.from, config.infobip.whatsappFrom),
      to: e164Digits(input.to),
      messageId: input.messageId,
      content,
      callbackData: this.callbackData(input),
      ...(urlOptions ? { urlOptions } : {}),
      ...this.notifyFields(),
      ...this.platformFields(input.entityId),
    };
  }

  private buildVoice(input: SendInput): InfobipVoiceMessage {
    const c = input.content;
    const audioFileUrl = str(c.audioFileUrl);
    const message: InfobipVoiceMessage = {
      from: phoneSender(c.from, config.infobip.voiceFrom),
      destinations: [{ to: e164Digits(input.to), messageId: input.messageId }],
      callbackData: this.callbackData(input),
      ...this.notifyFields(),
      ...this.platformFields(input.entityId),
    };
    if (audioFileUrl) {
      message.audioFileUrl = audioFileUrl;
      return message;
    }
    const gender = str(c.voiceGender)?.toLowerCase();
    const name = str(c.voiceName);
    message.text = str(c.text) ?? '';
    message.language = str(c.language) ?? 'en';
    message.voice = {
      gender: gender === 'male' || gender === 'female' ? gender : 'female',
      name: name || 'Joanna',
    };
    const rate = typeof c.speechRate === 'number' ? c.speechRate : Number(str(c.speechRate));
    if (Number.isFinite(rate) && rate >= 0.5 && rate <= 2) message.speechRate = rate;
    return message;
  }

  /** Send using a pre-approved WhatsApp template; placeholders fill `{{n}}` vars. */
  private buildWhatsAppTemplate(
    input: SendInput,
    from: string,
    templateName: string,
  ): InfobipWhatsAppTemplateBody {
    const c = input.content;
    const placeholders = Array.isArray(c.placeholders)
      ? c.placeholders.map((p) => str(p) ?? String(p ?? ''))
      : [];
    // Template bodies can embed URLs Infobip shortens when urlOptions is set —
    // unless the campaign opted out of click tracking.
    const trackingUrl = this.trackingUrl();
    const urlOptions: InfobipUrlOptions | undefined =
      trackingUrl && c.trackClicks !== false
        ? {
            shortenUrl: true,
            trackClicks: true,
            trackingUrl,
            removeProtocol: true,
          }
        : undefined;
    return {
      messages: [
        {
          from,
          to: e164Digits(input.to),
          messageId: input.messageId,
          callbackData: this.callbackData(input),
          ...this.notifyFields(),
          ...(urlOptions ? { urlOptions } : {}),
          content: {
            templateName,
            templateData: { body: { placeholders } },
            // Must match the language code used when the template was registered.
            language: str(c.templateLanguage) ?? 'en',
          },
          ...this.platformFields(input.entityId),
        },
      ],
    };
  }

  /**
   * Single instrumented request to Infobip via `node:https` (not undici fetch).
   * Forces IPv4 and a 30s connect budget — undici's default 10s ConnectTimeout
   * routinely fails to Infobip on networks where IPv6 is broken or slow.
   */
  private async fetchInfobip(
    method: string,
    path: string,
    body: string | undefined,
  ): Promise<{ res: Response; text: string }> {
    const url = new URL(path, this.base.endsWith('/') ? this.base : `${this.base}/`);
    const headers = this.headers();
    const start = Date.now();

    try {
      const { statusCode, responseHeaders, text } = await new Promise<{
        statusCode: number;
        responseHeaders: Record<string, string>;
        text: string;
      }>((resolve, reject) => {
        const req = https.request(
          {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || 443,
            path: `${url.pathname}${url.search}`,
            method,
            headers: {
              ...headers,
              ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
            },
            // Prefer IPv4 — dual-stack connect hangs are a common Infobip timeout cause.
            family: 4,
            timeout: CONNECT_TIMEOUT_MS,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            res.on('end', () => {
              const rawHeaders: Record<string, string> = {};
              for (const [k, v] of Object.entries(res.headers)) {
                if (v == null) continue;
                rawHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
              }
              resolve({
                statusCode: res.statusCode ?? 0,
                responseHeaders: rawHeaders,
                text: Buffer.concat(chunks).toString('utf8'),
              });
            });
            res.on('error', reject);
          },
        );
        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
          req.destroy(new Error(`Infobip request timed out after ${REQUEST_TIMEOUT_MS}ms`));
        });
        req.on('timeout', () => {
          req.destroy(
            Object.assign(
              new Error(`ConnectTimeoutError: connect timed out after ${CONNECT_TIMEOUT_MS}ms`),
              {
                name: 'ConnectTimeoutError',
                code: 'UND_ERR_CONNECT_TIMEOUT',
              },
            ),
          );
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });

      // Minimal Response-like object for callers (ok, status, headers.get, text already read).
      const res = {
        ok: statusCode >= 200 && statusCode < 300,
        status: statusCode,
        headers: {
          get(name: string): string | null {
            const key = name.toLowerCase();
            const found = Object.entries(responseHeaders).find(([k]) => k.toLowerCase() === key);
            return found ? found[1] : null;
          },
        },
      };

      emitProviderHttp({
        provider: this.name,
        method,
        url: url.toString(),
        requestHeaders: redactHeaders(headers),
        requestBody: body,
        status: statusCode,
        responseHeaders,
        responseBody: text,
        durationMs: Date.now() - start,
      });
      return { res: res as Response, text };
    } catch (err) {
      emitProviderHttp({
        provider: this.name,
        method,
        url: url.toString(),
        requestHeaders: redactHeaders(headers),
        requestBody: body,
        status: 0,
        responseHeaders: {},
        durationMs: Date.now() - start,
        error: formatFetchError(err),
      });
      throw err;
    }
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
    const { res, text } = await this.fetchInfobip(
      method,
      path,
      body ? JSON.stringify(body) : undefined,
    );
    return { ok: res.ok, status: res.status, json: text ? safeJson(text) : {} };
  }

  /**
   * Mailbox validation via Infobip `/email/2/validation`, one address per call
   * with bounded concurrency.
   *
   * The bulk endpoint (`/email/2/validations`) is asynchronous — measured
   * ~13s of warm-up before results start and 2.5–4.4 addresses/s — which is
   * fine for a background job but not for something a send is waiting on. The
   * singular endpoint answers in ~500ms, so a bounded fan-out returns a whole
   * trial-sized audience in a few seconds.
   *
   * **Every call is billed** ($0.0077 at the time of writing, 15× the cost of
   * sending the email), so callers must cap the address count themselves.
   *
   * Fails open: an address we could not check is returned `valid: true,
   * unknown: true`. A provider outage must not silently block sending, and the
   * caller decides what to do with an unknown.
   */
  async validateEmailAddresses(addresses: string[]): Promise<Map<string, AddressValidation>> {
    const out = new Map<string, AddressValidation>();
    const unique = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter(Boolean))];
    const CONCURRENCY = 10;

    for (let i = 0; i < unique.length; i += CONCURRENCY) {
      const wave = unique.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        wave.map(async (to): Promise<AddressValidation> => {
          try {
            const { res, text } = await this.fetchInfobip(
              'POST',
              'email/2/validation',
              JSON.stringify({ to }),
            );
            if (!res.ok) return { valid: true, unknown: true };
            const json = safeJson(text);
            // `validMailbox` is a STRING ("true"/"false"/"unknown") while every
            // sibling flag is a real boolean — a truthiness check here would
            // read "false" as valid and defeat the whole exercise.
            const mailbox = String(str(json.validMailbox) ?? '').toLowerCase();
            const reason = str(json.detailedReasons) ?? str(json.reason);
            if (mailbox === 'false') return { valid: false, ...(reason ? { reason } : {}) };
            if (mailbox === 'true') return { valid: true };
            return { valid: true, unknown: true };
          } catch {
            return { valid: true, unknown: true };
          }
        }),
      );
      wave.forEach((address, j) => out.set(address, results[j]!));
    }
    return out;
  }

  /**
   * Create the CPaaS X entity a workspace's traffic is tagged with.
   *
   * Idempotent: 409 means it already exists, which is success (`existed`).
   *
   * A 403 means the account's API key has no provisioning scope. The caller
   * logs and continues rather than failing the signup, but the entity then
   * does NOT exist — nothing else creates it. Infobip does not materialise an
   * entity from an unknown `entityId` carried on a traffic API call; that was
   * verified against the live account on 2026-08-17, where a workspace with
   * 153 accepted entity-tagged sends still read back 404. Traffic tagged with
   * an id no entity backs is accepted and billed, just unattributable.
   */
  async createEntity(input: {
    entityId: string;
    entityName: string;
  }): Promise<EntityProvisionResult> {
    try {
      const { res, text } = await this.fetchInfobip(
        'POST',
        'provisioning/1/entities',
        JSON.stringify({ entityId: input.entityId, entityName: input.entityName }),
      );
      if (res.ok) return { ok: true };
      if (res.status === 409) return { ok: true, existed: true };
      const message = this.extractError(text ? safeJson(text) : {}) ?? `infobip ${res.status}`;
      if (res.status === 403 || res.status === 401) {
        return { ok: false, forbidden: true, error: message };
      }
      return { ok: false, error: message };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'network error' };
    }
  }

  async registerWhatsAppTemplate(input: RegisterTemplateInput): Promise<RegisterTemplateResult> {
    const name = normalizeWhatsAppTemplateName(input.name);
    if (!name) {
      return {
        ok: false,
        error: {
          category: 'validation',
          message:
            'WhatsApp template name must contain lowercase letters, numbers, or underscores (e.g. wa1)',
          retryable: false,
        },
      };
    }
    const s = input.structure;
    const structure: Record<string, unknown> = {
      body: {
        text: s.body.text,
        ...(s.body.examples?.length ? { examples: s.body.examples } : {}),
      },
    };
    if (s.header) structure.header = s.header;
    if (s.footer) structure.footer = s.footer;
    if (s.buttons?.length) structure.buttons = s.buttons;
    if (input.structureType) structure.type = input.structureType;
    else if (s.header || s.footer || s.buttons?.length) structure.type = 'MEDIA';
    const body = {
      name,
      language: input.language,
      category: input.category,
      structure,
      // CPaaS X: nested platform block (not top-level fields).
      ...this.platformBlock(input.entityId),
    };
    const path = `/whatsapp/2/senders/${encodeURIComponent(input.sender)}/templates`;
    try {
      // One retry: intermittent undici connect timeouts to Infobip show up as "fetch failed".
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await this.rawRequest('POST', path, body);
          if (!res.ok) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                '[infobip] registerWhatsAppTemplate failed',
                JSON.stringify({ status: res.status, path, body, response: res.json }, null, 2),
              );
            }
            return { ok: false, error: this.httpError(res.status, res.json) };
          }
          return {
            ok: true,
            providerTemplateId: str(res.json.id),
            status: mapTemplateStatus(res.json.status),
          };
        } catch (err) {
          lastErr = err;
          if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
        }
      }
      return { ok: false, error: this.networkError(lastErr) };
    } catch (err) {
      return { ok: false, error: this.networkError(err) };
    }
  }

  async listWhatsAppTemplates(sender: string): Promise<ListTemplatesResult> {
    try {
      const res = await this.rawRequest(
        'GET',
        `/whatsapp/2/senders/${encodeURIComponent(sender)}/templates`,
      );
      if (!res.ok) return { ok: false, templates: [], error: this.httpError(res.status, res.json) };
      const rows = Array.isArray(res.json.templates) ? res.json.templates : [];
      const templates: RemoteTemplate[] = rows
        .map((row): RemoteTemplate => {
          const r = asRecord(row);
          return {
            id: str(r.id) ?? '',
            name: str(r.name) ?? '',
            language: str(r.language) ?? '',
            status: mapTemplateStatus(r.status),
            category: str(r.category),
          };
        })
        .filter((t) => t.id);
      return { ok: true, templates };
    } catch (err) {
      return { ok: false, templates: [], error: this.networkError(err) };
    }
  }

  normalizeTemplateWebhook(input: ProviderWebhookInput): TemplateStatusEvent | null {
    const body = asRecord(input.body);
    const rawId = body.messageTemplateId;
    const providerTemplateId = rawId === undefined || rawId === null ? undefined : String(rawId);
    const change = asRecord(body.change);
    const newStatus = str(change.newStatus);
    if (!providerTemplateId || !newStatus) return null;
    const reason = str(change.reason);
    return {
      providerTemplateId,
      name: str(body.messageTemplateName),
      status: mapTemplateStatus(newStatus),
      rejectionReason: reason && reason !== 'NONE' ? reason : undefined,
    };
  }

  private httpError(status: number, json: Record<string, unknown>): ProviderSendError {
    const category = classifyHttpStatus(status);
    return {
      category,
      code: String(status),
      message: this.extractError(json) ?? `infobip ${status}`,
      retryable: isRetryable(category),
    };
  }

  private networkError(err: unknown): ProviderSendError {
    const category = classifyNetworkError(err);
    let message = formatFetchError(err);
    if (/fetch failed|ConnectTimeout|HeadersTimeout|UND_ERR/i.test(message)) {
      message +=
        ' — Infobip did not complete the HTTP response in time. Retry; if it persists, check connectivity to INFOBIP_BASE_URL and that the WhatsApp sender is active on this account.';
    }
    return {
      category,
      message,
      retryable: isRetryable(category),
    };
  }

  private async post(path: string, body: InfobipSendBody): Promise<ProviderSendResult> {
    // One quick retry on connect/network blips (BullMQ will still back off further).
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { res, text } = await this.fetchInfobip('POST', path, JSON.stringify(body));
        const json = text ? safeJson(text) : {};
        const requestId = res.headers.get('x-request-id') ?? undefined;

        if (!res.ok) {
          const category = classifyHttpStatus(res.status);
          return {
            accepted: false,
            status: 'rejected',
            providerRequestId: requestId,
            error: {
              category,
              code: String(res.status),
              message: this.extractError(json) ?? `infobip ${res.status}`,
              retryable: isRetryable(category),
            },
          };
        }
        return {
          accepted: true,
          status: 'submitted',
          providerMessageId: this.extractMessageId(json),
          providerRequestId: requestId,
        };
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 750));
      }
    }
    return {
      accepted: false,
      status: 'rejected',
      error: this.networkError(lastErr),
    };
  }

  private extractMessageId(json: Record<string, unknown>): string | undefined {
    const messages = json.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return str(asRecord(messages[0]).messageId);
    }
    return str(json.messageId) ?? str(json.bulkId);
  }

  private extractError(json: Record<string, unknown>): string | undefined {
    const requestError = asRecord(json.requestError);
    const serviceException = asRecord(requestError.serviceException);
    const text = str(serviceException.text) ?? str(json.text) ?? str(json.description);
    const messageId = str(serviceException.messageId) ?? str(json.errorCode);
    let message =
      text && messageId && messageId !== text ? `${text} (${messageId})` : (text ?? messageId);
    if (!message) return undefined;
    const validation = asRecord(serviceException.validationErrors);
    const validationBits = Object.entries(validation).flatMap(([field, errs]) => {
      const list = Array.isArray(errs) ? errs : [errs];
      return list
        .map((e) => (typeof e === 'string' ? e : null))
        .filter((e): e is string => Boolean(e))
        .map((e) => `${field}: ${e}`);
    });
    if (validationBits.length) message += ` — ${validationBits.join('; ')}`;
    // Point operators at the usual fix when CPaaS X bindings are the cause.
    if (/forbidden application id|forbidden entity id/i.test(message)) {
      message +=
        ' — set INFOBIP_APPLICATION_ID / INFOBIP_ENTITY_ID to the Application/Entity that owns this sender (portal → Developer tools → Applications and entities), or use a main (unbound) API key. Restart the server after editing .env.';
    } else if (/unauthorized access/i.test(message)) {
      message +=
        ' — usually a bad CPaaS X Application/Entity on the request (check INFOBIP_APPLICATION_ID / INFOBIP_ENTITY_ID — leave empty for an unbound main key), or the key is Application-linked and cannot call management APIs. Scopes alone are not enough if platform IDs are wrong.';
    }
    return message;
  }

  async normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedProviderEvent[]> {
    const body = asRecord(input.body);
    const results = Array.isArray(body.results) ? body.results : [];
    return results.map((entry): NormalizedProviderEvent => {
      const e = asRecord(entry);
      const status = asRecord(e.status);
      const outcome = mapInfobipGroup(str(status.groupName));
      const doneAt = str(e.doneAt) ?? str(e.sentAt);
      return {
        providerEventId: str(e.bulkId) ? `${str(e.bulkId)}:${str(e.messageId)}` : undefined,
        fingerprintParts: [str(e.messageId), str(status.groupName), str(e.doneAt)],
        providerMessageId: str(e.messageId),
        correlationId: str(e.bulkId),
        eventType: input.kind,
        outcome,
        providerStatus: str(status.name) ?? str(status.groupName),
        occurredAt: doneAt ? new Date(doneAt) : undefined,
        raw: e,
      };
    });
  }

  /**
   * Pull delivery status via Messages API reports (works for WhatsApp — there is
   * no `/whatsapp/1/logs` endpoint). Reports for a given id are returned once.
   */
  async getDeliveryStatusGroup(
    channel: Channel,
    providerMessageId: string,
    entityId?: string,
  ): Promise<string | null> {
    const channelParam = messagesApiChannel(channel);
    const q = new URLSearchParams({ messageId: providerMessageId, limit: '10' });
    if (channelParam) q.set('channel', channelParam);
    // `/messages-api/1/reports` and `/sms/1/reports` take entityId as a query
    // filter; `/whatsapp/2/logs` and `/tts/3/reports` publish no such parameter,
    // so those two stay account-wide and are matched on messageId alone.
    const entity = this.reportEntityFilter(entityId);
    if (entity) q.set('entityId', entity);

    // Unified reports API covers standalone WhatsApp/SMS/email sends too.
    // Voice reports are NOT in the unified API — they live at /tts/3/reports.
    // Reports are one-shot (consumed on read); the WhatsApp logs endpoint is
    // idempotent with ~48h retention, so it recovers messages whose report
    // was already drained (e.g. REJECTED sends with no PostHog DLR).
    const paths = [
      `/messages-api/1/reports?${q.toString()}`,
      ...(channel === 'whatsapp'
        ? [`/whatsapp/2/logs?messageId=${encodeURIComponent(providerMessageId)}`]
        : []),
      ...(channel === 'sms'
        ? [
            `/sms/1/reports?messageId=${encodeURIComponent(providerMessageId)}` +
              (entity ? `&entityId=${encodeURIComponent(entity)}` : ''),
          ]
        : []),
      ...(channel === 'voice'
        ? [`/tts/3/reports?messageId=${encodeURIComponent(providerMessageId)}`]
        : []),
    ];

    for (const path of paths) {
      try {
        const { res, text } = await this.fetchInfobip('GET', path, undefined);
        if (!res.ok) continue;
        const json = text ? safeJson(text) : {};
        const results = Array.isArray(json.results) ? json.results : [];
        for (let i = results.length - 1; i >= 0; i--) {
          const row = asRecord(results[i]);
          const rowId = str(row.messageId);
          if (rowId && rowId !== providerMessageId) continue;
          const status = asRecord(row.status);
          const group = str(status.groupName);
          if (group) return group;
        }
      } catch {
        /* try next path */
      }
    }
    return null;
  }

  /**
   * Drain a batch of recent DLRs (each report returned only once by Infobip).
   * Prefer this over per-id polls when catching up many open messages.
   */
  async pullDeliveryReports(
    channel?: Channel,
    limit = 100,
    entityId?: string,
  ): Promise<Array<{ providerMessageId: string; statusGroup: string }>> {
    const q = new URLSearchParams({
      limit: String(Math.min(Math.max(limit, 1), 1000)),
    });
    const channelParam = channel ? messagesApiChannel(channel) : null;
    if (channelParam) q.set('channel', channelParam);
    // Scope the drain to one workspace so this call cannot consume — and throw
    // away — reports belonging to another. `/tts/3/reports` has no entityId
    // parameter, so voice drains stay account-wide.
    const entity = this.reportEntityFilter(entityId);
    if (entity) q.set('entityId', entity);

    // Voice reports are not in the unified Messages API — drain /tts/3/reports.
    const path =
      channel === 'voice'
        ? `/tts/3/reports?limit=${Math.min(Math.max(limit, 1), 1000)}`
        : `/messages-api/1/reports?${q.toString()}`;

    try {
      const { res, text } = await this.fetchInfobip('GET', path, undefined);
      if (!res.ok) return [];
      const json = text ? safeJson(text) : {};
      const results = Array.isArray(json.results) ? json.results : [];
      const out: Array<{ providerMessageId: string; statusGroup: string }> = [];
      for (const item of results) {
        const row = asRecord(item);
        const providerMessageId = str(row.messageId);
        const statusGroup = str(asRecord(row.status).groupName);
        if (providerMessageId && statusGroup) {
          out.push({ providerMessageId, statusGroup });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

function messagesApiChannel(channel: Channel): string | null {
  switch (channel) {
    case 'whatsapp':
      return 'WHATSAPP';
    case 'sms':
      return 'SMS';
    case 'email':
      return 'EMAIL';
    case 'voice':
      return 'VOICE';
    default:
      return null;
  }
}
