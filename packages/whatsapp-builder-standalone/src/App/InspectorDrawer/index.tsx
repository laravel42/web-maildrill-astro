import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Typography } from '@mui/material';

import { useInspectorDrawerOpen } from '../../documents/editor/EditorContext';
import ConfigurationPanel from './ConfigurationPanel';

export const INSPECTOR_DRAWER_WIDTH = 320;

/** Right panel — block configuration for the current selection. */
export default function InspectorDrawer() {
  const { t } = useTranslation('waInspector');
  const open = useInspectorDrawerOpen();

  if (!open) return null;

  return (
    <Box
      sx={{
        width: INSPECTOR_DRAWER_WIDTH,
        flexShrink: 0,
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflowY: 'auto',
        display: { xs: 'none', sm: 'block' },
      }}
    >
      <Typography variant="overline" sx={{ display: 'block', px: 2, pt: 1.5, color: 'text.secondary' }}>
        {t('inspector.title')}
      </Typography>
      <Box sx={{ p: 2, pt: 1 }}>
        <ConfigurationPanel />
      </Box>
    </Box>
  );
}
