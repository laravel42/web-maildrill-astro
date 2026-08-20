import React, { Fragment } from 'react';
import { useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import ViewDayOutlined from '@mui/icons-material/ViewDayOutlined';
import { Box, Stack, Typography } from '@mui/material';

import { BUTTONS } from '../../../../App/ComponentsLibrary/builtInBlocks';
import {
  type BuiltInBlockDragItem,
  type BuiltInPresetDragItem,
  type FetchableLibraryCategory,
  LIBRARY_COMPONENT_DND_TYPE,
  type LibraryComponentDragItem,
} from '../../../../App/ComponentsLibrary/dnd';
import { fetchSavedSubtree } from '../../../../App/ComponentsLibrary/fetchSavedSubtree';
import { PRIMITIVES } from '../../../../App/ComponentsLibrary/primitivesCatalog';
import { TEditorBlock } from '../../../editor/core';
import EditorBlock from '../../../editor/EditorBlock';
import {
  appendBuiltInBlockToParent,
  appendSavedComponentToParent,
  insertNewChildInColumn,
  insertNewChildInContainer,
  isChildOf,
} from '../../../editor/EditorContext';

export type EditorChildrenChange = {
  blockId: string;
  block: TEditorBlock;
  childrenIds: string[];
};

export type EditorChildrenIdsProps = {
  childrenIds: string[] | null | undefined;
  onChange: (val: EditorChildrenChange) => void;
  parentId: string;
  position?: number;
  isNotClient?: boolean;
  /** Canvas raíz (`EmailLayout`): lista raíz del documento. Container/columnas no lo usan. */
  listEndPolicy?: 'root';
};

type DropItem = { blockId?: string } & Partial<LibraryComponentDragItem> &
  Partial<BuiltInBlockDragItem> &
  Partial<BuiltInPresetDragItem>;

export default function EditorChildrenIds({
  childrenIds,
  onChange: _onChange,
  parentId,
  position,
  isNotClient,
}: EditorChildrenIdsProps) {
  const { t } = useTranslation();

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ['block', LIBRARY_COMPONENT_DND_TYPE],
      drop: (item: DropItem, monitor) => {
        if (monitor.getItemType() === LIBRARY_COMPONENT_DND_TYPE) {
          if (monitor.didDrop()) {
            monitor.getDropResult();
            return;
          }
          if (item.category === 'block' && typeof item.buttonIndex === 'number') {
            const entry = BUTTONS[item.buttonIndex];
            if (!entry) return;
            appendBuiltInBlockToParent(parentId, entry.block(), position);
            return;
          }
          if (item.category === 'block-preset' && typeof item.presetIndex === 'number') {
            const preset = PRIMITIVES[item.presetIndex];
            if (!preset) return;
            appendBuiltInBlockToParent(parentId, preset.block as TEditorBlock, position);
            return;
          }
          const libItem = item as unknown as Omit<LibraryComponentDragItem, 'category'> & {
            category: FetchableLibraryCategory;
          };
          if (libItem.category === 'template') {
            console.warn(
              '[ComponentsLibrary] templates cannot be dropped inline; click the card in the drawer to apply.',
            );
            return;
          }
          void (async () => {
            try {
              const result = await fetchSavedSubtree(libItem.category, libItem.axis, libItem.id);
              appendSavedComponentToParent(parentId, result.blocks, position);
            } catch (err) {
              console.error('[ComponentsLibrary] failed to append saved subtree', err);
            }
          })();
          return;
        }

        const draggedId = item.blockId as string;

        if (monitor.didDrop()) {
          monitor.getDropResult();
          return;
        }
        if (position === undefined) {
          return insertNewChildInContainer({
            parentId,
            blockId: draggedId,
          });
        }
        return insertNewChildInColumn({
          parentId,
          blockId: draggedId,
          indexArray: position,
        });
      },
      canDrop: (item: DropItem, monitor) => {
        if (monitor.getItemType() === LIBRARY_COMPONENT_DND_TYPE) {
          return true;
        }
        const draggedId = item.blockId as string;
        return !isChildOf({ targetId: parentId, draggedId }) && draggedId !== parentId;
      },
      collect: (monitor) => ({
        isOver: monitor.canDrop() ? Boolean(monitor.isOver()) : false,
      }),
    }),
    [parentId, position],
  );

  /** Sin UI: mantiene react-dnd al final de la lista cuando ya hay hijos (raíz y anidadas). */
  const listTrailingDrop =
    childrenIds && childrenIds.length > 0 ? (
      <Box
        ref={(node: HTMLDivElement | null) => {
          drop(node);
        }}
        sx={{
          minHeight: 0,
          border: isOver ? '2px solid' : '',
          borderColor: isOver ? 'secondary.main' : undefined,
        }}
        aria-hidden
      />
    ) : null;

  if (isNotClient) {
    return childrenIds.map((childId) => (
      <Fragment key={childId}>
        <EditorBlock id={childId} isNotClient={isNotClient} />
      </Fragment>
    ));
  }

  if (!childrenIds || childrenIds.length === 0) {
    // Empty canvas / empty container: drop target with subtle diagonal pattern.
    return (
      <Box
        ref={(node: HTMLDivElement | null) => {
          drop(node);
        }}
        sx={{
          minHeight: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          border: isOver ? '2px solid' : '1px dashed',
          borderColor: isOver ? 'secondary.main' : 'divider',
          backgroundImage: (theme) =>
            `repeating-linear-gradient(45deg, ${theme.palette.action.hover} 0, ${theme.palette.action.hover} 1px, transparent 1px, transparent 12px)`,
          backgroundColor: isOver ? 'action.hover' : 'transparent',
          transition: 'background-color 120ms ease, border-color 120ms ease',
        }}
      >
        <Stack spacing={0.75} sx={{ px: 2, color: 'text.secondary', alignItems: 'center' }}>
          <ViewDayOutlined sx={{ fontSize: 22, opacity: 0.7 }} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {t('editor.emptyCanvasDropHint', 'Drag a block here from the library')}
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <>
      {childrenIds.map((childId) => (
        <Fragment key={childId}>
          <EditorBlock id={childId} />
        </Fragment>
      ))}
      {listTrailingDrop}
    </>
  );
}
