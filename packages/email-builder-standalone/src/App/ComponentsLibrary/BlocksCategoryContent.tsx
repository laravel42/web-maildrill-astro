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
 * Below the plain tiles, one exclusive accordion per primitive type
 * (Text, Social, Button — three axes covered by `primitivesCatalog.ts`;
 * Image was tried and removed — role-specific placeholders still didn't
 * read as visually distinct/usable at tile size; Divider/Spacer have too
 * little to meaningfully vary and Columns/Container aren't primitives)
 * lists 6 ready-made styled variants of that block, also drag/click-to-
 * insert, also fully client-side (`category: 'block-preset'`). All
 * accordions start collapsed; opening one closes any other (a single
 * `expandedType` string, not a per-accordion boolean) to avoid visual
 * noise from many long variant lists open at once.
 */

import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import ExpandMoreOutlined from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Typography, useTheme } from '@mui/material';

import type { TEditorBlock } from '../../documents/editor/core';
import { appendBuiltInBlockToParent, setSelectedBlockId } from '../../documents/editor/EditorContext';

import { BUTTONS } from './builtInBlocks';
import { type BuiltInBlockDragItem, type BuiltInPresetDragItem, LIBRARY_COMPONENT_DND_TYPE } from './dnd';
import { dragTileShellSx } from './dragTileShell';
import { PRIMITIVES, type PrimitiveType } from './primitivesCatalog';
import LibraryCardPrimitiveRender from './thumbnail/LibraryCardPrimitiveRender';

/** Primitive axis → theme.blocks i18n key (title reused, no new i18n keys needed). */
const PRIMITIVE_TYPE_META: ReadonlyArray<{ type: PrimitiveType; titleKey: string }> = [
  { type: 'notion-text', titleKey: 'theme.blocks.notionText.title' },
  { type: 'social-media', titleKey: 'theme.blocks.socialMedia.title' },
  { type: 'button', titleKey: 'theme.blocks.button.title' },
];

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
    [index]
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
        {entry.icon}
      </Box>
      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
        {t(entry.labelKey)}
      </Typography>
    </Box>
  );
}

/** One styled-variant tile inside a primitive-type accordion. */
function PresetTile({ index }: { index: number }) {
  const preset = PRIMITIVES[index];
  const theme = useTheme();

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: LIBRARY_COMPONENT_DND_TYPE,
      item: (): BuiltInPresetDragItem => ({
        kind: LIBRARY_COMPONENT_DND_TYPE,
        category: 'block-preset',
        presetIndex: index,
      }),
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [index]
  );

  const handleClick = () => {
    const newId = appendBuiltInBlockToParent('root', preset.block as TEditorBlock);
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
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <LibraryCardPrimitiveRender id={`preset-${index}`} block={preset.block} alt={preset.name} height={80} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', px: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={preset.name}
      >
        {preset.name}
      </Typography>
    </Box>
  );
}

/**
 * One exclusive accordion for a primitive type. `expanded` /
 * `onToggle` are controlled by the parent so only one accordion is
 * ever open at a time.
 */
function PrimitiveTypeAccordion({
  type,
  titleKey,
  expanded,
  onToggle,
}: {
  type: PrimitiveType;
  titleKey: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('inspector');
  const indices = PRIMITIVES.reduce<number[]>((acc, item, idx) => {
    if (item.type === type) acc.push(idx);
    return acc;
  }, []);

  if (indices.length === 0) return null;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => onToggle()}
      disableGutters
      square
      sx={{
        boxShadow: 'none',
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlined />}
        sx={{ px: 0, minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.75, alignItems: 'center' } }}
      >
        <Typography variant="subtitle2" sx={{ mr: 0.75 }}>
          {t(titleKey)}
        </Typography>
        <Chip
          size="small"
          label={indices.length}
          sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 1.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5 }}>
          {indices.map((idx) => (
            <PresetTile key={idx} index={idx} />
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default function BlocksCategoryContent() {
  // Exclusive accordion state: at most one primitive-type section open
  // at a time, to keep the tab from turning into a long scroll of
  // variant tiles ("evitando ruido en el proyecto").
  const [expandedType, setExpandedType] = useState<PrimitiveType | null>(null);

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5, pt: 0.5 }}>
        {BUTTONS.map((_entry, index) => (
          <BlockTile key={index} index={index} />
        ))}
      </Box>
      <Box sx={{ mt: 1 }}>
        {PRIMITIVE_TYPE_META.map(({ type, titleKey }) => (
          <PrimitiveTypeAccordion
            key={type}
            type={type}
            titleKey={titleKey}
            expanded={expandedType === type}
            onToggle={() => setExpandedType((prev) => (prev === type ? null : type))}
          />
        ))}
      </Box>
    </Box>
  );
}
