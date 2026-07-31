import React from 'react';

import { Box, Container, Divider, Tooltip } from '@mui/material';

import { useBlockTypeSelected } from '../../../../../documents/editor/EditorContext';
import {
  THEME_BLOCK_REGISTRY,
  ThemeBlockType,
} from '../../../../TemplatePanel/ThemePanel/registry';
import { useCompactMode } from '../../../CompactModeContext';

type SidebarPanelProps = {
  title?: string;
  children: React.ReactNode;
};
export default function BaseSidebarPanel({ title, children }: SidebarPanelProps) {
  const compact = useCompactMode();
  const blockType = useBlockTypeSelected() as ThemeBlockType | null;
  const blockSpec = blockType ? THEME_BLOCK_REGISTRY[blockType] : null;
  const BlockIcon = blockSpec?.icon;

  return (
    <Container sx={{ padding: '0!important', paddingTop: '0.5rem!important' }}>
      {/* No title here anymore — it duplicated the tab header above it and
          ate vertical space. Compact mode keeps its icon (there's no text
          header to duplicate in that rail). */}
      {compact && BlockIcon && (
        <Tooltip title={title} placement="left">
          <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.5 }}>
            <BlockIcon sx={{ fontSize: 22, color: 'text.secondary' }} />
          </Box>
        </Tooltip>
      )}
      {/* Plain Box, not Stack — the theme's MuiStack styleOverrides forces
          `margin: 0 !important` on every Stack's children (added for some
          other layout elsewhere), which silently defeats both `spacing`
          and a `gap` set via sx on an actual MuiStack-root. A Box sidesteps
          that override entirely. 1rem between properties in full mode;
          compact keeps its tighter rhythm since it's icon-only rows. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', mb: 3, gap: compact ? 0.5 : 2 }}>
        {children}
      </Box>
    </Container>
  );
}

/** Thin divider rendered only in compact mode to separate content from styles. */
export function CompactDivider() {
  const compact = useCompactMode();
  if (!compact) return null;
  return <Divider sx={{ my: 0.5 }} />;
}
