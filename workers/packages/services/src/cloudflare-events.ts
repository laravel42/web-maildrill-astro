import { config } from '@maildrill/config';
import { createLogger } from '@maildrill/observability';
import { ingestWebhook } from './webhook-intake';

const log = createLogger({ component: 'cloudflare-events' });

const PULL_BATCH_SIZE = 50;
/** Long enough to persist a batch; unacked messages reappear after this. */
const VISIBILITY_TIMEOUT_MS = 60_000;
/** Redeliver a failed ingest after a minute rather than immediately. */
const RETRY_DELAY_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * HTTP pull consumer for the Cloudflare Queue that Email Sending event
 * subscriptions publish to (delivered / deferred / bounced / failed /
 * rejected / complained). Each pulled event is persisted through the normal
 * webhook intake (dedup on raw body, async processing by the events worker,
 * where CloudflareProvider.normalizeWebhook correlates it to a message by
 * provider message id). Successfully ingested events are acked; failures are
 * left to redeliver with a delay.
 *
 * Setup: create a queue, subscribe it to the Email Service events
 * (dashboard → Queues → Event subscriptions, source "Email Sending"), then set
 * CLOUDFLARE_EVENTS_QUEUE_ID and a token with Queues Read+Write.
 */
export interface CloudflareEventsPollResult {
  pulled: number;
  ingested: number;
  duplicates: number;
  failed: number;
}

export function cloudflareEventsConfigured(): boolean {
  const cf = config.cloudflare;
  return Boolean(cf.accountId && cf.eventsQueueId && cf.eventsApiToken);
}

interface PulledMessage {
  id: string;
  leaseId: string;
  text: string;
}

function queueUrl(op: 'pull' | 'ack'): string {
  const cf = config.cloudflare;
  return `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/queues/${cf.eventsQueueId}/messages/${op}`;
}

async function queuesRequest(
  op: 'pull' | 'ack',
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(queueUrl(op), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.cloudflare.eventsApiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`cloudflare queues ${op} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`cloudflare queues ${op}: non-JSON response`);
  }
}

function decodeBody(raw: unknown, contentType: string | undefined): string {
  const body = typeof raw === 'string' ? raw : '';
  // json/bytes bodies arrive base64-encoded; text arrives as plain UTF-8.
  if (contentType === 'json' || contentType === 'bytes') {
    return Buffer.from(body, 'base64').toString('utf8');
  }
  return body;
}

function parsePulled(json: Record<string, unknown>): PulledMessage[] {
  const result = (json.result ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(result.messages) ? result.messages : [];
  const out: PulledMessage[] = [];
  for (const row of rows) {
    const m = row as Record<string, unknown>;
    const leaseId = typeof m.lease_id === 'string' ? m.lease_id : '';
    if (!leaseId) continue;
    const metadata = (m.metadata ?? {}) as Record<string, unknown>;
    const contentType = Object.entries(metadata).find(
      ([k]) => k.toLowerCase() === 'cf-content-type',
    )?.[1];
    out.push({
      id: typeof m.id === 'string' ? m.id : '',
      leaseId,
      text: decodeBody(m.body, typeof contentType === 'string' ? contentType : undefined),
    });
  }
  return out;
}

/** Pull one batch of Email Sending events and ingest them. Returns counts. */
export async function pullCloudflareEmailEvents(): Promise<CloudflareEventsPollResult> {
  const result: CloudflareEventsPollResult = { pulled: 0, ingested: 0, duplicates: 0, failed: 0 };
  if (!cloudflareEventsConfigured()) return result;

  const pulled = parsePulled(
    await queuesRequest('pull', {
      batch_size: PULL_BATCH_SIZE,
      visibility_timeout_ms: VISIBILITY_TIMEOUT_MS,
    }),
  );
  result.pulled = pulled.length;
  if (pulled.length === 0) return result;

  const acks: Array<{ lease_id: string }> = [];
  const retries: Array<{ lease_id: string; delay_seconds: number }> = [];

  for (const msg of pulled) {
    try {
      const event: unknown = JSON.parse(msg.text);
      const ingested = await ingestWebhook({
        provider: 'cloudflare',
        kind: 'delivery',
        headers: { 'x-cloudflare-queue-message-id': msg.id },
        body: event,
        rawBody: msg.text,
      });
      if (ingested.duplicate) result.duplicates += 1;
      else result.ingested += 1;
      acks.push({ lease_id: msg.leaseId });
    } catch (err) {
      // Unparseable bodies would fail forever — ack them and keep only
      // ingest/DB failures on the redelivery path.
      if (err instanceof SyntaxError) {
        log.warn({ queueMessageId: msg.id }, 'cloudflare event body is not JSON — dropping');
        acks.push({ lease_id: msg.leaseId });
      } else {
        retries.push({ lease_id: msg.leaseId, delay_seconds: RETRY_DELAY_SECONDS });
      }
      result.failed += 1;
    }
  }

  if (acks.length > 0 || retries.length > 0) {
    await queuesRequest('ack', { acks, retries });
  }
  return result;
}
