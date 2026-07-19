import React from 'react';

import { Container as BaseContainer } from '@eb/block-container';

import { ReaderBlock } from '../../Reader/core';

import { ContainerProps } from './ContainerPropsSchema';

export default function ContainerReader({ style, props, blockId }: ContainerProps) {
  const childrenIds = props?.childrenIds ?? [];
  return (
    <BaseContainer style={style} blockId={`${blockId}`}>
      {childrenIds.map((childId) => (
        <React.Fragment key={childId}>
          <ReaderBlock id={childId} />
        </React.Fragment>
      ))}
    </BaseContainer>
  );
}
