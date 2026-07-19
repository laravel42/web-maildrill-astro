import React from 'react';

import { ColumnsContainer as BaseColumnsContainer } from '@eb/block-columns-container';

import { ReaderBlock } from '../../Reader/core';

import { ColumnsContainerProps } from './ColumnsContainerPropsSchema';

export default function ColumnsContainerReader({
  style,
  props,
  blockId,
}: ColumnsContainerProps & { blockId?: string }) {
  const { columns, ...restProps } = props ?? {};
  let cols = undefined;
  if (columns) {
    cols = (columns as Array<{ childrenIds: string[] }>).map((col) =>
      col.childrenIds.map((childId) => (
        <React.Fragment key={childId}>
          <ReaderBlock id={childId} />
        </React.Fragment>
      ))
    );
  }

  return <BaseColumnsContainer blockId={blockId} props={restProps as any} columns={cols} style={style} />;
}
