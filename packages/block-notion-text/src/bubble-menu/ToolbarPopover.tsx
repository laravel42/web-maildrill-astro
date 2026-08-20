import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Popover } from '@mui/material';

import { MENU_GAP_PX, MENU_PAPER_SX, MENU_VIEWPORT_MARGIN_PX } from './menu-skin';

type ToolbarPopoverProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  disableAutoFocus?: boolean;
  /** Merged over the shared panel skin for per-menu tweaks (e.g. a wider merge-tag panel). */
  paperSx?: Record<string, unknown>;
};

/** Floor for the room clamp — under this a panel is unusable anyway. */
const MIN_PANEL_HEIGHT = 120;

export default function ToolbarPopover({
  anchorEl,
  onClose,
  children,
  disableAutoFocus = false,
  paperSx,
}: ToolbarPopoverProps) {
  const [above, setAbove] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number>();
  const paperRef = useRef<HTMLElement | null>(null);

  /*
   * Panels open downward, and MUI's own overflow handling would slide a tall
   * one up until it fits — parking it over the format bar. So we drive it:
   * clamp to the room under the anchor, and when the panel wants more than
   * that, put it above the anchor instead of squeezing it. Only a panel that
   * fits neither way gets capped and scrolls.
   *
   * `scrollHeight` stays the panel's natural height even once a cap is
   * applied, so re-measuring can't oscillate between the two sides.
   */
  const measure = useCallback(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const chrome = MENU_GAP_PX + MENU_VIEWPORT_MARGIN_PX;
    const roomBelow = window.innerHeight - rect.bottom - chrome;
    const roomAbove = rect.top - chrome;
    const wanted = paperRef.current?.scrollHeight ?? 0;

    const flip = wanted > roomBelow && roomAbove > roomBelow;
    setAbove(flip);
    setMaxHeight(Math.max(MIN_PANEL_HEIGHT, flip ? roomAbove : roomBelow));
  }, [anchorEl]);

  useLayoutEffect(() => {
    if (!anchorEl) {
      // Next open re-measures from scratch rather than inheriting a side.
      setAbove(false);
      setMaxHeight(undefined);
      return;
    }
    measure();
  }, [anchorEl, measure]);

  // Measuring in the paper's ref callback keeps the flip within the same
  // commit as the first render, so the panel never paints on the wrong side.
  const handlePaperRef = useCallback(
    (node: HTMLElement | null) => {
      paperRef.current = node;
      if (node) measure();
    },
    [measure],
  );

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      {...(disableAutoFocus && { disableEnforceFocus: true, disableAutoFocus: true })}
      anchorOrigin={{ vertical: above ? 'top' : 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: above ? 'bottom' : 'top', horizontal: 'center' }}
      marginThreshold={MENU_VIEWPORT_MARGIN_PX}
      slotProps={{
        paper: {
          ref: handlePaperRef,
          sx: {
            ...MENU_PAPER_SX,
            ...(above ? { mt: 0, mb: `${MENU_GAP_PX}px` } : null),
            maxHeight,
            ...paperSx,
          },
        },
      }}
    >
      {children}
    </Popover>
  );
}
