/**
 * BlocksCategoryContent — the "Blocks" tab body in the Components
 * Library drawer. Unlike every other category, this one is synthetic:
 * its items are the built-in block factories from `BUTTONS`
 * (`builtInBlocks.tsx`), not saved components fetched by id. No
 * network call, no localStorage, no listing endpoint — the tile list
 * is static and identical in every storage mode.
 *
 * Each plain tile is:
 *   - a `react-dnd` drag source of type `LIBRARY_COMPONENT_DND_TYPE`
 *     with `category: 'block'` and `buttonIndex` (index into `BUTTONS`);
 *     drop targets call `BUTTONS[buttonIndex].block()` for a fresh
 *     instance (see `EditorChildrenIds/index.tsx` and
 *     `EditorBlockWrapper.tsx`).
 *   - click-to-insert: appends a fresh block to the end of the
 *     document root, covering the empty-canvas case without needing to
 *     drag.
 *
 * Point 6 (EMAIL_BUILDER_TASKS.md) removed the three per-primitive
 * accordions (Text / Social Media / Button) that used to list 6
 * ready-made styled variants below the plain-tile grid — they didn't
 * add enough value to justify the space. The plain tiles (including
 * Text, Social and Button themselves) are unaffected.
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import { Box, Typography, useTheme } from '@mui/material';

import {
  appendBuiltInBlockToParent,
  setSelectedBlockId,
} from '../../documents/editor/EditorContext';

import { BUTTONS } from './builtInBlocks';
import { type BuiltInBlockDragItem, LIBRARY_COMPONENT_DND_TYPE } from './dnd';
import { dragTileShellSx } from './dragTileShell';

function BlockTile({ index }: { index: number }) {
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
    // Click-to-insert always appends to the document root — covers the
    // empty-canvas case and is a predictable, simple target. Drag lets
    // the user pick an exact position anywhere in the tree.
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
        // Homologado con Builder42 (`.pbx-palette__item`, sidebar.css):
        // `min-height` (no padding fijo que empuje la altura) + icono SIN
        // fondo/caja propia — ahí el ícono va directo con `color` sobre
        // el fondo de la card, sin ningún wrapper `bgcolor`/`borderRadius`
        // que lo encajone y lo haga verse chico respecto a la card.
        minHeight: 76,
        p: '10px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        color: 'text.secondary',
      }}
    >
      {
        // 28px — mismo valor que `.pbx-palette__icon` de Builder42
        // (sidebar.css: "icono grande, protagonista de la card"),
        // unificado con LibraryCardThumbnail.tsx. `style` inline (no
        // `sx`) — `sx` vía cloneElement no ganó de forma determinista
        // contra `.MuiSvgIcon-root` (mui/material-ui#34056); `style`
        // inline se renderiza como atributo HTML, máxima especificidad.
        React.cloneElement(entry.icon, {
          style: { fontSize: 28, width: 28, height: 28 },
        })
      }
      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
        {t(entry.labelKey)}
      </Typography>
    </Box>
  );
}

export default function BlocksCategoryContent() {
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5, pt: 0.5 }}
    >
      {BUTTONS.map((_entry, index) => (
        <BlockTile key={index} index={index} />
      ))}
    </Box>
  );
}
