/**
 * Synthetic IDs for Component Tree rows that represent a ColumnsContainer column
 * (not real document blocks). Parsed by changeBlockPosition / isChildOf.
 */
export const COMPONENT_TREE_COLUMN_SLOT_PREFIX = 'eb-component-tree-column:';

export function makeComponentTreeColumnSlotId(parentBlockId: string, columnIndex: number): string {
  return `${COMPONENT_TREE_COLUMN_SLOT_PREFIX}${parentBlockId}:${columnIndex}`;
}

export function parseComponentTreeColumnSlotId(id: string): { parentBlockId: string; columnIndex: number } | null {
  if (!id.startsWith(COMPONENT_TREE_COLUMN_SLOT_PREFIX)) return null;
  const rest = id.slice(COMPONENT_TREE_COLUMN_SLOT_PREFIX.length);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const parentBlockId = rest.slice(0, lastColon);
  const columnIndex = Number(rest.slice(lastColon + 1));
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex > 2) return null;
  return { parentBlockId, columnIndex };
}
