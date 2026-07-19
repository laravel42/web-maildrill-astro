/**
 * EmptyState — a reusable, sober empty-state block used across the editor
 * (Components Library listings, themes, etc.).
 *
 * Editorial "pro" polish (Fase 3): gives empty states a voice instead of a
 * bare muted line. A subtle monochrome icon in a soft circle, a short
 * human title, and an optional how-to description. No accent color — stays
 * within the monochrome editorial direction. Generous vertical padding
 * (whitespace as structure).
 *
 * Generic leaf component (only depends on MUI + its own props). Safe to use
 * anywhere, including the block-render chain — it does NOT import from the
 * ComponentsLibrary barrel (avoids the circular-eval gotcha in LEARNED.md).
 */

import React from 'react';

import { Box, Stack, Typography } from '@mui/material';

type EmptyStateProps = {
  /** Icon element (e.g. a MUI icon). Rendered muted inside a soft circle. */
  icon?: React.ReactNode;
  /** Short, human title line. */
  title: string;
  /** Optional secondary line — the how-to / guidance. */
  description?: string;
  /** Compact variant: smaller padding + icon, for tight panels. */
  dense?: boolean;
};

export default function EmptyState({ icon, title, description, dense = false }: EmptyStateProps) {
  return (
    <Stack
      spacing={dense ? 1 : 1.5}
      sx={{
        textAlign: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: dense ? 3 : 5,
        color: 'text.secondary',
      }}
    >
      {icon && (
        <Box
          sx={{
            width: dense ? 36 : 44,
            height: dense ? 36 : 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            color: 'text.secondary',
            '& .MuiSvgIcon-root': { fontSize: dense ? 20 : 22 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="caption" sx={{ color: 'text.secondary', maxWidth: 260, lineHeight: 1.5 }}>
          {description}
        </Typography>
      )}
    </Stack>
  );
}
