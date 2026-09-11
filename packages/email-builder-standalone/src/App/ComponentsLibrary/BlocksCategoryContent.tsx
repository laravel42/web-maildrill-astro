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
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          p: 1,
          borderRadius: 0.5,
          bgcolor: theme.palette.action.hover,
          color: 'text.secondary',
        }}
      >
        {
          // Homologado con Builder42 (`.pbx-palette__icon`, sidebar.css:
          // "Icono del tipo de componente — grande, protagonista de la
          // card", 28px dentro de un tile de 76px de alto). El default
          // de MUI (24px) se veía chico en comparación.
          //
          // Dos intentos previos no dieron un resultado determinista:
          // `sx={{ '& svg': {...} }}` en el Box padre (medido ~27px,
          // luego ~52px según la ventana) y `cloneElement(..., { sx })`
          // (sin cambio visible) — MUI's SvgIcon resuelve su tamaño vía
          // `.MuiSvgIcon-root`/`fontSizeMedium`, cuya especificidad real
          // en la cascada de Emotion no está garantizada a perder contra
          // un `sx` inyectado desde fuera (confirmado como problema
          // conocido: mui/material-ui#34056, "ownerState passed to
          // SvgIcon changes the font size"). `style` inline de React se
          // renderiza como atributo HTML `style=""`, máxima especificidad
          // posible — no hay clase CSS que pueda ganarle.
          React.cloneElement(entry.icon, {
            style: { fontSize: 32, width: 32, height: 32 },
          })
        }
      </Box>
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
