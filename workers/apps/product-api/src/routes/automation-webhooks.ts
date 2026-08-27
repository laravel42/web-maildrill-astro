import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  automationLimits,
  createRun,
  payloadWithinLimit,
  recordWebhookPayload,
  resolveWebhookToken,
} from '@maildrill/automations';
import { createLogger, metrics } from '@maildrill/observability';

const log = createLogger({ component: 'automation-webhook' });

/**
 * Public entry point for webhook-triggered automations.
 *
 * NOT behind `authenticate`: the token in the path is the credential, because an external
 * system has no Maildrill session. It is 32 random bytes, stored hashed, and revocable by
 * re-minting — the same trade the one-click unsubscribe link makes.
 *
 * Every failure answers 404 with the same body. "Unknown token", "automation paused" and
 * "never published" must be indistinguishable, or the endpoint becomes a way to probe
 * which tokens exist.
 */
export async function automationWebhookRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/webhooks/automations/:token',
    {
      schema: {
        tags: ['Automations'],
        summary: 'Start a webhook-triggered automation (token in the path is the credential)',
        params: z.object({ token: z.string().min(16).max(128) }),
      },
    },
    async (req, reply) => {
      const resolved = await resolveWebhookToken(req.params.token);
      if (!resolved) {
        metrics.inc('automation_webhook_rejected_total', { reason: 'unknown_token' });
        return reply.code(404).send({ error: 'not_found' });
      }

      const payload = {
        body: (req.body ?? {}) as unknown,
        query: req.query as unknown,
        // A allow-list, not the whole header map: forwarding everything would put the
        // caller's own Authorization header into the run log.
        headers: {
          'content-type': req.headers['content-type'] ?? null,
          'user-agent': req.headers['user-agent'] ?? null,
        },
        receivedAt: new Date().toISOString(),
      };

      const limits = automationLimits();
      if (!payloadWithinLimit(payload, limits)) {
        metrics.inc('automation_webhook_rejected_total', { reason: 'payload_too_large' });
        return reply.code(413).send({ error: 'payload_too_large' });
      }

      await recordWebhookPayload(resolved.automation.id, payload);

      const result = await createRun({
        tenantId: resolved.tenantId,
        automationId: resolved.automation.id,
        automationVersionId: resolved.version.id,
        source: 'webhook',
        triggerPayload: payload,
        // No dedupe key: two identical POSTs are two real deliveries, and an external
        // system that wants at-most-once semantics has to say so with its own idempotency
        // field, which no standard defines here.
        dedupeKey: null,
      });

      if (!result.runId) {
        // The workspace is at its concurrency cap. 429 is the honest answer and tells a
        // well-behaved caller to back off, rather than silently dropping the delivery.
        return reply.code(429).send({ error: 'too_many_runs' });
      }

      log.info(
        {
          tenantId: resolved.tenantId,
          automationId: resolved.automation.id,
          runId: result.runId,
        },
        'automation webhook accepted',
      );
      return reply.code(202).send({ runId: result.runId });
    },
  );
}
