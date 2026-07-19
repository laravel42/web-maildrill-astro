/**
 * LibrarySkeletonGrid — loading placeholder for the Components Library
 * listings (Sections / Templates / Themes). Mirrors the real card grid
 * (thumbnail band + two text lines) so the transition from loading to
 * loaded doesn't shift layout.
 *
 * Editorial "pro" polish (Fase 4): replaces the plain "Loading…" text with
 * skeleton cards. Uses MUI `<Skeleton>` which derives its color from the
 * theme palette (adapts to light/dark automatically) — no hardcoded greys.
 * The `wave` animation is neutralized for users who prefer reduced motion
 * by the global guard in global.css.
 *
 * Leaf component (MUI-only deps). Safe to import from the drawer.
 */

import React from 'react';

import { Box, Skeleton, Stack } from '@mui/material';

type LibrarySkeletonGridProps = {
  /** Number of grid columns — should match the real listing's `columns`. */
  columns?: number;
  /** How many skeleton cards to render. @default 4 */
  count?: number;
  /** Thumbnail band height, matches LibraryCardThumbnail. @default 120 */
  thumbnailHeight?: number;
};

export default function LibrarySkeletonGrid({
  columns = 2,
  count = 4,
  thumbnailHeight = 120,
}: LibrarySkeletonGridProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 0.5,
        pt: 0.5,
      }}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Stack key={i} spacing={0.75} sx={{ p: 0.5 }}>
          <Skeleton variant="rounded" animation="wave" height={thumbnailHeight} sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" animation="wave" width="70%" />
          <Skeleton variant="text" animation="wave" width="45%" />
        </Stack>
      ))}
    </Box>
  );
}
