import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  getProvider as defaultGetProvider,
  PROVIDER_NAMES,
  type ProviderName,
} from '../providers/index.js';
import { VisualBriefSchema } from '../wizard/brief-schema.js';
import { compileBrief } from '../wizard/compile-brief.js';

const VisualBriefBodySchema = z.object({
  brief: VisualBriefSchema,
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
  model: z.string().min(1).optional(),
});

export type VisualBriefBody = z.infer<typeof VisualBriefBodySchema>;

export interface CreateVisualBriefRouteOptions {
  getProvider?: typeof defaultGetProvider;
  llmText?: () => Promise<string>;
}

export function createVisualBriefRoute(options: CreateVisualBriefRouteOptions = {}) {
  return async function visualBriefPlugin(fastify: FastifyInstance) {
    fastify.post('/visual-brief/compile', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: VisualBriefBody;
      try {
        body = VisualBriefBodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const result = await compileBrief(body.brief, {
          provider: body.provider,
          model: body.model,
          getProvider: options.getProvider ?? defaultGetProvider,
          llmText: options.llmText,
        });

        return reply.send(result);
      } catch (err) {
        console.error('[visual-brief/compile] unexpected error', err);
        return reply.status(500).send({ error: 'internal_error' });
      }
    });
  };
}

export const visualBriefPlugin = createVisualBriefRoute();
