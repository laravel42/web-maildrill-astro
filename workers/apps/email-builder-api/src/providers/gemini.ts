import { GoogleGenAI } from '@google/genai';

import type { LLMProvider, LLMStreamParams } from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_MAX_TOKENS = 16000;

export interface GeminiProviderOptions {
  /** Overrides the default API key (defaults to `GEMINI_API_KEY` or `GOOGLE_API_KEY`). */
  apiKey?: string;
  /** Default model used when a request does not specify one. */
  defaultModel?: string;
  /** Default `maxOutputTokens` value used when a request does not specify one. */
  defaultMaxTokens?: number;
}

/**
 * Creates a Google Gemini-backed `LLMProvider` using `@google/genai`.
 *
 * The returned provider converts Gemini's async-iterable stream into a
 * standard `ReadableStream<string>` of text chunks, mirroring the shape
 * exposed by {@link createOpenAIProvider} so the rest of the backend
 * (route, SSE framing, NDJSON dedup) stays provider-agnostic.
 *
 * The `system` prompt is forwarded via Gemini's `config.systemInstruction`
 * rather than being prepended to the user message — this keeps the system
 * rules outside the chat turn and matches how OpenAI consumes our system
 * prompt.
 */
export function createGeminiProvider(options: GeminiProviderOptions = {}): LLMProvider {
  const {
    apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    defaultModel = DEFAULT_MODEL,
    defaultMaxTokens = DEFAULT_MAX_TOKENS,
  } = options;

  const client = new GoogleGenAI(apiKey ? { apiKey } : {});

  return {
    stream({ system, prompt, model, maxTokens }: LLMStreamParams): ReadableStream<string> {
      return new ReadableStream<string>({
        async start(controller) {
          try {
            const response = await client.models.generateContentStream({
              model: model ?? defaultModel,
              contents: prompt,
              config: {
                systemInstruction: system,
                maxOutputTokens: maxTokens ?? defaultMaxTokens,
              },
            });

            for await (const chunk of response) {
              // `chunk.text` is the incremental text delta. It can be
              // `undefined` (e.g. for chunks that only carry metadata or
              // safety information), so guard before enqueueing.
              const delta = chunk.text;
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
