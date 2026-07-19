/**
 * Discriminator that resolves which Components Library category a
 * subtree belongs to, given a root block id and the current document
 * map. The classification rules (all four categories) are kept intact
 * even though only `'section'` currently has a save path — the result
 * drives:
 *
 * - `TuneMenu`: whether the "Save to library" action is enabled (only
 *   for `'section'`, since library-first-block-insertion).
 * - `SaveSubtreeDialog`: safety-net re-check before POSTing.
 *
 * The rules:
 *
 *   root.type === EmailLayout                                              → 'template'
 *   root.type ∈ {Container, ColumnsContainer} ∧ every descendant in set    → 'layout'
 *   root.type ∈ {Container, ColumnsContainer} ∧ ≥1 descendant outside set  → 'section'
 *   root.type ∉ {Container, ColumnsContainer, EmailLayout}                 → 'primitive'
 *
 * "Layout" is recursive: nested empty Containers / Columns still
 * qualify because the "every descendant in set" clause is vacuously
 * true for empty subtrees.
 */

import type { TEditorBlock, TEditorConfiguration } from './core';

export type SubtreeCategory = 'primitive' | 'layout' | 'section' | 'template';

const STRUCTURAL_TYPES = new Set(['Container', 'ColumnsContainer']);

/**
 * Walk every reachable id starting at `rootId` (excluding the root
 * itself), via `childrenIds` and `columns[].childrenIds`. Cycles are
 * guarded with a `visited` set; missing references are skipped.
 */
function collectDescendantIds(rootId: string, document: TEditorConfiguration): string[] {
  const out: string[] = [];
  const visited = new Set<string>([rootId]);
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const block = document[id];
    if (!block) continue;

    const propsContainer = (block.data as { props?: Record<string, unknown> } | undefined)?.props;
    const childrenIds = (propsContainer as { childrenIds?: unknown } | undefined)?.childrenIds;
    if (Array.isArray(childrenIds)) {
      for (const childId of childrenIds as unknown[]) {
        if (typeof childId === 'string' && !visited.has(childId)) {
          visited.add(childId);
          out.push(childId);
          queue.push(childId);
        }
      }
    }
    const columns = (propsContainer as { columns?: unknown } | undefined)?.columns;
    if (Array.isArray(columns)) {
      for (const col of columns as Array<{ childrenIds?: unknown }>) {
        if (Array.isArray(col.childrenIds)) {
          for (const childId of col.childrenIds as unknown[]) {
            if (typeof childId === 'string' && !visited.has(childId)) {
              visited.add(childId);
              out.push(childId);
              queue.push(childId);
            }
          }
        }
      }
    }
  }

  return out;
}

export function classifyBlockSubtree(rootId: string, document: TEditorConfiguration): SubtreeCategory {
  const root: TEditorBlock | undefined = document[rootId];
  if (!root) {
    throw new Error(`classifyBlockSubtree: root block "${rootId}" not found in document`);
  }

  if (root.type === 'EmailLayout') return 'template';

  if (!STRUCTURAL_TYPES.has(root.type)) return 'primitive';

  // Container or ColumnsContainer — inspect descendants.
  const descendants = collectDescendantIds(rootId, document);
  for (const id of descendants) {
    const block = document[id];
    if (!block) continue;
    if (!STRUCTURAL_TYPES.has(block.type)) return 'section';
  }
  return 'layout';
}
