import React from 'react';

import { Box, Container, Divider, Stack, Tooltip, Typography } from '@mui/material';

import { useBlockTypeSelected } from '../../../../../documents/editor/EditorContext';
import { THEME_BLOCK_REGISTRY, ThemeBlockType } from '../../../../TemplatePanel/ThemePanel/registry';
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
    <Container sx={{ padding: '0!important', paddingTop: '1rem!important' }}>
      {!compact && (
        <Typography
          sx={{
            fontWeight: 'bold',
            mb: 2,
            color: 'text.primary',
            fontSize: '1.25rem',
          }}
        >
          {title}
        </Typography>
      )}
      {compact && BlockIcon && (
        <Tooltip title={title} placement="left">
          <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.5 }}>
            <BlockIcon sx={{ fontSize: 22, color: 'text.secondary' }} />
          </Box>
        </Tooltip>
      )}
      {/* 1rem between properties in full mode — anything smaller reads as
          cramped once each row also has its own label. Compact keeps its
          tighter rhythm since it's icon-only rows. */}
      <Stack spacing={compact ? 0.5 : 2} sx={{ mb: 3, pt: compact ? 0 : 1 }}>
        {children}
      </Stack>
    </Container>
  );
}

/** Thin divider rendered only in compact mode to separate content from styles. */
export function CompactDivider() {
  const compact = useCompactMode();
  if (!compact) return null;
  return <Divider sx={{ my: 0.5 }} />;
}
