import React from 'react';

import { Box, Typography } from '@mui/material';

interface Props {
  /** Single source of the step title (replaces the old external subtitle). */
  title: string;
  /** Short microcopy under the title. */
  hint?: string;
  /** Vertical rhythm between fields (theme spacing units). */
  spacing?: number;
  children: React.ReactNode;
}

/**
 * Uniform scaffold for every wizard step. Fixes the vertical rhythm (title +
 * hint + fields) so all steps read identically.
 *
 * NOTE: uses flexbox `gap` rather than MUI `Stack` spacing on purpose — the
 * editor theme overrides `MuiStack` with `margin: 0 !important`, which
 * neutralises Stack's margin-based spacing. `gap` is unaffected.
 */
export default function WizardStep({ title, hint, spacing = 2.5, children }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing }}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}
