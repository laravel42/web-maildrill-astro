/**
 * Shared visual shell for the synthetic (client-side) drag tiles in the
 * Components Library: `BlockTile`, `PresetTile` (BlocksCategoryContent) and
 * `CompactBlockTile` (CompactBlocksList).
 *
 * This centralizes ONLY the visual styling (border, hover, drag state,
 * micro-interaction). Each tile keeps its own `useDrag`, drag payload,
 * deps and content — the drag mechanics are intentionally NOT shared to
 * avoid stale-payload bugs (see docs/plans/component-audit-findings.md
 * §3.1).
 *
 * Micro-interaction (editorial "pro" polish, Fase 2): a subtle lift on
 * hover (`translateY(-1px)`) that settles on active. Only `transform`,
 * `background-color` and `border-color` are animated (composited /
 * cheap). The global `prefers-reduced-motion` guard in global.css neuters
 * the transform for users who opt out.
 *
 * Leaf module (no ComponentsLibrary barrel import) per the barrel-cycle
 * note in LEARNED.md.
 */

import type { Theme } from '@mui/material';

/** Options for the shared tile shell. */
type DragTileShellOptions = {
  /** Whether the tile is currently being dragged (dims it). */
  dragging: boolean;
};

/**
 * Returns the `sx` object for a synthetic drag tile. Spread the result and
 * add per-tile layout (padding, direction) and content on top.
 */
export function dragTileShellSx(theme: Theme, { dragging }: DragTileShellOptions) {
  return {
    borderRadius: 1,
    border: '1px dashed',
    borderColor: theme.palette.divider,
    cursor: 'grab',
    // Touch DnD (react-dnd-touch-backend): prevent the browser from
    // treating the drag gesture as a scroll/pan so the drag can start.
    // No effect on desktop mouse dragging (HTML5Backend).
    touchAction: 'none',
    opacity: dragging ? 0.5 : 1,
    transition: 'transform 130ms ease, background-color 130ms ease, border-color 130ms ease',
    willChange: 'transform',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      borderColor: theme.palette.secondary.main,
      transform: 'translateY(-1px)',
    },
    '&:active': {
      cursor: 'grabbing',
      transform: 'translateY(0)',
    },
  };
}
