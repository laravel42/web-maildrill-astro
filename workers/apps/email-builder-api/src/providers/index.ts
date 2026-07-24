import { createGeminiProvider } from './gemini';
import { createMiniMaxProvider } from './minimax';
import { createOpenAIProvider } from './openai';
import type { LLMProvider } from './types';

/**
 * Registry of supported LLM providers. Add new providers here and extend the
 * `factories` map below to make them selectable via `getProvider`.
 */
export const PROVIDER_NAMES = ['openai', 'gemini', 'minimax'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

type ProviderFactory = () => LLMProvider;

const factories: Record<ProviderName, ProviderFactory> = {
  openai: () => createOpenAIProvider(),
  gemini: () => createGeminiProvider(),
  minimax: () => createMiniMaxProvider(),
};

const cache = new Map<ProviderName, LLMProvider>();

/**
 * Returns a cached `LLMProvider` instance for the given name.
 * Falls back to `openai` when no name is provided.
 */
export function getProvider(name: ProviderName = 'openai'): LLMProvider {
  let provider = cache.get(name);
  if (!provider) {
    provider = factories[name]();
    cache.set(name, provider);
  }
  return provider;
}

/**
 * Clears the internal provider cache. Useful for tests and when credentials
 * change at runtime.
 */
export function resetProviderCache(): void {
  cache.clear();
}

export type { LLMProvider, LLMStreamParams } from './types';
