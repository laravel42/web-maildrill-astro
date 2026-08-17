import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '@maildrill/config';
import { createLogger } from '@maildrill/observability';
import {
  ingestUsageCallback,
  processPaymentWebhook,
  WebhookVerificationError,
  type UsageCallbackPayload,
} from '@maildrill/billing';

const log = createLogger({ component: 'billing-webhooks-route' });

/**
 * Payment-provider webhook intake. Lives in its own plugin so its scoped
 * content-type parser (raw string, required for signature verification)
 * never leaks to the JSON routes, and so it can skip `authenticate` — the
 * HMAC signature IS the authentication.
 *
 * Response contract: 2xx = consumed (including duplicates/skips — redelivery
 * can't help), 400 = bad signature (misconfiguration), 5xx = transient
 * failure, provider please retry.
 */
export async function billingWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    ['application/json', 'application/json; charset=utf-8'],
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

  app.post('/v1/billing/webhooks/stripe', {
    schema: {
      tags: ['Billing'],
      summary: 'Stripe webhook intake (signature-authenticated, idempotent)',
    },
    config: { rateLimit: false },
    handler: async (req, reply) => {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      const signature = req.headers['stripe-signature'];
      try {
        const outcome = await processPaymentWebhook(
          rawBody,
          typeof signature === 'string' ? signature : undefined,
        );
        return reply.code(200).send({ received: true, outcome: outcome.outcome });
      } catch (err) {
        if (err instanceof WebhookVerificationError) {
          log.warn({ err: err.message }, 'rejected unverifiable payment webhook');
          return reply.code(400).send({ error: 'invalid_signature' });
        }
        log.error({ err }, 'payment webhook processing failed — provider will retry');
        return reply.code(500).send({ error: 'processing_failed' });
      }
    },
  });

  /**
   * Infobip billing-usage results.
   *
   * Infobip signs nothing on this callback and offers no shared-secret header,
   * so the unguessable `?token=` in the URL we handed it at query time IS the
   * authentication — the same construction as the unsubscribe and webview
   * links. Compared in constant time so the token can't be recovered a byte at
   * a time from response latency.
   *
   * Response contract differs from Stripe's on purpose: Infobip delivers each
   * result EXACTLY ONCE and never retries, so a 5xx here loses the data
   * permanently. Everything that reaches the handler is therefore answered 200
   * once it has been persisted, and genuine processing failures are recorded on
   * the request row (status `failed`) for the sweeper to re-ask, rather than
   * being pushed back to a provider that will not call again.
   */
  app.post('/v1/billing/webhooks/infobip-usage', {
    schema: {
      tags: ['Billing'],
      summary: 'Infobip billing usage result intake (token-authenticated, idempotent)',
    },
    config: { rateLimit: false },
    handler: async (req, reply) => {
      const expected = config.infobip.billingCallbackToken.trim();
      const provided = String((req.query as { token?: unknown } | undefined)?.token ?? '');
      if (!expected || !constantTimeEquals(provided, expected)) {
        log.warn('rejected billing usage callback with bad or missing token');
        return reply.code(401).send({ error: 'unauthorized' });
      }

      let payload: UsageCallbackPayload;
      try {
        payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as UsageCallbackPayload;
      } catch {
        return reply.code(400).send({ error: 'invalid_json' });
      }

      try {
        const result = await ingestUsageCallback(payload);
        return reply.code(200).send({ received: true, ...result });
      } catch (err) {
        // Persisting failed, and a retry will never come. Log loudly with the
        // requestId so the payload can be re-requested by hand if needed.
        log.error(
          { err, requestId: (payload as { requestId?: unknown })?.requestId },
          'billing usage callback could not be persisted — result is lost, re-query required',
        );
        return reply.code(200).send({ received: true, stored: false });
      }
    },
  });
}

/** Length-independent constant-time comparison. */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still burn a comparison so length is not leaked by timing alone.
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}
