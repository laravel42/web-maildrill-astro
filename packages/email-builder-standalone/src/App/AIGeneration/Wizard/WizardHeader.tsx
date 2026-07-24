import React from 'react';
import { useTranslation } from 'react-i18next';

import { EditNote } from '@mui/icons-material';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';

import AiSparkleIcon from '../AiSparkleIcon';

interface Props {
  mode: 'direct' | 'wizard';
  onSwitch: () => void;
  disabled?: boolean;
}

/**
 * Header for the direct/wizard entry modes: the current title plus the shared
 * `ToggleButtonGroup` (already themed as a segmented pill) to switch between
 * "Generate with AI" (direct prompt) and the "Visual Wizard". Each option is an
 * icon with a hover tooltip explaining what it does; the selected option uses
 * the theme's primary fill with a legible white icon via `primary.contrastText`.
 */
export default function WizardHeader({ mode, onSwitch, disabled }: Props) {
  const { t } = useTranslation('aiWizard');

  const handleChange = (_event: React.MouseEvent<HTMLElement>, next: 'direct' | 'wizard' | null) => {
    if (next && next !== mode) onSwitch();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
      <Typography variant="h6" component="span">
        {mode === 'wizard' ? t('header.wizardTitle') : t('header.directTitle')}
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={handleChange}
        disabled={disabled}
        size="small"
        aria-label={t('header.switchAria')}
        sx={{ width: 'auto', flex: 'none' }}
      >
        <ToggleButton value="direct" aria-label={t('header.directTitle')} sx={{ flex: 'none', px: 1.25 }}>
          <Tooltip title={t('header.directTooltip')}>
            <Box component="span" sx={{ display: 'inline-flex', lineHeight: 0 }}>
              <EditNote fontSize="small" />
            </Box>
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="wizard" aria-label={t('header.wizardTitle')} sx={{ flex: 'none', px: 1.25 }}>
          <Tooltip title={t('header.wizardTooltip')}>
            <Box component="span" sx={{ display: 'inline-flex', lineHeight: 0 }}>
              <AiSparkleIcon fontSize="small" />
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
