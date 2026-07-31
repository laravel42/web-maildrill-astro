/**
 * seedLocalLibrary — seeds the bundled `localPresets` catalog into
 * `localStorage` the first time a `componentsStorage='local'`
 * deployment runs (or whenever the catalog version changes).
 *
 * Behaviour:
 *   - Templates: on each catalog version bump, replace all bundled
 *     `preset-*` rows with the catalog (user-saved templates kept).
 *   - Sections / layouts / primitives / themes: append-by-id with dedupe.
 *   - A version sentinel (`eb:lib:seeded`) gates the whole pass so it
 *     runs at most once per catalog version.
 *   - Themes are re-shaped to the local theme store's row format.
 *   - After seeding, the drawer is refreshed via
 *     `bumpComponentsLibraryRefresh`.
 *
 * The presets module is imported dynamically so its ~500 KB payload is
 * code-split into its own chunk and only fetched in local mode.
 */

import { bumpComponentsLibraryRefresh } from '../../documents/editor/EditorContext';

import {
  clearAllLocalThumbnails,
  getThumbnailsCacheVersion,
  setThumbnailsCacheVersion,
} from './localLibraryStore';

const TEMPLATES_KEY = 'eb:lib:templates';
const THEMES_KEY = 'eb:lib:themes';
const SECTIONS_KEY = 'eb:lib:sections';
const LAYOUTS_KEY = 'eb:lib:layouts';
const PRIMITIVES_KEY = 'eb:lib:primitives';
const SEEDED_KEY = 'eb:lib:seeded';

type WithId = { id: string };

function readArray<T extends WithId>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Append entries whose id isn't already present. No-op on empty input. */
function mergeById<T extends WithId>(key: string, incoming: T[] | undefined): void {
  if (!incoming?.length) return;
  const existing = readArray<T>(key);
  const seen = new Set(existing.map((e) => e.id));
  const toAdd = incoming.filter((e) => !seen.has(e.id));
  if (toAdd.length) localStorage.setItem(key, JSON.stringify([...existing, ...toAdd]));
}

/**
 * Replace bundled `preset-*` template rows with the catalog, keeping any
 * user-saved templates (ids that do not start with `preset-`). Append-only
 * merge alone would leave obsolete gallery presets in localStorage forever.
 */
function replaceBundledTemplates<T extends WithId>(incoming: T[] | undefined): void {
  if (!incoming?.length) return;
  const existing = readArray<T>(TEMPLATES_KEY);
  const userSaved = existing.filter((e) => !String(e.id).startsWith('preset-'));
  const bundledIds = new Set(incoming.map((e) => e.id));
  // Drop prior bundled presets not in the new catalog; keep user-saved.
  const keptUser = userSaved.filter((e) => !bundledIds.has(e.id));
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify([...incoming, ...keptUser]));
}

export async function seedLocalLibrary(): Promise<void> {
  const { default: presets } = await import('./localPresets');
  const version = presets.version ?? '1';

  // Thumbnail cache is pinned to the catalog version. When the catalog
  // changes (new/updated/more complex templates & sections) drop every
  // cached preview so the lazy generator recaptures them all at the
  // current sizes. Runs before the seed early-return so an already-seeded
  // user still gets a one-time refresh when the version bumps (or the
  // first time this versioning ships and no version tag exists yet).
  if (getThumbnailsCacheVersion() !== version) {
    clearAllLocalThumbnails();
    setThumbnailsCacheVersion(version);
    bumpComponentsLibraryRefresh();
  }

  // Already seeded for this catalog version — nothing to do.
  if (localStorage.getItem(SEEDED_KEY) === version) return;

  replaceBundledTemplates(presets.templates);
  mergeById(SECTIONS_KEY, presets.sections);
  mergeById(LAYOUTS_KEY, presets.layouts);
  mergeById(PRIMITIVES_KEY, presets.primitives);

  if (presets.themes?.length) {
    const existing = readArray<{ id: string }>(THEMES_KEY);
    const seen = new Set(existing.map((e) => e.id));
    const toAdd = presets.themes
      .filter((e) => !seen.has(e.id))
      .map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        globals: e.globals,
        blocks: e.blocks,
      }));
    if (toAdd.length) localStorage.setItem(THEMES_KEY, JSON.stringify([...existing, ...toAdd]));
  }

  localStorage.setItem(SEEDED_KEY, version);
  bumpComponentsLibraryRefresh();
}
