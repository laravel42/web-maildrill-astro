/**
 * ComponentsLibraryHandle — vertical tab on the right edge of the
 * library (left edge of the canvas). Mirrors InspectorHandle: a 24×80
 * flag that sticks out from the panel. Clicking collapses the full
 * library to the compact rail, or expands it back.
 *
 * Chevron + vertical label ("Library"), homologado con Builder42's
 * `PanelHandle` (`packages/builder42/src/app/layout/PanelHandle.tsx`,
 * `.pbx-panel-handle`/`.pbx-panel-handle__label`):
 * - Always neutral theme colors (`background.paper` + `text.secondary`,
 *   hover to `action.hover` + `text.primary`) instead of switching to
 *   `primary.main`/`primary.contrastText` when compact — that's what made
 *   the label unreadable (near-black text) against some custom brand
 *   colors (Theme Panel), because `primary.contrastText` is picked for
 *   contrast against `primary.main`, not against this handle's own
 *   background. Neutral surface colors are always in-theme contrast-safe.
 * - A chevron (pointing at the canvas when compact = "click to expand",
 *   pointing at its own edge when expanded = "click to collapse") gives
 *   the same open/closed affordance as Builder42's `ChevronLeft`/
 *   `ChevronRight`.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';

import {
  setComponentsLibraryDrawerOpen,
  useComponentsLibraryDrawerOpen,
  useComponentsLibraryEnabled,
  useSelectedMainTab,
} from '../../documents/editor/EditorContext';

import {
  COMPACT_LIBRARY_DRAWER_WIDTH,
  COMPONENTS_LIBRARY_DRAWER_WIDTH,
} from './ComponentsLibraryDrawer';
import { resetHoverPreview } from './hoverPreviewStore';

export default function ComponentsLibraryHandle() {
  const open = useComponentsLibraryDrawerOpen();
  const enabled = useComponentsLibraryEnabled();
  const selectedMainTab = useSelectedMainTab();
  const { t } = useTranslation('inspector');

  if (!enabled || selectedMainTab !== 'editor') return null;

  const isCompact = !open;
  const drawerWidth = open ? COMPONENTS_LIBRARY_DRAWER_WIDTH : COMPACT_LIBRARY_DRAWER_WIDTH;
  const panelName = t('componentsLibrary.drawer.handle', 'Library');
  // Left-edge handle: compact (collapsed) points right toward the canvas
  // ("click to expand"); expanded points left toward its own edge
  // ("click to collapse") — mirrors Builder42's left-slot semantics.
  const ChevronIcon = isCompact ? ChevronRight : ChevronLeft;

  const toggle = () => {
    if (open) resetHoverPreview();
    setComponentsLibraryDrawerOpen(!open);
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        left: drawerWidth,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
      }}
    >
      <Tooltip
        title={
          isCompact
            ? t('inspector.handle.expand', 'Expand panel')
            : t('inspector.handle.compact', 'Compact panel')
        }
        placement="right"
      >
        <ButtonBase
          onClick={toggle}
          aria-label={
            isCompact
              ? t('inspector.handle.expand', 'Expand panel')
              : t('inspector.handle.compact', 'Compact panel')
          }
          sx={(theme) => ({
            width: 24,
            minHeight: 88,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.secondary,
            border: `1px solid ${theme.palette.divider}`,
            borderLeft: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            py: 1,
            boxShadow: '2px 0 6px rgba(0,0,0,0.04)',
            transition: 'background-color 120ms ease, color 120ms ease',
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
              color: theme.palette.text.primary,
            },
          })}
        >
          <ChevronIcon sx={{ fontSize: 15 }} aria-hidden="true" />
          <Typography
            component="span"
            sx={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {panelName}
          </Typography>
        </ButtonBase>
      </Tooltip>
    </Box>
  );
}
