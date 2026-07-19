// ---------------------------------------------------------------------------
// Node-safe entry point for @eb/email-builder.
//
// Exposes the HTML rendering surface used by server-side consumers (the
// external MCP project, automated flows): turn an email document (JSON)
// into a self-contained HTML string in a plain Node process via
// `react-dom/server`. React + react-dom are peer deps the consumer
// provides; zod is external too.
//
// This entry deliberately pulls in the React render tree (Reader + block
// components). It is "Node-safe" in the sense that nothing here touches
// the browser DOM, `window`, `localStorage`, or the editor's Zustand
// store — the block renderers were decoupled from the editor app for
// exactly this purpose. It is NOT React-free (unlike
// `@eb/document-core/node`).
// ---------------------------------------------------------------------------

export { renderEmailHtml } from './render/renderEmailHtml';
export type { RenderEmailHtmlOptions } from './render/renderEmailHtml';

export { default as cleanDocument } from './render/cleanDocument';
export { globalsStyles } from './render/globalsStyles';

export { default as Reader } from './Reader/core';
export type { TReaderBlock, TReaderDocument, TReaderProps } from './Reader/core';
