import React from 'react';

import { Box, ToggleButton } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { RADIUS_INPUT } from '../../../../constants';

export type PillOption = {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * Pill look for standalone (wrapping) toggle buttons. Selected state is left to
 * the theme's `MuiToggleButton` override (`.Mui-selected` → `primary.main` fill
 * + `contrastText`); this only adds the unselected outline so the pills read as
 * the app's badge/pill buttons rather than borderless grouped segments.
 */
export const PILL_SX: SxProps<Theme> = {
  borderRadius: `${RADIUS_INPUT}px`,
  border: '1px solid',
  borderColor: 'divider',
  textTransform: 'none',
  fontWeight: 500,
  lineHeight: 1.2,
  '&.Mui-selected': {
    borderColor: 'primary.main',
  },
};

type Props = {
  options: PillOption[];
  isSelected: (value: string) => boolean;
  onToggle: (value: string) => void;
  ariaLabel?: string;
};

/**
 * A wrapping row of pill toggle buttons. Used by both `PillSelect` (single,
 * long option sets) and `PillMultiSelect` (multi). Selection semantics live in
 * the caller via `isSelected` / `onToggle`.
 */
export default function WrapPills({ options, isSelected, onToggle, ariaLabel }: Props) {
  return (
    <Box role="group" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {options.map((opt) => (
        <ToggleButton
          key={opt.value}
          value={opt.value}
          selected={isSelected(opt.value)}
          onChange={() => onToggle(opt.value)}
          size="small"
          sx={PILL_SX}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {opt.icon}
            <span>{opt.label}</span>
          </Box>
        </ToggleButton>
      ))}
    </Box>
  );
}
