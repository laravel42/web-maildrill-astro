import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';

import { INPUT_TEXTFIELD_SX } from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';

import type { DraftBrief } from './briefDefaults';
import { compileBriefClient } from './compileBriefClient';

interface Props {
  brief: DraftBrief;
  backendUrl: string;
  onGenerate: (prompt: string, brief: DraftBrief) => void;
  onBack: () => void;
  generating: boolean;
}

/**
 * Normalise the compiled prompt: some responses arrive JSON-encoded (the whole
 * payload wrapped in quotes with escaped newlines) — decode that first.
 */
function normalizePrompt(raw: string): string {
  let s = raw;
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    try {
      const decoded = JSON.parse(s);
      if (typeof decoded === 'string') s = decoded;
    } catch {
      /* not JSON — leave as-is */
    }
  }
  return s;
}

/**
 * Turn the backend's structured, tag-annotated brief (`[PURPOSE] …`,
 * `[LAYOUT] …`) into a single, natural prompt the user reads and edits. We
 * still let the backend derive a structure for us, but we don't surface the
 * machine tags/chips — the review reads like one editable prompt, in tone with
 * the rest of the app. The `/generate` system prompt handles layout/quality, so
 * dropping the tag scaffolding here doesn't cost generation quality.
 */
function humanizePrompt(raw: string): string {
  return normalizePrompt(raw)
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*\[[A-Z0-9_]+]\s*/, '') // drop leading [TAG]
        .replace(/^["'\s]+|["'\s]+$/g, '') // trim stray quotes/space
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

export default function SummaryStep({ brief, backendUrl, onGenerate, onBack, generating }: Props) {
  const { t } = useTranslation('aiWizard');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [compileFailed, setCompileFailed] = useState(false);
  // Once the user edits the prompt, a late/re-run compile must not clobber it.
  const editedRef = useRef(false);

  /**
   * Local, tone-appropriate prompt built purely from the brief. Used as the
   * initial value if the compile endpoint is slow/unavailable so the field is
   * NEVER empty (previously a failed compile left an empty prompt and the user
   * couldn't generate).
   */
  const buildFallback = useCallback((): string => {
    const es = brief.email_strategy;
    if (es.rawIntent && es.rawIntent.trim()) return es.rawIntent.trim();

    const kind = es.purpose && es.purpose !== 'custom' ? `${es.purpose} email` : 'email';
    let s = `Create a polished, production-ready ${kind}`;
    if (es.brandName && es.brandName.trim()) s += ` for ${es.brandName.trim()}`;
    if (es.audience && es.audience.trim()) s += ` aimed at ${es.audience.trim()}`;
    s += '.';
    if (es.goal && es.goal.trim()) s += ` The main goal is ${es.goal.trim()}.`;
    const c = brief.visual_strategy.brandColors;
    const colors = [c?.primary, c?.secondary, c?.accent].filter(Boolean) as string[];
    if (colors.length) s += ` Use the brand colors ${colors.join(', ')}.`;
    return s;
  }, [brief]);

  const compile = useCallback(async () => {
    setLoading(true);
    setCompileFailed(false);
    try {
      const result = await compileBriefClient(brief, backendUrl);
      const clean = humanizePrompt(result.prompt);
      if (!editedRef.current) setPrompt(clean || buildFallback());
    } catch {
      setCompileFailed(true);
      if (!editedRef.current) setPrompt(buildFallback());
    } finally {
      setLoading(false);
    }
  }, [brief, backendUrl, buildFallback]);

  // Seed the field immediately with the local fallback so it is never empty,
  // then replace it with the compiled prompt when it arrives.
  useEffect(() => {
    if (!editedRef.current && !prompt) setPrompt(buildFallback());
    void compile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(() => {
    const text = prompt.trim();
    if (text) onGenerate(text, brief);
  }, [prompt, brief, onGenerate]);

  return (
    <Stack spacing={1.5}>
      <div>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t('summary.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('summary.finalPromptHelp')}
        </Typography>
      </div>

      <TextField
        fullWidth
        multiline
        minRows={6}
        maxRows={14}
        variant="outlined"
        value={prompt}
        placeholder={t('summary.promptPlaceholder')}
        onChange={(e) => {
          editedRef.current = true;
          setPrompt(e.target.value);
        }}
        disabled={generating}
        sx={INPUT_TEXTFIELD_SX}
      />

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="caption">{t('summary.compiling')}</Typography>
        </Stack>
      )}

      {compileFailed && !loading && (
        <Alert
          severity="info"
          action={
            <Button size="small" onClick={compile}>
              {t('summary.retry')}
            </Button>
          }
        >
          {t('summary.compileError')}
        </Alert>
      )}

      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
        <Button onClick={onBack} disabled={generating}>
          {t('steps.common.back')}
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {generating ? t('summary.generating') : t('summary.generate')}
        </Button>
      </Stack>
    </Stack>
  );
}
