import type { FastifyInstance } from 'fastify';
import { createLogger } from '@maildrill/observability';
import { processPaymentWebhook, WebhookVerificationError } from '@maildrill/billing';

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
}
