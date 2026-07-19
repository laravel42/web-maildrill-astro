import type { TEditorBlock, TEditorConfiguration } from '../../documents/editor/core';

/**
 * Outcome of {@link repairOrphanedBlocks}.
 *
 * `repaired` is a shallow clone of the input document with `root.childrenIds`
 * extended so every formerly-orphan top-level block becomes reachable from
 * the tree walk. `appendedRootChildren` lists the block ids that were added
 * in the order they were appended — the dialog surfaces them as warnings so
 * the user knows the LLM's output was auto-repaired.
 */
export type RepairResult = {
  repaired: TEditorConfiguration;
  appendedRootChildren: string[];
};

/**
 * Read every id referenced by a block's children. Mirrors the shapes
 * actually used across the EmailBuilder block schemas:
 *
 *   - `EmailLayout`          — `data.childrenIds`
 *   - `Container`            — `data.props.childrenIds`
 *   - `ColumnsContainer`     — `data.props.columns[*].childrenIds` (three
 *                              column slots)
 *
 * Non-string entries are filtered out defensively. Unknown block types fall
 * through and return `[]`.
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

/**
 * Append orphaned top-level blocks to `root.childrenIds` so they become part
 * of the rendered email instead of dangling in the document map.
 *
 * A block is considered an *orphan root* when:
 *
 *   1. It is not `root` itself.
 *   2. It is not reachable from `root.childrenIds` (via any of the three
 *      child shapes extracted by {@link extractAllChildIds}).
 *   3. No other block's `childrenIds` references it — otherwise it belongs
 *      to a parent that is itself orphaned, and attaching the parent will
 *      bring it along; attaching both would render the block twice.
 *
 * Orphan roots are appended in document-insertion order so the result is
 * deterministic. The original document is not mutated — a shallow clone is
 * returned with `root.data.childrenIds` replaced by a new array.
 *
 * When the document has no `root` (or `root` is not an `EmailLayout`), the
 * document is returned untouched and `appendedRootChildren` is empty; the
 * downstream validator handles that failure mode separately.
 */
export function repairOrphanedBlocks(doc: TEditorConfiguration): RepairResult {
  const root = doc.root;
  if (!root || root.type !== 'EmailLayout') {
    return { repaired: doc, appendedRootChildren: [] };
  }

  const rootData = root.data as { childrenIds?: unknown } | undefined;
  const currentRootChildren: string[] = Array.isArray(rootData?.childrenIds)
    ? (rootData!.childrenIds as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  // BFS from root to find every reachable block id.
  const reachable = new Set<string>(['root']);
  const queue: string[] = [...currentRootChildren];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const block = doc[id];
    if (!block) continue;
    for (const childId of extractAllChildIds(block)) {
      if (!reachable.has(childId)) queue.push(childId);
    }
  }

  // Build the set of all ids referenced by any block's children. Used to
  // distinguish "orphan roots" from "children of an orphan subtree".
  const referencedAnywhere = new Set<string>();
  for (const [id, block] of Object.entries(doc)) {
    if (id === 'root') {
      for (const childId of currentRootChildren) referencedAnywhere.add(childId);
      continue;
    }
    for (const childId of extractAllChildIds(block)) {
      referencedAnywhere.add(childId);
    }
  }

  // Collect orphan roots in document-insertion order. Dropping reachable
  // blocks and blocks referenced elsewhere leaves only the top of each
  // disconnected subtree.
  const orphanRoots: string[] = [];
  for (const id of Object.keys(doc)) {
    if (id === 'root') continue;
    if (reachable.has(id)) continue;
    if (referencedAnywhere.has(id)) continue;
    orphanRoots.push(id);
  }

  if (orphanRoots.length === 0) {
    return { repaired: doc, appendedRootChildren: [] };
  }

  // Rebuild the document with a new root.data.childrenIds. Shallow clone is
  // enough because we only replace the root block; the rest of the document
  // is handed back by reference.
  const nextChildren = [...currentRootChildren, ...orphanRoots];
  const repairedRoot: TEditorBlock = {
    ...root,
    data: {
      ...(root.data as object),
      childrenIds: nextChildren,
    },
  } as TEditorBlock;

  const repaired: TEditorConfiguration = {
    ...doc,
    root: repairedRoot,
  };

  return { repaired, appendedRootChildren: orphanRoots };
}

/** A `childrenIds` reference that pointed to a block not present in the doc. */
export type DroppedReference = { parent: string; missingId: string };

export type CleanResult = {
  cleaned: TEditorConfiguration;
  droppedReferences: DroppedReference[];
};

/**
 * Remove every `childrenIds` entry that points to a block id not present in
 * the document. The LLM occasionally lists top-level ids it never emits
 * (e.g. naming `block-12-1..3` for column children but referencing a
 * non-existent `block-12` as a sibling). Without cleaning, the validator
 * reports a missing-child error and Apply stays blocked.
 *
 * The cleaner is *surgical*: it only rewrites children arrays, never block
 * types or other props. It shallow-clones each block it touches and leaves
 * untouched blocks as-is. Blocks whose children arrays remain unchanged are
 * returned by reference.
 */
export function cleanDanglingReferences(doc: TEditorConfiguration): CleanResult {
  const existingIds = new Set(Object.keys(doc));
  const droppedReferences: DroppedReference[] = [];

  /** Split a candidate `childrenIds` array into kept and dropped. */
  const filterIds = (parent: string, ids: unknown[]): { kept: string[]; changed: boolean } => {
    const kept: string[] = [];
    let changed = false;
    for (const entry of ids) {
      if (typeof entry !== 'string') {
        changed = true;
        continue;
      }
      if (existingIds.has(entry)) {
        kept.push(entry);
      } else {
        droppedReferences.push({ parent, missingId: entry });
        changed = true;
      }
    }
    return { kept, changed };
  };

  const cleaned: TEditorConfiguration = {};

  for (const [id, block] of Object.entries(doc)) {
    const data = (block as { data?: unknown }).data as
      | {
          childrenIds?: unknown;
          props?: {
            childrenIds?: unknown;
            columns?: unknown;
          };
        }
      | undefined;

    let nextBlock: TEditorBlock = block;
    let touched = false;

    // EmailLayout: data.childrenIds
    if (Array.isArray(data?.childrenIds)) {
      const { kept, changed } = filterIds(id, data!.childrenIds);
      if (changed) {
        nextBlock = {
          ...nextBlock,
          data: { ...(nextBlock.data as object), childrenIds: kept },
        } as TEditorBlock;
        touched = true;
      }
    }

    // Container: data.props.childrenIds
    if (Array.isArray(data?.props?.childrenIds)) {
      const { kept, changed } = filterIds(id, data!.props!.childrenIds as unknown[]);
      if (changed) {
        const prevData = nextBlock.data as { props?: object };
        nextBlock = {
          ...nextBlock,
          data: {
            ...(prevData as object),
            props: { ...(prevData.props as object), childrenIds: kept },
          },
        } as TEditorBlock;
        touched = true;
      }
    }

    // ColumnsContainer: data.props.columns[*].childrenIds
    if (Array.isArray(data?.props?.columns)) {
      const originalCols = data!.props!.columns as unknown[];
      let colsChanged = false;
      const nextCols = originalCols.map((col) => {
        if (col && typeof col === 'object' && Array.isArray((col as { childrenIds?: unknown }).childrenIds)) {
          const { kept, changed } = filterIds(id, (col as { childrenIds: unknown[] }).childrenIds);
          if (changed) {
            colsChanged = true;
            return { ...(col as object), childrenIds: kept };
          }
        }
        return col;
      });

      if (colsChanged) {
        const prevData = nextBlock.data as { props?: object };
        nextBlock = {
          ...nextBlock,
          data: {
            ...(prevData as object),
            props: { ...(prevData.props as object), columns: nextCols },
          },
        } as TEditorBlock;
        touched = true;
      }
    }

    cleaned[id] = touched ? nextBlock : block;
  }

  return { cleaned, droppedReferences };
}

/** Combined repair result from {@link repairDocument}. */
export type FullRepairResult = {
  repaired: TEditorConfiguration;
  appendedRootChildren: string[];
  droppedReferences: DroppedReference[];
  normalizedBlocks: string[];
  duplicateChildRefs: DuplicateChildRef[];
};

/** A `childrenIds` reference that pointed to the same child as a previous parent. */
export type DuplicateChildRef = {
  /** Block id that appeared in two different parents' children arrays. */
  childId: string;
  /** Parent that kept the reference (BFS order from root). */
  keptBy: string;
  /** Parent the reference was removed from. */
  droppedFrom: string;
};

export type DedupeChildResult = {
  deduped: TEditorConfiguration;
  duplicates: DuplicateChildRef[];
};

/** Result from {@link normalizeBlockShape}. */
export type NormalizeResult = {
  normalized: TEditorConfiguration;
  normalizedBlocks: string[];
};

/**
 * Fix a common LLM mistake: emitting `props` as a sibling of `data` instead
 * of inside `data.props`. The schema accepts `block.data.props.*`; the
 * misplaced `block.props` silently slips through Zod's `.passthrough()` but
 * makes the block render empty at runtime and hides its children from the
 * downstream repair helpers (which look at `data.props.childrenIds`).
 *
 * When both `block.props` AND `block.data.props` exist, we keep `data.props`
 * untouched — it's the source of truth — and drop the stray top-level
 * `props`. When only `block.props` exists, we move it under `data.props`.
 *
 * Leaves blocks without this anomaly untouched (same reference).
 */
export function normalizeBlockShape(doc: TEditorConfiguration): NormalizeResult {
  const normalized: TEditorConfiguration = {};
  const normalizedBlocks: string[] = [];

  for (const [id, block] of Object.entries(doc)) {
    const anyBlock = block as unknown as {
      type?: unknown;
      data?: { props?: unknown } | unknown;
      props?: unknown;
    };

    const hasTopLevelProps = anyBlock.props !== undefined;
    const data =
      anyBlock.data && typeof anyBlock.data === 'object' && !Array.isArray(anyBlock.data)
        ? (anyBlock.data as Record<string, unknown>)
        : undefined;

    if (!hasTopLevelProps || data === undefined) {
      normalized[id] = block;
      continue;
    }

    // Preserve every non-`props` key on the block and fold `props` into data.
    const nextBlock: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(anyBlock)) {
      if (key === 'props') continue;
      nextBlock[key] = value;
    }

    const dataHasProps = 'props' in data && data.props !== undefined;
    const nextDataProps = dataHasProps ? data.props : anyBlock.props;
    nextBlock.data = { ...data, props: nextDataProps };

    normalized[id] = nextBlock as unknown as TEditorBlock;
    normalizedBlocks.push(id);
  }

  return { normalized, normalizedBlocks };
}

/**
 * Identifies one of the three `childrenIds`-bearing positions inside a
 * block. The discriminator is what lets {@link dedupeChildReferences}
 * write back to the exact slot it filtered.
 */
type ChildArrayKind =
  | { kind: 'data' } // EmailLayout: data.childrenIds
  | { kind: 'props' } // Container: data.props.childrenIds
  | { kind: 'column'; index: number }; // ColumnsContainer: data.props.columns[i].childrenIds

/** Pair of an array slot and the id list it currently holds. */
type ChildArrayEntry = { kind: ChildArrayKind; ids: string[] };

/**
 * Enumerate every `childrenIds` slot inside a block in document order:
 *
 *   1. `data.childrenIds`   (EmailLayout)
 *   2. `data.props.childrenIds`   (Container)
 *   3. `data.props.columns[0..n].childrenIds`   (ColumnsContainer)
 *
 * A block may carry multiple slots simultaneously when an LLM emits a
 * malformed mix; we surface them all so the dedup pass can reason over
 * every reference. Non-string entries are filtered out defensively.
 */
function listChildArrays(block: TEditorBlock): ChildArrayEntry[] {
  const data = block.data as
    | {
        childrenIds?: unknown;
        props?: { childrenIds?: unknown; columns?: unknown };
      }
    | undefined;
  const out: ChildArrayEntry[] = [];

  if (Array.isArray(data?.childrenIds)) {
    out.push({
      kind: { kind: 'data' },
      ids: (data!.childrenIds as unknown[]).filter((v): v is string => typeof v === 'string'),
    });
  }

  const propsObj = data?.props as { childrenIds?: unknown; columns?: unknown } | undefined;
  if (propsObj && Array.isArray(propsObj.childrenIds)) {
    out.push({
      kind: { kind: 'props' },
      ids: (propsObj.childrenIds as unknown[]).filter((v): v is string => typeof v === 'string'),
    });
  }

  if (propsObj && Array.isArray(propsObj.columns)) {
    (propsObj.columns as unknown[]).forEach((col, index) => {
      if (col && typeof col === 'object' && Array.isArray((col as { childrenIds?: unknown }).childrenIds)) {
        out.push({
          kind: { kind: 'column', index },
          ids: (col as { childrenIds: unknown[] }).childrenIds.filter((v): v is string => typeof v === 'string'),
        });
      }
    });
  }

  return out;
}

/**
 * Apply a precomputed set of replacement arrays to a block. Each entry in
 * `replacements` carries both the slot identifier and the new list to
 * write into that slot. Slots not present in `replacements` are kept as
 * the original reference.
 */
function applyChildArrays(block: TEditorBlock, replacements: ChildArrayEntry[]): TEditorBlock {
  if (replacements.length === 0) return block;

  const data = block.data as
    | {
        childrenIds?: unknown;
        props?: { childrenIds?: unknown; columns?: unknown };
      }
    | undefined;
  if (data === undefined) return block;

  const nextData: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  let propsClone: Record<string, unknown> | null = null;
  const ensurePropsClone = () => {
    if (propsClone === null) {
      propsClone = { ...((data.props as object) ?? {}) };
    }
    return propsClone;
  };
  let columnsClone: unknown[] | null = null;
  const ensureColumnsClone = () => {
    if (columnsClone === null) {
      const original = (data.props as { columns?: unknown })?.columns;
      columnsClone = Array.isArray(original) ? [...original] : [];
    }
    return columnsClone;
  };

  for (const { kind, ids } of replacements) {
    if (kind.kind === 'data') {
      nextData.childrenIds = ids;
    } else if (kind.kind === 'props') {
      ensurePropsClone().childrenIds = ids;
    } else {
      const cols = ensureColumnsClone();
      const col = cols[kind.index];
      const colObj = col && typeof col === 'object' ? (col as Record<string, unknown>) : {};
      cols[kind.index] = { ...colObj, childrenIds: ids };
    }
  }

  if (columnsClone !== null) {
    ensurePropsClone().columns = columnsClone;
  }
  if (propsClone !== null) {
    nextData.props = propsClone;
  }

  return { ...block, data: nextData } as TEditorBlock;
}

/**
 * Remove `childrenIds` references that point to a block already claimed by
 * an earlier parent during a BFS walk from `root`. The LLM occasionally
 * emits the same id inside two different parents' children arrays (e.g. a
 * NotionText id listed both inside a `ColumnsContainer` column AND in a
 * later `Container.childrenIds`). The block itself is emitted only once,
 * but at render time `EditorChildrenIds` maps over each parent's array
 * verbatim — so the same component mounts twice.
 *
 * Strategy: walk in BFS order from `root` (using the same child-extraction
 * shapes as the rest of this module) and, for each parent slot, keep only
 * the first occurrence of every child id across the global walk. The first
 * (parent, slot) in BFS order wins deterministically; later references
 * are dropped and reported.
 *
 * The cleaner is *surgical*: it only filters child arrays. Blocks not
 * touching the dedup are returned by reference. Blocks unreachable from
 * `root` pass through unchanged — their children are still processed for
 * the dedup map so any subsequent re-attachment by `repairOrphanedBlocks`
 * doesn't reintroduce a duplicate.
 */
export function dedupeChildReferences(doc: TEditorConfiguration): DedupeChildResult {
  if (!doc.root) return { deduped: doc, duplicates: [] };

  const duplicates: DuplicateChildRef[] = [];
  const claimedBy = new Map<string, string>(); // childId → first parent that referenced it
  const replacements = new Map<string, ChildArrayEntry[]>(); // parentId → new arrays

  const processParent = (parentId: string): string[] => {
    const parentBlock = doc[parentId];
    if (!parentBlock) return [];
    const arrays = listChildArrays(parentBlock);
    if (arrays.length === 0) return [];

    const newArrays: ChildArrayEntry[] = [];
    let anyDropped = false;
    const newlyClaimed: string[] = [];

    for (const { kind, ids } of arrays) {
      const kept: string[] = [];
      for (const childId of ids) {
        const earlierParent = claimedBy.get(childId);
        if (earlierParent !== undefined) {
          duplicates.push({ childId, keptBy: earlierParent, droppedFrom: parentId });
          anyDropped = true;
          continue;
        }
        claimedBy.set(childId, parentId);
        kept.push(childId);
        newlyClaimed.push(childId);
      }
      newArrays.push({ kind, ids: kept });
      if (kept.length !== ids.length) {
        anyDropped = true;
      }
    }

    if (anyDropped) {
      replacements.set(parentId, newArrays);
    }
    return newlyClaimed;
  };

  // BFS from root. New children get queued only on their first claim so
  // we never revisit the same subtree twice.
  const visited = new Set<string>();
  const queue: string[] = ['root'];
  while (queue.length > 0) {
    const parentId = queue.shift() as string;
    if (visited.has(parentId)) continue;
    visited.add(parentId);
    for (const childId of processParent(parentId)) {
      queue.push(childId);
    }
  }

  // Process orphan subtrees too — they may carry references that the next
  // step (repairOrphanedBlocks) will re-attach to root, and we don't want
  // those references to introduce a duplicate of a block already claimed
  // by a reachable parent above.
  for (const id of Object.keys(doc)) {
    if (id === 'root' || visited.has(id)) continue;
    visited.add(id);
    processParent(id);
  }

  if (duplicates.length === 0) return { deduped: doc, duplicates: [] };

  const deduped: TEditorConfiguration = {};
  for (const [id, block] of Object.entries(doc)) {
    const replacement = replacements.get(id);
    deduped[id] = replacement ? applyChildArrays(block, replacement) : block;
  }
  return { deduped, duplicates };
}

/**
 * One-shot document repair pipeline:
 *
 *   1. {@link normalizeBlockShape} — fold misplaced top-level `props` into
 *      `data.props` so the following steps (and the editor renderer) can
 *      see the intended children.
 *   2. {@link dedupeChildReferences} — drop duplicate `childrenIds` entries
 *      that name a child already claimed by an earlier parent (BFS order).
 *      Without this, the same block would render twice — once per parent.
 *   3. {@link cleanDanglingReferences} — strip `childrenIds` entries that
 *      point to blocks not present in the document.
 *   4. {@link repairOrphanedBlocks} — reattach any orphan subtrees to
 *      `root.childrenIds`.
 *
 * Order matters: normalization exposes hidden children that step 2 walks;
 * step 2 must run before step 3 so a duplicate reference doesn't survive
 * as the only reference once the original parent gets cleaned; step 3 may
 * surface new orphans that step 4 re-attaches.
 */
export function repairDocument(doc: TEditorConfiguration): FullRepairResult {
  const { normalized, normalizedBlocks } = normalizeBlockShape(doc);
  const { deduped, duplicates: duplicateChildRefs } = dedupeChildReferences(normalized);
  const { cleaned, droppedReferences } = cleanDanglingReferences(deduped);
  const { repaired, appendedRootChildren } = repairOrphanedBlocks(cleaned);
  return {
    repaired,
    appendedRootChildren,
    droppedReferences,
    normalizedBlocks,
    duplicateChildRefs,
  };
}
