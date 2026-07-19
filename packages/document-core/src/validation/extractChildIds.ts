import type { TEditorBlock } from '../schemas';

/**
 * Extract all childrenIds from a block. Covers the three shapes used:
 *
 *   - `EmailLayout`      — `data.childrenIds`
 *   - `Container`        — `data.props.childrenIds`
 *   - `ColumnsContainer` — `data.props.columns[*].childrenIds`
 */
export function extractAllChildIds(block: TEditorBlock): string[] {
  const data = block.data as
    | {
        childrenIds?: unknown;
        props?: {
          childrenIds?: unknown;
          columns?: Array<{ childrenIds?: unknown } | null | undefined> | unknown;
        };
      }
    | undefined;

  const ids: string[] = [];

  const rootLevel = data?.childrenIds;
  if (Array.isArray(rootLevel)) {
    for (const id of rootLevel) if (typeof id === 'string') ids.push(id);
  }

  const propsLevel = data?.props?.childrenIds;
  if (Array.isArray(propsLevel)) {
    for (const id of propsLevel) if (typeof id === 'string') ids.push(id);
  }

  const columns = data?.props?.columns;
  if (Array.isArray(columns)) {
    for (const col of columns) {
      if (col && typeof col === 'object' && Array.isArray((col as { childrenIds?: unknown }).childrenIds)) {
        for (const id of (col as { childrenIds: unknown[] }).childrenIds) {
          if (typeof id === 'string') ids.push(id);
        }
      }
    }
  }

  return ids;
}
