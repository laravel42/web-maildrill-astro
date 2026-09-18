/**
 * ComponentsLibraryHandle — vertical tab on the right edge of the
 * library (left edge of the canvas). Mirrors InspectorHandle: a 24×80
 * flag that sticks out from the panel. Clicking collapses the full
 * library to the compact rail, or expands it back.
 *
 * Icon + vertical label ("Library"), homologado con Builder42's
 * `PanelHandle` (`packages/builder42/src/app/layout/PanelHandle.tsx`,
 * `.pbx-panel-handle__label`) — antes solo mostraba el icono.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
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
            backgroundColor: isCompact
              ? theme.palette.primary.main
              : theme.palette.background.paper,
            color: isCompact ? theme.palette.primary.contrastText : theme.palette.text.secondary,
            border: `1px solid ${theme.palette.divider}`,
            borderLeft: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            py: 1,
            boxShadow: '2px 0 6px rgba(0,0,0,0.04)',
            '&:hover': {
              backgroundColor: isCompact
                ? theme.palette.primary.dark
                : theme.palette.mode === 'dark'
                  ? theme.palette.grey[800]
                  : theme.palette.grey[200],
            },
          })}
        >
          <ViewSidebarOutlined sx={{ fontSize: 15 }} />
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
