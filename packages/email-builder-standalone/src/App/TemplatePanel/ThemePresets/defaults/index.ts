/**
 * Predefined theme presets surfaced by `ThemePresetsButton` in the main
 * toolbar. Each preset is a bare `ThemeBundlePayload` ({ globals, blocks })
 * applied through the existing `applyThemeBundle()` pipeline — a single,
 * undoable atomic write. `swatch` colors only drive the menu preview dots.
 *
 * `fontFamily` values must be keys from `FONT_FAMILY_SCHEMA`
 * (see documents/blocks/helpers/fontFamily.ts).
 */

import type { ThemeBundlePayload } from '@eb/document-core';

export type ThemePreset = {
  id: string;
  name: string;
  swatch: string[];
  bundle: ThemeBundlePayload;
};

/** Build a payload with the block overrides every preset shares. */
function preset(
  globals: NonNullable<ThemeBundlePayload['globals']>,
  buttonBg: string,
  buttonText: string,
  dividerColor: string
): ThemeBundlePayload {
  const surface = globals.canvasColor ?? undefined;
  return {
    globals,
    blocks: {
      Button: { style: { buttonBackgroundColor: buttonBg, buttonTextColor: buttonText } },
      Divider: { style: { color: dividerColor } },
      Container: { style: { backgroundColor: surface } },
      ColumnsContainer: { style: { backgroundColor: surface } },
    },
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic-light',
    name: 'Classic Light',
    swatch: ['#ffffff', '#2563eb', '#0f172a'],
    bundle: preset(
      {
        backdropColor: '#f1f5f9',
        canvasColor: '#ffffff',
        textColor: '#0f172a',
        fontFamily: 'MODERN_SANS',
        linkGlobal: { linkColor: '#2563eb', underline: true },
      },
      '#2563eb',
      '#ffffff',
      '#e2e8f0'
    ),
  },
  {
    id: 'midnight',
    name: 'Midnight',
    swatch: ['#0f172a', '#38bdf8', '#e2e8f0'],
    bundle: preset(
      {
        backdropColor: '#020617',
        canvasColor: '#0f172a',
        textColor: '#e2e8f0',
        fontFamily: 'MODERN_SANS',
        linkGlobal: { linkColor: '#38bdf8', underline: false },
      },
      '#38bdf8',
      '#0f172a',
      '#1e293b'
    ),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    swatch: ['#ecfeff', '#0891b2', '#164e63'],
    bundle: preset(
      {
        backdropColor: '#cffafe',
        canvasColor: '#ecfeff',
        textColor: '#164e63',
        fontFamily: 'OPEN_SANS',
        linkGlobal: { linkColor: '#0891b2', underline: true },
      },
      '#0891b2',
      '#ffffff',
      '#a5f3fc'
    ),
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: ['#fff7ed', '#ea580c', '#7c2d12'],
    bundle: preset(
      {
        backdropColor: '#ffedd5',
        canvasColor: '#fff7ed',
        textColor: '#7c2d12',
        fontFamily: 'MONTSERRAT',
        linkGlobal: { linkColor: '#ea580c', underline: false },
      },
      '#ea580c',
      '#ffffff',
      '#fed7aa'
    ),
  },
  {
    id: 'forest',
    name: 'Forest',
    swatch: ['#f0fdf4', '#16a34a', '#14532d'],
    bundle: preset(
      {
        backdropColor: '#dcfce7',
        canvasColor: '#f0fdf4',
        textColor: '#14532d',
        fontFamily: 'LATO',
        linkGlobal: { linkColor: '#16a34a', underline: true },
      },
      '#16a34a',
      '#ffffff',
      '#bbf7d0'
    ),
  },
  {
    id: 'royal',
    name: 'Royal',
    swatch: ['#faf5ff', '#7c3aed', '#3b0764'],
    bundle: preset(
      {
        backdropColor: '#f3e8ff',
        canvasColor: '#faf5ff',
        textColor: '#3b0764',
        fontFamily: 'PLAYFAIR',
        linkGlobal: { linkColor: '#7c3aed', underline: false },
      },
      '#7c3aed',
      '#ffffff',
      '#e9d5ff'
    ),
  },
  {
    id: 'slate',
    name: 'Slate',
    swatch: ['#f8fafc', '#475569', '#1e293b'],
    bundle: preset(
      {
        backdropColor: '#e2e8f0',
        canvasColor: '#f8fafc',
        textColor: '#1e293b',
        fontFamily: 'MERRIWEATHER',
        linkGlobal: { linkColor: '#475569', underline: true },
      },
      '#475569',
      '#ffffff',
      '#cbd5e1'
    ),
  },
  {
    id: 'coral',
    name: 'Coral',
    swatch: ['#fff1f2', '#e11d48', '#881337'],
    bundle: preset(
      {
        backdropColor: '#ffe4e6',
        canvasColor: '#fff1f2',
        textColor: '#881337',
        fontFamily: 'ROBOTO',
        linkGlobal: { linkColor: '#e11d48', underline: false },
      },
      '#e11d48',
      '#ffffff',
      '#fecdd3'
    ),
  },
  {
    id: 'mocha',
    name: 'Mocha',
    swatch: ['#faf6f1', '#92400e', '#451a03'],
    bundle: preset(
      {
        backdropColor: '#f5e9dc',
        canvasColor: '#faf6f1',
        textColor: '#451a03',
        fontFamily: 'MERRIWEATHER',
        linkGlobal: { linkColor: '#92400e', underline: true },
      },
      '#92400e',
      '#ffffff',
      '#e7d3bf'
    ),
  },
  {
    id: 'mono',
    name: 'Mono',
    swatch: ['#ffffff', '#111111', '#111111'],
    bundle: preset(
      {
        backdropColor: '#e5e5e5',
        canvasColor: '#ffffff',
        textColor: '#111111',
        fontFamily: 'OSWALD',
        linkGlobal: { linkColor: '#111111', underline: true },
      },
      '#111111',
      '#ffffff',
      '#d4d4d4'
    ),
  },
];
