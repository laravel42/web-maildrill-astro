import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { getProvider as defaultGetProvider, PROVIDER_NAMES, type ProviderName } from '../providers/index.js';
import { generateTheme } from '../wizard/generate-theme.js';
import { GenerateThemeInputSchema } from '../wizard/theme-schema.js';

/**
 * POST /api/generate-theme
 *
 * Synthesise a complete, WCAG-accessible theme from the wizard's brand
 * inputs. Returns a `GeneratedTheme` (`{ name, globals, blocks,
 * accessibility }`) whose `globals` + `blocks` map directly onto the
 * editor's `ThemeBundlePayload`.
 *
 * Unlike `/api/generate` (which streams NDJSON blocks for a full
 * template), this is a single synchronous JSON response — themes are
 * tiny and computed mostly deterministically.
 */

const GenerateThemeBodySchema = GenerateThemeInputSchema.extend({
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
  model: z.string().min(1).optional(),
});

export type GenerateThemeBody = z.infer<typeof GenerateThemeBodySchema>;

export interface CreateGenerateThemeRouteOptions {
  getProvider?: typeof defaultGetProvider;
  llmText?: () => Promise<string>;
}

export function createGenerateThemeRoute(options: CreateGenerateThemeRouteOptions = {}) {
  return async function generateThemePlugin(fastify: FastifyInstance) {
    fastify.post('/generate-theme', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: GenerateThemeBody;
      try {
        body = GenerateThemeBodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const { provider, model, ...input } = body;
        const theme = await generateTheme(input, {
          provider,
          model,
          getProvider: options.getProvider ?? defaultGetProvider,
          llmText: options.llmText,
        });
        return reply.send(theme);
      } catch (err) {
        console.error('[generate-theme] unexpected error', err);
        return reply.status(500).send({ error: 'internal_error' });
      }
    });
  };
}

export const generateThemePlugin = createGenerateThemeRoute();
