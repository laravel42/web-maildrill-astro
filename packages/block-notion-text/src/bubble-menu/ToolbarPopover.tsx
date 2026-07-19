import React from 'react';

import { Popover, useTheme } from '@mui/material';

type ToolbarPopoverProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  disableAutoFocus?: boolean;
};

export default function ToolbarPopover({ anchorEl, onClose, children, disableAutoFocus = false }: ToolbarPopoverProps) {
  const theme = useTheme();

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      {...(disableAutoFocus && { disableEnforceFocus: true, disableAutoFocus: true })}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            backgroundColor: theme.palette.background.paper,
            borderRadius: '12px',
            boxShadow: theme.palette.mode === 'dark' ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
          },
        },
      }}
    >
      {children}
    </Popover>
  );
}
