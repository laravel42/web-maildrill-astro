import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '@maildrill/config';
import { ingestWebhook } from '@maildrill/services';
import { createLogger } from '@maildrill/observability';
import type { ZodTypeProvider } from '@maildrill/httpkit';

const log = createLogger({ component: 'ses-webhook' });

const query = z.object({ secret: z.string().optional() });

// Shared with the generic /webhooks/:provider/:kind route (see webhooks.ts) —
// one unguessable-URL secret gates every provider webhook in this API, same
// reasoning as the unsubscribe link token.
function secretOk(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.webhooks.infobipSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface SnsEnvelope {
  Type?: 'SubscriptionConfirmation' | 'Notification' | 'UnsubscribeConfirmation';
  Message?: string;
  SubscribeURL?: string;
  MessageId?: string;
  TopicArn?: string;
}

function parseSnsEnvelope(raw: string): SnsEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SnsEnvelope) : null;
  } catch {
    return null;
  }
}

/**
 * Amazon SNS push endpoint for SES delivery events: SES Configuration Set →
 * Event Destination → SNS topic → this route. Two things make SNS different
 * from every other webhook this API accepts:
 *
 * 1. It posts `Content-Type: text/plain` (a JSON body regardless), so this
 *    plugin registers its own content-type parser rather than relying on
 *    Fastify's default JSON parser — scoped to this plugin, so it cannot
 *    affect any other route.
 * 2. A brand-new subscription arrives as a `SubscriptionConfirmation`
 *    message carrying a `SubscribeURL` that must be fetched once to activate
 *    delivery; this handler does that automatically so standing up a new
 *    topic/subscription needs no manual step.
 *
 * A `Notification` message's `Message` field is the actual SES event as a
 * JSON string — unwrapped here and hand off to the same generic
 * `ingestWebhook` intake every other provider uses, so `SesProvider.
 * normalizeWebhook` is the only place that ever sees the SES-specific shape.
 *
 * This is a fallback/manual-testing path — the same relationship Infobip's
 * `/webhooks/infobip/*` routes have to its PostHog pipeline. Production
 * points the SNS subscription at PostHog instead (Hog does the same event
 * mapping `normalizeWebhook` does here, then the existing campaign-delivery
 * poller HogQL-reads it back) — see `docs/posthog-ses-hog.md`.
 *
 * Setup for THIS route specifically: SES Configuration Set → Event
 * destination → Amazon SNS → topic; subscribe that topic with protocol
 * HTTPS, endpoint `https://<api-host>/webhooks/ses/sns?secret=<WEBHOOK_INFOBIP_SECRET>`.
 */
export async function sesWebhookRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    (_req, body: string, done) => done(null, body),
  );

  app.post(
    '/webhooks/ses/sns',
    { schema: { tags: ['Webhooks'], summary: 'Amazon SNS push endpoint for SES delivery events (secret-gated)', querystring: query } },
    async (req, reply) => {
      const headerSecret = req.headers['x-webhook-secret'];
      const secret = typeof headerSecret === 'string' ? headerSecret : req.query.secret;
      if (!secretOk(secret)) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      const envelope = parseSnsEnvelope(rawBody);
      if (!envelope) {
        return reply.code(400).send({ error: 'invalid_sns_envelope' });
      }

      if (envelope.Type === 'SubscriptionConfirmation' || envelope.Type === 'UnsubscribeConfirmation') {
        if (envelope.SubscribeURL) {
          try {
            await fetch(envelope.SubscribeURL, { signal: AbortSignal.timeout(10_000) });
            log.info({ topicArn: envelope.TopicArn }, `ses sns ${envelope.Type} confirmed`);
          } catch (err) {
            log.error(
              { topicArn: envelope.TopicArn, err: err instanceof Error ? err.message : String(err) },
              'ses sns confirmation fetch failed',
            );
          }
        }
        return reply.code(200).send({ ok: true });
      }

      if (envelope.Type !== 'Notification' || typeof envelope.Message !== 'string') {
        return reply.code(200).send({ ok: true, ignored: envelope.Type ?? 'unknown' });
      }

      let event: unknown;
      try {
        event = JSON.parse(envelope.Message);
      } catch {
        log.warn({ snsMessageId: envelope.MessageId }, 'ses sns Notification.Message is not JSON — dropping');
        return reply.code(200).send({ ok: true, ignored: 'unparseable' });
      }

      const result = await ingestWebhook({
        provider: 'ses',
        kind: 'delivery',
        headers: req.headers,
        body: event,
        rawBody: envelope.Message,
      });
      return reply
        .code(202)
        .send({ webhookEventId: result.webhookEventId, duplicate: result.duplicate });
    },
  );
}
