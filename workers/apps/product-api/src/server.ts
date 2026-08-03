import Fastify, { type FastifyInstance } from 'fastify';
import { logger } from '@maildrill/observability';
import { isValidationError, setupOpenApi } from '@maildrill/httpkit';
import { authRoutes } from './routes/auth';
import { statsRoutes } from './routes/stats';
import { mediaRoutes } from './routes/media';
import { campaignRoutes } from './routes/campaigns';
import { customFieldRoutes } from './routes/custom-fields';
import { healthRoutes } from './routes/health';
import { listRoutes } from './routes/lists';
import { meRoutes } from './routes/me';
import { securityRoutes } from './routes/security';
import { segmentRoutes } from './routes/segments';
import { subscriberRoutes } from './routes/subscribers';
import { suppressionRoutes } from './routes/suppressions';
import { tagRoutes } from './routes/tags';
import { templateRoutes } from './routes/templates';
import { channelRoutes } from './routes/channels';
import { voicePreviewRoutes } from './routes/voice-preview';
import { workspaceRoutes } from './routes/workspace';

/**
 * The product app's business routes, without health. Exported so the unified
 * dev server can mount them on a shared instance.
 */
export async function productRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(securityRoutes);
  await app.register(subscriberRoutes);
  await app.register(listRoutes);
  await app.register(segmentRoutes);
  await app.register(tagRoutes);
  await app.register(customFieldRoutes);
  await app.register(templateRoutes);
  await app.register(suppressionRoutes);
  await app.register(campaignRoutes);
  await app.register(channelRoutes);
  await app.register(voicePreviewRoutes);
  await app.register(statsRoutes);
  await app.register(mediaRoutes);
  await app.register(workspaceRoutes);
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
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    logger.error(
      { err: err instanceof Error ? err.message : String(err), url: req.url },
      'product-api request error',
    );
    return reply.code(statusCode).send({ error: 'internal_error' });
  });

  return app;
}
