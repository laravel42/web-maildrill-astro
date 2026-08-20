import React, { useCallback } from 'react';

import { useBlock } from '../../documents/editor/blockHooks';
import { atomicUpdateBlock } from '../../documents/editor/blockUpdaters';
import { TEditorBlock } from '../../documents/editor/core';
import { useSelectedBlockId } from '../../documents/editor/EditorContext';
import ThemePanel from '../TemplatePanel/ThemePanel';

import ContainerSidebarPanel from './ConfigurationPanel/input-panels/ContainerSidebarPanel';
import DividerSidebarPanel from './ConfigurationPanel/input-panels/DividerSidebarPanel';
import SpacerSidebarPanel from './ConfigurationPanel/input-panels/SpacerSidebarPanel';

export default function StylesPanel() {
  const selectedBlockId = useSelectedBlockId();
  const block = useBlock(selectedBlockId ?? 'root');
  const setBlock = useCallback(
    (conf: TEditorBlock) => {
      if (selectedBlockId) {
        atomicUpdateBlock(selectedBlockId, () => conf);
      }
    },
    [selectedBlockId],
  );

  if (!block) return null;

  const { data, type } = block;

  switch (type) {
    case 'Container':
      return (
        <ContainerSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    case 'Divider':
      return (
        <DividerSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    case 'Spacer':
      return (
        <SpacerSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    case 'EmailLayout':
      // Root context view. `ThemePanel` owns everything: the panel
      // title, the Root accordion (global EmailLayout fields), the
      // per-block-type theme accordions and the optional version
      // footer. When the user explicitly selects another block, the
      // ConfigurationPanel takes over and this branch is no longer
      // rendered.
      return <ThemePanel />;
    default:
      return <pre>{JSON.stringify(block, null, '  ')}</pre>;
  }
}
