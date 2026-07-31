/**
 * Shared plumbing for rule packs.
 *
 * A rule is a pure function from the resolved document to findings. Keeping
 * them pure means the whole engine is trivially testable — no fixtures beyond
 * a document literal, no mocking — and means rules can be run selectively.
 */
import { getContrastRatio, WCAG_LEVELS } from '../../utils/wcag-contrast.js';
import type { DocumentFacts } from '../metrics.js';
import type { ResolvedBlock, ResolvedDocument } from '../model.js';
import type { DimensionId, Finding, Severity } from '../types.js';

export type RuleContext = {
  doc: ResolvedDocument;
  facts: DocumentFacts;
};

export type RulePack = (ctx: RuleContext) => Finding[];

export type FindingInput = {
  ruleId: string;
  severity: Severity;
  dimension: DimensionId;
  title: string;
  detail: string;
  impact: string;
  fix: string;
  blocks?: (ResolvedBlock | string)[];
  path?: string;
  standard?: string;
  clients?: string[];
  autoFixable?: boolean;
};

export function finding(input: FindingInput): Finding {
  const blockIds = (input.blocks ?? []).map((b) => (typeof b === 'string' ? b : b.id));
  const first = input.blocks?.[0];
  return {
    ruleId: input.ruleId,
    severity: input.severity,
    dimension: input.dimension,
    title: input.title,
    detail: input.detail,
    impact: input.impact,
    fix: input.fix,
    location: {
      blockIds,
      path: input.path ?? (first && typeof first !== 'string' ? first.path : undefined),
    },
    standard: input.standard,
    clients: input.clients,
    autoFixable: input.autoFixable,
  };
}

/**
 * Contrast ratio that never throws.
 *
 * Colours come from documents that may be hand-edited or model-generated, so
 * a malformed value has to degrade to "cannot judge" rather than take down
 * the audit. Returns `null` when either colour is unparseable.
 */
export function safeContrast(foreground: string, background: string): number | null {
  try {
    return getContrastRatio(foreground, background);
  } catch {
    return null;
  }
}

/** WCAG 1.4.3 threshold for the given text, in points-equivalent px. */
export function contrastRequirement(fontSizePx: number, bold: boolean): number {
  const isLarge = fontSizePx >= 24 || (fontSizePx >= 18.66 && bold);
  return isLarge ? WCAG_LEVELS.AA_LARGE : WCAG_LEVELS.AA_NORMAL;
}

export function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** `[a, b, c]` → `"a, b and c"`, for readable finding text. */
export function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Truncates a quoted excerpt so findings stay one-line readable. */
export function excerpt(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
