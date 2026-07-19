/**
 * CompactBlocksList — the body rendered inside the Components Library
 * drawer when it is collapsed to `compact` mode. It mirrors the right
 * InspectorDrawer's compact rail: a narrow vertical strip that surfaces
 * only the essentials — here, the built-in base blocks.
 *
 * Each tile is the same `react-dnd` drag source as the full Blocks tab
 * (`BlocksCategoryContent`): type `LIBRARY_COMPONENT_DND_TYPE`, category
 * `block`, carrying the index into `BUTTONS` (`builtInBlocks.tsx`). Drop
 * targets instantiate a fresh block via `BUTTONS[buttonIndex].block()`.
 * Clicking a tile appends the block to the document root (empty-canvas
 * friendly). A single "expand" button at the top returns to full mode.
 *
 * The labels stay icon-only (surfaced via tooltip) so the whole strip
 * fits in the compact width; use the full drawer for Sections /
 * Templates and search.
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
import { Box, ButtonBase, Stack, Tooltip, useTheme } from '@mui/material';

import {
  appendBuiltInBlockToParent,
  setComponentsLibraryDrawerOpen,
  setSelectedBlockId,
} from '../../documents/editor/EditorContext';

import { BUTTONS } from './builtInBlocks';
import { type BuiltInBlockDragItem, LIBRARY_COMPONENT_DND_TYPE } from './dnd';
import { dragTileShellSx } from './dragTileShell';

/** One icon-only base-block tile: drag to position, click to append. */
function CompactBlockTile({ index }: { index: number }) {
  const entry = BUTTONS[index];
  const theme = useTheme();
  const { t } = useTranslation('inspector');

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: LIBRARY_COMPONENT_DND_TYPE,
      item: (): BuiltInBlockDragItem => ({
        kind: LIBRARY_COMPONENT_DND_TYPE,
        category: 'block',
        buttonIndex: index,
      }),
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [index]
  );

  const handleClick = () => {
    // Click-to-insert always appends to the document root — mirrors the
    // full Blocks tab and covers the empty-canvas case. Drag lets the
    // user pick an exact position anywhere in the tree.
    const newId = appendBuiltInBlockToParent('root', entry.block());
    if (newId) setSelectedBlockId(newId);
  };

  return (
    <Tooltip title={t(entry.labelKey)} placement="right">
      <Box
        ref={(node: HTMLDivElement | null) => {
          if (node) (dragRef as unknown as (n: HTMLElement) => void)(node);
        }}
        onClick={handleClick}
        sx={{
          ...dragTileShellSx(theme, { dragging: isDragging }),
          aspectRatio: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        {entry.icon}
      </Box>
    </Tooltip>
  );
}

export default function CompactBlocksList() {
  const { t } = useTranslation('inspector');
  const theme = useTheme();

  return (
    <>
      <Stack
        direction="row"
        sx={{
          px: 0.5,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Tooltip title={t('componentsLibrary.drawer.expand', 'Expand library')} placement="right">
          <ButtonBase
            onClick={() => setComponentsLibraryDrawerOpen(true)}
            aria-label={t('componentsLibrary.drawer.expand', 'Expand library')}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              color: 'text.secondary',
              '&:hover': { backgroundColor: theme.palette.action.hover },
            }}
          >
            <ViewSidebarOutlined fontSize="small" />
          </ButtonBase>
        </Tooltip>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 0.5, py: 1 }}>
        <Stack spacing={0.5}>
          {BUTTONS.map((_entry, index) => (
            <CompactBlockTile key={index} index={index} />
          ))}
        </Stack>
      </Box>
    </>
  );
}
