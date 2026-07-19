import React from 'react';

import { renderEmailHtml, type TReaderDocument } from '@eb/email-builder';

import ClientOnly from '../../documents/editor/ClientOnly';

type TOptions = {
  rootBlockId: string;
};

/**
 * Browser HTML export. Delegates to the pure, Node-safe `renderEmailHtml`
 * from `@eb/email-builder` (the same function the MCP consumes via
 * `@eb/email-builder/node`) and wraps the resulting string in
 * `ClientOnly` so it only materializes after hydration in the editor —
 * preserving the previous SSR-guard behaviour of the HTML tab.
 *
 * All rendering logic (the desktop shell, `cleanDocument`'s CSS, the
 * `<head>` resets) lives in `renderEmailHtml`; this wrapper exists purely
 * for the editor's client-only constraint.
 */
export default function renderToStaticMarkup(document: TReaderDocument, { rootBlockId }: TOptions) {
  return <ClientOnly>{renderEmailHtml(document, { rootBlockId })}</ClientOnly>;
}
