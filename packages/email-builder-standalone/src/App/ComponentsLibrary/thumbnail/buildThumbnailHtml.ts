/**
 * Build a complete HTML document suitable for iframe rendering of a
 * library subtree (Section / Layout / Template / Primitive / Theme).
 *
 * The HTML is produced by the existing `renderToStaticMarkup` helper
 * (the same one used for the editor's HTML export tab and the AI
 * preview panel). Two cases:
 *
 *   - Templates: `rootBlockId === 'root'` and `document.root.type === 'EmailLayout'`.
 *     Pass through to renderer as-is.
 *
 *   - Subtrees (Sections / Layouts / Primitives): the `document` map
 *     does NOT have a 'root' EmailLayout because the saved subtree
 *     wasn't a full template. We synthesise a minimal EmailLayout
 *     wrapping the actual root block id so the renderer's contract
 *     ("render `'root'`") still holds. The synthetic layout uses the
 *     current editor's backdrop/canvas colours when available so the
 *     captured thumbnail matches what the user is editing.
 *
 *   - Themes: callers should apply the theme bundle to a cloned
 *     current document BEFORE calling this helper. We don't reach
 *     into the theme system here — the theme application logic lives
 *     in EditorContext.
 *
 * The returned HTML is a complete `<!DOCTYPE html><html>...</html>`
 * document ready for `<iframe srcdoc={...}>` mounting.
 */

import type { TReaderDocument } from '@eb/email-builder';

import renderToStaticMarkup from '../../TemplatePanel/renderToStaticMarkup';

/**
 * Backdrop fallback when no current document is available (e.g. a
 * direct call from a script). Matches the editor's default.
 */
const FALLBACK_BACKDROP = '#f4f4f4';
const FALLBACK_CANVAS = '#ffffff';

/**
 * Local placeholder for empty containers/columns — a plain 600×120
 * light-grey rectangle, encoded as a data URI SVG.
 *
 * Was `https://placehold.co/600x120@2x/F0F0F0/BBB?text=%C2%A0` (a real
 * network request). During the lazy thumbnail generator's pass over
 * the seeded local catalog (114 items; ~106 empty containers/columns
 * across them, confirmed by inspecting localPresets.data.json), every
 * placeholder fired its own request to placehold.co — that's the bulk
 * of the ~260 requests and multi-minute stall reported when opening
 * the editor, not the per-capture iframe timeout (already addressed
 * separately). A same-document data URI has zero network latency and
 * renders identically (same fill colour, same size).
 */
const PLACEHOLDER_IMAGE_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><rect width="600" height="120" fill="%23F0F0F0"/></svg>'
  );

/**
 * Inject placeholder Image blocks into empty containers/columns so
 * layout previews show visible structure instead of collapsing to 0px.
 */
export function injectPlaceholders(document: TReaderDocument): TReaderDocument {
  const result = { ...document };
  let placeholderIdx = 0;

  const makePlaceholder = (): TReaderDocument[string] =>
    ({
      type: 'Image',
      data: {
        style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
        props: { url: PLACEHOLDER_IMAGE_DATA_URI },
      },
    }) as unknown as TReaderDocument[string];

  for (const [id, block] of Object.entries(result)) {
    if (!block || typeof block !== 'object') continue;
    const data = (block as { data?: Record<string, unknown> }).data;
    if (!data) continue;

    const props = data.props as Record<string, unknown> | undefined;
    if (!props) continue;

    // Container with empty childrenIds
    if (Array.isArray(props.childrenIds) && (props.childrenIds as string[]).length === 0) {
      const phId = `__ph_${placeholderIdx++}`;
      result[phId] = makePlaceholder();
      result[id] = {
        ...block,
        data: { ...data, props: { ...props, childrenIds: [phId] } },
      } as TReaderDocument[string];
    }

    // ColumnsContainer with empty columns
    if (Array.isArray(props.columns)) {
      const columns = props.columns as Array<{ childrenIds?: string[] }>;
      let modified = false;
      const newColumns = columns.map((col) => {
        if (Array.isArray(col.childrenIds) && col.childrenIds.length === 0) {
          const phId = `__ph_${placeholderIdx++}`;
          result[phId] = makePlaceholder();
          modified = true;
          return { ...col, childrenIds: [phId] };
        }
        return col;
      });
      if (modified) {
        result[id] = {
          ...block,
          data: { ...data, props: { ...props, columns: newColumns } },
        } as TReaderDocument[string];
      }
    }
  }

  return result;
}

/**
 * Extract the HTML string from the `ClientOnly` React Element that
 * `renderToStaticMarkup` returns. The renderer wraps the literal HTML
 * string in `<ClientOnly>{html}</ClientOnly>` so its children prop is
 * the raw string. Same trick used by `index.tsx`'s `getHtml()` API.
 */
function extractHtmlString(element: ReturnType<typeof renderToStaticMarkup>): string {
  const children = (element as { props?: { children?: unknown } }).props?.children;
  return typeof children === 'string' ? children : '';
}

/**
 * Build HTML for a SUBTREE — `rootBlockId` points at a Container,
 * ColumnsContainer, or single Primitive block. We wrap it in a
 * synthetic EmailLayout so the renderer's "render `'root'`" contract
 * holds. The synthetic layout copies background colours from the
 * caller's current EmailLayout so the captured PNG matches what the
 * user sees in the canvas.
 *
 * `document` must contain entries for `rootBlockId` and any descendants.
 * Missing descendants are tolerated by the renderer (skipped silently).
 */
export function buildSubtreeHtml(
  document: TReaderDocument,
  rootBlockId: string,
  options?: {
    backdropColor?: string;
    canvasColor?: string;
    /**
     * Live EmailLayout root `data` (document globals + `theme`). When
     * provided, it is spread onto the synthetic EmailLayout so the
     * previewed subtree inherits the project globals (textColor,
     * fontFamily, linkGlobal, theme…) and resolves the theme exactly
     * like the live canvas. Callers that want the theme to win must
     * pre-clean the blocks with `stripBlockStylesForTheme`. Omit (e.g.
     * save-time thumbnail capture) to render the subtree as saved.
     */
    rootData?: Record<string, unknown>;
  }
): string {
  // If the document already roots at an EmailLayout (Template path),
  // pass through unchanged — templates carry their own theme.
  const existingRoot = document['root'];
  if (existingRoot && existingRoot.type === 'EmailLayout' && rootBlockId === 'root') {
    return extractHtmlString(renderToStaticMarkup(document, { rootBlockId: 'root' }));
  }

  // Synthetic EmailLayout that points at the real root. When `rootData`
  // is supplied, inherit the full document globals; otherwise fall back
  // to the explicit backdrop/canvas (or defaults).
  const syntheticRootData: Record<string, unknown> = options?.rootData
    ? {
        ...options.rootData,
        backdropColor:
          (options.rootData.backdropColor as string | undefined) ?? options.backdropColor ?? FALLBACK_BACKDROP,
        canvasColor: (options.rootData.canvasColor as string | undefined) ?? options.canvasColor ?? FALLBACK_CANVAS,
        childrenIds: [rootBlockId],
      }
    : {
        backdropColor: options?.backdropColor ?? FALLBACK_BACKDROP,
        canvasColor: options?.canvasColor ?? FALLBACK_CANVAS,
        childrenIds: [rootBlockId],
      };

  const syntheticDocument: TReaderDocument = injectPlaceholders({
    ...document,
    root: {
      type: 'EmailLayout',
      data: syntheticRootData,
    } as TReaderDocument['root'],
  });

  return extractHtmlString(renderToStaticMarkup(syntheticDocument, { rootBlockId: 'root' }));
}

/**
 * Convenience: build HTML for a single block (Primitive). Equivalent
 * to `buildSubtreeHtml` but explicitly named for the inline-render
 * path used by `LibraryCardPrimitiveRender`.
 */
export function buildPrimitiveHtml(
  block: { id: string; block: unknown },
  options?: { backdropColor?: string; canvasColor?: string; rootData?: Record<string, unknown> }
): string {
  const doc: TReaderDocument = {
    [block.id]: block.block as TReaderDocument[string],
  } as TReaderDocument;
  return buildSubtreeHtml(doc, block.id, options);
}
