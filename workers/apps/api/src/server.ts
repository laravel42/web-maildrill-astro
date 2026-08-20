import Fastify, { type FastifyInstance } from 'fastify';
import { logger } from '@maildrill/observability';
import { isValidationError, setupOpenApi } from '@maildrill/httpkit';
import { adminRoutes } from './routes/admin';
import { healthRoutes } from './routes/health';
import { messageRoutes } from './routes/messages';
import { webhookRoutes } from './routes/webhooks';

/**
 * The messaging app's business routes, without health. Exported so the unified
 * dev server can mount them alongside the other apps on one instance; each
 * module stays its own encapsulated plugin, so the auth preHandler in
 * messages/admin still cannot leak onto webhooks.
 */
export async function messagingRoutes(app: FastifyInstance): Promise<void> {
  await app.register(messageRoutes);
  await app.register(webhookRoutes);
  await app.register(adminRoutes);
}

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 1_048_576 });

  setupOpenApi(app, {
    title: 'Maildrill Messaging API',
    version: '0.1.0',
    description:
      'The sending engine: submit messages, provider webhooks, and queue admin. Auth: x-api-key or Bearer JWT.',
  });

  void app.register(healthRoutes);
  void app.register(messagingRoutes);

  app.setErrorHandler((err, req, reply) => {
    if (isValidationError(err)) {
      return reply.code(400).send({ error: 'validation', issues: err.validation });
    }
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    logger.error(
      { err: err instanceof Error ? err.message : String(err), url: req.url },
      'request error',
    );
    return reply.code(statusCode).send({ error: 'internal_error' });
  });

  return app;
}
