import React from 'react';

import { useBlock, useSelectedBlockId } from '../../documents/editor/EditorContext';
import BodySidebarPanel from './panels/BodySidebarPanel';
import ButtonsSidebarPanel from './panels/ButtonsSidebarPanel';
import FooterSidebarPanel from './panels/FooterSidebarPanel';
import HeaderSidebarPanel from './panels/HeaderSidebarPanel';
import MessageSidebarPanel from './panels/MessageSidebarPanel';

/**
 * Panel picker — the same hardcoded `switch (block.type)` pattern as
 * the email builder's ConfigurationPanel. No selection (or the root
 * selected) shows the message-level panel: language, category and the
 * live validation summary.
 */
export default function ConfigurationPanel() {
  const selectedBlockId = useSelectedBlockId();
  const block = useBlock(selectedBlockId);

  if (!selectedBlockId || !block || block.type === 'WhatsAppMessage') {
    return <MessageSidebarPanel />;
  }

  switch (block.type) {
    case 'Header':
      return <HeaderSidebarPanel key={selectedBlockId} blockId={selectedBlockId} data={block.data} />;
    case 'Body':
      return <BodySidebarPanel key={selectedBlockId} blockId={selectedBlockId} data={block.data} />;
    case 'Footer':
      return <FooterSidebarPanel key={selectedBlockId} blockId={selectedBlockId} data={block.data} />;
    case 'Buttons':
      return <ButtonsSidebarPanel key={selectedBlockId} blockId={selectedBlockId} data={block.data} />;
    default:
      return <MessageSidebarPanel />;
  }
}
