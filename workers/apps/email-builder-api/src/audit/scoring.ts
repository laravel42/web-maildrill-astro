/**
 * Turning findings into scores.
 *
 * Two properties matter more than the exact weights. First, the mapping is
 * deterministic — the same document always scores the same, so a trend line
 * means something. Second, a dimension with nothing to judge is scored `null`
 * and dropped from the denominator rather than being handed a zero or a free
 * four; a template with no images should not be punished for weak imagery,
 * and should not be rewarded for it either.
 */
import {
  AUDIT_DIMENSIONS,
  bandFor,
  CRITIQUE_DIMENSIONS,
  DIMENSION_LABEL,
  type DimensionId,
  type DimensionScore,
  type Finding,
  type ScoreCard,
  type Severity,
  type SeverityCounts,
  type TemplateMetrics,
} from './types.js';

/**
 * Cost of a finding against its dimension's four points.
 *
 * A single P0 floors the dimension: "blocking" has to mean the score cannot
 * still read as passable. P1 through P3 accumulate, so three minor issues
 * cost about as much as one major one — which matches how a reviewer weighs
 * them in practice.
 */
const PENALTY: Record<Severity, number> = {
  P0: 4,
  P1: 1.5,
  P2: 0.75,
  P3: 0.25,
};

export type Applicability = Partial<Record<DimensionId, string>>;

/**
 * Dimensions that cannot be judged for this particular template, with the
 * reason shown in the report. Everything not listed is scored.
 */
export function computeApplicability(metrics: TemplateMetrics): Applicability {
  const na: Applicability = {};

  if (metrics.imageCount === 0 && metrics.wordCount <= 150) {
    na.imagery = 'No images, and the email is short enough that none is expected.';
  }
  if (metrics.blockCount === 0) {
    na.hierarchy = 'The document is empty.';
    na.typography = 'The document is empty.';
    na.spacing = 'The document is empty.';
    na.scanability = 'The document is empty.';
    na.consistency = 'The document is empty.';
  }
  if (metrics.blockCount > 0 && metrics.ctaCount <= 1 && metrics.blockCount < 4) {
    // Consistency needs repeated elements to compare. A single button in a
    // three-block transactional message has nothing to be inconsistent with.
    na.consistency = 'Too few repeated elements to judge consistency.';
  }

  return na;
}

function scoreDimension(
  dimension: DimensionId,
  findings: Finding[],
  applicability: Applicability,
): DimensionScore {
  const reason = applicability[dimension];
  const mine = findings.filter((f) => f.dimension === dimension);

  if (reason) {
    return {
      dimension,
      label: DIMENSION_LABEL[dimension],
      score: null,
      raw: null,
      notApplicableReason: reason,
      findingCount: mine.length,
    };
  }

  const penalty = mine.reduce((sum, f) => sum + PENALTY[f.severity], 0);
  const raw = Math.max(0, Math.min(4, 4 - penalty));

  // The worst finding is the one worth naming in a one-line summary.
  const order: Severity[] = ['P0', 'P1', 'P2', 'P3'];
  const worst = [...mine].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))[0];

  return {
    dimension,
    label: DIMENSION_LABEL[dimension],
    score: Math.round(raw),
    raw: Math.round(raw * 100) / 100,
    keyFinding: worst?.title,
    findingCount: mine.length,
  };
}

function buildCard(
  dimensions: readonly DimensionId[],
  findings: Finding[],
  applicability: Applicability,
): ScoreCard {
  const scored = dimensions.map((d) => scoreDimension(d, findings, applicability));
  const applicable = scored.filter((d) => d.score !== null);
  const total = applicable.reduce((sum, d) => sum + (d.score ?? 0), 0);
  const max = applicable.length * 4;
  const percentage = max > 0 ? Math.round((total / max) * 100) : 100;

  return {
    dimensions: scored,
    total,
    max,
    percentage,
    band: bandFor(percentage),
  };
}

export function buildAuditCard(findings: Finding[], applicability: Applicability): ScoreCard {
  return buildCard(AUDIT_DIMENSIONS, findings, applicability);
}

export function buildCritiqueCard(findings: Finding[], applicability: Applicability): ScoreCard {
  return buildCard(CRITIQUE_DIMENSIONS, findings, applicability);
}

export function countSeverities(findings: Finding[]): SeverityCounts {
  const counts: SeverityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

/** Fix-first ordering: severity, then the dimensions that block sending. */
const DIMENSION_WEIGHT: Record<DimensionId, number> = {
  structuralIntegrity: 0,
  deliverability: 1,
  accessibility: 2,
  clientCompatibility: 3,
  responsive: 4,
  ctaClarity: 5,
  hierarchy: 6,
  content: 7,
  color: 8,
  typography: 9,
  scanability: 10,
  imagery: 11,
  spacing: 12,
  consistency: 13,
  brandSpecificity: 14,
};

export function sortFindings(findings: Finding[]): Finding[] {
  const order: Severity[] = ['P0', 'P1', 'P2', 'P3'];
  return [...findings].sort((a, b) => {
    const bySeverity = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return DIMENSION_WEIGHT[a.dimension] - DIMENSION_WEIGHT[b.dimension];
  });
}

/**
 * Recurring problems worth naming once instead of fifteen times.
 *
 * A finding that touches many blocks is a systemic choice, not a slip, and
 * reads very differently to whoever has to fix it.
 */
export function detectPatterns(findings: Finding[]): string[] {
  const patterns: string[] = [];

  for (const f of findings) {
    if (f.location.blockIds.length >= 4) {
      patterns.push(
        `${f.title} — affects ${f.location.blockIds.length} blocks, so it is a systemic choice rather than an isolated slip.`,
      );
    }
  }

  const byDimension = new Map<DimensionId, number>();
  for (const f of findings) byDimension.set(f.dimension, (byDimension.get(f.dimension) ?? 0) + 1);
  for (const [dimension, count] of byDimension) {
    if (count >= 4) {
      patterns.push(
        `${count} separate findings in ${DIMENSION_LABEL[dimension].toLowerCase()} — worth one focused pass rather than fixing them individually.`,
      );
    }
  }

  return patterns;
}

/**
 * What the template gets right.
 *
 * Derived from the absence of specific findings rather than from a high
 * score, so each line names a real property that was checked. A report that
 * only lists faults gives no signal about what to preserve while fixing them.
 */
export function detectStrengths(findings: Finding[], metrics: TemplateMetrics): string[] {
  const fired = new Set(findings.map((f) => f.ruleId));
  const strengths: string[] = [];

  if (
    !fired.has('a11y/text-contrast') &&
    !fired.has('a11y/button-contrast') &&
    metrics.wordCount > 0
  ) {
    strengths.push('Every text and button colour pair clears WCAG AA contrast.');
  }
  if (
    metrics.imageCount > 0 &&
    !fired.has('a11y/image-alt-missing') &&
    !fired.has('a11y/image-alt-filename')
  ) {
    strengths.push(
      `All ${metrics.imageCount} images carry meaningful alt text, so the email still reads with images blocked.`,
    );
  }
  if (!fired.has('compat/web-font-no-fallback') && !fired.has('compat/web-font-generic-fallback')) {
    strengths.push(
      'Typography uses stacks that degrade predictably in clients that do not load web fonts.',
    );
  }
  if (
    metrics.ctaCount >= 1 &&
    !fired.has('design/competing-ctas') &&
    !fired.has('a11y/generic-button-text')
  ) {
    strengths.push('The call to action is singular and specifically worded.');
  }
  if (
    !fired.has('structure/orphan-blocks') &&
    !fired.has('structure/dangling-reference') &&
    !fired.has('structure/placeholder-content')
  ) {
    strengths.push(
      'The document is structurally clean — no orphans, no dangling references, no placeholder copy.',
    );
  }
  if (
    !fired.has('design/palette-sprawl') &&
    !fired.has('design/no-accent-colour') &&
    metrics.paletteSize > 0
  ) {
    strengths.push(`A disciplined palette of ${metrics.paletteSize} colours with a clear accent.`);
  }
  if (!fired.has('deliver/no-unsubscribe')) {
    strengths.push('An unsubscribe path is present.');
  }
  if (
    !fired.has('responsive/column-too-narrow') &&
    !fired.has('responsive/image-wider-than-mobile') &&
    !fired.has('compat/three-column-no-stack')
  ) {
    strengths.push('The layout survives a 370px phone canvas without overflow.');
  }

  return strengths;
}
