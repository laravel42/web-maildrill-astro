import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import WrapPills from './Wizard/controls/WrapPills';

const CHANGE_CHIPS = [
  'colour',
  'typography',
  'spacing',
  'imagery',
  'copy',
  'cta',
  'layout',
  'mobile',
  'accessibility',
  'polish',
] as const;

type Scope = 'block' | 'section' | 'email';

interface Props {
  backendUrl: string;
  description: string;
  onCompiled: (prompt: string) => void;
}

/**
 * Structured refine composer — picks change chips + scope, then compiles a
 * craft-aware refine prompt via `/visual-brief/refine`.
 */
export default function RefineComposer({ backendUrl, description, onCompiled }: Props) {
  const { t } = useTranslation('inspector');
  const [changes, setChanges] = useState<string[]>(['polish']);
  const [scope, setScope] = useState<Scope>('email');
  const [loading, setLoading] = useState(false);

  const toggle = (value: string) => {
    setChanges((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((c) => c !== value);
        return next.length ? next : prev;
      }
      if (prev.length >= 8) return prev;
      return [...prev, value];
    });
  };

  const compile = useCallback(async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/visual-brief/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: { changes, description: description.trim(), scope },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { prompt: string };
      onCompiled(data.prompt);
    } catch (err) {
      console.error('Failed to compile refine brief', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, changes, description, scope, onCompiled]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {t('aiGeneration.refine.changesLabel', 'What should change?')}
      </Typography>
      <Box sx={{ mt: 0.5, mb: 1 }}>
        <WrapPills
          ariaLabel={t('aiGeneration.refine.changesLabel', 'What should change?')}
          options={CHANGE_CHIPS.map((c) => ({
            value: c,
            label: t(`aiGeneration.refine.changes.${c}`, c),
          }))}
          isSelected={(v) => changes.includes(v)}
          onToggle={toggle}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('aiGeneration.refine.scopeLabel', 'Scope')}
      </Typography>
      <ToggleButtonGroup
        value={scope}
        exclusive
        size="small"
        fullWidth
        sx={{ mt: 0.5, mb: 1 }}
        onChange={(_e, next: Scope | null) => {
          if (next) setScope(next);
        }}
      >
        <ToggleButton value="block" sx={{ textTransform: 'none' }}>
          {t('aiGeneration.refine.scope.block', 'Block')}
        </ToggleButton>
        <ToggleButton value="section" sx={{ textTransform: 'none' }}>
          {t('aiGeneration.refine.scope.section', 'Section')}
        </ToggleButton>
        <ToggleButton value="email" sx={{ textTransform: 'none' }}>
          {t('aiGeneration.refine.scope.email', 'Whole email')}
        </ToggleButton>
      </ToggleButtonGroup>
      <Button
        size="small"
        variant="outlined"
        onClick={() => void compile()}
        disabled={loading || !description.trim()}
        startIcon={loading ? <CircularProgress size={14} /> : undefined}
        sx={{ textTransform: 'none' }}
      >
        {loading
          ? t('aiGeneration.refine.compiling', 'Shaping refine prompt…')
          : t('aiGeneration.refine.compile', 'Shape refine prompt')}
      </Button>
    </Box>
  );
}
