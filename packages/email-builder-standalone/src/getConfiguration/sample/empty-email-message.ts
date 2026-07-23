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
 * NO theme is baked onto the root. Fresh documents ship with sensible
 * document-level globals (backdrop/canvas surface, text color, font,
 * link style) but WITHOUT a `theme.blocks` override map — so inserted
 * library blocks never inherit a theme-imposed background/border and
 * stay a clean, fully editable slate. (Previously a `Classic Light`
 * theme was baked here, which injected Container/ColumnsContainer
 * backgrounds, Button colors and a Divider color into every block that
 * didn't set its own; that default theme selection has been removed on
 * purpose.) A theme can still be applied deliberately from the Themes
 * gallery, which writes the `theme` back onto the root.
 */
const CLEAN_ROOT_DEFAULTS = {
  backdropColor: '#f1f5f9',
  canvasColor: '#ffffff',
  textColor: '#0f172a',
  fontFamily: 'MODERN_SANS',
  linkGlobal: {
    linkColor: '#2563eb',
    underline: true,
  },
} as const;

const EMPTY_EMAIL_MESSAGE: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      ...CLEAN_ROOT_DEFAULTS,
      childrenIds: [],
      showVersion: true,
    },
  },
};

const EMPTY_EMAIL_PROD: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      ...CLEAN_ROOT_DEFAULTS,
      childrenIds: [],
    },
  },
};

export { EMPTY_EMAIL_MESSAGE, EMPTY_EMAIL_PROD };
