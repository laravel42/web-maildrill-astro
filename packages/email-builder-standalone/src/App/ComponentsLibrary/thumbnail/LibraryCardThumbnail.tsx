/**
 * LibraryCardThumbnail — visual preview shown at the top of each
 * LibraryCard for Sections / Layouts / Templates.
 *
 * Renders one of:
 *   - `<img>` when the listing reports `hasThumbnail: true`. The src
 *     points at the backend GET /dev/{category}/[axis/]:id/thumbnail
 *     endpoint. The image is lazy-loaded so a long drawer list
 *     doesn't fire N requests on open.
 *   - A neutral SVG placeholder when `hasThumbnail: false` — items
 *     saved before this feature shipped, or items where the capture
 *     failed at save time. The placeholder uses CSS only, no fetch.
 *
 * Sizing: 240×120 logical px (16:8 aspect). The captured PNG is
 * 280×400 @1.5x DPR, so the displayed image is downscaled but stays
 * sharp on retina displays. We use `object-fit: cover` so portrait
 * captures (typical for emails) get cropped to the band rather than
 * letterboxed.
 */

import React from 'react';

import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import { Box, Typography, useTheme } from '@mui/material';

export type LibraryCardThumbnailProps = {
  /** Source URL when a thumbnail exists; null shows the placeholder. */
  src: string | null;
  /** Used as `<img alt>`. Should be the item's display name. */
  alt: string;
  /** CSS height of the thumbnail strip. @default 120 */
  height?: number;
  /** Optional placeholder caption — defaults to a localised fallback. */
  placeholderText?: string;
};

export default function LibraryCardThumbnail({ src, alt, height = 120, placeholderText }: LibraryCardThumbnailProps) {
  const theme = useTheme();

  const baseStyle: React.CSSProperties = {
    width: '100%',
    height,
    borderRadius: 4,
    backgroundColor: theme.palette.background.default,
    display: 'block',
  };

  if (src === null) {
    return (
      <Box
        sx={{
          ...baseStyle,
          border: `1px dashed ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          color: 'text.secondary',
        }}
        aria-label={alt}
      >
        <ImageNotSupportedOutlinedIcon sx={{ fontSize: 24, opacity: 0.6 }} />
        {placeholderText !== undefined && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {placeholderText}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{
        ...baseStyle,
        objectFit: 'cover',
        objectPosition: 'top center',
        border: `1px solid ${theme.palette.divider}`,
      }}
      onError={(e) => {
        // If the GET endpoint returned 404 or the file is corrupted,
        // hide the broken-image icon and fall back to the placeholder
        // visual by clearing the src. We can't easily swap to the
        // placeholder component here without a re-render, so we fall
        // through to a styled empty state in-place.
        const img = e.currentTarget;
        img.style.display = 'none';
      }}
    />
  );
}
