import React from 'react';

import { ButtonBase } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { PILL_SX } from './WrapPills';

interface Props {
  label: React.ReactNode;
  onClick: () => void;
  startIcon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * A single click-to-apply pill button using the same visual language as the
 * pill selectors (border + radius + hover). Used for the direct-mode prompt
 * suggestions so they match the wizard's pill controls instead of MUI Chips.
 */
export default function PillButton({ label, onClick, startIcon, disabled }: Props) {
  const sx: SxProps<Theme> = {
    ...(PILL_SX as object),
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 1.25,
    py: 0.75,
    fontSize: 13,
    color: 'text.secondary',
    '&:hover': { borderColor: 'text.secondary', backgroundColor: 'action.hover' },
    '&.Mui-disabled': { opacity: 0.5 },
  };
  return (
    <ButtonBase onClick={onClick} disabled={disabled} sx={sx}>
      {startIcon}
      <span>{label}</span>
    </ButtonBase>
  );
}
