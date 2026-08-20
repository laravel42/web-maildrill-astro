import React, { memo, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import { atomicUpdateBlock } from '../../../documents/editor/blockUpdaters';
import { TEditorBlock } from '../../../documents/editor/core';
import { useBlock, useSelectedBlockId } from '../../../documents/editor/EditorContext';

import ButtonSidebarPanel from './input-panels/ButtonSidebarPanel';
import ColumnsContainerSidebarPanel from './input-panels/ColumnsContainerSidebarPanel';
import ContainerSidebarPanel from './input-panels/ContainerSidebarPanel';
import DividerSidebarPanel from './input-panels/DividerSidebarPanel';
import EmailLayoutSidebarPanel from './input-panels/EmailLayoutSidebarPanel';
import ImageSidebarPanel from './input-panels/ImageSidebarPanel';
import NotionTextSidebarPanel from './input-panels/NotionTextSidebarPanel';
import { SocialMediaSidebarPanel } from './input-panels/SocialSidebarPanel';
import SpacerSidebarPanel from './input-panels/SpacerSidebarPanel';

function renderMessage(val: string) {
  return (
    <Box sx={{ m: 3, p: 1, border: '1px dashed', borderColor: 'divider' }}>
      <Typography color="text.secondary">{val}</Typography>
    </Box>
  );
}

function ConfigurationPanelInner() {
  const selectedBlockId = useSelectedBlockId();
  const block = useBlock(selectedBlockId || '');

  const setBlock = useCallback(
    (conf: TEditorBlock) => {
      if (!selectedBlockId) return;
      atomicUpdateBlock(selectedBlockId, () => conf);
    },
    [selectedBlockId],
  );

  // When no block is selected the inspector falls back to the StylesPanel
  // tab (`'styles'`), which renders the root EmailLayout fields plus the
  // document Theme overrides — see Phase 2c notes in StylesPanel.tsx. This
  // branch only triggers on transient races (e.g. a block was deleted
  // while ConfigurationPanel was the active sidebar tab).
  if (!selectedBlockId) {
    return renderMessage('Click on a block to inspect.');
  }

  if (!block) {
    return renderMessage(
      `Block with id ${selectedBlockId} was not found. Click on a block to reset.`,
    );
  }

  const { data, type } = block;

  switch (type) {
    case 'Button':
      return (
        <ButtonSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    case 'ColumnsContainer':
      return (
        <ColumnsContainerSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
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
    case 'Image':
      return (
        <ImageSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    case 'EmailLayout':
      return (
        <EmailLayoutSidebarPanel
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
    case 'NotionText':
      return (
        <NotionTextSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    case 'SocialMedia':
      return (
        <SocialMediaSidebarPanel
          key={selectedBlockId}
          data={data}
          setData={(data) => setBlock({ type, data })}
        />
      );
    default:
      return <pre>{JSON.stringify(block, null, '  ')}</pre>;
  }
}

// Memoizar para evitar re-renders cuando no cambia el bloque seleccionado
const ConfigurationPanel = memo(ConfigurationPanelInner);
export default ConfigurationPanel;
