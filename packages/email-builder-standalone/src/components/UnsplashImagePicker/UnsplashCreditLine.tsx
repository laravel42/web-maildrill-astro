import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { CameraAltOutlined } from '@mui/icons-material';
import { Box, Link } from '@mui/material';

import type { UnsplashCredit } from '../../documents/editor/unsplashCreditsStore';

interface UnsplashCreditLineProps {
  credit: UnsplashCredit;
}

/**
 * Compact credit chip shown in the side panel when the current image was
 * sourced from Unsplash. Renders:
 *   📷 Photo by [Author] on [Unsplash]
 * Both links open in a new tab with UTMs already baked into the URLs.
 */
const UnsplashCreditLine: React.FC<UnsplashCreditLineProps> = ({ credit }) => {
  const { t } = useTranslation('inspector');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 1,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        fontSize: '0.7rem',
        color: 'text.secondary',
        lineHeight: 1.4,
      }}
    >
      <CameraAltOutlined sx={{ fontSize: '0.85rem', flexShrink: 0 }} />
      <Box sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        <Trans
          t={t}
          i18nKey="inputs.unsplash.creditLine"
          values={{ author: credit.photographerName }}
          components={{
            authorLink: (
              <Link
                href={credit.photographerUrl}
                target="_blank"
                rel="noreferrer noopener"
                underline="hover"
                sx={{ color: 'text.primary', fontSize: 'inherit', fontWeight: 500 }}
              />
            ),
            unsplashLink: (
              <Link
                href={credit.unsplashUrl}
                target="_blank"
                rel="noreferrer noopener"
                underline="hover"
                sx={{ color: 'text.primary', fontSize: 'inherit', fontWeight: 500 }}
              />
            ),
          }}
        />
      </Box>
    </Box>
  );
};

export default UnsplashCreditLine;
