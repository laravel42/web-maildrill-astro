import React, { useRef, useState } from 'react';

import type { SvgIconComponent } from '@mui/icons-material';
import { alpha, Box, IconButton, Popover, Tooltip } from '@mui/material';

import { useCompactMode } from '../../../../CompactModeContext';

type CompactableInputProps = {
  icon: SvgIconComponent;
  label: string;
  children: React.ReactNode;
  /**
   * When true, renders a small "modified" dot so the user can scan which
   * individual properties diverge from the default. Intentionally lighter
   * and smaller than the parent accordion badge. Compact mode paints it on
   * the icon button; full mode paints it in the left gutter of the field.
   */
  modified?: boolean;
};

export default function CompactableInput({ icon: Icon, label, children, modified = false }: CompactableInputProps) {
  const compact = useCompactMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  if (!compact) {
    if (!modified) return <>{children}</>;
    return (
      <Box sx={{ position: 'relative' }}>
        {children}
        <Box
          component="span"
          aria-hidden
          sx={(theme) => ({
            position: 'absolute',
            top: 4,
            left: -10,
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.primary.main, 0.55),
            pointerEvents: 'none',
          })}
        />
      </Box>
    );
  }

  return (
    <>
      <Tooltip title={label} placement="left">
        <Box sx={{ position: 'relative', display: 'inline-flex', alignSelf: 'center' }}>
          <IconButton
            ref={ref}
            onClick={() => setOpen(!open)}
            color={open ? 'primary' : 'default'}
            size="small"
            sx={{ borderRadius: 1.5, width: 32, height: 32 }}
          >
            <Icon fontSize="small" />
          </IconButton>
          {modified && (
            <Box
              component="span"
              aria-hidden
              sx={(theme) => ({
                position: 'absolute',
                top: 2,
                right: 2,
                width: 5,
                height: 5,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.55),
                pointerEvents: 'none',
              })}
            />
          )}
        </Box>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={ref.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
        transformOrigin={{ vertical: 'center', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              width: 360,
              p: 2,
              borderRadius: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              transform: 'translateX(-18px) !important',
              overflow: 'visible',
              '&::after': {
                content: '""',
                position: 'absolute',
                right: -5,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: `5px solid ${theme.palette.divider}`,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                right: -4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent',
                borderLeft: `4px solid ${theme.palette.background.paper}`,
                zIndex: 1,
              },
            }),
          },
        }}
      >
        {children}
      </Popover>
    </>
  );
}
