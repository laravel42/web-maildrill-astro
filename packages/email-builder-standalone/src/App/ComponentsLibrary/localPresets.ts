/**
 * localPresets — bundled Components Library catalog shipped with the
 * package so that `componentsStorage='local'` deployments (no backend)
 * start with a curated set of Templates, Sections, Layouts, Primitives
 * and Themes instead of an empty drawer.
 *
 * Reconstructed verbatim from the published `email-builder-online`
 * dist (`localPresets-*.js`). The data lives in a sibling `.json` file
 * so this module stays a thin, dynamically-importable wrapper — the
 * seeder (`seedLocalLibrary`) imports it lazily, keeping the ~500 KB
 * payload out of the main bundle until local mode is active.
 *
 * Field shapes mirror the published presets exactly:
 *   - templates:  { id, name, description?, tags, createdAt, updatedAt, blocks }
 *   - sections:   { …, role, blocks }
 *   - layouts:    { …, shape, blocks }
 *   - primitives: { …, type, blocks }
 *   - themes:     { id, name, description?, createdAt, updatedAt, globals, blocks }
 *
 * `blocks` is a `[{ id, block }]` array; ids are renumbered to fresh
 * runtime ids at insert time by `buildRenamedSubtreeFromSaved`.
 */

import data from './localPresets.data.json';

type SavedBlock = { id: string; block: unknown };

type PresetBase = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  blocks: SavedBlock[];
};

export type PresetTemplate = PresetBase;
export type PresetSection = PresetBase & { role: string };
export type PresetLayout = PresetBase & { shape: string };
export type PresetPrimitive = PresetBase & { type: string };
export type PresetTheme = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  globals?: unknown;
  blocks?: unknown;
};

export type LocalPresets = {
  /** Catalog version — seeding is skipped when it matches the stored sentinel. */
  version: string;
  templates: PresetTemplate[];
  sections: PresetSection[];
  layouts: PresetLayout[];
  primitives: PresetPrimitive[];
  themes: PresetTheme[];
};

const presets = data as unknown as LocalPresets;

/**
 * Catalog version, derived from a content hash (FNV-1a) of the preset
 * arrays rather than the static `version` field in the JSON. This makes
 * the seed / thumbnail-cache version change **if and only if** the
 * presets actually change — no manual bump to forget, and no needless
 * cache invalidation on unrelated rebuilds. The hash is computed once,
 * lazily (this module is only imported in local mode).
 */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const contentVersion = fnv1a(
  JSON.stringify([
    presets.templates,
    presets.sections,
    presets.layouts,
    presets.primitives,
    presets.themes,
  ]),
);

export default { ...presets, version: contentVersion } satisfies LocalPresets;
