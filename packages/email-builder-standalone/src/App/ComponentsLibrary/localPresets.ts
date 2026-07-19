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

export default presets;
