import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, MenuItem, Slider, Stack, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

import { FONT_FAMILIES } from '../../../../documents/blocks/helpers/fontFamily';
import Select from '../../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/Select';
import LabelProperty from '../../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';
import { type DraftBrief, THEME_FONT_OPTIONS } from '../briefDefaults';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

function fontCss(key: string): string {
  return FONT_FAMILIES.find((f) => f.key === key)?.value ?? 'inherit';
}

const FONT_MENU_ITEMS = THEME_FONT_OPTIONS.map((key) => (
  <MenuItem key={key} value={key} sx={{ fontFamily: fontCss(key) }}>
    {FONT_FAMILIES.find((f) => f.key === key)?.label ?? key}
  </MenuItem>
));

export default function StepThemeTypography({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const { fontBody, fontHeadings, borderRadius } = brief.theme_strategy;
  const radius = borderRadius ?? 8;

  const handleBodyChange = (e: SelectChangeEvent<unknown>) => {
    patch({ theme_strategy: { fontBody: (e.target.value as string) || undefined } });
  };

  const handleHeadingsChange = (e: SelectChangeEvent<unknown>) => {
    patch({ theme_strategy: { fontHeadings: (e.target.value as string) || undefined } });
  };

  return (
    <Stack spacing={2.5}>
      {/* Font selects */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <LabelProperty label={t('steps.themeTypography.fontBodyLabel')} />
        <Select
          value={fontBody ?? ''}
          size="small"
          onChange={handleBodyChange}
          sx={{ fontFamily: fontBody ? fontCss(fontBody) : undefined }}
        >
          <MenuItem value="">{t('steps.theme.auto')}</MenuItem>
          {FONT_MENU_ITEMS}
        </Select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <LabelProperty label={t('steps.themeTypography.fontHeadingsLabel')} />
        <Select
          value={fontHeadings ?? ''}
          size="small"
          onChange={handleHeadingsChange}
          sx={{ fontFamily: fontHeadings ? fontCss(fontHeadings) : undefined }}
        >
          <MenuItem value="">{t('steps.theme.auto')}</MenuItem>
          {FONT_MENU_ITEMS}
        </Select>
      </div>

      {/* Radius slider with live preview */}
      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('steps.themeTypography.radiusTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('steps.themeTypography.radiusHint')}
        </Typography>
        <Slider
          value={radius}
          min={0}
          max={32}
          step={1}
          onChange={(_, v) => patch({ theme_strategy: { borderRadius: v as number } })}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}px`}
          size="small"
          sx={{ mx: 0.5 }}
        />
        {/* Live preview */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, alignItems: 'center' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'primary.main',
              borderRadius: `${radius}px`,
              transition: 'border-radius 0.15s ease',
            }}
          />
          <Box
            component="span"
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: `${radius}px`,
              fontSize: 13,
              fontWeight: 600,
              transition: 'border-radius 0.15s ease',
            }}
          >
            Button
          </Box>
          <Typography variant="caption" color="text.secondary">
            {radius}px
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
