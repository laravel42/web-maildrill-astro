/**
 * Dev-only smoke test for the Gemini provider.
 *
 * Reads GEMINI_API_KEY (or GOOGLE_API_KEY) from the package's .env file and
 * streams a single completion to stdout so we can verify the adapter
 * end-to-end without needing the full /api/generate HTTP route.
 *
 * Usage (from repo root):
 *   pnpm -F @eb/backend test:gemini "Write a haiku about email"
 *
 * Override the model with DEFAULT_MODEL or by passing `gemini-2.5-pro` etc.
 * in the package's .env file.
 */

import 'dotenv/config';

import { getProvider } from '../providers/index.js';

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) {
    console.error('Usage: pnpm -F @eb/backend test:gemini "<your prompt>"');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error(
      'GEMINI_API_KEY is not set. Fill it in packages/backend/.env first ' +
        '(GOOGLE_API_KEY is also accepted).',
    );
    process.exit(1);
  }

  // The Gemini default model lives inside the provider; allow a DEFAULT_MODEL
  // override for parity with test-openai. Falls back to the provider default
  // when the env var is unset or points at a non-Gemini model.
  const envModel = process.env.DEFAULT_MODEL;
  const model = envModel && envModel.startsWith('gemini') ? envModel : undefined;

  const provider = getProvider('gemini');
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
  console.error('\n[test-gemini] error:', err);
  process.exit(1);
});
