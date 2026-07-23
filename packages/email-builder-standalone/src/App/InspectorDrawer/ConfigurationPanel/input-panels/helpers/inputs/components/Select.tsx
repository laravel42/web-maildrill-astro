import React from 'react';

import { alpha, Select, SelectProps, styled, useTheme } from '@mui/material';

import { RADIUS_DROPDOWN } from '../../../../../../../constants';

import { BORDER_RADIUS, INPUT_HEIGHT } from './inputStyles';

// Componente SVG personalizado para el ícono (invertido: apuntando hacia abajo)
const ChevronIcon: React.FC<{ className?: string } & React.SVGProps<SVGSVGElement>> = ({ className, ...rest }) => (
  <svg width="15" height="10" viewBox="0 0 24 12" className={className} aria-hidden="true" focusable="false" {...rest}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      d="m6 3l6 6l6-6"
    />
  </svg>
);

// Styled Select para usar colores y tipografía del theme
// Fondo transparente + borde sutil para reducir peso visual en el inspector (phase F)
const StyledSelect = styled(Select)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  color: theme.palette.text.primary,
  backgroundColor: 'transparent',
  width: '100%',
  height: `${INPUT_HEIGHT}px`,
  // Ensure the input root matches our standard height
  '&.MuiInputBase-root, &.MuiOutlinedInput-root': {
    height: `${INPUT_HEIGHT}px`,
    minHeight: `${INPUT_HEIGHT}px`,
    boxSizing: 'border-box',
    borderRadius: `${BORDER_RADIUS}px`,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: 'transparent',
  },
  // MUI's outlined variant renders its own fieldset/legend border
  // (.MuiOutlinedInput-notchedOutline) underneath the one set above —
  // without disabling it, the two combine into a visible double border.
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  // Standardize select padding; extra right padding to avoid icon overlap
  '&& .MuiSelect-select, && .MuiInputBase-input': {
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    paddingRight: '36px',
    lineHeight: '20px',
    minHeight: 'unset',
  },
  '& .MuiSelect-icon': {
    color: theme.palette.secondary.main,
    right: 12,
    top: 'calc(50% - 4px)',
    transition: 'transform 200ms ease',
    pointerEvents: 'none',
  },
  '& .MuiSelect-iconOpen': {
    transform: 'rotate(180deg)',
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.04),
  },
  '&.Mui-focused': {
    borderColor: theme.palette.text.secondary,
  },
}));

// Nuestro componente que reemplaza a MUI Select
// En MUI 5.18+, SelectInput fusiona PaperProps y slotProps.paper; slotProps.paper tiene prioridad en Popover
const CustomSelect = React.forwardRef<HTMLDivElement, SelectProps>((props, ref) => {
  const theme = useTheme();
  const dropdownSx = {
    backgroundColor: theme.palette.background.paper,
    marginTop: '4px',
    borderRadius: `${RADIUS_DROPDOWN}px`,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: `0 1px 3px ${alpha('#000000', 0.6)}`,
    color: theme.palette.text.primary,
  };

  const paperProps = {
    sx: dropdownSx,
  };

  const existingSlotProps = props.MenuProps?.slotProps ?? {};
  const existingPaper = (existingSlotProps as { paper?: Record<string, unknown> }).paper ?? {};

  return (
    <StyledSelect
      ref={ref}
      {...props}
      IconComponent={ChevronIcon}
      MenuProps={{
        ...props.MenuProps,
        slotProps: {
          ...existingSlotProps,
          paper: {
            ...existingPaper,
            ...paperProps,
            sx: {
              ...(typeof existingPaper.sx === 'object' && existingPaper.sx),
              ...dropdownSx,
            },
          },
        },
      }}
    />
  );
});

CustomSelect.displayName = 'CustomSelect';

export default CustomSelect;
