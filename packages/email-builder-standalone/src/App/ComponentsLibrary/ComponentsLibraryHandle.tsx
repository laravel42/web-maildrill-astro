/**
 * ComponentsLibraryHandle — vertical tab anchored to the left edge of the
 * editor canvas. Always visible when devMode is on. Clicking toggles the
 * `ComponentsLibraryDrawer`.
 *
 * Visual: a small button with rotated text that sticks out about 24 px
 * from the left edge so it's always reachable, even when the drawer is
 * closed. When the drawer opens, the handle simply moves with the page
 * flow because both elements are siblings inside the same flex parent.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import LibraryAddOutlined from '@mui/icons-material/LibraryAddOutlined';
import { Box, ButtonBase, Tooltip } from '@mui/material';

import {
  toggleComponentsLibraryDrawerOpen,
  useComponentsLibraryDrawerOpen,
  useComponentsLibraryEnabled,
  useSelectedMainTab,
} from '../../documents/editor/EditorContext';

import {
  COMPACT_LIBRARY_DRAWER_WIDTH,
  COMPONENTS_LIBRARY_DRAWER_WIDTH,
} from './ComponentsLibraryDrawer';

export default function ComponentsLibraryHandle() {
  const open = useComponentsLibraryDrawerOpen();
  const enabled = useComponentsLibraryEnabled();
  const selectedMainTab = useSelectedMainTab();
  const { t } = useTranslation('inspector');

  // The left panel only exists in the editor view.
  if (!enabled || selectedMainTab !== 'editor') return null;

  // The rail is always visible (compact base blocks) when closed, so the
  // handle sits at the rail width when closed and the full width when open.
  const drawerWidth = open ? COMPONENTS_LIBRARY_DRAWER_WIDTH : COMPACT_LIBRARY_DRAWER_WIDTH;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: drawerWidth,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        transition: 'left 220ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Tooltip
        title={
          open
            ? t('componentsLibrary.drawer.handleClose')
            : t('componentsLibrary.drawer.handleOpen')
        }
        placement="right"
      >
        <ButtonBase
          onClick={toggleComponentsLibraryDrawerOpen}
          aria-label={
            open
              ? t('componentsLibrary.drawer.handleClose')
              : t('componentsLibrary.drawer.handleOpen')
          }
          sx={(theme) => ({
            width: 28,
            minHeight: 96,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            backgroundColor: open ? theme.palette.secondary.main : theme.palette.background.paper,
            color: open ? theme.palette.secondary.contrastText : theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            borderLeft: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            py: 1,
            boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
            transition: 'background-color 120ms ease, color 120ms ease',
            '&:hover': {
              backgroundColor: open
                ? theme.palette.secondary.dark
                : theme.palette.mode === 'dark'
                  ? theme.palette.grey[800]
                  : theme.palette.grey[200],
            },
          })}
        >
          <LibraryAddOutlined sx={{ fontSize: 18 }} />
          <Box
            sx={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {t('componentsLibrary.drawer.handle')}
          </Box>
        </ButtonBase>
      </Tooltip>
    </Box>
  );
}
