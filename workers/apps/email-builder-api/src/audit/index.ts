/**
 * The template quality engine.
 *
 * `analyzeTemplate` is the whole public surface: hand it a document, get back
 * a deterministic report. No network, no LLM, no I/O — which is what lets it
 * run on every generation without cost, in CI, and eventually in the browser
 * for a live quality panel.
 *
 * The LLM never sees these numbers before producing its own review; the
 * design reviewer in `../agent/critique.ts` runs first and is then reconciled
 * against this pass, so a model cannot simply agree with a score it was
 * shown. That mirrors the two-assessment split the Impeccable design skill
 * uses, for the same reason: anchoring destroys the value of the second
 * opinion.
 */
import { computeFacts, type EnvelopeContext } from './metrics.js';
import { resolveDocument, type EditorDocument, type ResolvedDocument } from './model.js';
import { accessibilityRules } from './rules/accessibility.js';
import { compatibilityRules } from './rules/compatibility.js';
import type { RuleContext, RulePack } from './rules/context.js';
import { deliverabilityRules } from './rules/deliverability.js';
import { designRules } from './rules/design.js';
import { responsiveRules } from './rules/responsive.js';
import { structureRules } from './rules/structure.js';
import {
  buildAuditCard,
  buildCritiqueCard,
  computeApplicability,
  countSeverities,
  detectPatterns,
  detectStrengths,
  sortFindings,
} from './scoring.js';
import { bandFor, type QualityReport } from './types.js';

export const ENGINE_VERSION = '1.0.0';

const PACKS: { id: string; run: RulePack }[] = [
  { id: 'structure', run: structureRules },
  { id: 'accessibility', run: accessibilityRules },
  { id: 'compatibility', run: compatibilityRules },
  { id: 'responsive', run: responsiveRules },
  { id: 'deliverability', run: deliverabilityRules },
  { id: 'design', run: designRules },
];

export type AnalyzeOptions = EnvelopeContext & {
  /** Root block key. Defaults to `root`. */
  rootId?: string;
  /** Rule ids to drop, for teams that have consciously accepted a trade-off. */
  suppress?: string[];
};

export type AnalyzeResult = {
  report: QualityReport;
  /** The resolved document, so callers can avoid a second walk. */
  resolved: ResolvedDocument;
};

export function analyzeTemplate(document: EditorDocument, options: AnalyzeOptions = {}): AnalyzeResult {
  const { rootId = 'root', suppress = [], ...envelope } = options;

  const resolved = resolveDocument(document, rootId);
  const facts = computeFacts(resolved, envelope);
  const ctx: RuleContext = { doc: resolved, facts };

  const suppressed = new Set(suppress);
  const findings = sortFindings(
    PACKS.flatMap(({ id, run }) => {
      try {
        return run(ctx);
      } catch (error) {
        // A crashing rule pack must not take the report with it — a partial
        // audit is far more useful than a 500, and the gap is reported.
        return [
          {
            ruleId: `engine/${id}-failed`,
            severity: 'P3' as const,
            dimension: 'structuralIntegrity' as const,
            title: `The ${id} rules could not run`,
            detail: error instanceof Error ? error.message : String(error),
            impact: `This report is incomplete: nothing from the ${id} pack was checked.`,
            fix: 'Report this as a bug with the document that triggered it.',
            location: { blockIds: [] },
          },
        ];
      }
    }).filter((f) => !suppressed.has(f.ruleId)),
  );

  const notChecked: string[] = [];
  if (envelope.subject === undefined) {
    notChecked.push('Subject line — not supplied, so length, casing, and spam signals were not reviewed.');
  }
  if (envelope.preheader === undefined) {
    notChecked.push(
      'Preheader — not supplied. It is the second line in the inbox list and moves open rate more than anything inside the email, so it is worth reviewing separately.',
    );
  }
  if (envelope.renderedHtmlBytes === undefined) {
    notChecked.push('Rendered HTML size — estimated from the document rather than measured, so the Gmail clipping check is approximate.');
  }
  notChecked.push(
    'Image content — the engine reads dimensions and alt text but never fetches the images, so it cannot tell whether one is broken, off-brand, or has text baked into it.',
  );

  const applicability = computeApplicability(facts.metrics);
  const audit = buildAuditCard(findings, applicability);
  const critique = buildCritiqueCard(findings, applicability);
  const overall = Math.round((audit.percentage + critique.percentage) / 2);

  const report: QualityReport = {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    audit,
    critique,
    overall,
    overallBand: bandFor(overall),
    findings,
    severityCounts: countSeverities(findings),
    metrics: facts.metrics,
    strengths: detectStrengths(findings, facts.metrics),
    patterns: detectPatterns(findings),
    notChecked,
  };

  return { report, resolved };
}

/**
 * True when the template is safe to send: nothing blocking, and no more than
 * a couple of major issues. Used as the gate on generated output.
 */
export function isSendReady(report: QualityReport): boolean {
  return report.severityCounts.P0 === 0 && report.severityCounts.P1 <= 2;
}

export * from './types.js';
export { resolveDocument } from './model.js';
export type { EditorDocument } from './model.js';
