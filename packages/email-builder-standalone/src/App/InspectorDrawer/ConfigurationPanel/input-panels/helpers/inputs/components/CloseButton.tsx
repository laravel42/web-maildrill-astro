import React from 'react';
import { useTranslation } from 'react-i18next';

import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';

interface CloseButtonProps {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}

export function CloseButton({ onClick, disabled, primary = false }: CloseButtonProps) {
  const { t } = useTranslation('inspector');
  return (
    <IconButton
      aria-label={t('inputs.common.close')}
      onClick={onClick}
      disabled={disabled}
      sx={{
        position: 'absolute',
        right: 8,
        top: 8,
        color: (theme) => (primary ? 'brand.blue' : theme.palette.grey[500]),
        '&:hover': {
          opacity: 0.8,
        },
      }}
    >
      <Close />
    </IconButton>
  );
}
