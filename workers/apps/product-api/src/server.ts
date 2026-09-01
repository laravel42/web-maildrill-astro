import Fastify, { type FastifyInstance } from 'fastify';
import { DomainError } from '@maildrill/domain';
import { logger } from '@maildrill/observability';
import { asClientError, isValidationError, setupOpenApi } from '@maildrill/httpkit';
import { installAutomationEventSink, installSubscriptionFilter } from '@maildrill/automations';
import { authRoutes } from './routes/auth';
import { statsRoutes } from './routes/stats';
import { mediaRoutes } from './routes/media';
import { campaignRoutes } from './routes/campaigns';
import { customFieldRoutes } from './routes/custom-fields';
import { healthRoutes } from './routes/health';
import { listRoutes } from './routes/lists';
import { unsubscribeRoutes } from './routes/unsubscribe';
import { meRoutes } from './routes/me';
import { securityRoutes } from './routes/security';
import { segmentRoutes } from './routes/segments';
import { subscriberRoutes } from './routes/subscribers';
import { suppressionRoutes } from './routes/suppressions';
import { tagRoutes } from './routes/tags';
import { templateRoutes } from './routes/templates';
import { landingRoutes } from './routes/landings';
import { channelRoutes } from './routes/channels';
import { voicePreviewRoutes } from './routes/voice-preview';
import { workspaceRoutes } from './routes/workspace';
import { billingRoutes } from './routes/billing';
import { billingWebhookRoutes } from './routes/billing-webhooks';
import { automationRoutes } from './routes/automations';
import { automationWebhookRoutes } from './routes/automation-webhooks';

/**
 * The product app's business routes, without health. Exported so the unified
 * dev server can mount them on a shared instance.
 */
export async function productRoutes(app: FastifyInstance): Promise<void> {
  /*
   * The API emits domain events too — a subscriber created through the UI must be able to
   * start a workflow — so the sink is installed here as well as in the worker. Installing
   * it is idempotent, and without a sink `emitMaildrillEvent` is a no-op, so this is the
   * switch that turns the bridge on for this process.
   */
  installAutomationEventSink();
  installSubscriptionFilter();

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(securityRoutes);
  await app.register(subscriberRoutes);
  await app.register(listRoutes);
  await app.register(unsubscribeRoutes);
  await app.register(segmentRoutes);
  await app.register(tagRoutes);
  await app.register(customFieldRoutes);
  await app.register(templateRoutes);
  await app.register(landingRoutes);
  await app.register(suppressionRoutes);
  await app.register(campaignRoutes);
  await app.register(channelRoutes);
  await app.register(voicePreviewRoutes);
  await app.register(statsRoutes);
  await app.register(mediaRoutes);
  await app.register(workspaceRoutes);
  await app.register(billingRoutes);
  await app.register(billingWebhookRoutes);
  await app.register(automationRoutes);
  await app.register(automationWebhookRoutes);
}

export function buildProductServer(): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 2_097_152 });

  setupOpenApi(app, {
    title: 'Maildrill Product API',
    version: '0.1.0',
    description:
      'Subscribers, lists, segments, tags, templates, suppressions, auth, and campaign send. Auth: x-api-key or Bearer JWT.',
  });

  void app.register(healthRoutes);
  void app.register(productRoutes);

  app.setErrorHandler((err, req, reply) => {
    if (isValidationError(err)) {
      return reply.code(400).send({ error: 'validation', issues: err.validation });
    }
    // A bad request the caller can act on (an invalid cursor) must say so —
    // masking it as `internal_error` invites a retry that can only fail again.
    const client = asClientError(err);
    if (client) return reply.code(client.statusCode).send({ error: client.error });
    // Same rule one layer down. A ValidationError is the domain saying "this
    // input is wrong", and it carried no statusCode, so every one of them fell
    // through to 500 — including the segment-rule checks whose whole purpose is
    // to answer 400 before the page query throws. `internal_error` on bad input
    // tells the caller to retry and tells us to go looking for an outage.
    if (err instanceof DomainError && err.category === 'validation') {
      return reply.code(400).send({ error: 'validation', message: err.message });
    }
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    logger.error(
      { err: err instanceof Error ? err.message : String(err), url: req.url },
      'product-api request error',
    );
    return reply.code(statusCode).send({ error: 'internal_error' });
  });

  return app;
}
