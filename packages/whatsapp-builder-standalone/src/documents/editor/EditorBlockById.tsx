import React from 'react';

import type { SectionType } from '../schemas';
import { EditorBlock } from './core';
import { useBlock } from './EditorContext';
import SectionWrapper from './SectionWrapper';

/**
 * Store-connected block renderer — the analogue of the email builder's
 * `EditorBlock.tsx`: subscribes to `document[id]` and renders the
 * dictionary component, wrapped in the section chrome (except the root,
 * which owns the bubble and is not itself selectable/removable).
 */
export default function EditorBlockById({ id }: { id: string }) {
  const block = useBlock(id);
  if (!block) return null;

  if (block.type === 'WhatsAppMessage') {
    return <EditorBlock type={block.type} data={block.data} blockId={id} isNotClient />;
  }

  // After excluding the root, TS treats `type` and `data` as independent
  // union members, so the exact-pair BlockConfiguration<T> isn't inferred
  // through the destructured spread. The pair is correct by construction
  // (it came straight out of the validated document record).
  const blockProps = block as React.ComponentProps<typeof EditorBlock>;

  return (
    <SectionWrapper blockId={id} type={block.type as SectionType}>
      <EditorBlock {...blockProps} blockId={id} isNotClient />
    </SectionWrapper>
  );
}
