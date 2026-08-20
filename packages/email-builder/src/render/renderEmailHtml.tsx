import React from 'react';
import { renderToStaticMarkup as baseRenderToStaticMarkup } from 'react-dom/server';

import { buildGoogleFontsHref, collectDocumentFonts } from '@eb/document-core';

import type { EmailLayoutProps } from '../blocks/EmailLayout/EmailLayoutPropsSchema';
import Reader, { type TReaderDocument } from '../Reader/core';

import cleanDocument from './cleanDocument';
import { globalsStyles } from './globalsStyles';

export type RenderEmailHtmlOptions = {
  rootBlockId: string;
};

/**
 * Serialize an email document to a self-contained HTML string ready for
 * an email service. This is the pure, Node-safe core of the HTML export
 * — no `ClientOnly`, no editor, no Zustand, no DOM. It runs in a plain
 * Node process via `react-dom/server` and is the function the external
 * MCP / automated flows consume through `@eb/email-builder/node`.
 *
 * The editor's `renderToStaticMarkup` wraps this in `ClientOnly` for the
 * browser HTML tab; everything else (the markup, the CSS) is identical.
 *
 * The export always renders the desktop shell. `cleanDocument`'s base
 * CSS pass uses `'desktop'`; its `@media (max-width: 640px)` pass keeps
 * handling mobile, so clients that strip `<style>` (Outlook desktop)
 * still render correctly while clients honouring media queries pick up
 * the mobile overrides.
 */
export function renderEmailHtml(
  document: TReaderDocument,
  { rootBlockId }: RenderEmailHtmlOptions,
): string {
  const { cleanedDocument, css } = cleanDocument(document, { viewport: 'desktop' });

  // Subset Google Fonts to only the faces this document actually uses, so
  // the export doesn't pull ~28 unused families. `null` when the document
  // uses only system stacks (MODERN_SANS / inherit) — we then omit the
  // <link> entirely.
  const fontsHref = buildGoogleFontsHref(collectDocumentFonts(document));

  return (
    '<!DOCTYPE html>' +
    baseRenderToStaticMarkup(
      <html lang="en">
        <head>
          {fontsHref ? <link href={fontsHref} rel="stylesheet" /> : null}
          <style
            dangerouslySetInnerHTML={{
              __html: `${css}`,
            }}
          />
          <style
            dangerouslySetInnerHTML={{
              __html: `${globalsStyles}`,
            }}
          />
          <title>emailbuilder.online</title>
        </head>
        <body
          style={{
            width: '100%',
            margin: '0',
            padding: '0',
            backgroundColor:
              (document?.root?.data as EmailLayoutProps | undefined)?.backdropColor ?? '#f4f4f4',
          }}
        >
          <table
            role="presentation"
            style={{
              width: '100%',
              height: '100%',
              border: '0',
            }}
          >
            <tbody>
              <tr>
                <td align="center" valign="middle" style={{ padding: '0' }}>
                  <table
                    role="presentation"
                    style={{
                      maxWidth: '600px',
                      width: '100%',
                      border: '0',
                    }}
                  >
                    <tr>
                      <td>
                        <Reader
                          document={cleanedDocument}
                          rootBlockId={rootBlockId}
                          viewport="desktop"
                        />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>,
    ).replace(
      /<div style="position:relative">\s*<button\s+class="MuiButtonBase-root\b.*?>.*?<\/button>.*?<\/div>/gs,
      '',
    )
  );
}

export default renderEmailHtml;
