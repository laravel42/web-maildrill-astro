/**
 * Compile a structured refine brief into a generation prompt that preserves
 * the current document's block IDs while directing surgical changes.
 */

import type { RefineBrief } from '../wizard/brief-schema.js';

import { callLlmText, extractFirstJson, type LlmCallOptions } from './llm-text.js';

const CHANGE_LABELS: Record<string, string> = {
  colour: 'Adjust the colour palette / brand colours',
  typography: 'Tighten or restyle typography',
  spacing: 'Fix spacing and vertical rhythm',
  imagery: 'Replace or improve imagery',
  copy: 'Rewrite or clarify copy',
  cta: 'Clarify or restyle the primary CTA',
  layout: 'Restructure sections / columns',
  mobile: 'Improve mobile / stacked layout',
  accessibility: 'Fix contrast, alt text, and semantics',
  polish: 'Final polish pass without redesigning',
};

export type CompileRefineResult = {
  prompt: string;
  changes: string[];
  scope: RefineBrief['scope'];
};

function buildRefineScaffold(brief: RefineBrief): string {
  const changeLines = brief.changes.map((c) => `- ${CHANGE_LABELS[c] ?? c}`).join('\n');
  return [
    `[REFINE] Scope: ${brief.scope}`,
    `[CHANGES]`,
    changeLines,
    `[INSTRUCTION] ${brief.description.trim()}`,
    '',
    'Rules for this refine pass:',
    '- Re-emit the FULL document as NDJSON (root EmailLayout first).',
    '- Preserve existing block IDs wherever the block still exists.',
    '- Do not invent a new visual world unless the instruction asks for a redesign.',
    '- Keep brand colours, fonts, and section order unless a listed change targets them.',
    '- Apply only the requested changes; leave everything else intact.',
  ].join('\n');
}

const REFINE_CREATIVE_SYSTEM = [
  'You sharpen refine instructions for an email template editor.',
  'Given a refine brief, return JSON with one key:',
  '  "directive" — 1–2 sentences that make the change concrete and measurable',
  '    (e.g. which colour, which CTA, how much spacing). Do not repeat the scaffold.',
  'Return ONLY valid JSON. No markdown.',
].join('\n');

export type CompileRefineOptions = Omit<LlmCallOptions, 'system' | 'prompt'>;

export async function compileRefineBrief(
  brief: RefineBrief,
  options: CompileRefineOptions = {},
): Promise<CompileRefineResult> {
  const scaffold = buildRefineScaffold(brief);

  try {
    const raw = await callLlmText({
      ...options,
      system: REFINE_CREATIVE_SYSTEM,
      prompt: JSON.stringify(brief),
      maxTokens: options.maxTokens ?? 200,
    });
    const json = extractFirstJson(raw);
    if (json) {
      const parsed = JSON.parse(json) as { directive?: string };
      if (typeof parsed.directive === 'string' && parsed.directive.trim().length > 8) {
        return {
          prompt: `${scaffold}\n[DIRECTIVE] ${parsed.directive.trim()}`,
          changes: brief.changes,
          scope: brief.scope,
        };
      }
    }
  } catch (err) {
    console.warn('[agent/refine] LLM directive failed, using scaffold', err);
  }

  return { prompt: scaffold, changes: brief.changes, scope: brief.scope };
}
