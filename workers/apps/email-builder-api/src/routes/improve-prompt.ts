import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { getProvider as defaultGetProvider, PROVIDER_NAMES, type ProviderName } from '../providers/index.js';

const ImprovePromptBodySchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
  model: z.string().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
});

const DEFAULT_MAX_TOKENS = 2000;
const MAX_MAX_TOKENS = 2000;

export type ImprovePromptBody = z.infer<typeof ImprovePromptBodySchema>;

function resolveProvider(explicit: ProviderName | undefined): ProviderName {
  if (explicit) return explicit;
  const fromEnv = process.env.DEFAULT_PROVIDER;
  if (fromEnv && (PROVIDER_NAMES as readonly string[]).includes(fromEnv)) {
    return fromEnv as ProviderName;
  }
  return 'openai';
}

const IMPROVEMENT_SYSTEM_PROMPT = `You are an expert email template prompt optimizer for EmailBuilder.js.

Transform user prompts to maximize visual appeal and template quality.

ENHANCEMENT RULES:
- Always add background images (hero banners, section backgrounds)
- Include specific visual elements (images, icons, colors)
- Add structural details (sections, layout, call-to-actions)
- Specify content types (headlines, articles, buttons)
- Keep the user's core intent intact

EXAMPLES:
Input: "newsletter"
Output: "Newsletter mensual con hero banner visual, artículos destacados con imágenes de fondo, sección de call-to-action y footer con redes sociales"

Input: "welcome email"
Output: "Email de bienvenida con header con logo, mensaje personalizado con imagen de fondo, botones de acción coloridos y footer elegante"

Respond only with the improved prompt in the same language as the input.`;

export function createImprovePromptRoute() {
  return async function improvePromptPlugin(fastify: FastifyInstance) {
    fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = ImprovePromptBodySchema.parse(request.body);
        const { prompt, provider: explicitProvider, model } = body;

        const providerName = resolveProvider(explicitProvider);
        const provider = defaultGetProvider(providerName);

        const requestedMaxTokens = body.maxTokens ?? DEFAULT_MAX_TOKENS;
        const maxTokens = Math.min(requestedMaxTokens, MAX_MAX_TOKENS);

        const llmStream = provider.stream({
          system: IMPROVEMENT_SYSTEM_PROMPT,
          prompt: prompt,
          model: model ?? undefined,
          maxTokens,
        });

        const reader = llmStream.getReader();
        let improved = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            improved += value;
          }
        } finally {
          reader.releaseLock();
        }

        const trimmed = improved.trim();

        if (trimmed.length > 0) {
          const lastChar = trimmed.charAt(trimmed.length - 1);
          const looksComplete = /[.!?…)\]""'']/.test(lastChar);
          if (!looksComplete) {
            console.warn(
              `[improve-prompt] Output may be truncated at maxTokens=${maxTokens}. ` +
                `Length=${trimmed.length} chars, ends with "${lastChar}". ` +
                `Consider raising the client-side maxTokens override.`
            );
          }
        }

        return reply.send({
          original: prompt,
          improved: trimmed,
          provider: providerName,
          model: model ?? 'provider-default',
          maxTokens,
        });
      } catch (error) {
        console.error('❌ Error improving prompt:', error);
        return reply.status(500).send({ error: 'Failed to improve prompt' });
      }
    });
  };
}

export const improvePromptPlugin = createImprovePromptRoute();
