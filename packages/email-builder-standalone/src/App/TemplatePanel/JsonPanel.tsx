import React, { useMemo } from 'react';

import { useDocument } from '../../documents/editor/EditorContext';

import HighlightedCodePanel from './helper/HighlightedCodePanel';

export default function JsonPanel() {
  const document = useDocument();
  const code = useMemo(() => JSON.stringify(document, null, '  '), [document]);
  return (
    <div style={{ width: '100%', margin: '0 auto' }}>
      <HighlightedCodePanel type="json" value={code} />
    </div>
  );
}
