import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import OpenAI from 'openai';
import { z } from 'zod';

const BodySchema = z.object({
  prompt: z.string().min(1).max(1500),
  size: z.enum(['1024x1024', '1024x1792', '1792x1024']).optional().default('1024x1024'),
  model: z.enum(['gpt-image-1', 'dall-e-3', 'dall-e-2', 'image-01']).optional(),
  provider: z.enum(['openai', 'minimax']).optional(),
  aspect_ratio: z
    .enum(['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16'])
    .optional()
    .default('1:1'),
});

function resolveProvider(explicit?: string, model?: string): 'openai' | 'minimax' {
  if (explicit) return explicit as 'openai' | 'minimax';
  if (model === 'image-01') return 'minimax';
  const fromEnv = process.env.DEFAULT_IMAGE_PROVIDER;
  if (fromEnv === 'minimax') return 'minimax';
  return 'openai';
}

async function generateWithMiniMax(prompt: string, aspectRatio: string): Promise<{ url: string }> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw Object.assign(new Error('MINIMAX_API_KEY is not set'), { status: 503 });

  const res = await fetch('https://api.minimax.io/v1/image_generation', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt,
      aspect_ratio: aspectRatio,
      response_format: 'url',
      n: 1,
      prompt_optimizer: true,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.base_resp?.status_code !== 0) {
    const msg = data.base_resp?.status_msg ?? `MiniMax error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }

  const url = data.data?.image_urls?.[0];
  if (!url) throw Object.assign(new Error('No image returned from MiniMax'), { status: 500 });

  return { url };
}

async function generateWithOpenAI(
  prompt: string,
  size: string,
  model: string,
): Promise<{ url: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY is not set'), { status: 503 });

  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({
    model,
    prompt,
    size: size as any,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (b64) return { url: `data:image/png;base64,${b64}` };

  const url = result.data?.[0]?.url;
  if (!url) throw Object.assign(new Error('No image returned from OpenAI'), { status: 500 });

  return { url };
}

export function createAiImageGenerateRoute() {
  return async function aiImageGeneratePlugin(fastify: FastifyInstance) {
    fastify.post('/ai/image-generate', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: z.infer<typeof BodySchema>;
      try {
        body = BodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      const provider = resolveProvider(body.provider, body.model);

      try {
        const result =
          provider === 'minimax'
            ? await generateWithMiniMax(body.prompt, body.aspect_ratio)
            : await generateWithOpenAI(body.prompt, body.size, body.model ?? 'gpt-image-1');

        return reply.send({ url: result.url, success: true, provider });
      } catch (err: any) {
        const status = err?.status ?? 500;
        const message = err?.message ?? 'Image generation failed';
        return reply.status(status >= 400 && status < 600 ? status : 500).send({
          error: { code: status, message },
          success: false,
          provider,
        });
      }
    });
  };
}

export const aiImageGeneratePlugin = createAiImageGenerateRoute();
