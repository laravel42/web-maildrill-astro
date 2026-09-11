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
import { Box, Skeleton, Typography, useTheme } from '@mui/material';

import { getSectionIcon } from './sectionIcons';

export type LibraryCardThumbnailProps = {
  /** Source URL when a thumbnail exists; null shows the placeholder. */
  src: string | null;
  /** Used as `<img alt>`. Should be the item's display name. */
  alt: string;
  /** CSS height of the thumbnail strip. @default 120 */
  height?: number;
  /**
   * True while this item's preview is queued/generating (local mode).
   * Renders an animated Skeleton instead of the "No preview" placeholder
   * until the capture finishes and `src` arrives.
   */
  loading?: boolean;
  /** Optional placeholder caption — defaults to a localised fallback. */
  placeholderText?: string;
  /**
   * Item id — looked up against the hand-designed icon set
   * (`sectionIcons.tsx`, COMPONENT_ICONS_PLAN.md). **Draft / in
   * review**: only the items designed so far (Tanda 1: 10/146) render
   * an icon; everything else falls back to the existing PNG/placeholder
   * behaviour unchanged. Takes priority over `src` so the designed
   * icon is visible for review even for items that already have a
   * captured PNG.
   */
  iconId?: string;
};

export default function LibraryCardThumbnail({
  src,
  alt,
  height = 120,
  loading = false,
  placeholderText,
  iconId,
}: LibraryCardThumbnailProps) {
  const theme = useTheme();

  const baseStyle: React.CSSProperties = {
    width: '100%',
    height,
    borderRadius: 0,
    backgroundColor: theme.palette.background.default,
    display: 'block',
  };

  const designedIcon = iconId ? getSectionIcon(iconId) : null;

  // Hand-designed icon (COMPONENT_ICONS_PLAN.md) — draft, pending visual
  // approval. Takes priority over the captured PNG so the user can review
  // it in place without needing the full "replace the thumbnail pipeline"
  // migration to land first.
  if (designedIcon) {
    return (
      <Box
        sx={{
          ...baseStyle,
          border: `1px dashed ${theme.palette.warning.main}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Color explícito (no heredado de `text.secondary` vía sx) —
          // mismo valor que --pb-chrome-text-muted de Builder42 (--text3,
          // #57554e claro / #A1A1AA oscuro) para que el trazo se vea
          // exactamente igual de "tenue", no más oscuro por herencia
          // distinta de currentColor en algún wrapper intermedio.
          color: theme.palette.mode === 'dark' ? '#A1A1AA' : '#57554e',
          // Tamaño: Builder42 no tiene un icono de tile de biblioteca 1:1
          // (sus tarjetas de sección/plantilla escalan HTML real, no SVG,
          // ver templates.css `.pbx-template-card__preview`) — la
          // referencia de proporción más cercana es
          // `.pbx-compact-rail__tile-icon-svg` (18px dentro de una caja de
          // 24px, ratio ~75%). 32px en una caja de 120px (~27%) se veía
          // chico en comparación; 56px (~47%) se acerca más sin dominar
          // la tarjeta.
          //
          // 28px — mismo valor que `.pbx-palette__icon` de Builder42
          // (sidebar.css: "Icono del tipo de componente — grande,
          // protagonista de la card"), la única referencia real medida en
          // su código fuente para este contexto (no hay un ícono de 27px
          // en Builder42; se descartó esa cifra al no encontrar
          // sustento en el código). Mismo valor unificado en
          // BlockTile/CompactBlockTile (BlocksCategoryContent.tsx,
          // CompactBlocksList.tsx).
          '& svg': { width: 28, height: 28 },
        }}
        aria-label={alt}
        title={`${designedIcon.name} (${designedIcon.role}) — draft icon, Tanda 1`}
      >
        {designedIcon.svg}
      </Box>
    );
  }

  // Pending generation (local mode): show an animated skeleton rather than
  // the "No preview" placeholder, so a queued card reads as "loading" not
  // "empty" while the lazy generator works through the queue.
  if (src === null && loading) {
    return (
      <Skeleton
        variant="rounded"
        animation="wave"
        height={height}
        aria-label={alt}
        sx={{ width: '100%', borderRadius: 0 }}
      />
    );
  }

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
