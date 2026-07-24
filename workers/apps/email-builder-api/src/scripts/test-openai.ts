/**
 * Dev-only smoke test for the OpenAI provider.
 *
 * Reads OPENAI_API_KEY from the package's .env file and streams a single
 * completion to stdout so we can verify the adapter end-to-end without
 * needing the full /api/generate HTTP route.
 *
 * Usage (from repo root):
 *   pnpm -F @eb/backend test:openai "Write a haiku about email"
 */

import 'dotenv/config';

import { getProvider, type ProviderName } from '../providers/index.js';

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) {
    console.error('Usage: pnpm -F @eb/backend test:openai "<your prompt>"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Fill it in packages/backend/.env first.');
    process.exit(1);
  }

  const providerName = (process.env.DEFAULT_PROVIDER as ProviderName | undefined) ?? 'openai';
  const model = process.env.DEFAULT_MODEL;

  const provider = getProvider(providerName);
  const stream = provider.stream({
    system: 'You are a concise assistant. Respond in plain text.',
    prompt,
    model,
  });

  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(value);
    }
    process.stdout.write('\n');
  } finally {
    reader.releaseLock();
  }
}

main().catch((err) => {
  console.error('\n[test-openai] error:', err);
  process.exit(1);
});
