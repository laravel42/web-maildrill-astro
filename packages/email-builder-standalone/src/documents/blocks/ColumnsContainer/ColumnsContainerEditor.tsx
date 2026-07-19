import React from 'react';

import { ColumnsContainer as BaseColumnsContainer } from '@eb/block-columns-container';

import ClientOnly from '../../editor/ClientOnly';
import type { TEditorBlock } from '../../editor/core';
import { useCurrentBlockId } from '../../editor/EditorBlock';
import { applyBlockUpdates, editorStateStore, setSelectedBlockId } from '../../editor/EditorContext';
import EditorChildrenIds, { EditorChildrenChange } from '../helpers/EditorChildrenIds';

import ColumnsContainerPropsSchema, { ColumnsContainerProps } from './ColumnsContainerPropsSchema';
const EMPTY_COLUMNS = [{ childrenIds: [] }, { childrenIds: [] }, { childrenIds: [] }];

export default function ColumnsContainerEditor({ style, props, blockId, isNotClient }: ColumnsContainerProps) {
  const currentBlockId = useCurrentBlockId();
  const { columns, ...restProps } = props ?? {};
  const columnsValue = columns ?? EMPTY_COLUMNS;

  const updateColumn = (columnIndex: 0 | 1 | 2, { block, blockId, childrenIds }: EditorChildrenChange) => {
    const state = editorStateStore.getState();
    const currentBlock = state.document[currentBlockId] as any;
    const currentColumns = currentBlock?.data?.props?.columns ?? columnsValue;
    const currentRestProps = currentBlock?.data?.props ? { ...currentBlock.data.props } : { ...restProps };
    delete (currentRestProps as any).columns;
    const nColumns =
      currentColumns.length === 2 ? [...currentColumns, { childrenIds: [] as string[] }] : [...currentColumns];
    nColumns[columnIndex] = { childrenIds };
    const correctColumnsStructure = {
      ...currentRestProps,
      fixedWidths:
        (currentRestProps as any).fixedWidths?.length === 2
          ? [...(currentRestProps as any).fixedWidths, null]
          : (currentRestProps as any).fixedWidths,
    };
    const updatedParent: TEditorBlock = {
      type: 'ColumnsContainer',
      data: ColumnsContainerPropsSchema.parse({
        style: currentBlock?.data?.style ?? style,
        props: {
          ...correctColumnsStructure,
          columns: nColumns,
        },
      }),
    };
    const updates: Record<string, TEditorBlock> = {
      [blockId]: block,
      [currentBlockId]: updatedParent,
    };
    applyBlockUpdates(updates);
    setSelectedBlockId(blockId);
  };
  if (isNotClient) {
    return (
      <>
        <BaseColumnsContainer
          blockId={blockId}
          props={restProps as any}
          style={style}
          columns={[
            <EditorChildrenIds
              isNotClient={isNotClient}
              parentId={blockId}
              position={0}
              childrenIds={columns?.[0]?.childrenIds}
              onChange={(change) => updateColumn(0, change)}
            />,
            <EditorChildrenIds
              isNotClient={isNotClient}
              parentId={blockId}
              position={1}
              childrenIds={columns?.[1]?.childrenIds}
              onChange={(change) => updateColumn(1, change)}
            />,
            <EditorChildrenIds
              isNotClient={isNotClient}
              parentId={blockId}
              position={2}
              childrenIds={columns?.[2]?.childrenIds}
              onChange={(change) => updateColumn(2, change)}
            />,
          ]}
        />
      </>
    );
  }
  return (
    <ClientOnly>
      <BaseColumnsContainer
        blockId={blockId}
        props={restProps as any}
        style={style}
        columns={[
          <EditorChildrenIds
            parentId={blockId}
            position={0}
            childrenIds={columns?.[0]?.childrenIds}
            onChange={(change) => updateColumn(0, change)}
          />,
          <EditorChildrenIds
            parentId={blockId}
            position={1}
            childrenIds={columns?.[1]?.childrenIds}
            onChange={(change) => updateColumn(1, change)}
          />,
          <EditorChildrenIds
            parentId={blockId}
            position={2}
            childrenIds={columns?.[2]?.childrenIds}
            onChange={(change) => updateColumn(2, change)}
          />,
        ]}
      />
    </ClientOnly>
  );
}
