import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Stack, Typography } from '@mui/material';

import { type DraftBrief, PALETTE_CHIPS, PHOTO_STYLE_CHIPS } from '../briefDefaults';
import ChipQuestion from '../ChipQuestion';
import ColorPickerField from '../ColorPickerField';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

const PALETTE_OPTIONS = PALETTE_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step03.palette.${v}`,
}));

const PHOTO_STYLE_OPTIONS = PHOTO_STYLE_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step03.photoStyle.${v}`,
}));

export default function Step03Visual({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const vs = brief.visual_strategy;
  const colors = vs.brandColors ?? { primary: '', secondary: '', accent: '' };

  function patchColor(key: 'primary' | 'secondary' | 'accent', hex: string) {
    patch({ visual_strategy: { brandColors: { ...colors, [key]: hex } } });
  }

  return (
    <Stack spacing={3}>
      <ChipQuestion
        questionKey="steps.step03.paletteQuestion"
        hintKey="steps.common.onlyAnswerThisPoint"
        options={PALETTE_OPTIONS}
        selected={vs.palette ? [vs.palette] : []}
        onChange={([v]) => patch({ visual_strategy: { palette: v } })}
      />

      {/* Brand colors — editable */}
      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('steps.step03.brandColorsTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t('steps.step03.brandColorsHint')}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
          <ColorPickerField
            label={t('steps.step03.colorPrimary')}
            value={colors.primary || ''}
            onChange={(hex) => patchColor('primary', hex)}
          />
          <ColorPickerField
            label={t('steps.step03.colorSecondary')}
            value={colors.secondary || ''}
            onChange={(hex) => patchColor('secondary', hex)}
          />
          <ColorPickerField
            label={t('steps.step03.colorAccent')}
            value={colors.accent || ''}
            onChange={(hex) => patchColor('accent', hex)}
          />
        </Stack>
      </Box>

      <ChipQuestion
        questionKey="steps.step03.photoStyleQuestion"
        options={PHOTO_STYLE_OPTIONS}
        selected={vs.photoStyle ? [vs.photoStyle] : []}
        onChange={([v]) => patch({ visual_strategy: { photoStyle: v } })}
      />
    </Stack>
  );
}
