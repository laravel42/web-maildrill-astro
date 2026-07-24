import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { getProvider as defaultGetProvider, PROVIDER_NAMES, type ProviderName } from '../providers/index.js';

const AI_ACTIONS = [
  'rewrite',
  'grammar_check',
  'continue_writing',
  'shorter',
  'descriptive',
  'detailed',
  'friendly',
  'professional',
] as const;

type AIAction = (typeof AI_ACTIONS)[number];

const BodySchema = z.object({
  text: z.string().min(1, 'text is required'),
  action: z.enum(AI_ACTIONS),
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
});

const SYSTEM_PROMPTS: Record<AIAction, string> = {
  rewrite:
    'Rewrite the following text to improve clarity and flow while preserving the original meaning. Return only the rewritten HTML content, no explanations.',
  grammar_check:
    'Fix all grammar, spelling, and punctuation errors in the following text. Return only the corrected HTML content, no explanations.',
  continue_writing:
    'Continue writing from where the text ends, maintaining the same style and tone. Return the original text followed by your continuation as HTML. No explanations.',
  shorter:
    'Make the following text significantly shorter while keeping the key message. Return only the shortened HTML content, no explanations.',
  descriptive:
    'Make the following text more descriptive and vivid with sensory details. Return only the enhanced HTML content, no explanations.',
  detailed:
    'Expand the following text with more details, examples, and depth. Return only the expanded HTML content, no explanations.',
  friendly:
    'Rewrite the following text in a warm, friendly, and approachable tone. Return only the rewritten HTML content, no explanations.',
  professional:
    'Rewrite the following text in a formal, professional business tone. Return only the rewritten HTML content, no explanations.',
};

function resolveProvider(explicit: ProviderName | undefined): ProviderName {
  if (explicit) return explicit;
  const fromEnv = process.env.DEFAULT_PROVIDER;
  if (fromEnv && (PROVIDER_NAMES as readonly string[]).includes(fromEnv)) {
    return fromEnv as ProviderName;
  }
  return 'openai';
}

export function createAiTextProcessRoute() {
  return async function aiTextProcessPlugin(fastify: FastifyInstance) {
    fastify.post('/ai/text-process', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: z.infer<typeof BodySchema>;
      try {
        body = BodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const providerName = resolveProvider(body.provider);
        const provider = defaultGetProvider(providerName);

        const stream = provider.stream({
          system: SYSTEM_PROMPTS[body.action],
          prompt: body.text,
          maxTokens: 2000,
        });

        const reader = stream.getReader();
        let result = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += value;
          }
        } finally {
          reader.releaseLock();
        }

        return reply.send({ processedContent: result.trim(), action: body.action });
      } catch (err: any) {
        console.error('❌ AI text-process error:', err?.message ?? err);
        return reply.status(500).send({ error: 'processing_failed', message: err?.message ?? 'Unknown error' });
      }
    });
  };
}

export const aiTextProcessPlugin = createAiTextProcessRoute();
