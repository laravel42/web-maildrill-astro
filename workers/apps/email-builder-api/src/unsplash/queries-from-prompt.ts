/**
 * Derive a short list of Unsplash search queries from a user-provided email
 * prompt, by issuing a small auxiliary LLM call.
 *
 * The output of this module feeds {@link buildImagePool}, which fans out
 * to `searchPhotos` and assembles the IMAGE_POOL injected into the system
 * prompt. Quality of these queries is the single biggest lever on whether
 * the resulting template feels visually coherent — generic queries
 * ("business", "office") give us generic stock; specific, domain-aware
 * queries ("artisan bakery storefront", "team retrospective whiteboard")
 * yield photos that actually match the email's intent.
 *
 * Fallbacks (in order):
 *   1. LLM call returns valid JSON → use it.
 *   2. LLM call fails / returns garbage → strip stopwords from the prompt
 *      and return up to `count` keyword groups.
 *   3. Heuristic also empty → return a single generic query.
 *
 * The aux call deliberately uses a small/cheap model and a low token cap.
 * Latency budget on the AI generation path is ~1s for this step; if it
 * trends higher in production, consider a server-side cache keyed by
 * normalised prompt hash.
 */

import { z } from 'zod';

// `providers/index.js` transitively pulls in `@google/genai`, which ships
// ESM-only and is not transformed by Jest's default `transformIgnorePatterns`.
// We only need `getProvider` at runtime when the caller doesn't pass the
// `llmText` test seam, so the value import is deferred to the actual call
// site via `await import(...)`. Types stay statically importable so the
// public surface of this module is unchanged.
import type { getProvider as ProductionGetProvider, ProviderName } from '../providers/index.js';

const DEFAULT_COUNT = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 10;
const DEFAULT_MAX_TOKENS = 200;

/**
 * Aux-call system prompt. The model returns ONLY a single JSON object so
 * we can `JSON.parse` the entire stream. We also anchor with concrete
 * good/bad examples — generic terms are the failure mode we see most.
 */
const QUERIES_SYSTEM_PROMPT = [
  'You are a stock photography search expert helping a marketing email designer.',
  'Given a description of an email the designer wants to create, return a JSON object with a `queries` array containing 3 to 7 distinct Unsplash search queries that would yield photos suitable for that email.',
  '',
  'RULES:',
  '- Return ONLY a single JSON object, no markdown fences, no prose, no commentary.',
  '- Each query is 1 to 4 lowercase words.',
  '- Queries MUST be specific and visual — describe a concrete scene the photographer would shoot.',
  '- Avoid generic terms ("business", "office", "people", "lifestyle") unless the prompt is itself generic.',
  '- Cover different angles of the topic: hero shot, supporting detail, lifestyle context, environment, product close-up.',
  '- Match the language of the prompt to English query terms (Unsplash search works best in English regardless of source language).',
  '',
  'GOOD EXAMPLES:',
  'Prompt: "Black Friday sale email for a streetwear brand"',
  'Output: {"queries":["streetwear flatlay","urban fashion model","sneaker store interior","clothing rack neon","city street style"]}',
  '',
  'Prompt: "SaaS welcome email for a project management app for designers"',
  'Output: {"queries":["designer at laptop","kanban board sticky notes","modern coworking space","creative team meeting","minimal workspace setup"]}',
  '',
  'Prompt: "Wedding venue booking confirmation"',
  'Output: {"queries":["outdoor wedding ceremony","rustic barn venue","wedding reception table","string lights evening","floral wedding arch"]}',
  '',
  'BAD EXAMPLES (do NOT do this):',
  '- {"queries":["business","corporate","email","newsletter","marketing"]}  // too generic',
  '- ["streetwear","sneakers"]  // wrong shape — must be an object with a `queries` key',
  '- {"queries":["a beautiful sunset over the mountains with vibrant colors and dramatic clouds"]}  // too long',
  '',
  'Respond with the JSON object only.',
].join('\n');

/**
 * Zod schema for the aux LLM response. Anything that does not parse goes
 * to the heuristic fallback.
 */
const QueriesResponseSchema = z.object({
  queries: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
});

export interface QueriesFromPromptOptions {
  /** Target number of queries. Clamped to [MIN_COUNT, MAX_COUNT]. */
  count?: number;
  /** Override the LLM provider. Defaults to `process.env.DEFAULT_PROVIDER` resolution. */
  provider?: ProviderName;
  /** Override the model used for the aux call. */
  model?: string;
  /** Override the `max_tokens` cap on the aux call. */
  maxTokens?: number;
  /** Test seam — defaults to the production provider factory. */
  getProvider?: typeof ProductionGetProvider;
  /** Test seam — short-circuits the LLM call when set. */
  llmText?: () => Promise<string>;
}

export interface QueriesFromPromptResult {
  /** Final list of queries (LLM, heuristic or generic — never empty). */
  queries: string[];
  /** Where the queries came from. Useful for logging/observability. */
  source: 'llm' | 'heuristic' | 'generic';
}

const STOPWORDS = new Set<string>([
  // English
  'the',
  'a',
  'an',
  'of',
  'and',
  'or',
  'for',
  'with',
  'about',
  'on',
  'in',
  'at',
  'to',
  'from',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'our',
  'we',
  'you',
  'your',
  'they',
  'them',
  'their',
  'it',
  'its',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'could',
  'can',
  'may',
  'might',
  'must',
  'email',
  'mail',
  'newsletter',
  'message',
  // Spanish
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'al',
  'y',
  'o',
  'para',
  'por',
  'con',
  'sin',
  'sobre',
  'en',
  'a',
  'es',
  'son',
  'fue',
  'fueron',
  'ser',
  'sido',
  'siendo',
  'este',
  'esta',
  'estos',
  'estas',
  'ese',
  'esa',
  'esos',
  'esas',
  'yo',
  'mi',
  'nuestro',
  'nosotros',
  'tu',
  'tuyo',
  'ellos',
  'ellas',
  'lo',
  'su',
  'sus',
  'tener',
  'tiene',
  'hay',
  'hace',
  'correo',
  'mensaje',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Drain a `ReadableStream<string>` into a single string. Mirrors the
 * collector in `improve-prompt.ts` — kept inlined to keep this module
 * self-contained and easy to test.
 */
async function readFullStream(stream: ReadableStream<string>): Promise<string> {
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

/**
 * Permissive JSON extractor. The aux model is told to return JSON only,
 * but providers occasionally still wrap output in a code fence or add a
 * trailing newline. We extract the first balanced `{...}` block before
 * parsing.
 */
function extractFirstJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return trimmed.slice(firstBrace, i + 1);
    }
  }
  return null;
}

/**
 * Normalise a query string: lower-case, collapse whitespace, drop quotes
 * and other punctuation that confuse Unsplash search.
 */
function normaliseQuery(query: string): string {
  return query.toLowerCase().replace(/["'`]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Filter, normalise, dedupe and clamp a candidate query list.
 */
function sanitiseQueries(candidates: string[], count: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of candidates) {
    const normalised = normaliseQuery(raw);
    if (!normalised) continue;
    if (normalised.length > 80) continue;
    if (seen.has(normalised)) continue;
    seen.add(normalised);
    result.push(normalised);
    if (result.length >= count) break;
  }
  return result;
}

/**
 * Heuristic fallback. Strips stopwords and groups consecutive content
 * words into 1-2 word queries.
 */
function heuristicQueries(prompt: string, count: number): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const queries: string[] = [];
  // Pair adjacent words first (more specific), then fall back to singles.
  for (let i = 0; i < words.length - 1 && queries.length < count; i += 1) {
    queries.push(`${words[i]} ${words[i + 1]}`);
  }
  for (let i = 0; i < words.length && queries.length < count; i += 1) {
    queries.push(words[i]);
  }
  return sanitiseQueries(queries, count);
}

/**
 * Best effort: returns a useful query list for the prompt, never throws.
 */
export async function queriesFromPrompt(
  userPrompt: string,
  options: QueriesFromPromptOptions = {},
): Promise<QueriesFromPromptResult> {
  const count = clamp(options.count ?? DEFAULT_COUNT, MIN_COUNT, MAX_COUNT);
  const trimmedPrompt = userPrompt.trim();
  if (!trimmedPrompt) {
    return { queries: ['marketing email'], source: 'generic' };
  }

  // 1. LLM call.
  try {
    let raw: string;
    if (options.llmText) {
      raw = await options.llmText();
    } else {
      const getProvider =
        options.getProvider ??
        // Lazy load to keep `@google/genai` (ESM-only) out of the import
        // graph when callers stub the LLM via `llmText` or `getProvider`.
        (await import('../providers/index.js')).getProvider;
      const providerName: ProviderName =
        options.provider ?? (process.env.DEFAULT_PROVIDER as ProviderName | undefined) ?? 'openai';
      const provider = getProvider(providerName);
      const stream = provider.stream({
        system: QUERIES_SYSTEM_PROMPT,
        prompt: trimmedPrompt,
        model: options.model,
        maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      });
      raw = await readFullStream(stream);
    }

    const json = extractFirstJsonObject(raw);
    if (json) {
      const parsed = QueriesResponseSchema.safeParse(JSON.parse(json));
      if (parsed.success) {
        const cleaned = sanitiseQueries(parsed.data.queries, count);
        if (cleaned.length > 0) {
          return { queries: cleaned, source: 'llm' };
        }
      }
    }
  } catch (error) {
    // Swallow — we always have a fallback. Log so an operator can spot a
    // misconfigured provider without breaking the user-facing flow.

    console.warn('[queriesFromPrompt] LLM call failed, falling back to heuristic', error);
  }

  // 2. Heuristic fallback.
  const heuristic = heuristicQueries(trimmedPrompt, count);
  if (heuristic.length > 0) {
    return { queries: heuristic, source: 'heuristic' };
  }

  // 3. Generic fallback (very short prompts with all stopwords).
  return { queries: ['marketing email'], source: 'generic' };
}
