import { TEditorConfiguration } from '../../documents/editor/core';

/**
 * Seed templates for new documents.
 *
 * Both seeds intentionally ship with an empty `EmailLayout` root and
 * NO child blocks. Users start from a blank canvas and pick a starting
 * point from the templates / blocks / themes / components gallery in
 * the left drawer instead of being forced to delete a placeholder
 * NotionText or Spacer block.
 *
 * Style values that match a block schema's `.default(...)` should NOT
 * be hardcoded here — the resolver chain (level 3) supplies them
 * automatically and any duplication would shadow theme overrides for
 * fresh documents (see `skills/theme-system.md`).
 *
 * The `Classic Light` theme is baked onto the root (globals +
 * per-block `theme.blocks` overrides). Shipping the theme by default
 * means fresh documents — and every section / layout / primitive
 * preview in the Components Library that inherits the current root
 * globals + `theme` — render with a correct white canvas and container
 * background instead of a transparent / unset surface. Keep these
 * values in sync with the `classic-light` preset in
 * `App/TemplatePanel/ThemePresets/defaults/index.ts`.
 */
const CLASSIC_LIGHT_ROOT_DEFAULTS = {
  backdropColor: '#f1f5f9',
  canvasColor: '#ffffff',
  textColor: '#0f172a',
  fontFamily: 'MODERN_SANS',
  linkGlobal: {
    linkColor: '#2563eb',
    underline: true,
  },
  theme: {
    blocks: {
      Button: { style: { buttonBackgroundColor: '#2563eb', buttonTextColor: '#ffffff' } },
      Divider: { style: { color: '#e2e8f0' } },
      Container: { style: { backgroundColor: '#ffffff' } },
      ColumnsContainer: { style: { backgroundColor: '#ffffff' } },
    },
  },
} as const;

const EMPTY_EMAIL_MESSAGE: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      ...CLASSIC_LIGHT_ROOT_DEFAULTS,
      childrenIds: [],
      showVersion: true,
    },
  },
};

const EMPTY_EMAIL_PROD: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      ...CLASSIC_LIGHT_ROOT_DEFAULTS,
      childrenIds: [],
    },
  },
};

export { EMPTY_EMAIL_MESSAGE, EMPTY_EMAIL_PROD };
