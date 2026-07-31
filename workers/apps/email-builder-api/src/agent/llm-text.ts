/**
 * Shared helpers for non-streaming LLM calls used by the agent layer
 * (critique, refine compile, creative brief). Providers only expose streams;
 * these utilities collect and parse them.
 */

import type { getProvider as ProductionGetProvider, ProviderName } from '../providers/index.js';

export async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let out = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) out += value;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
  return out;
}

/** Extract the first balanced `{…}` JSON object from a model response. */
export function extractFirstJson(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      if (--depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

export type LlmCallOptions = {
  system: string;
  prompt: string;
  provider?: ProviderName;
  model?: string;
  maxTokens?: number;
  /** Test seam — short-circuits the provider. */
  llmText?: () => Promise<string>;
  getProvider?: typeof ProductionGetProvider;
};

export async function callLlmText(options: LlmCallOptions): Promise<string> {
  if (options.llmText) return options.llmText();
  const getProvider = options.getProvider ?? (await import('../providers/index.js')).getProvider;
  const providerName: ProviderName =
    options.provider ?? (process.env.DEFAULT_PROVIDER as ProviderName | undefined) ?? 'openai';
  const provider = getProvider(providerName);
  const stream = provider.stream({
    system: options.system,
    prompt: options.prompt,
    model: options.model,
    maxTokens: options.maxTokens,
  });
  return readStream(stream);
}
