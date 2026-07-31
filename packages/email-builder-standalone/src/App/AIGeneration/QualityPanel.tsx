import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

import type { TEditorConfiguration } from '../../documents/editor/core';

type Severity = 'P0' | 'P1' | 'P2' | 'P3';

type Finding = {
  ruleId: string;
  severity: Severity;
  dimension: string;
  title: string;
  detail: string;
  fix: string;
  clients?: string[];
  location?: { blockIds: string[] };
  autoFixable?: boolean;
};

/** Build a refine prompt from the highest-severity findings. */
export function buildCorrectionsPrompt(findings: Finding[]): string {
  const ranked = [...findings].sort((a, b) => {
    const order: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return order[a.severity] - order[b.severity];
  });
  const actionable = ranked
    .filter((f) => f.severity === 'P0' || f.severity === 'P1' || f.severity === 'P2')
    .slice(0, 10);
  if (actionable.length === 0) {
    return [
      '[REFINE] Scope: email',
      '[CHANGES]',
      '- Final polish pass without redesigning',
      '[INSTRUCTION] Apply a careful polish pass: tighten spacing, clarify the primary CTA, and fix any accessibility or client-compatibility issues. Preserve brand colours, copy intent, and block IDs.',
      '',
      'Rules for this refine pass:',
      '- Re-emit the FULL document as NDJSON (root EmailLayout first).',
      '- Preserve existing block IDs wherever the block still exists.',
      '- Do not invent a new visual world — only fix the listed issues.',
    ].join('\n');
  }

  const lines = actionable.map((f, i) => {
    const blocks = f.location?.blockIds?.length
      ? ` (blocks: ${f.location.blockIds.join(', ')})`
      : '';
    const clients = f.clients?.length ? ` [clients: ${f.clients.join(', ')}]` : '';
    return `${i + 1}. [${f.severity}] ${f.title}${blocks}${clients}\n   Fix: ${f.fix}`;
  });

  return [
    '[REFINE] Scope: email',
    '[CHANGES]',
    '- Apply quality-report corrections',
    '[INSTRUCTION] Fix the following quality findings. Preserve brand colours, fonts, section order, and block IDs unless a finding requires changing them. Do not redesign the email.',
    '',
    'Findings to fix:',
    ...lines,
    '',
    'Rules for this refine pass:',
    '- Re-emit the FULL document as NDJSON (root EmailLayout first).',
    '- Preserve existing block IDs wherever the block still exists.',
    '- Prefer the concrete Fix instructions above over inventing new content.',
    '- Keep the email send-ready: fix P0/P1 first, then P2 polish.',
  ].join('\n');
}

type ScoreCard = {
  percentage: number;
  band: string;
  total: number;
  max: number;
};

type QualityReport = {
  overall: number;
  overallBand: string;
  audit: ScoreCard;
  critique: ScoreCard;
  findings: Finding[];
  severityCounts: Record<Severity, number>;
  strengths: string[];
  clientWeaknesses?: string[];
  designWeaknesses?: string[];
  sendReady?: boolean;
  llmCritique?: {
    specificity?: string;
    summary?: string;
  } | null;
};

type AuditResponse = {
  report: QualityReport;
  sendReady?: boolean;
  clientWeaknesses?: Array<{ title: string; clients: string[]; fix: string; severity: Severity }>;
  designWeaknesses?: Array<{ title: string; dimension: string; fix: string; severity: Severity }>;
};

type CritiqueResponse = {
  report: QualityReport;
};

interface Props {
  document: TEditorConfiguration | null;
  backendUrl: string;
  /** Prompt / brief used for generation — forwarded to the LLM critique. */
  brief?: string;
  locale?: string;
  /**
   * When true, run the full critique (deterministic + LLM). Default is the
   * fast deterministic `/audit` pass; the user can upgrade with one click.
   */
  autoRun?: boolean;
  /** True while a corrections refine stream is in flight. */
  applying?: boolean;
  /**
   * Re-generate the template in refine mode using a prompt built from the
   * quality findings. Parent should pass `document` as `currentDocument`.
   */
  onApplyCorrections?: (prompt: string, document: TEditorConfiguration) => void;
}

const SEVERITY_COLOR: Record<Severity, 'error' | 'warning' | 'info' | 'default'> = {
  P0: 'error',
  P1: 'warning',
  P2: 'info',
  P3: 'default',
};

function bandColor(band: string): 'success' | 'info' | 'warning' | 'error' {
  if (band === 'Excellent' || band === 'Good') return 'success';
  if (band === 'Acceptable') return 'info';
  if (band === 'Poor') return 'warning';
  return 'error';
}

/**
 * Template quality report: technical audit + optional LLM design critique,
 * with explicit design and HTML-client weakness lists.
 */
export default function QualityPanel({
  document,
  backendUrl,
  brief,
  locale,
  autoRun = true,
  applying = false,
  onApplyCorrections,
}: Props) {
  const { t } = useTranslation('inspector');
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [showAll, setShowAll] = useState(false);

  const handleApplyCorrections = useCallback(() => {
    if (!document || !report || !onApplyCorrections || applying) return;
    const prompt = buildCorrectionsPrompt(report.findings ?? []);
    onApplyCorrections(prompt, document);
  }, [document, report, onApplyCorrections, applying]);

  const runAudit = useCallback(async () => {
    if (!document) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AuditResponse;
      setReport({
        ...data.report,
        sendReady: data.sendReady ?? data.report.sendReady,
        clientWeaknesses:
          data.clientWeaknesses?.map((w) => `${w.severity} · ${w.title}`) ??
          data.report.clientWeaknesses,
        designWeaknesses:
          data.designWeaknesses?.map((w) => `${w.severity} · ${w.title}`) ??
          data.report.designWeaknesses,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [document, backendUrl]);

  const runDeepCritique = useCallback(async () => {
    if (!document) return;
    setDeepLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/critique`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document, brief, locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CritiqueResponse;
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeepLoading(false);
    }
  }, [document, backendUrl, brief, locale]);

  useEffect(() => {
    if (autoRun && document) void runAudit();
  }, [autoRun, document, runAudit]);

  if (!document) return null;

  const findings = report?.findings ?? [];
  const visible = showAll
    ? findings
    : findings.filter((f) => f.severity === 'P0' || f.severity === 'P1').slice(0, 8);
  const needsCorrections =
    Boolean(report) &&
    !report?.sendReady &&
    ((report?.severityCounts.P0 ?? 0) > 0 ||
      (report?.severityCounts.P1 ?? 0) > 0 ||
      (report?.severityCounts.P2 ?? 0) > 0);
  const busy = loading || deepLoading || applying;

  return (
    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t('aiGeneration.quality.title', 'Template quality')}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => void runAudit()} disabled={busy}>
            {loading ? (
              <CircularProgress size={16} />
            ) : (
              t('aiGeneration.quality.recheck', 'Recheck')
            )}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void runDeepCritique()}
            disabled={busy}
          >
            {deepLoading ? (
              <CircularProgress size={16} />
            ) : (
              t('aiGeneration.quality.deepCritique', 'Design critique')
            )}
          </Button>
          {/* "Apply corrections" lives once, next to the findings it fixes —
              a second copy up here competed with it and dimmed to noise when
              the report was already send-ready. */}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {(loading || deepLoading) && !report && <LinearProgress sx={{ mb: 1 }} />}

      {report && (
        <>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}
          >
            <Chip
              color={bandColor(report.overallBand)}
              label={`${report.overall}% · ${report.overallBand}`}
              sx={{ fontWeight: 700 }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t('aiGeneration.quality.auditScore', 'Tech {{n}}%', {
                n: report.audit.percentage,
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t('aiGeneration.quality.designScore', 'Design {{n}}%', {
                n: report.critique.percentage,
              })}
            />
            <Chip
              size="small"
              color={report.sendReady ? 'success' : 'warning'}
              label={
                report.sendReady
                  ? t('aiGeneration.quality.sendReady', 'Send-ready')
                  : t('aiGeneration.quality.needsWork', 'Needs work')
              }
            />
            {report.llmCritique?.specificity && (
              <Chip size="small" variant="outlined" label={report.llmCritique.specificity} />
            )}
          </Stack>

          {report.llmCritique?.summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {report.llmCritique.summary}
            </Typography>
          )}

          {report.strengths?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                {t('aiGeneration.quality.strengths', 'Strengths')}
              </Typography>
              <List dense disablePadding>
                {report.strengths.slice(0, 4).map((s, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemText primary={s} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {(report.designWeaknesses?.length || 0) > 0 && (
            <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('aiGeneration.quality.designWeaknesses', 'Design weaknesses')}
              </Typography>
              <List dense disablePadding>
                {report.designWeaknesses!.slice(0, 5).map((w, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemText primary={w} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {(report.clientWeaknesses?.length || 0) > 0 && (
            <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('aiGeneration.quality.clientWeaknesses', 'HTML client compatibility')}
              </Typography>
              <List dense disablePadding>
                {report.clientWeaknesses!.slice(0, 5).map((w, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemText primary={w} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          <Typography
            variant="caption"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
          >
            {t('aiGeneration.quality.findings', 'Findings')} ({report.severityCounts.P0} P0 ·{' '}
            {report.severityCounts.P1} P1 · {report.severityCounts.P2} P2)
          </Typography>
          <List dense>
            {visible.map((f, i) => (
              <ListItem key={`${f.ruleId}-${i}`} alignItems="flex-start" sx={{ px: 0 }}>
                <Chip
                  size="small"
                  color={SEVERITY_COLOR[f.severity]}
                  label={f.severity}
                  sx={{ mr: 1, mt: 0.5, minWidth: 36 }}
                />
                <ListItemText
                  primary={f.title}
                  secondary={
                    <>
                      {f.detail}
                      {f.fix ? (
                        <>
                          <br />
                          <strong>{t('aiGeneration.quality.fix', 'Fix')}:</strong> {f.fix}
                        </>
                      ) : null}
                      {f.clients?.length ? (
                        <>
                          <br />
                          {t('aiGeneration.quality.clients', 'Clients')}: {f.clients.join(', ')}
                        </>
                      ) : null}
                    </>
                  }
                  slotProps={{
                    primary: { variant: 'body2', sx: { fontWeight: 600 } },
                    secondary: { variant: 'caption', component: 'div' },
                  }}
                />
              </ListItem>
            ))}
          </List>
          {findings.length > visible.length && (
            <Button size="small" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? t('aiGeneration.quality.showLess', 'Show less')
                : t('aiGeneration.quality.showAll', 'Show all {{n}} findings', {
                    n: findings.length,
                  })}
            </Button>
          )}

          {onApplyCorrections && needsCorrections && (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                type="button"
                fullWidth
                variant="contained"
                onClick={handleApplyCorrections}
                disabled={busy}
                startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {applying
                  ? t('aiGeneration.quality.applyingCorrections', 'Applying…')
                  : t('aiGeneration.quality.applyCorrections', 'Apply corrections')}
              </Button>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                {t(
                  'aiGeneration.quality.applyCorrectionsHint',
                  'Re-generates this template in refine mode, fixing the P0/P1 findings above while keeping block IDs and brand.',
                )}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
