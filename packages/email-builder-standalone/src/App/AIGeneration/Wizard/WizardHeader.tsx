import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';

interface Props {
  mode: 'direct' | 'wizard';
  onSwitch: () => void;
  disabled?: boolean;
}

export default function WizardHeader({ mode, onSwitch, disabled }: Props) {
  const { t } = useTranslation('aiWizard');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Typography variant="h6" component="span">
        {mode === 'wizard' ? t('header.wizardTitle') : t('header.directTitle')}
      </Typography>
      <Tooltip title={t('header.switchAria')}>
        <FormControlLabel
          control={<Switch checked={mode === 'wizard'} onChange={onSwitch} disabled={disabled} size="small" />}
          label={
            <Typography variant="caption" color="text.secondary">
              {t('header.wizardTitle')}
            </Typography>
          }
          labelPlacement="start"
          sx={{ mr: 0, ml: 0 }}
        />
      </Tooltip>
    </Box>
  );
}
