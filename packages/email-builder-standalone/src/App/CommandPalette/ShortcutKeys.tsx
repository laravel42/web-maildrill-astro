/**
 * ShortcutKeys — renders a keyboard shortcut as individual key chips
 * separated by `+` signs.
 *
 * Usage:
 *   <ShortcutKeys keys={['Ctrl', 'B']} />        → [Ctrl] + [B]
 *   <ShortcutKeys keys={['⌘', 'Shift', '1']} />  → [⌘] + [Shift] + [1]
 *
 * Accepts a string shorthand too:
 *   <ShortcutKeys shortcut="Ctrl+Shift+K" />
 */
import React from 'react';

import { Box, Typography } from '@mui/material';

type ShortcutKeysProps = (
  { keys: string[]; shortcut?: never } | { shortcut: string; keys?: never }
) & {
  /** sx forwarded to the wrapper Box */
  sx?: object;
};

export default function ShortcutKeys({ keys, shortcut, sx }: ShortcutKeysProps) {
  const parts = keys ?? shortcut?.split('+') ?? [];
  if (parts.length === 0) return null;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        flexShrink: 0,
        ...sx,
      }}
    >
      {parts.map((key, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Typography
              component="span"
              sx={{
                fontSize: '0.65rem',
                color: 'text.disabled',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              +
            </Typography>
          )}
          <Box
            component="kbd"
            sx={(theme) => ({
              display: 'inline-block',
              px: '5px',
              py: '1px',
              borderRadius: '4px',
              fontSize: theme.typography.pxToRem(11),
              fontFamily: 'monospace',
              lineHeight: '18px',
              color: theme.palette.text.secondary,
              bgcolor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              userSelect: 'none',
            })}
          >
            {key}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}
