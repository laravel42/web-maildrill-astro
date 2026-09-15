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
 *
 * T3 split the single flat tile grid into two labelled groups —
 * "Basics" (Text, Image, Button, Divider, Spacer, Social) and
 * "Structure" (Columns, Container) — each its own container with its
 * own `data-tour` anchor (`blocksBasics` / `blocksLayout`), so a future
 * tour step can highlight one group without touching the other's
 * tiles (D29). `groupBuiltInBlockIndices` computes the membership from
 * `BUTTONS` and always returns the ORIGINAL index of each entry — the
 * drag/click-to-insert contract resolves against `BUTTONS[index]`
 * directly, so grouping must never re-index (D32).
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import { Box, Typography, useTheme } from '@mui/material';

import {
  appendBuiltInBlockToParent,
  setSelectedBlockId,
} from '../../documents/editor/EditorContext';
import { dataTourAttr, EMAIL_BUILDER_TOUR_ANCHORS } from '../../tour/tourAnchors';

import { BUTTONS } from './builtInBlocks';
import { type BuiltInBlockDragItem, LIBRARY_COMPONENT_DND_TYPE } from './dnd';
import { dragTileShellSx } from './dragTileShell';

/** Labels of the structural blocks — grouped under "Structure", in this display order. */
export const LAYOUT_BLOCK_LABELS: readonly string[] = ['Columns', 'Container'];

/**
 * Intended reading order for the "Basics" group. Any `BUTTONS` label not listed here (and not
 * in `LAYOUT_BLOCK_LABELS`) still lands in `basics`, appended in `buttons` order — see
 * `groupBuiltInBlockIndices`.
 */
export const BASICS_BLOCK_ORDER: readonly string[] = [
  'Text',
  'Image',
  'Button',
  'Divider',
  'Spacer',
  'Social',
];

/**
 * Partitions the ORIGINAL indices of `buttons` into `basics` and `layout` groups, keyed by
 * `label`. Pure, DOM-free, React-free — see D32.
 *
 * The returned indices are into `buttons` as given (never re-indexed), because the drag
 * contract (`BuiltInBlockDragItem.buttonIndex`) and click-to-insert both resolve against the
 * original `BUTTONS` array.
 *
 * Every index appears in exactly one of the two arrays: `layout` holds the indices whose label
 * is in `LAYOUT_BLOCK_LABELS` (in that order), `basics` holds the rest — ordered by
 * `BASICS_BLOCK_ORDER` first, then any unknown label appended in `buttons` order. This
 * guarantees a future 9th block still renders (under Basics) instead of silently disappearing.
 */
export function groupBuiltInBlockIndices(
  buttons: readonly { label: string }[],
): { basics: number[]; layout: number[] } {
  const layout: number[] = [];
  const basics: number[] = [];

  // `layout` first, in `LAYOUT_BLOCK_LABELS` order, then `basics` in
  // `BASICS_BLOCK_ORDER` order — each pass keeps `buttons`' original relative
  // order for entries that share a label (stable sort by priority list).
  for (const label of LAYOUT_BLOCK_LABELS) {
    buttons.forEach((button, index) => {
      if (button.label === label) layout.push(index);
    });
  }

  const layoutIndices = new Set(layout);
  for (const label of BASICS_BLOCK_ORDER) {
    buttons.forEach((button, index) => {
      if (button.label === label && !layoutIndices.has(index)) basics.push(index);
    });
  }

  const placed = new Set([...layout, ...basics]);
  buttons.forEach((_button, index) => {
    if (!placed.has(index)) basics.push(index);
  });

  return { basics, layout };
}

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
        // Border sólido (no dashed) + color exacto `--pb-chrome-border`
        // (`theme.palette.grey[200]`, mapeado 1:1 a `--border` del host
        // en theme.ts) — `dragTileShellSx` traía un border punteado
        // (`divider`) pensado para el resto de tiles de drag, distinto
        // al de Builder42.
        minHeight: 76,
        p: '10px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        border: '1px solid',
        borderColor: theme.palette.grey[200],
        // `--pb-chrome-text-faint` (`--muted`) — mismo color que
        // `.pbx-palette__icon` en reposo, mapeado a `theme.palette.
        // text.disabled` (`#a5a39a` claro / `#52525B` oscuro, ver
        // theme.ts `textColors.disabled`).
        color: 'text.disabled',
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

function BlockGroup({
  titleKey,
  indices,
  tourKey,
}: {
  titleKey: string;
  indices: number[];
  tourKey: (typeof EMAIL_BUILDER_TOUR_ANCHORS)[keyof typeof EMAIL_BUILDER_TOUR_ANCHORS];
}) {
  const { t } = useTranslation('inspector');

  return (
    <Box {...dataTourAttr(tourKey)} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
        {t(titleKey)}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5 }}>
        {indices.map((index) => (
          <BlockTile key={index} index={index} />
        ))}
      </Box>
    </Box>
  );
}

export default function BlocksCategoryContent() {
  const { basics, layout } = groupBuiltInBlockIndices(BUTTONS);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
      <BlockGroup
        titleKey="componentsLibrary.drawer.group.basics"
        indices={basics}
        tourKey={EMAIL_BUILDER_TOUR_ANCHORS.blocksBasics}
      />
      <BlockGroup
        titleKey="componentsLibrary.drawer.group.layout"
        indices={layout}
        tourKey={EMAIL_BUILDER_TOUR_ANCHORS.blocksLayout}
      />
    </Box>
  );
}
