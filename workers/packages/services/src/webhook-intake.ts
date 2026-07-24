import { and, eq } from "drizzle-orm";
import { db, webhookEvents } from "@maildrill/database";
import {
  JOB_NAMES,
  QUEUE_NAMES,
  webhookFingerprint,
  type ProcessWebhookJobV1,
} from "@maildrill/domain";
import { enqueue } from "@maildrill/queues";
import { metrics } from "@maildrill/observability";
import type { WebhookKind } from "@maildrill/providers";

const REDACTED = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = REDACTED.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

export interface IngestWebhookInput {
  provider: string;
  kind: WebhookKind;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody: string;
  tenantId?: string;
}

export interface IngestWebhookResult {
  webhookEventId: string;
  duplicate: boolean;
}

/**
 * Persist a raw webhook and enqueue async processing. Deduplicates on
 * (provider, fingerprint) so duplicate deliveries never create duplicate work.
 * Returns quickly — the heavy lifting happens in the provider-events worker.
 */
export async function ingestWebhook(
  input: IngestWebhookInput,
): Promise<IngestWebhookResult> {
  const fingerprint = webhookFingerprint(input.provider, input.rawBody);

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      kind: input.kind,
      tenantId: input.tenantId ?? null,
      eventFingerprint: fingerprint,
      headers: sanitizeHeaders(input.headers),
      payload: input.body,
      processingStatus: "pending",
    })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventFingerprint],
    })
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    metrics.inc("provider_webhook_duplicate_total", { provider: input.provider });
    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, input.provider),
          eq(webhookEvents.eventFingerprint, fingerprint),
        ),
      )
      .limit(1);
    return { webhookEventId: existing[0]!.id, duplicate: true };
  }

  const row = inserted[0]!;
  await enqueue(QUEUE_NAMES.events, JOB_NAMES.processDeliveryReport, {
    version: 1,
    webhookEventId: row.id,
    provider: input.provider,
    correlationId: row.id,
  } satisfies ProcessWebhookJobV1);

  return { webhookEventId: row.id, duplicate: false };
}
