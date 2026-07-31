/**
 * LLM design critique (Assessment A).
 *
 * Mirrors the Impeccable critique split: this pass runs *before* it sees the
 * deterministic audit numbers, so the model cannot simply agree with a score
 * it was shown. The orchestrator in `report.ts` reconciles both afterwards.
 */

import { z } from 'zod';

import type { EditorDocument } from '../audit/model.js';
import type { CritiqueDimensionId, Finding, Severity } from '../audit/types.js';
import { CRITIQUE_DIMENSIONS, DIMENSION_LABEL } from '../audit/types.js';

import { callLlmText, extractFirstJson, type LlmCallOptions } from './llm-text.js';

const DimensionScoreSchema = z.object({
  dimension: z.enum(CRITIQUE_DIMENSIONS as unknown as [CritiqueDimensionId, ...CritiqueDimensionId[]]),
  score: z.number().min(0).max(4).nullable(),
  note: z.string().max(280).optional(),
});

const LlmCritiqueSchema = z.object({
  specificity: z.enum(['brand-specific', 'generic', 'mixed']),
  summary: z.string().min(20).max(800),
  strengths: z.array(z.string().min(3).max(200)).min(1).max(4),
  issues: z
    .array(
      z.object({
        severity: z.enum(['P0', 'P1', 'P2', 'P3']),
        dimension: z.enum(CRITIQUE_DIMENSIONS as unknown as [CritiqueDimensionId, ...CritiqueDimensionId[]]),
        title: z.string().min(3).max(120),
        detail: z.string().min(3).max(400),
        fix: z.string().min(3).max(400),
        blockIds: z.array(z.string()).max(8).optional(),
      }),
    )
    .max(8),
  dimensions: z.array(DimensionScoreSchema).min(5).max(10),
  provocativeQuestions: z.array(z.string().min(5).max(200)).max(3).optional(),
});

export type LlmCritique = z.infer<typeof LlmCritiqueSchema>;

const CRITIQUE_SYSTEM = [
  'You are a senior email design director reviewing a Maildrill EmailBuilder.js document.',
  'The document is a flat Record<id, {type, data}> of blocks: EmailLayout, Container,',
  'ColumnsContainer, NotionText, Button, Image, Divider, Spacer, SocialMedia.',
  '',
  'Evaluate design craft ONLY — hierarchy, typography, colour, spacing, imagery,',
  'CTA clarity, content, scanability, consistency, brand specificity.',
  'Do NOT score technical HTML-client facts (Outlook, Gmail clipping, contrast maths);',
  'a separate deterministic engine covers those.',
  '',
  'Return ONLY valid JSON with keys:',
  '  specificity: "brand-specific" | "generic" | "mixed"',
  '  summary: 2–4 sentences of design-director judgement',
  '  strengths: 1–4 short strengths',
  '  issues: up to 8 objects {severity, dimension, title, detail, fix, blockIds?}',
  '  dimensions: scores 0–4 (or null if n/a) for each of:',
  `    ${CRITIQUE_DIMENSIONS.join(', ')}`,
  '  provocativeQuestions: up to 3 sharp questions for the author',
  '',
  'Be specific and evidence-based. Prefer concrete block references over vague taste.',
  'A template that could belong to any brand after swapping the logo scores low on brandSpecificity.',
].join('\n');

function summariseDocument(document: EditorDocument): string {
  const lines: string[] = [];
  for (const [id, block] of Object.entries(document)) {
    if (!block || typeof block !== 'object') continue;
    const type = (block as { type?: string }).type ?? '?';
    const data = (block as { data?: Record<string, unknown> }).data ?? {};
    const style = (data.style as Record<string, unknown> | undefined) ?? {};
    const props = (data.props as Record<string, unknown> | undefined) ?? {};
    let hint = '';
    if (type === 'NotionText' && typeof props.html === 'string') {
      hint = props.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    } else if (type === 'Button' && typeof props.text === 'string') {
      hint = `btn:"${props.text}" bg=${String(props.buttonBackgroundColor ?? style.buttonBackgroundColor ?? '')}`;
    } else if (type === 'Image') {
      hint = `img w=${String(props.width ?? '')} size=${String(props.size ?? '')} alt=${String(props.alt ?? '').slice(0, 40)}`;
    } else if (type === 'EmailLayout') {
      hint = `canvas=${String(data.canvasColor ?? '')} font=${String(data.fontFamily ?? '')}`;
    } else if (type === 'Container' || type === 'ColumnsContainer') {
      const kids = (props.childrenIds as string[] | undefined)
        ?? (props.columns as Array<{ childrenIds?: string[] }> | undefined)?.flatMap((c) => c.childrenIds ?? []);
      hint = `kids=${(kids ?? []).length} pad=${JSON.stringify(style.padding ?? null)}`;
    }
    lines.push(`${id}|${type}|${hint}`);
  }
  // Cap prompt size — full gallery templates are ~40–50 blocks.
  return lines.slice(0, 80).join('\n');
}

export type RunCritiqueOptions = Omit<LlmCallOptions, 'system' | 'prompt'> & {
  locale?: string;
  brief?: string;
};

/**
 * Run the LLM design critique. Never throws — returns `null` on failure so
 * the deterministic audit can still ship alone.
 */
export async function runLlmCritique(
  document: EditorDocument,
  options: RunCritiqueOptions = {},
): Promise<LlmCritique | null> {
  const userPrompt = [
    options.brief ? `Brief:\n${options.brief}\n` : '',
    options.locale ? `Locale: ${options.locale}\n` : '',
    'Document (id|type|hint):\n',
    summariseDocument(document),
  ].join('');

  try {
    const raw = await callLlmText({
      ...options,
      system: CRITIQUE_SYSTEM,
      prompt: userPrompt,
      maxTokens: options.maxTokens ?? 1400,
    });
    const json = extractFirstJson(raw);
    if (!json) return null;
    const parsed = LlmCritiqueSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.warn('[agent/critique] LLM critique failed', err);
    return null;
  }
}

/** Convert LLM issues into Finding rows tagged so the UI can tell them apart. */
export function llmIssuesToFindings(critique: LlmCritique): Finding[] {
  return critique.issues.map((issue, i) => ({
    ruleId: `llm/design-${i + 1}`,
    severity: issue.severity as Severity,
    dimension: issue.dimension,
    title: issue.title,
    detail: issue.detail,
    impact: 'Design quality — recipients may bounce or ignore the message.',
    fix: issue.fix,
    location: { blockIds: issue.blockIds ?? [] },
  }));
}

export function llmDimensionNotes(critique: LlmCritique): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of critique.dimensions) {
    if (d.note) out[DIMENSION_LABEL[d.dimension] ?? d.dimension] = d.note;
  }
  return out;
}
