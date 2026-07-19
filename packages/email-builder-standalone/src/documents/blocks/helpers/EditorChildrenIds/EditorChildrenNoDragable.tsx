import React, { Fragment } from 'react';

import { TEditorBlock } from '../../../editor/core';
import EditorBlock from '../../../editor/EditorBlock';

export type EditorChildrenChange = {
  blockId: string;
  block: TEditorBlock;
  childrenIds: string[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateId() {
  return `block-${Date.now()}`;
}
export type EditorChildrenIdsProps = {
  childrenIds: string[] | null | undefined;
  onChange: (val: EditorChildrenChange) => void;
  parentId: string;
  position?: number;
};

export default function EditorChildrenIdsNoDragable({ childrenIds }: EditorChildrenIdsProps) {
  return (
    <>
      {childrenIds.map((childId) => (
        <Fragment key={childId}>
          <EditorBlock isNotClient={true} id={childId} />
        </Fragment>
      ))}
    </>
  );
}
