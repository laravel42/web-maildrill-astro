import OpenAI from 'openai';

import type { LLMProvider, LLMStreamParams } from './types';

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 16000;

export interface OpenAIProviderOptions {
  /** Overrides the default API key (defaults to the `OPENAI_API_KEY` env var). */
  apiKey?: string;
  /** Default model used when a request does not specify one. */
  defaultModel?: string;
  /** Default `max_tokens` value used when a request does not specify one. */
  defaultMaxTokens?: number;
}

/**
 * Creates an OpenAI-backed `LLMProvider`.
 *
 * The returned provider converts OpenAI's async-iterable chat completion
 * stream into a standard `ReadableStream<string>` of text deltas.
 */
export function createOpenAIProvider(options: OpenAIProviderOptions = {}): LLMProvider {
  const { apiKey, defaultModel = DEFAULT_MODEL, defaultMaxTokens = DEFAULT_MAX_TOKENS } = options;

  const client = new OpenAI(apiKey ? { apiKey } : undefined);

  return {
    stream({ system, prompt, model, maxTokens }: LLMStreamParams): ReadableStream<string> {
      return new ReadableStream<string>({
        async start(controller) {
          try {
            const completion = await client.chat.completions.create({
              model: model ?? defaultModel,
              max_tokens: maxTokens ?? defaultMaxTokens,
              stream: true,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
              ],
            });

            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                controller.enqueue(delta);
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
