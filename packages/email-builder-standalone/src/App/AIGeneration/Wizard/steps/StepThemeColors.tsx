import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Stack, Typography } from '@mui/material';

import type { DraftBrief } from '../briefDefaults';
import ColorPickerField from '../ColorPickerField';
import type { BriefPatch } from '../useVisualBrief';
import WizardField from '../WizardField';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

export default function StepThemeColors({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const colors = brief.visual_strategy.brandColors ?? { primary: '', secondary: '', accent: '' };

  function patchColor(key: 'primary' | 'secondary' | 'accent', hex: string) {
    patch({ visual_strategy: { brandColors: { ...colors, [key]: hex } } });
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('steps.theme.colorsTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t('steps.theme.colorsHint')}
        </Typography>
        <Stack spacing={1.5}>
          <ColorPickerField
            label={t('steps.theme.primary')}
            value={colors.primary || ''}
            onChange={(hex) => patchColor('primary', hex)}
          />
          <ColorPickerField
            label={t('steps.theme.secondary')}
            value={colors.secondary || ''}
            onChange={(hex) => patchColor('secondary', hex)}
          />
          <ColorPickerField
            label={t('steps.theme.accent')}
            value={colors.accent || ''}
            onChange={(hex) => patchColor('accent', hex)}
          />
        </Stack>
      </Box>

      <WizardField
        label={t('steps.theme.brandNameLabel')}
        value={brief.email_strategy.brandName}
        onChange={(e) => patch({ email_strategy: { brandName: e.target.value } })}
        placeholder={t('steps.theme.brandNamePlaceholder')}
      />
    </Stack>
  );
}
