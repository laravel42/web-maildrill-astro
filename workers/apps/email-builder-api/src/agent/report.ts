/**
 * Full quality report: deterministic audit first, optional LLM critique second.
 *
 * Order is intentional (Impeccable invariant): the LLM never sees the
 * technical scores before writing its own review. We then merge findings.
 */

import { analyzeTemplate, isSendReady, type AnalyzeOptions, type EditorDocument } from '../audit/index.js';
import type { Finding, QualityReport, ScoreCard } from '../audit/types.js';
import { bandFor, CRITIQUE_DIMENSIONS, DIMENSION_LABEL } from '../audit/types.js';

import {
  llmIssuesToFindings,
  runLlmCritique,
  type LlmCritique,
  type RunCritiqueOptions,
} from './critique.js';

export type FullQualityReport = QualityReport & {
  /** Present when the LLM design pass succeeded. */
  llmCritique: LlmCritique | null;
  /** True when P0=0 and P1≤2 on the merged findings. */
  sendReady: boolean;
  /** Human-readable client-compatibility weakness list. */
  clientWeaknesses: string[];
  /** Human-readable design weakness list (top findings). */
  designWeaknesses: string[];
};

export type BuildReportOptions = AnalyzeOptions &
  RunCritiqueOptions & {
    /** Skip the LLM pass (faster / offline). Defaults to running it. */
    skipLlm?: boolean;
    brief?: string;
  };

function mergeCritiqueCard(base: ScoreCard, llm: LlmCritique | null): ScoreCard {
  if (!llm) return base;
  const byDim = new Map(llm.dimensions.map((d) => [d.dimension, d]));
  const dimensions = base.dimensions.map((d) => {
    const overlay = byDim.get(d.dimension as (typeof CRITIQUE_DIMENSIONS)[number]);
    if (!overlay || overlay.score == null) return d;
    // Average deterministic seed with LLM judgement — neither alone owns the score.
    const blended =
      d.score == null ? overlay.score : Math.round(((d.score + overlay.score) / 2) * 10) / 10;
    return {
      ...d,
      score: blended,
      raw: blended,
      keyFinding: overlay.note ?? d.keyFinding,
    };
  });
  const applicable = dimensions.filter((d) => d.score != null);
  const total = applicable.reduce((s, d) => s + (d.score as number), 0);
  const max = applicable.length * 4;
  const percentage = max > 0 ? Math.round((total / max) * 100) : 0;
  return { dimensions, total, max, percentage, band: bandFor(percentage) };
}

function pickWeaknesses(findings: Finding[], dimensionPrefix: 'design' | 'tech'): string[] {
  const designDims = new Set<string>(CRITIQUE_DIMENSIONS);
  const filtered = findings.filter((f) =>
    dimensionPrefix === 'design' ? designDims.has(f.dimension) : !designDims.has(f.dimension),
  );
  return filtered
    .filter((f) => f.severity === 'P0' || f.severity === 'P1' || f.severity === 'P2')
    .slice(0, 8)
    .map((f) => {
      const clients = f.clients?.length ? ` [${f.clients.join(', ')}]` : '';
      return `${f.severity} · ${DIMENSION_LABEL[f.dimension]}: ${f.title}${clients}`;
    });
}

function clientWeaknessesFrom(findings: Finding[]): string[] {
  return findings
    .filter((f) => f.dimension === 'clientCompatibility' || (f.clients && f.clients.length > 0))
    .slice(0, 10)
    .map((f) => {
      const clients = f.clients?.length ? f.clients.join(', ') : 'multiple clients';
      return `${f.title} — ${clients}. ${f.fix}`;
    });
}

/**
 * Build a full quality report. Deterministic audit always runs; LLM critique
 * is best-effort and skipped when `skipLlm` is true.
 */
export async function buildQualityReport(
  document: EditorDocument,
  options: BuildReportOptions = {},
): Promise<FullQualityReport> {
  const { skipLlm = false, brief, locale, provider, model, maxTokens, llmText, getProvider, ...analyzeOpts } =
    options;

  const { report } = analyzeTemplate(document, analyzeOpts);

  let llm: LlmCritique | null = null;
  if (!skipLlm) {
    llm = await runLlmCritique(document, { brief, locale, provider, model, maxTokens, llmText, getProvider });
  }

  const llmFindings = llm ? llmIssuesToFindings(llm) : [];
  const findings = [...report.findings, ...llmFindings];
  const critique = mergeCritiqueCard(report.critique, llm);
  const overall = Math.round((report.audit.percentage + critique.percentage) / 2);

  const severityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) severityCounts[f.severity] += 1;

  const strengths = [
    ...report.strengths,
    ...(llm?.strengths ?? []).filter((s) => !report.strengths.includes(s)),
  ].slice(0, 6);

  const merged: QualityReport = {
    ...report,
    critique,
    overall,
    overallBand: bandFor(overall),
    findings,
    severityCounts,
    strengths,
    notChecked: [
      ...report.notChecked,
      ...(llm ? [] : ['LLM design critique — skipped or unavailable for this run.']),
    ],
  };

  return {
    ...merged,
    llmCritique: llm,
    sendReady: isSendReady(merged),
    clientWeaknesses: clientWeaknessesFrom(findings),
    designWeaknesses: pickWeaknesses(findings, 'design'),
  };
}
