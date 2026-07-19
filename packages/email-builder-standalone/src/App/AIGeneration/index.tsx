import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AutoAwesome } from '@mui/icons-material';
import { Button, Tooltip } from '@mui/material';

import type { AIGenerateTemplateRequest, AIGenerateTemplateResponse } from '../..';

import AIGenerationDialog from './AIGenerationDialog';

type OnAIGenerateTemplate = (
  request: AIGenerateTemplateRequest,
  options: { signal: AbortSignal }
) => Promise<AIGenerateTemplateResponse>;

function readCallbackFromWindow(): OnAIGenerateTemplate | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as any).__emailBuilderOnAIGenerateTemplate as OnAIGenerateTemplate | undefined;
}

/**
 * Entry point for AI template generation. Renders a button in the editor
 * header that opens `AIGenerationDialog` when clicked.
 *
 * Visibility is guarded by the presence of `onAIGenerateTemplate` on the
 * `EmailBuilder` component. That callback is bridged to
 * `window.__emailBuilderOnAIGenerateTemplate` by `EmailBuilder` itself —
 * same pattern used by `ImageInput`, `BackgroundImageInput`, and
 * `AiFeaturesDropdown` for `__emailBuilderEnableAI` / `__emailBuilderOnAIRequest`.
 *
 * Because `EmailBuilder` sets that global from a `useEffect` (which runs
 * *after* child effects on first mount), a plain inline read would miss the
 * initial paint. We subscribe to the `email-builder-ai-features-updated`
 * event that `EmailBuilder` dispatches whenever the AI-feature globals
 * change so the button renders/hides reactively.
 */
export default function AIGeneration() {
  const { t } = useTranslation('inspector');

  const [onAIGenerateTemplate, setOnAIGenerateTemplate] = useState<OnAIGenerateTemplate | undefined>(
    readCallbackFromWindow
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const next = readCallbackFromWindow();
      setOnAIGenerateTemplate(() => next);
    };
    // Re-check after the first paint to catch the case where EmailBuilder's
    // own effect ran after ours on initial mount.
    refresh();
    window.addEventListener('email-builder-ai-features-updated', refresh);
    return () => {
      window.removeEventListener('email-builder-ai-features-updated', refresh);
    };
  }, []);

  const handleOpen = useCallback(() => setDialogOpen(true), []);
  const handleClose = useCallback(() => setDialogOpen(false), []);

  if (!onAIGenerateTemplate) {
    return null;
  }

  return (
    <>
      <Tooltip title={t('aiGeneration.tooltip')}>
        <Button variant="outlined" size="small" startIcon={<AutoAwesome fontSize="small" />} onClick={handleOpen}>
          {t('aiGeneration.button')}
        </Button>
      </Tooltip>
      <AIGenerationDialog open={dialogOpen} onClose={handleClose} onAIGenerateTemplate={onAIGenerateTemplate} />
    </>
  );
}
