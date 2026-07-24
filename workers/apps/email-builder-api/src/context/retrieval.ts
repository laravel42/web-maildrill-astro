/**
 * Corpus retrieval — selects a small, relevant subset of the template /
 * section / theme corpus to embed in the system prompt.
 *
 * ## Why this exists
 *
 * `buildSystemPrompt()` historically embedded the NDJSON of EVERY template
 * and section in the corpus. That was fine with ~16 bundled presets + 18
 * recipes, but the Components Library now holds hundreds of user-saved
 * templates (several MB of NDJSON). Dumping all of them blows past any
 * model context window and makes generation slow, expensive, and
 * eventually impossible.
 *
 * This module inverts the model: instead of "embed everything and let the
 * LLM choose", we score every entry against the user prompt and embed only
 * the top-N. The corpus becomes a *relevant reference*, not a dump.
 *
 * ## Design goals (from the plan)
 *
 *   - **Don't start from zero** — the LLM still sees real, valid NDJSON it
 *     can ground its structure on.
 *   - **Don't clone** — we hand the model a *handful* of templates as
 *     references to combine, not a single one to copy. Sections (one per
 *     relevant role) are the real composition unit, which produces variety
 *     naturally. Seed rotation happens *within* the relevant set so two
 *     generations of the same prompt pick different combinations.
 *   - **Don't break** — selected entries carry their full NDJSON, so all
 *     the downstream safety nets (normalizeBlockPayload, VALID_BLOCK_TYPES,
 *     token substitution) keep working.
 *
 * Scoring is keyword-based (reusing `calculateSimilarity` / `categorizePrompt`
 * / `assessComplexity` from `few-shot.ts`). No embeddings — keyword scoring
 * is sufficient for hundreds of entries and keeps the path dependency-free
 * and synchronous. Vector retrieval is a documented future step.
 */

import { assessComplexity, calculateSimilarity, categorizePrompt } from './few-shot.js';
import type { RecipeRole, SectionEntry, TemplateEntry, ThemeEntry } from './index.js';

/**
 * Default selection caps. Deliberately small — the whole point is to keep
 * the prompt lean. Overridable per call (and, in `buildSystemPrompt`, via
 * env) so we can tune without code changes.
 */
export const RETRIEVAL_DEFAULTS = {
  /** Templates embedded as structural references (NOT for verbatim copy). */
  templates: 3,
  /** Sections embedded per relevant role slot. */
  sectionsPerRole: 2,
  /** Maximum distinct roles to pull sections for. */
  maxRoles: 5,
  /** Themes embedded as palette references. */
  themes: 2,
} as const;

/** Roles that should always be considered when present, regardless of prompt. */
const STRUCTURAL_ROLES: ReadonlyArray<RecipeRole> = ['header', 'footer'];

/**
 * Map the coarse prompt category (from `categorizePrompt`) to the section
 * roles most likely to matter. Every prompt also implicitly wants a hero +
 * cta, so those are always in the candidate set.
 */
const CATEGORY_ROLE_HINTS: Record<string, ReadonlyArray<RecipeRole>> = {
  newsletter: ['hero', 'features', 'cta'],
  welcome: ['hero', 'features', 'cta'],
  ecommerce: ['hero', 'features', 'social_proof', 'cta'],
  event: ['hero', 'features', 'cta'],
  corporate: ['hero', 'features', 'social_proof', 'cta'],
  hero: ['hero', 'cta'],
  general: ['hero', 'features', 'cta'],
};

const ALWAYS_ROLES: ReadonlyArray<RecipeRole> = ['hero', 'cta'];

/**
 * mulberry32-based deterministic shuffle. Pure — never mutates input. Same
 * seed always produces the same order. Used to rotate *within* the relevant
 * set so variety across seeds doesn't cost relevance.
 */
export function shuffleBySeed<T>(items: readonly T[], seed: number): T[] {
  if (items.length <= 1) return items.slice();
  let state = seed >>> 0 || 1;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The searchable text for an entry — prefers the aggregated `keywords`. */
function searchText(entry: { keywords?: string; slug: string; description: string }): string {
  if (entry.keywords && entry.keywords.length > 0) return entry.keywords;
  return `${entry.slug} ${entry.description}`.toLowerCase();
}

/**
 * Score a single corpus entry against the user prompt. The score is a blend
 * of keyword similarity and category match, mirroring the few-shot scorer so
 * behaviour is consistent across the prompt.
 */
function scoreEntry(
  prompt: string,
  promptCategory: string,
  entry: { keywords?: string; slug: string; description: string }
): number {
  const text = searchText(entry);
  // Keyword overlap (dominant signal).
  let score = calculateSimilarity(prompt, text) * 0.7;
  // Category keyword present in the entry text → strong boost.
  if (promptCategory !== 'general' && text.includes(promptCategory)) {
    score += 0.3;
  }
  return score;
}

/**
 * Stable-sort helper: sort by score desc, breaking ties by slot asc so the
 * order is deterministic for a given pool (important for tests and for the
 * "bundled defaults first" intuition).
 */
function byScoreThenSlot<T extends { slot: number }>(scored: Array<{ entry: T; score: number }>): T[] {
  return scored
    .slice()
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.entry.slot - b.entry.slot))
    .map((s) => s.entry);
}

export interface SelectTemplatesOptions {
  topN?: number;
  seed?: number;
}

/**
 * Select up to `topN` templates most relevant to the prompt. Returns them in
 * relevance order, then (when a seed is given) shuffled *within* the selected
 * set so repeated generations of the same prompt vary which reference the LLM
 * sees first — without ever pulling in an irrelevant template.
 *
 * Falls back gracefully: an empty pool returns `[]`; a prompt that matches
 * nothing still returns the `topN` lowest-slot templates (bundled defaults
 * first) so the LLM is never left with zero references.
 */
export function selectTemplates(
  prompt: string,
  pool: readonly TemplateEntry[],
  options: SelectTemplatesOptions = {}
): TemplateEntry[] {
  const topN = options.topN ?? RETRIEVAL_DEFAULTS.templates;
  if (pool.length === 0 || topN <= 0) return [];
  if (pool.length <= topN) {
    return options.seed !== undefined ? shuffleBySeed(pool, options.seed) : pool.slice();
  }

  const category = categorizePrompt(prompt);
  const scored = pool.map((entry) => ({ entry, score: scoreEntry(prompt, category, entry) }));
  const ranked = byScoreThenSlot(scored).slice(0, topN);

  return options.seed !== undefined ? shuffleBySeed(ranked, options.seed) : ranked;
}

export interface SelectSectionsOptions {
  perRole?: number;
  maxRoles?: number;
  seed?: number;
}

/**
 * Select relevant sections grouped by role. For each role the prompt is
 * likely to need (derived from its category, plus always hero+cta and any
 * present header/footer), pick the top `perRole` sections by relevance.
 *
 * Composing the body from per-role sections — rather than copying one whole
 * template — is what gives generated emails structural variety while staying
 * valid. Within each role the seed rotates the choice so the same prompt
 * doesn't always grab the same hero/cta.
 */
export function selectSections(
  prompt: string,
  pool: readonly SectionEntry[],
  options: SelectSectionsOptions = {}
): SectionEntry[] {
  const perRole = options.perRole ?? RETRIEVAL_DEFAULTS.sectionsPerRole;
  const maxRoles = options.maxRoles ?? RETRIEVAL_DEFAULTS.maxRoles;
  if (pool.length === 0 || perRole <= 0) return [];

  const category = categorizePrompt(prompt);
  const hinted = CATEGORY_ROLE_HINTS[category] ?? CATEGORY_ROLE_HINTS.general;

  // Build the ordered, de-duplicated candidate role list: always roles first
  // (hero, cta), then category hints, then structural roles that exist in the
  // pool. Cap at maxRoles.
  const presentStructural = STRUCTURAL_ROLES.filter((r) => pool.some((s) => s.role === r));
  const roleOrder: RecipeRole[] = [];
  for (const r of [...ALWAYS_ROLES, ...hinted, ...presentStructural]) {
    if (!roleOrder.includes(r)) roleOrder.push(r);
  }
  const roles = roleOrder.slice(0, maxRoles);

  const result: SectionEntry[] = [];
  for (const role of roles) {
    const inRole = pool.filter((s) => s.role === role);
    if (inRole.length === 0) continue;
    const scored = inRole.map((entry) => ({ entry, score: scoreEntry(prompt, category, entry) }));
    let ranked = byScoreThenSlot(scored).slice(0, perRole);
    if (options.seed !== undefined) {
      // Offset the seed per role so adjacent roles decorrelate.
      ranked = shuffleBySeed(ranked, options.seed + role.length * 7);
    }
    result.push(...ranked);
  }

  // Sections with no role at all (rare — bundled recipes always have one, but
  // a user section could lack it). Include a couple of the most relevant so
  // they aren't silently dropped.
  const roleless = pool.filter((s) => s.role === undefined);
  if (roleless.length > 0 && result.length < perRole * maxRoles) {
    const scored = roleless.map((entry) => ({ entry, score: scoreEntry(prompt, category, entry) }));
    result.push(...byScoreThenSlot(scored).slice(0, perRole));
  }

  return result;
}

export interface SelectThemesOptions {
  topN?: number;
  seed?: number;
}

/**
 * Select up to `topN` themes most relevant to the prompt, as palette
 * references. Same fallback semantics as `selectTemplates`.
 */
export function selectThemes(
  prompt: string,
  pool: readonly ThemeEntry[],
  options: SelectThemesOptions = {}
): ThemeEntry[] {
  const topN = options.topN ?? RETRIEVAL_DEFAULTS.themes;
  if (pool.length === 0 || topN <= 0) return [];
  if (pool.length <= topN) {
    return options.seed !== undefined ? shuffleBySeed(pool, options.seed) : pool.slice();
  }

  const category = categorizePrompt(prompt);
  const scored = pool.map((entry) => ({ entry, score: scoreEntry(prompt, category, entry) }));
  const ranked = byScoreThenSlot(scored).slice(0, topN);

  return options.seed !== undefined ? shuffleBySeed(ranked, options.seed) : ranked;
}

// `assessComplexity` is re-exported intentionally: callers that want to tune
// caps by prompt complexity (e.g. more sections for "complex") can reuse it
// without importing from few-shot directly.
export { assessComplexity };
