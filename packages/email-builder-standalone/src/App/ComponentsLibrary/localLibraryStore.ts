/**
 * localLibraryStore — browser `localStorage` backend for the Components
 * Library **Templates + Themes**, used when `componentsStorage === 'local'`
 * (no dev backend, e.g. a landing page).
 *
 * The return shapes mirror the `/dev/templates` and `/dev/themes` HTTP
 * responses so the existing drawer / dialog UI works unchanged. Ids are
 * minted client-side with `crypto.randomUUID()` (a valid lowercase UUID
 * v4, so theme bundles pass `themeBundleSchema`). Thumbnails are not
 * persisted in local mode (cards fall back to a placeholder).
 */

import type { ThemeBundle, ThemeBundlePayload } from '@eb/document-core';

const TEMPLATES_KEY = 'eb:lib:templates';
const THEMES_KEY = 'eb:lib:themes';
const MAX_TEMPLATES = 50;
const MAX_THEMES = 50;

type SavedBlock = { id: string; block: unknown };

type StoredTemplate = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  blocks: SavedBlock[];
};

type StoredTheme = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  globals?: ThemeBundlePayload['globals'];
  blocks?: ThemeBundlePayload['blocks'];
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const nowIso = (): string => new Date().toISOString();

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function sizeOf(value: unknown): number {
  const json = JSON.stringify(value);
  try {
    return new Blob([json]).size;
  } catch {
    return json.length;
  }
}

/* ----------------------------- Thumbnails ----------------------------- */

/**
 * Local thumbnails are data URLs generated lazily by
 * `lazyThumbnailGenerator` and keyed by the saved item's id (shared
 * across sections / layouts / templates — ids are globally unique). In
 * local mode there is no backend `/dev/.../thumbnail` endpoint, so the
 * card reads the data URL straight from here.
 */
const THUMBNAILS_KEY = 'eb:lib:thumbnails';
/**
 * Catalog version the cached thumbnails were generated for. When the
 * bundled preset catalog bumps its `version` (new/updated/more complex
 * templates & sections), the cache is invalidated so every preview is
 * recaptured at the current sizes. Kept separate from `eb:lib:seeded`
 * (which gates the append-by-id seed) so a thumbnail-only refresh can
 * happen even when no new items were seeded.
 */
const THUMBNAILS_VERSION_KEY = 'eb:lib:thumbnails:version';

function readThumbnailMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(THUMBNAILS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getLocalThumbnail(id: string): string | null {
  return readThumbnailMap()[id] ?? null;
}

export function hasLocalThumbnail(id: string): boolean {
  return Boolean(readThumbnailMap()[id]);
}

export function setLocalThumbnail(id: string, dataUrl: string): void {
  const map = readThumbnailMap();
  map[id] = dataUrl;
  try {
    localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded — drop silently; the card falls back to the placeholder.
  }
}

/** Version the cached thumbnails were generated for, or null if never. */
export function getThumbnailsCacheVersion(): string | null {
  try {
    return localStorage.getItem(THUMBNAILS_VERSION_KEY);
  } catch {
    return null;
  }
}

/** Record the catalog version the current thumbnail cache corresponds to. */
export function setThumbnailsCacheVersion(version: string): void {
  try {
    localStorage.setItem(THUMBNAILS_VERSION_KEY, version);
  } catch {
    // Best-effort — a missing version just forces one extra regeneration.
  }
}

/** Drop all cached thumbnails (forces the lazy generator to recapture). */
export function clearAllLocalThumbnails(): void {
  try {
    localStorage.removeItem(THUMBNAILS_KEY);
  } catch {
    // Best-effort.
  }
}

/* ----------------------------- Templates ----------------------------- */

export type LocalTemplateListing = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  hasThumbnail: boolean;
};

export function localListTemplates(): LocalTemplateListing[] {
  return readArray<StoredTemplate>(TEMPLATES_KEY).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tags: t.tags ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    blockCount: t.blocks.length,
    sizeBytes: sizeOf(t),
    hasThumbnail: hasLocalThumbnail(t.id),
  }));
}

export function localGetTemplate(id: string): {
  id: string;
  name: string;
  description?: string;
  blocks: SavedBlock[];
} {
  const found = readArray<StoredTemplate>(TEMPLATES_KEY).find((t) => t.id === id);
  if (!found) throw new Error(`Template ${id} not found in local storage.`);
  return { id: found.id, name: found.name, description: found.description, blocks: found.blocks };
}

export function localSaveTemplate(input: {
  name: string;
  description?: string;
  tags?: string[];
  blocks: SavedBlock[];
}): { id: string; saved: string; blockCount: number } {
  const list = readArray<StoredTemplate>(TEMPLATES_KEY);
  const entry: StoredTemplate = {
    id: uuid(),
    name: input.name,
    description: input.description,
    tags: input.tags ?? [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    blocks: input.blocks,
  };
  list.unshift(entry);
  while (list.length > MAX_TEMPLATES) list.pop();
  writeArray(TEMPLATES_KEY, list);
  return { id: entry.id, saved: `localStorage:${TEMPLATES_KEY}`, blockCount: entry.blocks.length };
}

export function localRenameTemplate(
  id: string,
  patch: { name?: string; description?: string; tags?: string[] },
): void {
  const list = readArray<StoredTemplate>(TEMPLATES_KEY);
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Template ${id} not found in local storage.`);
  list[idx] = {
    ...list[idx],
    name: patch.name ?? list[idx].name,
    description: patch.description ?? list[idx].description,
    tags: patch.tags ?? list[idx].tags,
    updatedAt: nowIso(),
  };
  writeArray(TEMPLATES_KEY, list);
}

export function localDeleteTemplate(id: string): void {
  writeArray(
    TEMPLATES_KEY,
    readArray<StoredTemplate>(TEMPLATES_KEY).filter((t) => t.id !== id),
  );
}

/* ---------------- Saved components (sections / primitives / layouts) ---------------- */

/**
 * Sections, Primitives and Layouts share one storage shape: a captured
 * subtree (`blocks: [{ id, block }]`) plus metadata. The `axis` field is
 * the category's sub-directory equivalent on the backend — role
 * (sections), block type (primitives) or shape (layouts). Ids used inside
 * `blocks` are renumbered to fresh runtime ids at insert time by
 * `buildRenamedSubtreeFromSaved`, so we persist them verbatim.
 */
export type SavedComponentCategory = 'section' | 'primitive' | 'layout';

const SAVED_COMPONENT_KEYS: Record<SavedComponentCategory, string> = {
  section: 'eb:lib:sections',
  primitive: 'eb:lib:primitives',
  layout: 'eb:lib:layouts',
};

const MAX_SAVED_COMPONENTS = 100;

type StoredSavedComponent = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  /** Normalised axis written by user saves. */
  axis?: string;
  /**
   * Seeded presets from `localPresets` carry the category-specific
   * field instead of a normalised `axis` — section → role, layout →
   * shape, primitive → type. The listing resolves whichever is present.
   */
  role?: string;
  shape?: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  blocks: SavedBlock[];
};

export type LocalSavedComponentListing = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  axis: string;
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  hasThumbnail: boolean;
  /** Inline root block payload — primitives render it inline in the drawer. */
  block?: unknown;
};

export function localListSavedComponents(
  category: SavedComponentCategory,
): LocalSavedComponentListing[] {
  return readArray<StoredSavedComponent>(SAVED_COMPONENT_KEYS[category]).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    tags: c.tags ?? [],
    axis: c.axis ?? c.role ?? c.shape ?? c.type ?? '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    blockCount: c.blocks.length,
    sizeBytes: sizeOf(c),
    hasThumbnail: hasLocalThumbnail(c.id),
    block: c.blocks[0]?.block,
  }));
}

export function localGetSavedComponent(
  category: SavedComponentCategory,
  id: string,
): { id: string; name: string; description?: string; blocks: SavedBlock[] } {
  const found = readArray<StoredSavedComponent>(SAVED_COMPONENT_KEYS[category]).find(
    (c) => c.id === id,
  );
  if (!found) throw new Error(`${category} ${id} not found in local storage.`);
  return { id: found.id, name: found.name, description: found.description, blocks: found.blocks };
}

export function localSaveSavedComponent(
  category: SavedComponentCategory,
  input: {
    name: string;
    description?: string;
    tags?: string[];
    axis: string;
    blocks: SavedBlock[];
  },
): { id: string; saved: string; blockCount: number } {
  const key = SAVED_COMPONENT_KEYS[category];
  const list = readArray<StoredSavedComponent>(key);
  const entry: StoredSavedComponent = {
    id: uuid(),
    name: input.name,
    description: input.description,
    tags: input.tags ?? [],
    axis: input.axis,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    blocks: input.blocks,
  };
  list.unshift(entry);
  while (list.length > MAX_SAVED_COMPONENTS) list.pop();
  writeArray(key, list);
  return { id: entry.id, saved: `localStorage:${key}`, blockCount: entry.blocks.length };
}

export function localRenameSavedComponent(
  category: SavedComponentCategory,
  id: string,
  patch: { name?: string; description?: string; tags?: string[] },
): void {
  const key = SAVED_COMPONENT_KEYS[category];
  const list = readArray<StoredSavedComponent>(key);
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`${category} ${id} not found in local storage.`);
  list[idx] = {
    ...list[idx],
    name: patch.name ?? list[idx].name,
    description: patch.description ?? list[idx].description,
    tags: patch.tags ?? list[idx].tags,
    updatedAt: nowIso(),
  };
  writeArray(key, list);
}

export function localDeleteSavedComponent(category: SavedComponentCategory, id: string): void {
  const key = SAVED_COMPONENT_KEYS[category];
  writeArray(
    key,
    readArray<StoredSavedComponent>(key).filter((c) => c.id !== id),
  );
}

/* ------------------------------- Themes ------------------------------- */

export type LocalThemeListing = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  globals?: StoredTheme['globals'];
  blocks?: StoredTheme['blocks'];
};

export function localListThemes(): LocalThemeListing[] {
  return readArray<StoredTheme>(THEMES_KEY).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    sizeBytes: sizeOf(t),
    globals: t.globals,
    blocks: t.blocks,
  }));
}

export function localGetTheme(id: string): ThemeBundle {
  const found = readArray<StoredTheme>(THEMES_KEY).find((t) => t.id === id);
  if (!found) throw new Error(`Theme ${id} not found in local storage.`);
  return {
    id: found.id,
    createdAt: found.createdAt,
    updatedAt: found.updatedAt,
    name: found.name,
    description: found.description,
    globals: found.globals,
    blocks: found.blocks,
  } as ThemeBundle;
}

export function localSaveTheme(input: {
  name: string;
  description?: string;
  bundle: ThemeBundlePayload;
}): {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  saved: string;
} {
  const list = readArray<StoredTheme>(THEMES_KEY);
  const entry: StoredTheme = {
    id: uuid(),
    name: input.name,
    description: input.description,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    globals: input.bundle.globals,
    blocks: input.bundle.blocks,
  };
  list.unshift(entry);
  while (list.length > MAX_THEMES) list.pop();
  writeArray(THEMES_KEY, list);
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    sizeBytes: sizeOf(entry),
    saved: `localStorage:${THEMES_KEY}`,
  };
}

export function localUpdateTheme(
  id: string,
  patch: { name?: string; description?: string; bundle?: ThemeBundlePayload },
): {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
} {
  const list = readArray<StoredTheme>(THEMES_KEY);
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Theme ${id} not found in local storage.`);
  const next: StoredTheme = {
    ...list[idx],
    name: patch.name ?? list[idx].name,
    description:
      patch.description === '' ? undefined : (patch.description ?? list[idx].description),
    globals: patch.bundle ? patch.bundle.globals : list[idx].globals,
    blocks: patch.bundle ? patch.bundle.blocks : list[idx].blocks,
    updatedAt: nowIso(),
  };
  list[idx] = next;
  writeArray(THEMES_KEY, list);
  return {
    id: next.id,
    name: next.name,
    description: next.description,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    sizeBytes: sizeOf(next),
  };
}

export function localDeleteTheme(id: string): { id: string; deleted: string } {
  writeArray(
    THEMES_KEY,
    readArray<StoredTheme>(THEMES_KEY).filter((t) => t.id !== id),
  );
  return { id, deleted: 'local' };
}
