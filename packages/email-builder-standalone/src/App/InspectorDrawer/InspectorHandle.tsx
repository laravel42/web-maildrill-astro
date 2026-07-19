/**
 * InspectorHandle — vertical tab anchored to the right edge of the canvas
 * (left edge of the inspector sidebar). Clicking toggles between compact
 * and full inspector modes. Always visible when the inspector is open.
 *
 * Visual: mirrors the ComponentsLibraryHandle style — a small vertical
 * button that sticks out from the sidebar edge.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { Box, ButtonBase, Tooltip } from '@mui/material';

import {
  setInspectorDrawerMode,
  useInspectorDrawerMode,
  useInspectorDrawerOpen,
} from '../../documents/editor/EditorContext';

export default function InspectorHandle() {
  const open = useInspectorDrawerOpen();
  const mode = useInspectorDrawerMode();
  const { t } = useTranslation('inspector');

  if (!open) return null;

  const toggle = () => setInspectorDrawerMode(mode === 'full' ? 'compact' : 'full');
  const isCompact = mode === 'compact';

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateX(-100%) translateY(-50%)',
        zIndex: 10,
      }}
    >
      <Tooltip
        title={
          isCompact ? t('inspector.handle.expand', 'Expand panel') : t('inspector.handle.compact', 'Compact panel')
        }
        placement="left"
      >
        <ButtonBase
          onClick={toggle}
          sx={(theme) => ({
            width: 24,
            minHeight: 80,
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            backgroundColor: isCompact ? theme.palette.primary.main : theme.palette.background.paper,
            color: isCompact ? theme.palette.primary.contrastText : theme.palette.text.secondary,
            border: `1px solid ${theme.palette.divider}`,
            borderRight: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            py: 1,
            boxShadow: '-2px 0 6px rgba(0,0,0,0.04)',
            transition: 'background-color 120ms ease, color 120ms ease',
            '&:hover': {
              backgroundColor: isCompact
                ? theme.palette.primary.dark
                : theme.palette.mode === 'dark'
                  ? theme.palette.grey[800]
                  : theme.palette.grey[200],
            },
          })}
        >
          <TuneOutlined sx={{ fontSize: 16 }} />
        </ButtonBase>
      </Tooltip>
    </Box>
  );
}
