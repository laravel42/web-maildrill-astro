import {
  classifyHttpStatus,
  classifyNetworkError,
  isRetryable,
  type ProviderOutcome,
} from '@maildrill/domain';
import { config } from '@maildrill/config';
import { emitProviderHttp, redactHeaders } from './http-observer';
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

const REQUEST_TIMEOUT_MS = 60_000;

function safeJson(text: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return {};
  }
}

function formatFetchError(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur; i++) {
    if (cur instanceof Error) {
      const bit = cur.name && cur.name !== 'Error' ? `${cur.name}: ${cur.message}` : cur.message;
      if (bit && !parts.includes(bit)) parts.push(bit);
      cur = cur.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(' ← ') || 'fetch failed';
}

/** `from`/`reply_to` in the REST API: bare address string or `{address, name}`. */
type CloudflareAddress = { address: string; name?: string };

/** Split `Display Name <user@domain>` into the REST API's `{address, name}`. */
function parseAddress(value: string): CloudflareAddress {
  const match = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/.exec(value);
  if (match?.[2]) {
    const name = match[1]?.replace(/^"|"$/g, '').trim();
    return name ? { address: match[2], name } : { address: match[2] };
  }
  return { address: value.trim() };
}

export interface CloudflareEmailSettings {
  accountId: string;
  apiToken: string;
  from: string;
}

/** `POST /accounts/{id}/email/sending/send` request body. */
type CloudflareSendBody = {
  to: string;
  from: CloudflareAddress;
  subject: string;
  html?: string;
  text?: string;
  reply_to?: CloudflareAddress;
};

/**
 * Cloudflare Email Service adapter (Email Sending REST API) — email only.
 * Selecting it for another channel is a permanent validation error, so pair it
 * with PROVIDER_EMAIL_DRIVER=cloudflare to keep SMS/WhatsApp/Voice on Infobip.
 *
 * The From domain must be onboarded to Email Sending on the account
 * (`npx wrangler email sending enable <domain>`), and the token needs the
 * Email Sending permission. Note this is the same product that carries the
 * transactional SMTP relay (see transactional.ts) but a separate lane: REST
 * API, own token, campaign traffic only.
 *
 * Delivery visibility, two layers:
 * - The send response itself is synchronous: recipients come back as
 *   `delivered` / `queued` (accepted) or `permanent_bounces` (suppressed;
 *   rejected as permanent), plus a `message_id` stored for correlation.
 * - Event subscriptions push per-message lifecycle events (delivered /
 *   deferred / bounced / failed / rejected / complained) to a Cloudflare
 *   Queue; the cloudflare-email-events poller pulls that queue and feeds
 *   `normalizeWebhook` below, which correlates by `payload.messageId` ==
 *   the stored provider message id.
 */
export class CloudflareProvider implements MessagingProvider {
  readonly name = 'cloudflare';

  constructor(private readonly settings: CloudflareEmailSettings = config.cloudflare) {}

  async send(input: SendInput): Promise<ProviderSendResult> {
    if (input.channel !== 'email') {
      return this.validationError(
        `cloudflare: ${input.channel} is not supported (email only) — use PROVIDER_EMAIL_DRIVER=cloudflare so other channels keep their driver`,
      );
    }
    if (!this.settings.accountId || !this.settings.apiToken) {
      return this.validationError(
        'cloudflare email: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN',
      );
    }

    const c = input.content;
    const html = str(c.html);
    const text = str(c.text);
    const replyTo = str(c.replyTo);
    const body: CloudflareSendBody = {
      to: input.to,
      from: parseAddress(str(c.from) ?? this.settings.from),
      subject: str(c.subject) ?? '',
    };
    if (html) body.html = html;
    if (text || !html) body.text = text ?? '';
    if (replyTo) body.reply_to = parseAddress(replyTo);

    return this.post(body, input.to);
  }

  private validationError(message: string): ProviderSendResult {
    return {
      accepted: false,
      status: 'rejected',
      error: { category: 'validation', message, retryable: false },
    };
  }

  private networkError(err: unknown): ProviderSendError {
    const category = classifyNetworkError(err);
    return {
      category,
      message: `cloudflare email: ${formatFetchError(err)}`,
      retryable: isRetryable(category),
    };
  }

  private async post(body: CloudflareSendBody, recipient: string): Promise<ProviderSendResult> {
    // One quick retry on connect/network blips (BullMQ will still back off further).
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { status, headers, text } = await this.fetchCloudflare(JSON.stringify(body));
        const json = safeJson(text);
        const requestId = headers['cf-ray'] ?? headers['x-request-id'];

        if (status < 200 || status >= 300) {
          const category = classifyHttpStatus(status);
          const err = this.extractError(json);
          return {
            accepted: false,
            status: 'rejected',
            providerRequestId: requestId,
            error: {
              category,
              code: err.code ?? String(status),
              message: err.message ?? `cloudflare email ${status}`,
              retryable: isRetryable(category),
            },
          };
        }

        const result = asRecord(json.result);
        if (this.isPermanentBounce(result, recipient)) {
          return {
            accepted: false,
            status: 'rejected',
            providerRequestId: requestId,
            error: {
              category: 'permanent',
              code: 'permanent_bounce',
              message: `cloudflare email: ${recipient} is a known permanent bounce (suppressed)`,
              retryable: false,
            },
          };
        }
        return {
          accepted: true,
          status: 'submitted',
          // The send API returns recipient lists, not message ids; keep the
          // extraction defensive in case one is added later.
          providerMessageId: str(result.message_id) ?? str(result.id),
          providerRequestId: requestId,
        };
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 750));
      }
    }
    return { accepted: false, status: 'rejected', error: this.networkError(lastErr) };
  }

  private isPermanentBounce(result: Record<string, unknown>, recipient: string): boolean {
    const bounces = Array.isArray(result.permanent_bounces) ? result.permanent_bounces : [];
    const needle = recipient.trim().toLowerCase();
    return bounces.some((a) => typeof a === 'string' && a.trim().toLowerCase() === needle);
  }

  private extractError(json: Record<string, unknown>): { code?: string; message?: string } {
    const errors = Array.isArray(json.errors) ? json.errors : [];
    const first = asRecord(errors[0]);
    const message = str(first.message);
    return {
      code: first.code != null ? String(first.code) : undefined,
      message: message ? `cloudflare email: ${message}` : undefined,
    };
  }

  private async fetchCloudflare(
    body: string,
  ): Promise<{ status: number; headers: Record<string, string>; text: string }> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.settings.accountId}/email/sending/send`;
    const headers = {
      Authorization: `Bearer ${this.settings.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        responseHeaders[k.toLowerCase()] = v;
      });
      emitProviderHttp({
        provider: this.name,
        method: 'POST',
        url,
        requestHeaders: redactHeaders(headers),
        requestBody: body,
        status: res.status,
        responseHeaders,
        responseBody: text,
        durationMs: Date.now() - start,
      });
      return { status: res.status, headers: responseHeaders, text };
    } catch (err) {
      emitProviderHttp({
        provider: this.name,
        method: 'POST',
        url,
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

  /**
   * Normalize Email Sending event-subscription events
   * (https://developers.cloudflare.com/email-service/platform/event-subscriptions/).
   * Accepts a single event, a bare array, or an `{events: [...]}` wrapper so
   * both the queue pull poller (one event per queue message) and a batching
   * Worker forwarding to /webhooks/cloudflare/delivery parse identically.
   */
  async normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedProviderEvent[]> {
    const body = input.body;
    const wrapped = asRecord(body).events;
    const entries = Array.isArray(body) ? body : Array.isArray(wrapped) ? wrapped : [body];
    return entries.flatMap((entry): NormalizedProviderEvent[] => {
      const e = asRecord(entry);
      const type = str(e.type) ?? '';
      // `cf.email.sending.message.delivered` → `delivered`
      const name = /message\.([a-z]+)$/.exec(type)?.[1];
      if (!name) return [];
      const payload = asRecord(e.payload);
      const metadata = asRecord(e.metadata);
      const delivery = asRecord(payload.delivery);
      const at = str(metadata.eventTimestamp);
      return [
        {
          providerEventId: str(payload.eventId),
          fingerprintParts: [str(payload.eventId) ?? str(payload.messageId), type, at],
          providerMessageId: str(payload.messageId),
          eventType: `message.${name}`,
          outcome: CLOUDFLARE_EVENT_OUTCOMES[name] ?? 'submitted',
          providerStatus: str(delivery.status) ?? name,
          occurredAt: at ? new Date(at) : undefined,
          raw: e,
        },
      ];
    });
  }
}

/**
 * Event → message-state outcome. `deferred` stays `submitted` (retries pending
 * — the event is recorded but triggers no transition), and `complained` maps
 * to `delivered` because a spam complaint only happens after delivery; the
 * complaint itself is preserved in `eventType`/raw payload.
 */
const CLOUDFLARE_EVENT_OUTCOMES: Record<string, ProviderOutcome> = {
  delivered: 'delivered',
  deferred: 'submitted',
  bounced: 'failed',
  failed: 'failed',
  rejected: 'failed',
  complained: 'delivered',
};
