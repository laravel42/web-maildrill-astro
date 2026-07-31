/**
 * Compile a structured `VisualBrief` into:
 *   - `prompt`  — a structured generation prompt ready for `/api/generate`.
 *   - `queries` — 3–7 specific Unsplash search queries.
 *   - `hints`   — palette / density / sections forwarded to the route.
 *
 * Strategy: deterministic scaffold (hex codes, sections, tone, density are
 * always present verbatim) + a short LLM-generated creative paragraph that
 * adds style direction. If the LLM fails, the scaffold alone is sufficient.
 */

import { z } from 'zod';

import type { getProvider as ProductionGetProvider, ProviderName } from '../providers/index.js';

import type { VisualBrief } from './brief-schema.js';

const DEFAULT_MAX_TOKENS = 300;

// ---------------------------------------------------------------------------
// Density inference
// ---------------------------------------------------------------------------

function inferDensity(sectionsLen: number): 'concise' | 'standard' | 'rich' {
  if (sectionsLen <= 2) return 'concise';
  if (sectionsLen <= 4) return 'standard';
  return 'rich';
}

// ---------------------------------------------------------------------------
// Deterministic scaffold builder
// ---------------------------------------------------------------------------

/**
 * Format brand colors as an explicit string for injection into prompts.
 */
function formatBrandColors(brandColors?: { primary?: string; secondary?: string; accent?: string }): string {
  if (!brandColors) return '';
  const parts: string[] = [];
  if (brandColors.primary) parts.push(`primary: ${brandColors.primary}`);
  if (brandColors.secondary) parts.push(`secondary: ${brandColors.secondary}`);
  if (brandColors.accent) parts.push(`accent/CTA: ${brandColors.accent}`);
  return parts.length > 0 ? parts.join(', ') : '';
}

/**
 * Build the deterministic scaffold from the brief. This is the primary prompt
 * and always contains all constraints verbatim — no LLM interpretation.
 */
function buildScaffold(brief: VisualBrief): string {
  const { email_strategy: es, tone_strategy: ts, visual_strategy: vs, layout_strategy: ls } = brief;
  const density = inferDensity(ls.sections.length);
  const lines: string[] = [];

  // Purpose line
  const purposeParts = [`${es.purpose} email`];
  if (es.brandName) purposeParts.push(`for ${es.brandName}`);
  if (es.audience) purposeParts.push(`targeting ${es.audience}`);
  lines.push(`[PURPOSE] ${purposeParts.join(' ')}`);
  if (es.goal) lines.push(`[GOAL] ${es.goal}`);

  // Tone
  lines.push(`[TONE] ${ts.moods.join(', ')} — ${ts.vertical} vertical`);

  // Colors
  const colorsLine = formatBrandColors(vs.brandColors);
  if (colorsLine) {
    lines.push(`[COLORS] ${colorsLine}. Palette mood: ${vs.palette}`);
  } else {
    lines.push(`[COLORS] Palette mood: ${vs.palette}`);
  }

  // Layout
  lines.push(`[LAYOUT] Sections: ${ls.sections.join(' → ')}. Density: ${density}`);

  // Imagery
  if (vs.photoStyle !== 'none') {
    const subjects = brief.image_queries.subjects;
    const subjectStr = subjects.length > 0 ? `. Subjects: ${subjects.join(', ')}` : '';
    lines.push(`[IMAGERY] Photo style: ${vs.photoStyle}${subjectStr}`);
  } else {
    lines.push(`[IMAGERY] No images`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// LLM system prompt — only asks for creative brief + queries
// ---------------------------------------------------------------------------

const CREATIVE_SYSTEM_PROMPT = [
  'You are an award-winning email creative director (Impeccable craft bar).',
  'Given a structured email brief (purpose, tone, colors, layout, imagery),',
  'return a JSON object with exactly two keys:',
  '',
  '  "creative" — 2–3 sentences of creative direction that add style specifics:',
  '    describe visual atmosphere, spacing rhythm, button style, typography feel,',
  '    and any special layout treatment. Push for brand-specific composition —',
  '    refuse generic purple SaaS gradients, card spam, and flat hierarchy.',
  '    Do NOT repeat the constraints already in the brief (colors, sections,',
  '    density). Focus on *how* to express them.',
  '',
  '  "queries" — array of 3–7 Unsplash search queries (1–4 lowercase English words)',
  '    describing concrete photographic scenes matching the brief.',
  '',
  'RULES:',
  '- Return ONLY valid JSON. No markdown fences, no explanation.',
  '- LANGUAGE: Write "creative" in the SAME language the user used in rawIntent or goal. Default to English if no user text is present.',
  '- "queries" must ALWAYS be in English.',
  '- If photoStyle is "none", set queries to [].',
  '- Queries must describe concrete visual scenes. Avoid generic terms.',
].join('\n');

const CreativeResponseSchema = z.object({
  creative: z.string().min(5).max(1000),
  queries: z.array(z.string().trim().min(1).max(80)).max(20),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readStream(stream: ReadableStream<string>): Promise<string> {
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

function extractFirstJson(raw: string): string | null {
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

/**
 * Build deterministic fallback queries from the brief subjects.
 */
function deterministicQueries(brief: VisualBrief): string[] {
  if (brief.visual_strategy.photoStyle === 'none') return [];
  const { subjects } = brief.image_queries;
  if (subjects.length === 0) return [`${brief.tone_strategy.vertical} lifestyle`];
  return subjects.slice(0, 5).map((s) => s.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface CompileResult {
  prompt: string;
  queries: string[];
  hints: {
    palette: string;
    density: 'concise' | 'standard' | 'rich';
    sections: string[];
  };
}

export interface CompileBriefOptions {
  provider?: ProviderName;
  model?: string;
  maxTokens?: number;
  /** Test seam — short-circuits the LLM call. */
  llmText?: () => Promise<string>;
  /** Test seam — provider factory. */
  getProvider?: typeof ProductionGetProvider;
}

/**
 * Compile a `VisualBrief` into a structured prompt + Unsplash queries.
 * Never throws — falls back deterministically.
 */
export async function compileBrief(brief: VisualBrief, options: CompileBriefOptions = {}): Promise<CompileResult> {
  const hints = {
    palette: brief.visual_strategy.palette,
    density: inferDensity(brief.layout_strategy.sections.length),
    sections: brief.layout_strategy.sections as string[],
  };

  const scaffold = buildScaffold(brief);

  // Build user message for LLM — include rawIntent for language detection
  const userMessage = JSON.stringify({
    scaffold,
    rawIntent: brief.email_strategy.rawIntent || undefined,
    goal: brief.email_strategy.goal || undefined,
    photoStyle: brief.visual_strategy.photoStyle,
    subjects: brief.image_queries.subjects,
  });

  // 1. LLM path — ask only for creative direction + image queries
  try {
    let raw: string;
    if (options.llmText) {
      raw = await options.llmText();
    } else {
      const getProvider = options.getProvider ?? (await import('../providers/index.js')).getProvider;
      const providerName: ProviderName =
        options.provider ?? (process.env.DEFAULT_PROVIDER as ProviderName | undefined) ?? 'openai';
      const provider = getProvider(providerName);
      const stream = provider.stream({
        system: CREATIVE_SYSTEM_PROMPT,
        prompt: userMessage,
        model: options.model,
        maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      });
      raw = await readStream(stream);
    }

    const json = extractFirstJson(raw);
    if (json) {
      const parsed = CreativeResponseSchema.safeParse(JSON.parse(json));
      if (parsed.success) {
        const prompt = `${scaffold}\n[CREATIVE] ${parsed.data.creative}`;
        return { prompt, queries: parsed.data.queries, hints };
      }
    }
  } catch (err) {
    console.warn('[compileBrief] LLM call failed, using deterministic fallback', err);
  }

  // 2. Deterministic fallback — scaffold alone is a valid prompt
  return {
    prompt: scaffold,
    queries: deterministicQueries(brief),
    hints,
  };
}
