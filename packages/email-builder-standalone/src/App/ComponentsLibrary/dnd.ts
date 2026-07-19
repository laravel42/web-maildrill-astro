/**
 * dnd.ts — runtime constants and types for the Components Library
 * drag-and-drop integration. Kept in a leaf module (no React, no MUI, no
 * editor-state imports) so that drop targets in the editor (such as
 * `EditorChildrenIds` and `EditorBlockWrapper`) can import the DnD type
 * without dragging the whole Components Library UI tree into their
 * module graph — that load-order cycle would leave their `export default`
 * unresolved during the first pass of `core.tsx`.
 */

/** Drag-and-drop type for cards rendered by the Components Library drawer.
 * Distinct from the existing `'block'` type used by the canvas drag-handle
 * so the same drop targets can branch on `monitor.getItemType()`. */
export const LIBRARY_COMPONENT_DND_TYPE = 'library-component' as const;

/** Category of the dragged library item. Drop targets branch on this:
 *
 *   - `block`: built-in basic block (Text, Button, Image, …) — instantiated
 *     fresh from `BUTTONS` client-side, never fetched from the backend.
 *   - `block-preset`: built-in styled variant of one of the six primitive
 *     types (Button, Divider, Image, NotionText, SocialMedia, Spacer) —
 *     instantiated fresh from `PRIMITIVES` (`primitivesCatalog.ts`)
 *     client-side, never fetched. Rendered as exclusive accordions below
 *     the plain tiles in the Blocks tab. Distinct from `primitive` (the
 *     fetched/saved backend category) to avoid conflating the two.
 *   - `primitive | layout | section`: inline insert (sibling/append).
 *   - `template`: must be dropped on the document-root drop zone; replaces
 *     the current document with a confirmation modal (see L42-309 Phase 9).
 */
export type LibraryComponentCategory = 'block' | 'block-preset' | 'primitive' | 'layout' | 'section' | 'template';

/**
 * The subset of `LibraryComponentCategory` that identifies a saved item
 * fetched by `(axis, id)` — i.e. everything except the synthetic
 * `'block'` / `'block-preset'` categories. `fetchSavedSubtree`,
 * `RenameSubtreeTarget`, and the hover-preview descriptor all key off
 * this narrower type since built-in blocks and presets are never
 * fetched, renamed, or hover-previewed through those paths
 * (`BlocksCategoryContent` handles them directly).
 */
export type FetchableLibraryCategory = Exclude<LibraryComponentCategory, 'block' | 'block-preset'>;

/** Drag-item payload emitted by every saved-component card. The full
 * NDJSON is fetched lazily on drop, so the payload only needs to
 * identify the file via `(category, axis, id)`:
 *
 *   - `axis` is the on-disk sub-directory: `role` for sections, `type`
 *     for primitives, `shape` for layouts. Templates have no axis,
 *     pass `''`.
 *   - `id` is the server-minted UUID v4 (L42-307).
 */
export type LibraryComponentDragItem = {
  kind: typeof LIBRARY_COMPONENT_DND_TYPE;
  category: LibraryComponentCategory;
  axis: string;
  id: string;
};

/**
 * Drag-item payload for the built-in Blocks tab. These tiles are
 * synthetic — not saved components fetched by id — so instead of
 * `(axis, id)` they carry the index into `BUTTONS` (the shared block
 * factory list, see `builtInBlocks.ts`). Drop targets branch on
 * `category === 'block'` and read `buttonIndex` to call
 * `BUTTONS[buttonIndex].block()` for a fresh block instance.
 */
export type BuiltInBlockDragItem = {
  kind: typeof LIBRARY_COMPONENT_DND_TYPE;
  category: 'block';
  buttonIndex: number;
};

/**
 * Drag-item payload for a Blocks-tab accordion preset. Carries the
 * index into `PRIMITIVES` (`primitivesCatalog.ts`) instead of `(axis,
 * id)` — same rationale as `BuiltInBlockDragItem`, these tiles are
 * synthetic client-side variants, never fetched.
 */
export type BuiltInPresetDragItem = {
  kind: typeof LIBRARY_COMPONENT_DND_TYPE;
  category: 'block-preset';
  presetIndex: number;
};
