import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

export type { ZodTypeProvider } from 'fastify-type-provider-zod';

export interface OpenApiOptions {
  title: string;
  version: string;
  description?: string;
}

/**
 * Wire zod-based validation/serialization + an OpenAPI doc and a Scalar API
 * reference onto a Fastify app. Call BEFORE registering routes so @fastify/swagger
 * captures their schemas. Serves the spec at /openapi.json and the UI at /docs.
 */
export function setupOpenApi(app: FastifyInstance, opts: OpenApiOptions): void {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(fastifySwagger, {
    openapi: {
      info: {
        title: opts.title,
        version: opts.version,
        ...(opts.description ? { description: opts.description } : {}),
      },
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  void app.register(scalar, {
    routePrefix: '/docs',
    configuration: { title: opts.title, url: '/openapi.json' },
  });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
}

/** True when a Fastify error is a request schema-validation failure. */
export function isValidationError(err: unknown): err is { validation: unknown[]; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'validation' in err &&
    Array.isArray((err as { validation?: unknown }).validation)
  );
}
