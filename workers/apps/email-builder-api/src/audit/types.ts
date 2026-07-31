/**
 * Report model for the template quality engine.
 *
 * Two reports come out of the same deterministic pass, mirroring the split
 * between a *technical* audit and a *design* critique:
 *
 *   - `audit`    — five technical dimensions, scored /20. Everything here is
 *                  measurable from the document alone (contrast ratios, column
 *                  widths, client support facts). No taste, no LLM.
 *   - `critique` — ten design dimensions, scored /40. The deterministic pass
 *                  seeds these with what *is* countable (heading scale, CTA
 *                  count, palette size); an optional LLM reviewer layers
 *                  judgement on top without being allowed to move the
 *                  technical numbers.
 *
 * Scores are 0-4 per dimension so both tables read the same way, and a
 * dimension that genuinely cannot apply to a template is scored `null`
 * ("n/a") and dropped from the denominator rather than being given a
 * misleading zero.
 */

/** Fix-first ordering. A P0 means the email is broken for someone, somewhere. */
export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export const SEVERITY_LABEL: Record<Severity, string> = {
  P0: 'Blocking',
  P1: 'Major',
  P2: 'Minor',
  P3: 'Polish',
};

/** Technical dimensions — the /20 audit. */
export const AUDIT_DIMENSIONS = [
  'accessibility',
  'clientCompatibility',
  'responsive',
  'deliverability',
  'structuralIntegrity',
] as const;

/** Design dimensions — the /40 critique. */
export const CRITIQUE_DIMENSIONS = [
  'hierarchy',
  'typography',
  'color',
  'spacing',
  'imagery',
  'ctaClarity',
  'content',
  'scanability',
  'consistency',
  'brandSpecificity',
] as const;

export type AuditDimensionId = (typeof AUDIT_DIMENSIONS)[number];
export type CritiqueDimensionId = (typeof CRITIQUE_DIMENSIONS)[number];
export type DimensionId = AuditDimensionId | CritiqueDimensionId;

export const DIMENSION_LABEL: Record<DimensionId, string> = {
  accessibility: 'Accessibility',
  clientCompatibility: 'Client compatibility',
  responsive: 'Responsive / mobile',
  deliverability: 'Deliverability',
  structuralIntegrity: 'Structural integrity',
  hierarchy: 'Hierarchy & composition',
  typography: 'Typography',
  color: 'Color',
  spacing: 'Spacing & rhythm',
  imagery: 'Imagery',
  ctaClarity: 'CTA clarity',
  content: 'Content & copy',
  scanability: 'Scanability',
  consistency: 'Consistency',
  brandSpecificity: 'Brand specificity',
};

/**
 * Where a finding lives. `blockIds` are document keys so the editor can
 * select the offending blocks directly from a report row; `path` is a
 * human-readable trail ("root › Container › ColumnsContainer col 2 › Button").
 */
export type FindingLocation = {
  blockIds: string[];
  path?: string;
};

export type Finding = {
  /** Stable identifier, e.g. `a11y/text-contrast`. Safe to suppress on. */
  ruleId: string;
  severity: Severity;
  dimension: DimensionId;
  /** One line, names the problem. */
  title: string;
  /** What was measured — always carries the evidence, never just an opinion. */
  detail: string;
  /** Why it matters to a recipient. */
  impact: string;
  /** Concrete instruction, specific enough to act on without re-diagnosing. */
  fix: string;
  location: FindingLocation;
  /** WCAG success criterion, RFC, or spec reference where one applies. */
  standard?: string;
  /** Email clients that render this incorrectly. */
  clients?: string[];
  /**
   * True when `applyAutoFixes` can resolve this without a judgement call.
   * Contrast and alt text are not auto-fixable; a missing `role` is.
   */
  autoFixable?: boolean;
};

export type DimensionScore = {
  dimension: DimensionId;
  label: string;
  /** 0-4, or `null` when the dimension does not apply to this template. */
  score: number | null;
  /** Unrounded score, useful for trend lines where 3.4 → 3.6 is real progress. */
  raw: number | null;
  /** Why it is n/a, when it is. */
  notApplicableReason?: string;
  /** The single most important finding in this dimension. */
  keyFinding?: string;
  findingCount: number;
};

export type RatingBand = 'Excellent' | 'Good' | 'Acceptable' | 'Poor' | 'Critical';

export type ScoreCard = {
  dimensions: DimensionScore[];
  /** Sum of applicable dimension scores. */
  total: number;
  /** 4 × (number of applicable dimensions). Never assume the full maximum. */
  max: number;
  percentage: number;
  band: RatingBand;
};

export type SeverityCounts = Record<Severity, number>;

/** Facts the rules measured, surfaced so a reader can sanity-check the score. */
export type TemplateMetrics = {
  blockCount: number;
  blockTypeCounts: Record<string, number>;
  wordCount: number;
  /** Rough seconds to read at 240wpm. */
  readingTimeSeconds: number;
  imageCount: number;
  /** Share of the email's vertical space occupied by images, 0-1. */
  imageToTextRatio: number;
  linkCount: number;
  ctaCount: number;
  /** Distinct colours used across text, backgrounds, and buttons. */
  paletteSize: number;
  fontFamilies: string[];
  fontSizes: number[];
  /** Estimated rendered height in px at 600px wide. */
  estimatedHeightPx: number;
  maxNestingDepth: number;
  hasPreheader: boolean;
  hasUnsubscribe: boolean;
};

export type QualityReport = {
  /** Bumped when scoring changes in a way that breaks trend comparability. */
  engineVersion: string;
  generatedAt: string;
  /** Technical: /20 across five dimensions. */
  audit: ScoreCard;
  /** Design: /40 across ten dimensions. */
  critique: ScoreCard;
  /** Single headline number, 0-100, weighted 50/50 between the two cards. */
  overall: number;
  overallBand: RatingBand;
  findings: Finding[];
  severityCounts: SeverityCounts;
  metrics: TemplateMetrics;
  /** Things the template does well. A report that only lists faults is not a review. */
  strengths: string[];
  /** Recurring problems that point at a systemic cause rather than a one-off. */
  patterns: string[];
  /**
   * Checks the engine could not run, and why.
   *
   * Stated plainly rather than silently skipped: a reader has to be able to
   * tell "we looked and it was fine" from "we never looked". Absence of a
   * finding is only reassuring when the scope of the search is known.
   */
  notChecked: string[];
};

/** Rating bands read off the percentage so a renormalised card stays honest. */
export function bandFor(percentage: number): RatingBand {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 70) return 'Good';
  if (percentage >= 50) return 'Acceptable';
  if (percentage >= 30) return 'Poor';
  return 'Critical';
}
