/**
 * CompactBlocksList — the body rendered inside the Components Library
 * drawer when it is collapsed to `compact` mode. It mirrors the right
 * InspectorDrawer's compact rail: a narrower strip that surfaces only
 * the essentials — here, the built-in base blocks.
 *
 * Each tile is the same `react-dnd` drag source as the full Blocks tab
 * (`BlocksCategoryContent`): type `LIBRARY_COMPONENT_DND_TYPE`, category
 * `block`, carrying the index into `BUTTONS` (`builtInBlocks.tsx`). Drop
 * targets instantiate a fresh block via `BUTTONS[buttonIndex].block()`.
 * Clicking a tile appends the block to the document root (empty-canvas
 * friendly). A single "expand" button at the top returns to full mode.
 *
 * At the current 164px rail width, tiles show the full icon + label
 * (mirroring the full Blocks tab's tile styling) instead of an
 * icon-only square; use the full drawer for Sections / Templates and
 * search.
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
import { Box, ButtonBase, Stack, Tooltip, Typography, useTheme } from '@mui/material';

import {
  appendBuiltInBlockToParent,
  setComponentsLibraryDrawerOpen,
  setSelectedBlockId,
} from '../../documents/editor/EditorContext';

import { BUTTONS } from './builtInBlocks';
import { type BuiltInBlockDragItem, LIBRARY_COMPONENT_DND_TYPE } from './dnd';
import { dragTileShellSx } from './dragTileShell';

/**
 * One base-block tile — mirrors the full Blocks tab's `BlockTile`
 * styling (icon chip on top, label below, in a column) instead of the
 * previous icon-only square, now that the compact rail is 164px wide
 * (up from 64px) and has room for it. Rectangular — width fills the
 * rail, height stays tight to icon+label — rather than a square
 * aspect-ratio tile, so a full list of blocks doesn't overflow the
 * rail vertically the way taller square tiles would.
 */
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
    [index],
  );

  const handleClick = () => {
    // Click-to-insert always appends to the document root — mirrors the
    // full Blocks tab and covers the empty-canvas case. Drag lets the
    // user pick an exact position anywhere in the tree.
    const newId = appendBuiltInBlockToParent('root', entry.block());
    if (newId) setSelectedBlockId(newId);
  };

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        if (node) (dragRef as unknown as (n: HTMLElement) => void)(node);
      }}
      onClick={handleClick}
      sx={{
        ...dragTileShellSx(theme, { dragging: isDragging }),
        // Homologado con Builder42 (`.pbx-compact-rail__tile`,
        // sidebar.css: `padding: 8px 4px; gap: 4px`) — ícono SIN
        // fondo/caja propia, igual que en BlockTile
        // (BlocksCategoryContent.tsx): ahí `.pbx-compact-rail__tile-icon`
        // solo centra, no tiene `background`. Border sólido (no dashed)
        // + color exacto de `--pb-chrome-border`
        // (`theme.palette.grey[200]`) — `dragTileShellSx` traía un
        // border punteado (`divider`). Color `text.secondary`
        // (`--pb-chrome-text`), NO `text.disabled`: en Builder42 el rail
        // compacto (`.pbx-compact-rail__tile`) usa un color más intenso
        // que el panel expandido (`.pbx-palette__icon`, `--text-faint`)
        // — no son el mismo tono, confirmado en sidebar.css.
        p: '8px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        border: '1px solid',
        borderColor: theme.palette.grey[200],
        color: 'text.secondary',
      }}
    >
      {
        // Rail compacto (164px de ancho) — equivalente real en
        // Builder42 es `.pbx-compact-rail__tile-icon-svg` (18px), NO
        // `.pbx-palette__icon` (28px, panel EXPANDIDO — ver BlockTile en
        // BlocksCategoryContent.tsx). `style` inline (no `sx`) — ver
        // nota detallada ahí: `sx` vía cloneElement no ganó de forma
        // determinista contra `.MuiSvgIcon-root` (mui/material-ui#34056).
        React.cloneElement(entry.icon, {
          style: { fontSize: 18, width: 18, height: 18 },
        })
      }
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.75rem',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {t(entry.labelKey)}
      </Typography>
    </Box>
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
        {/* Box + gap, not Stack spacing — theme.ts's MuiStack styleOverrides
            forces margin: 0 !important on every Stack's children workspace-
            wide (see BaseSidebarPanel.tsx for the same issue), which would
            silently collapse this back to touching tiles. gap: 1 = 0.5rem
            gives the list some breathing room. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {BUTTONS.map((_entry, index) => (
            <CompactBlockTile key={index} index={index} />
          ))}
        </Box>
      </Box>
    </>
  );
}
