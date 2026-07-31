/**
 * librarySearch — pure, React-free helpers that power the Components
 * Library drawer toolbar (free-text search + axis/tag filtering +
 * sorting). Kept side-effect-free so they're trivially unit-testable
 * and reusable across every category content component.
 *
 * The helpers operate on a structural `SearchableLibraryItem` so they
 * don't depend on the drawer's `LibraryItem` type (avoids an import
 * cycle) yet accept it directly via the generic constraint.
 */

/** Sort options surfaced in the toolbar `Sort` select. */
export type LibrarySortKey =
  | 'updatedDesc'
  | 'createdDesc'
  | 'nameAsc'
  | 'nameDesc'
  | 'sizeAsc'
  | 'sizeDesc'
  | 'blocksAsc'
  | 'blocksDesc';

/** Order shown in the select; default is the first entry. */
export const LIBRARY_SORT_KEYS: readonly LibrarySortKey[] = [
  'updatedDesc',
  'createdDesc',
  'nameAsc',
  'nameDesc',
  'sizeDesc',
  'sizeAsc',
  'blocksDesc',
  'blocksAsc',
];

/** Toolbar query state. */
export type LibraryQuery = {
  search: string;
  axes: string[];
  tags: string[];
  sort: LibrarySortKey;
};

export const EMPTY_LIBRARY_QUERY: LibraryQuery = {
  search: '',
  axes: [],
  tags: [],
  sort: 'updatedDesc',
};

/** Minimal item shape the helpers read. `LibraryItem` is a superset. */
export type SearchableLibraryItem = {
  name: string;
  description?: string;
  axis: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  blockCount: number;
};

/** True when any filter (search / axis / tag) is active. */
export function isLibraryQueryActive(q: LibraryQuery): boolean {
  return q.search.trim().length > 0 || q.axes.length > 0 || q.tags.length > 0;
}

/**
 * Filter by free-text search (name + description + axis + tags,
 * case-insensitive substring), axis membership (OR within the set),
 * and tags (AND — item must carry every selected tag).
 */
export function filterLibraryItems<T extends SearchableLibraryItem>(
  items: T[],
  q: Pick<LibraryQuery, 'search' | 'axes' | 'tags'>,
): T[] {
  const search = q.search.trim().toLowerCase();
  return items.filter((it) => {
    if (q.axes.length > 0 && !q.axes.includes(it.axis)) return false;
    if (q.tags.length > 0) {
      const tags = it.tags ?? [];
      if (!q.tags.every((t) => tags.includes(t))) return false;
    }
    if (search.length > 0) {
      const haystack = [it.name, it.description ?? '', it.axis, ...(it.tags ?? [])]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** Return a new array sorted by the given key (stable; never mutates input). */
export function sortLibraryItems<T extends SearchableLibraryItem>(
  items: T[],
  sort: LibrarySortKey,
): T[] {
  const sorted = [...items];
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  switch (sort) {
    case 'nameAsc':
      return sorted.sort(byName);
    case 'nameDesc':
      return sorted.sort((a, b) => byName(b, a));
    case 'createdDesc':
      return sorted.sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      );
    case 'sizeAsc':
      return sorted.sort((a, b) => a.sizeBytes - b.sizeBytes);
    case 'sizeDesc':
      return sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
    case 'blocksAsc':
      return sorted.sort((a, b) => a.blockCount - b.blockCount);
    case 'blocksDesc':
      return sorted.sort((a, b) => b.blockCount - a.blockCount);
    case 'updatedDesc':
    default:
      return sorted.sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
      );
  }
}

/** Distinct tags present across the given items, sorted for stable UI. */
export function collectTags(items: SearchableLibraryItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) for (const t of it.tags ?? []) set.add(t);
  return Array.from(set).sort();
}

/** Distinct axis values present across the given items, in first-seen order. */
export function collectAxes(items: SearchableLibraryItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (it.axis && !seen.has(it.axis)) {
      seen.add(it.axis);
      out.push(it.axis);
    }
  }
  return out;
}
