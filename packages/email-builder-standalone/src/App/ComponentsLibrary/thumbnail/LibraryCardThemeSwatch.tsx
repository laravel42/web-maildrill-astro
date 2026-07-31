/**
 * LibraryCardThemeSwatch — CSS-only render of a saved Theme bundle's
 * design tokens. Lives at the top of each ThemesList card.
 *
 * Why CSS only and not a static thumbnail or live iframe?
 *   - Themes apply globally and are evaluated against the CURRENT
 *     document. A static thumbnail captured at save time would go
 *     stale the moment someone renames a block or tweaks a color
 *     elsewhere; the swatch always matches the actual stored tokens.
 *   - A swatch renders instantly (no fetch, no iframe, no font load
 *     wait) — ideal for a card list with potentially 50+ themes.
 *   - The hover Popper (Task 11) handles the case where users want
 *     to see how the theme would actually transform their current
 *     document — the swatch is just a token preview.
 *
 * Visual structure (CSS Grid, 240×120 strip):
 *
 *     ┌───────────────────────────────────────────────┐
 *     │ [primary] [secondary] [text] [bg]   Aa Body   │  ← token row
 *     │                                                │
 *     │  Heading Sample                                │  ← typography
 *     │  Body sample text                              │
 *     │  ─────────────                                 │  ← divider
 *     │  [    Button Sample    ]                       │  ← CTA
 *     └───────────────────────────────────────────────┘
 *
 * If the listing didn't include `globals` (legacy theme without the
 * inlined fields), all tokens fall back to a neutral grey palette so
 * the card stays useable without crashing.
 */

import React from 'react';

import { Box, useTheme } from '@mui/material';

const DEFAULT_HEIGHT = 120;

/**
 * Neutral fallback tokens used when the theme listing didn't include
 * a particular field (legacy bundles or partial saves).
 */
const FALLBACK = {
  primary: '#5e6ad2',
  secondary: '#8e8fff',
  textColor: '#1f2328',
  backdrop: '#f4f4f4',
  canvas: '#ffffff',
  divider: '#e3e5e8',
  fontFamily: '"Inter", system-ui, sans-serif',
} as const;

export type ThemeSwatchTokens = {
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  headingTextColor?: string;
  backdropColor?: string;
  canvasColor?: string;
  bodyBackgroundColor?: string;
  canvasBackgroundColor?: string;
  fontFamily?: string;
  fontFamilySerif?: string;
};

export type LibraryCardThemeSwatchProps = {
  /** Inlined theme tokens from the listing endpoint. May be partial. */
  globals?: ThemeSwatchTokens;
  /** CSS height of the swatch strip. @default 120 */
  height?: number;
  /** Display name (used as aria-label). */
  alt: string;
};

export default function LibraryCardThemeSwatch({
  globals,
  height = DEFAULT_HEIGHT,
  alt,
}: LibraryCardThemeSwatchProps) {
  const muiTheme = useTheme();

  // Resolve tokens with fallbacks. Several theme schemas use
  // overlapping field names (e.g. `canvasColor` / `canvasBackgroundColor`
  // depending on which release the theme was saved under), so we
  // probe both forms and pick the first available.
  const primary = globals?.primaryColor ?? FALLBACK.primary;
  const secondary = globals?.secondaryColor ?? FALLBACK.secondary;
  const textColor = globals?.textColor ?? FALLBACK.textColor;
  const headingColor = globals?.headingTextColor ?? globals?.textColor ?? FALLBACK.textColor;
  const backdrop = globals?.backdropColor ?? globals?.bodyBackgroundColor ?? FALLBACK.backdrop;
  const canvas = globals?.canvasColor ?? globals?.canvasBackgroundColor ?? FALLBACK.canvas;
  const fontFamily = globals?.fontFamily ?? FALLBACK.fontFamily;

  return (
    <Box
      aria-label={alt}
      sx={{
        width: '100%',
        height,
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: backdrop,
        // The card content sits on the canvas color centred with a
        // tiny gutter, mirroring how a real email shell looks.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        // Decorative — don't intercept drag / click events.
        pointerEvents: 'none',
        border: `1px solid ${muiTheme.palette.divider}`,
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          backgroundColor: canvas,
          borderRadius: 0.5,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontFamily,
        }}
      >
        {/* Token row: primary + secondary + text + a font label */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: primary }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: secondary }} />
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 0.5,
              backgroundColor: textColor,
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Box
            sx={{
              fontSize: 8,
              fontWeight: 500,
              color: textColor,
              opacity: 0.6,
              lineHeight: 1,
              maxWidth: 60,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Aa Bb
          </Box>
        </Box>

        {/* Typography sample */}
        <Box
          sx={{
            fontSize: 11,
            fontWeight: 700,
            color: headingColor,
            lineHeight: 1.2,
          }}
        >
          Heading Sample
        </Box>
        <Box
          sx={{
            fontSize: 8,
            color: textColor,
            lineHeight: 1.3,
            opacity: 0.85,
          }}
        >
          Body sample text
        </Box>

        {/* Divider line */}
        <Box
          sx={{
            height: 1,
            width: '40%',
            backgroundColor: muiTheme.palette.divider,
            my: '2px',
          }}
        />

        {/* Button sample */}
        <Box
          sx={{
            alignSelf: 'flex-start',
            mt: 'auto',
            backgroundColor: primary,
            color: '#ffffff',
            fontSize: 8,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 0.5,
            lineHeight: 1,
          }}
        >
          Button
        </Box>
      </Box>
    </Box>
  );
}
