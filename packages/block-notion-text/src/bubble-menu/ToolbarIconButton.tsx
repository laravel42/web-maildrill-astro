import React from 'react';

import { KeyboardArrowDown as ArrowDownIcon } from '@mui/icons-material';
import { IconButton, Tooltip, useTheme } from '@mui/material';

type ToolbarIconButtonProps = {
  tooltip: string;
  active?: boolean;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  children: React.ReactNode;
  showArrow?: boolean;
};

export default function ToolbarIconButton({
  tooltip,
  active = false,
  onClick,
  children,
  showArrow = false,
}: ToolbarIconButtonProps) {
  const theme = useTheme();

  return (
    <Tooltip title={tooltip} arrow disableInteractive>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          ...(showArrow && { display: 'flex', gap: 0.25 }),
          color: active ? theme.palette.text.primary : theme.palette.text.secondary,
          backgroundColor: active
            ? theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(0,0,0,0.18)'
            : 'transparent',
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
          },
          transition: 'all 150ms ease',
        }}
      >
        {children}
        {showArrow && <ArrowDownIcon sx={{ fontSize: 14 }} />}
      </IconButton>
    </Tooltip>
  );
}
