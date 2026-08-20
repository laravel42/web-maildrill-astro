/**
 * One skin for every bubble-menu dropdown panel, matching the
 * wa-template-studio `.wts-select-menu` surface used elsewhere in the host app.
 *
 * Deliberately fixed rather than theme-derived: these panels open over the
 * email canvas, which is the light preview surface whatever theme the editor
 * chrome is running.
 */

export const MENU_TEXT = '#1f1e1b';
export const MENU_MUTED = '#77756c';
export const MENU_HOVER_BG = '#eef0ff';
export const MENU_SELECTED_BG = '#e4e7ff';

/** Gap between the toolbar button and its panel. */
export const MENU_GAP_PX = 6;

/** Distance MUI keeps between a popover and the viewport edge (`marginThreshold`). */
export const MENU_VIEWPORT_MARGIN_PX = 16;

/**
 * Popover paper. The top margin clears the toolbar so the panel reads as
 * separate; `ToolbarPopover` swaps it for a bottom margin when a panel has to
 * open upward.
 */
export const MENU_PAPER_SX = {
  mt: `${MENU_GAP_PX}px`,
  border: '1px solid #e4e2da',
  borderRadius: '10px',
  backgroundColor: '#ffffff',
  color: MENU_TEXT,
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.1)',
} as const;

export const MENU_LIST_SX = { p: '4px' } as const;

export const MENU_ITEM_SX = {
  px: 1,
  py: 0.625,
  borderRadius: '6px',
  transition: 'background-color 150ms ease',
  '&:hover': { backgroundColor: MENU_HOVER_BG },
  '&:focus-visible': { backgroundColor: MENU_HOVER_BG },
  '&.Mui-selected': { backgroundColor: MENU_SELECTED_BG },
  '&.Mui-selected:hover': { backgroundColor: MENU_SELECTED_BG },
} as const;

export const MENU_ICON_SX = { minWidth: 'auto', mr: 1, color: MENU_MUTED } as const;

/** ListItemText ships 4px of vertical margin; drop it so rows stay compact. */
export const MENU_ITEM_TEXT_SX = { my: 0 } as const;

export const MENU_LABEL_SX = {
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.3,
  color: MENU_TEXT,
} as const;

/** Secondary line under a label — the raw token in the merge-tag menu. */
export const MENU_SUBLABEL_SX = {
  display: 'block',
  mt: 0.125,
  fontSize: '0.75rem',
  lineHeight: 1.3,
  color: MENU_MUTED,
  wordBreak: 'break-word',
} as const;

/** Group heading inside a panel ("Subscriber fields", AI section headers). */
export const MENU_SECTION_SX = {
  px: 1,
  py: 0.5,
  fontSize: '0.75rem',
  fontWeight: 500,
  color: MENU_MUTED,
  lineHeight: 1.2,
} as const;
