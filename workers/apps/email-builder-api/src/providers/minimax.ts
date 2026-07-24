import Anthropic from '@anthropic-ai/sdk';

import type { LLMProvider, LLMStreamParams } from './types';

const DEFAULT_MODEL = 'MiniMax-M2.7';
const DEFAULT_MAX_TOKENS = 16000;
const BASE_URL = 'https://api.minimax.io/anthropic';

export interface MiniMaxProviderOptions {
  apiKey?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
}

/**
 * Creates a MiniMax-backed `LLMProvider` using the Anthropic-compatible API.
 *
 * MiniMax recommends their Anthropic-compatible endpoint over the OpenAI one.
 * Base URL: https://api.minimax.io/anthropic
 * Env var:  MINIMAX_API_KEY
 */
export function createMiniMaxProvider(options: MiniMaxProviderOptions = {}): LLMProvider {
  const {
    apiKey = process.env.MINIMAX_API_KEY,
    defaultModel = DEFAULT_MODEL,
    defaultMaxTokens = DEFAULT_MAX_TOKENS,
  } = options;

  const client = new Anthropic({ apiKey, baseURL: BASE_URL });

  return {
    stream({ system, prompt, model, maxTokens }: LLMStreamParams): ReadableStream<string> {
      return new ReadableStream<string>({
        async start(controller) {
          try {
            const stream = await client.messages.stream({
              model: model ?? defaultModel,
              max_tokens: maxTokens ?? defaultMaxTokens,
              system,
              messages: [{ role: 'user', content: prompt }],
            });

            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                controller.enqueue(chunk.delta.text);
              }
            }

            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    },
  };
}
