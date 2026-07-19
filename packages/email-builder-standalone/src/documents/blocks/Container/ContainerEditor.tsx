import React from 'react';

import { Container as BaseContainer } from '@eb/block-container';

import ClientOnly from '../../editor/ClientOnly';
import { useCurrentBlockId } from '../../editor/EditorBlock';
import { insertChildAndUpdateParent, setSelectedBlockId } from '../../editor/EditorContext';
import EditorChildrenIds from '../helpers/EditorChildrenIds';
import EditorChildrenIdsNoDragable from '../helpers/EditorChildrenIds/EditorChildrenNoDragable';

import { ContainerProps } from './ContainerPropsSchema';

export default function ContainerEditor({ style, props, blockId, isNotClient }: ContainerProps) {
  const childrenIds = props?.childrenIds ?? [];
  const currentBlockId = useCurrentBlockId();

  return (
    <BaseContainer style={style} blockId={`${blockId}`}>
      {isNotClient ? (
        <EditorChildrenIdsNoDragable
          parentId={blockId}
          childrenIds={childrenIds}
          onChange={({ block, blockId, childrenIds }) => {
            insertChildAndUpdateParent(currentBlockId, blockId, block, childrenIds);
            setSelectedBlockId(blockId);
          }}
        />
      ) : (
        <ClientOnly>
          <EditorChildrenIds
            parentId={blockId}
            childrenIds={childrenIds}
            onChange={({ block, blockId, childrenIds }) => {
              insertChildAndUpdateParent(currentBlockId, blockId, block, childrenIds);
              setSelectedBlockId(blockId);
            }}
          />
        </ClientOnly>
      )}
    </BaseContainer>
  );
}
