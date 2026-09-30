/**
 * Base first-run site (chain F29, W2, D-F29.10) — a deliberately tiny seed
 * for a host that has nothing saved and no `?template=` request: one
 * container holding a text and an image, exactly what a visitor gets by
 * dragging those three components from the palette.
 *
 * This is a package-side CONTENT helper, not a registry layout
 * (`layoutRegistry.ts`'s `PageLayoutDefinition`): both `TemplatesPanel.tsx`
 * and `scripts/dump-template-catalog.mjs` (the host's build-time catalog
 * generator) filter page layouts by `category === "page"` with no
 * exclusion mechanism, so registering this as a layout would make it
 * appear in the in-editor Templates panel and become a 19th public
 * `/templates/<slug>` page — neither of which this seed is. Nothing here
 * decides WHEN to seed; that condition (no stored site AND no
 * `?template=`) is the host's to evaluate, because nothing inside this
 * package can see the URL or the host's storage key.
 *
 * Built with the registry's own node factory (`createNodeForType`) so the
 * three nodes — container, text, image — carry exactly the registry's
 * `defaultProps`/`defaultStyle`, byte-for-byte what a drag from the palette
 * produces. No hand-written styles, no invented copy — with one deliberate
 * exception (chain F29, W2b): `imageDefinition.defaultProps.source.url` is
 * the remote `https://placehold.co/300x160` (`registry/components/Image.tsx`),
 * and this seed overrides that ONE field to `BASE_IMAGE_SOURCE_URL` below, a
 * self-contained inline SVG data url. A first-run canvas — the first thing a
 * new visitor ever sees, on a static host with no guaranteed network — must
 * not depend on a third-party image service. The `image` component's own
 * `defaultProps` are untouched, so a visitor dragging an image from the
 * palette still gets the registry's remote placeholder; that is a separate
 * product decision, out of scope here. `imageDefinition.defaultProps.alt`
 * is `""` (no default alt text), so this seed also sets `alt` to the
 * literal `"Placeholder image"` — everything else, including `objectFit`
 * and `loading`, stays byte-for-byte the registry default.
 */

import { createNodeForType } from "./registry/componentRegistry";
import { createSiteFromDocument } from "./model/site";
import type { BuilderDocument, BuilderSite } from "./model/types";

/**
 * A 300×160 neutral placeholder (a filled rect, a "sun" circle and a
 * mountain-fold path — no text), inlined as an SVG data url so the
 * first-run canvas decodes it with zero network requests. Kept as plain,
 * readable XML (not base64) so a reader can see exactly what ships.
 */
const BASE_IMAGE_SOURCE_URL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='160' viewBox='0 0 300 160'><rect width='300' height='160' fill='%23e8eaed'/><circle cx='76' cy='46' r='18' fill='%23c9cdd2'/><path d='M0 130l70-58 46 38 52-44 62 52v22z' fill='%23c9cdd2'/></svg>";

/**
 * Root → one container → [text, image]. Four nodes total: the document
 * ROOT (itself a `container`, same shape as `createEmptyDocument()`'s) is
 * a distinct node from the CHILD container the visitor can delete in one
 * action — `removeNode` refuses to delete `doc.rootId`
 * (`model/tree.ts:174`), so the deletable example has to be the root's
 * child, never the root itself. This mirrors what `wrapPageRootBands`
 * gives every template (`registry/layoutRegistry.ts`, divergence #26 in
 * `packages/VENDOR.md`): a page root whose only child is the wrapper that
 * clears the whole example.
 */
function createBaseDocument(): BuilderDocument {
  const root = createNodeForType("container");
  const container = createNodeForType("container");
  const text = createNodeForType("text");
  const image = createNodeForType("image");
  // Override ONLY the source url (self-contained SVG, not the registry's
  // remote placehold.co) and the alt (the registry default is "", empty)
  // — see the module header. Everything else on `image.props` stays the
  // registry default: `objectFit: "cover"`, `loading: "lazy"`. `props` is
  // untyped (`Record<string, unknown>`, same as `readImageSource` reads
  // it in `model/assets.ts`), so the source is narrowed with the same
  // `{ kind: "url"; url: string }` shape as `ImageSource`.
  (image.props.source as { kind: "url"; url: string }).url = BASE_IMAGE_SOURCE_URL;
  image.props.alt = "Placeholder image";
  container.children = [text.id, image.id];
  root.children = [container.id];

  return {
    rootId: root.id,
    meta: { version: 1 },
    nodes: {
      [root.id]: root,
      [container.id]: container,
      [text.id]: text,
      [image.id]: image,
    },
  };
}

/**
 * A single-page `BuilderSite` wrapping the base document above. The host
 * passes `createBaseSite()` as the editor's `site` prop on a genuine first
 * run (no stored site, no `?template=`) — see `EditorApp.tsx`.
 */
export function createBaseSite(): BuilderSite {
  return createSiteFromDocument(createBaseDocument());
}
