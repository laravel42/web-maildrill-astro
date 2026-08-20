/**
 * ThemePresetPreview — ultra-compact, CSS-only mockup of a theme preset
 * surfaced inside each `ThemePresetsButton` menu item. It mirrors the
 * "what will this look like" intent of the old library Themes swatch,
 * but reads colors straight from the preset's `bundle` so the preview
 * reflects exactly what `applyThemePreset()` would write:
 *
 *   - backdrop  → bundle.globals.backdropColor   (outer shell)
 *   - canvas    → bundle.globals.canvasColor     (container surface)
 *   - text      → bundle.globals.textColor       (body line)
 *   - button    → bundle.blocks.Button.style.{buttonBackgroundColor,buttonTextColor}
 *   - divider   → bundle.blocks.Divider.style.color
 *
 * CSS only (no iframe / no fetch) so it renders instantly in a menu
 * that may list a dozen presets. Decorative — `pointerEvents: none`
 * keeps clicks on the parent `MenuItem`.
 */

import React from 'react';

import { Box } from '@mui/material';

import type { ThemePreset } from './defaults';

const FALLBACK = {
  backdrop: '#f1f5f9',
  canvas: '#ffffff',
  text: '#0f172a',
  button: '#2563eb',
  buttonText: '#ffffff',
  divider: '#e2e8f0',
} as const;

/** Safely read `bundle.blocks[type].style[key]` without widening types. */
function blockStyle(preset: ThemePreset, type: string, key: string): string | undefined {
  const blocks = preset.bundle.blocks as
    Record<string, { style?: Record<string, unknown> }> | undefined;
  const value = blocks?.[type]?.style?.[key];
  return typeof value === 'string' ? value : undefined;
}

export type ThemePresetPreviewProps = {
  preset: ThemePreset;
};

export default function ThemePresetPreview({ preset }: ThemePresetPreviewProps) {
  const globals = preset.bundle.globals ?? {};

  const backdrop = globals.backdropColor ?? FALLBACK.backdrop;
  const canvas = globals.canvasColor ?? FALLBACK.canvas;
  const text = globals.textColor ?? FALLBACK.text;
  const button = blockStyle(preset, 'Button', 'buttonBackgroundColor') ?? FALLBACK.button;
  const buttonText = blockStyle(preset, 'Button', 'buttonTextColor') ?? FALLBACK.buttonText;
  const divider = blockStyle(preset, 'Divider', 'color') ?? FALLBACK.divider;

  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        backgroundColor: backdrop,
        borderRadius: 0.75,
        p: '5px',
        pointerEvents: 'none',
      }}
    >
      {/* Container surface */}
      <Box
        sx={{
          backgroundColor: canvas,
          borderRadius: 0.5,
          p: '6px 7px',
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Body text lines + divider */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: '6px',
            flex: 1,
          }}
        >
          <Box
            sx={{ height: 4, width: '70%', borderRadius: 2, backgroundColor: text, opacity: 0.85 }}
          />
          <Box
            sx={{ height: 4, width: '45%', borderRadius: 2, backgroundColor: text, opacity: 0.45 }}
          />

          {/* Divider */}
          <Box sx={{ height: '2px', width: '100%', backgroundColor: divider }} />
        </Box>

        {/* Button */}
        <Box
          sx={{
            flexShrink: 0,
            backgroundColor: button,
            color: buttonText,
            fontSize: 7,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: 0.2,
            px: '8px',
            py: '4px',
            borderRadius: 0.5,
          }}
        >
          Button
        </Box>
      </Box>
    </Box>
  );
}
