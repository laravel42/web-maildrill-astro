import React from 'react';

import { Card, Skeleton } from '@mui/material';

/**
 * SkeletonImage — loading placeholder for a generated/loading image.
 *
 * Uses MUI `<Skeleton>` which derives its color from the theme palette so
 * it adapts to light/dark automatically (previously hardcoded light-only
 * greys). The `wave` animation is neutralized for users who prefer reduced
 * motion by the global guard in global.css.
 */
export function SkeletonImage() {
  return (
    <Card sx={{ position: 'relative' }}>
      <Skeleton variant="rounded" animation="wave" sx={{ height: '40vh', width: '100%', borderRadius: '8px', mt: 2 }} />
      <Skeleton
        variant="circular"
        animation="wave"
        width={100}
        height={100}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </Card>
  );
}
