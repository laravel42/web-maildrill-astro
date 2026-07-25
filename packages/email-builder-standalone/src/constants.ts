/**
 * Border-radius tokens (editorial redesign). Single source of truth for
 * corner radii across the editor chrome, aligned with the editorial plan's
 * radius table. The MUI theme sets `shape.borderRadius = 6` (base); these
 * cover the surfaces that deviate, so `borderRadius: '8px'` literals stop
 * being scattered across components.
 */
/** Buttons, inputs, tabs, small controls — matches theme base (6px). */
export const RADIUS_INPUT = 6;
/** Cards, tiles. */
export const RADIUS_CARD = 8;
/** Dropdown / popover menu surfaces. */
export const RADIUS_DROPDOWN = 8;
/** Dialogs / modals. */
export const RADIUS_DIALOG = 10;

export const DEFAULT_HEIGHT_DESKTOP = 400;
export const HEADER_HEIGHT = '50px';
export const COMPACT_PANEL_WIDTH = 56;

export const MAX_WIDTH_DESKTOP = 600;
export const MAX_WIDTH_MOBILE = 370;

/** Maildrill email channel identity — matches host `--ch-email` / `--accent`. */
export const EMAIL_CHANNEL_COLOR = '#4F46E5';

export const DEFAULT_PRESET_COLORS = [
  '#DC2626',
  '#EF4444',
  '#F87171',
  '#EC4899',
  '#BE185D',
  '#7C2D12',

  '#EA580C',
  '#F97316',
  '#FBBF24',
  '#D97706',
  '#A16207',
  '#92400E',

  '#059669',
  '#10B981',
  '#22C55E',
  '#65A30D',
  '#166534',
  '#064E3B',

  '#2563EB',
  '#3B82F6',
  '#60A5FA',
  '#0EA5E9',
  '#0891B2',
  '#1E40AF',

  '#7C3AED',
  '#A855F7',
  '#FFFFFF',
  '#000000',
  '#F9FAFB',
  '#111827',

  // Las row for last colors selected
  '',
  '',
  '',
  '',
  '',
];
