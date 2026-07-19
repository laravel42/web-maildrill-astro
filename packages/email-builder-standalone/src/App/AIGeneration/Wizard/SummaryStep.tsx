import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography } from '@mui/material';

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

/** Parse structured prompt lines into labeled sections for display. */
function parsePromptSections(prompt: string): Array<{ tag: string; content: string }> {
  const lines = prompt.split('\n');
  const sections: Array<{ tag: string; content: string }> = [];
  for (const line of lines) {
    const match = line.match(/^\[([A-Z]+)]\s*(.+)$/);
    if (match) {
      sections.push({ tag: match[1], content: match[2] });
    } else if (line.trim()) {
      sections.push({ tag: '', content: line.trim() });
    }
  }
  return sections;
}

const TAG_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'> = {
  PURPOSE: 'primary',
  GOAL: 'primary',
  TONE: 'secondary',
  COLORS: 'warning',
  LAYOUT: 'info',
  IMAGERY: 'success',
  CREATIVE: 'secondary',
};

export default function SummaryStep({ brief, backendUrl, onGenerate, onBack, generating }: Props) {
  const { t } = useTranslation('aiWizard');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const compile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await compileBriefClient(brief, backendUrl);
      setPrompt(result.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [brief, backendUrl]);

  useEffect(() => {
    void compile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(() => {
    if (prompt.trim()) onGenerate(prompt.trim(), brief);
  }, [prompt, brief, onGenerate]);

  const sections = parsePromptSections(prompt);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('summary.title')}
      </Typography>

      {/* Structured prompt display */}
      {loading ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="caption">{t('summary.compiling')}</Typography>
        </Stack>
      ) : editMode ? (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={6}
            size="small"
            variant="outlined"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            sx={INPUT_TEXTFIELD_SX}
          />
          <Button size="small" onClick={() => setEditMode(false)} sx={{ mt: 0.5 }}>
            {t('summary.doneEditing')}
          </Button>
        </Box>
      ) : (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
          <Stack spacing={1}>
            {sections.map((sec, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                {sec.tag && (
                  <Chip
                    label={sec.tag}
                    size="small"
                    color={TAG_COLORS[sec.tag] ?? 'default'}
                    variant="outlined"
                    sx={{ fontSize: '10px', height: 20, minWidth: 64 }}
                  />
                )}
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {sec.content}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Button size="small" onClick={() => setEditMode(true)} sx={{ mt: 1 }}>
            {t('summary.editPrompt')}
          </Button>
        </Box>
      )}

      {error && (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          action={
            <Button size="small" onClick={compile}>
              {t('summary.retry')}
            </Button>
          }
        >
          {t('summary.compileError')}
        </Alert>
      )}

      <Divider />

      <Typography variant="caption" color="text.secondary">
        {t('summary.finalPromptHelp')}
      </Typography>

      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1 }}>
        <Button onClick={onBack} disabled={generating}>
          {t('steps.common.back')}
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!prompt.trim() || loading || generating}
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {generating ? t('summary.generating') : t('summary.generate')}
        </Button>
      </Stack>
    </Stack>
  );
}
