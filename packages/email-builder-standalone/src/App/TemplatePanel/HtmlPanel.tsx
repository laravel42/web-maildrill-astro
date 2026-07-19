import React, { useMemo } from 'react';

import { TReaderDocument } from '@eb/email-builder';

import { useDocument } from '../../documents/editor/EditorContext';

import HighlightedCodePanel from './helper/HighlightedCodePanel';
import renderToStaticMarkup from './renderToStaticMarkup';

export default function HtmlPanel() {
  const document = useDocument();

  const code = useMemo(() => renderToStaticMarkup(document as TReaderDocument, { rootBlockId: 'root' }), [document]);

  return (
    <div style={{ width: '100%', margin: '0 auto' }}>
      <HighlightedCodePanel type="html" value={code?.props.children} />
    </div>
  );
}
