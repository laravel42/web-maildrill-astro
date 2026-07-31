import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vendored layout: the skills corpus is app-local, not at the monorepo root.
const DEFAULT_SKILLS_DIR = resolve(__dirname, '../../skills/email-builder');

/**
 * The full list of roles a section can fill in a generated email.
 *
 * - `hero`, `features`, `social_proof`, `cta` participate in the seed-driven
 *   slot-rotation system (see `buildVariationDirective` in
 *   `system-prompt.ts`).
 * - `header`, `footer`, `nav`, `logo` are structural pieces. They join the
 *   pool the LLM can splice in but are NOT subject to forced rotation —
 *   they always go where they belong (top / bottom / nav / logo anchor)
 *   when the prompt warrants them.
 */
export type RecipeRole =
  'hero' | 'features' | 'social_proof' | 'cta' | 'header' | 'footer' | 'nav' | 'logo';

export const ROTATION_ROLES: ReadonlyArray<RecipeRole> = [
  'hero',
  'features',
  'social_proof',
  'cta',
];

// ---------------------------------------------------------------------------
// L42-311 Layer A — five-category taxonomy
// ---------------------------------------------------------------------------
//
// The L42-309 Components Library refactor split user-saved content into
// five categories on disk:
//
//   skills/email-builder/references/
//   ├── templates/{uuid}.ndjson           full EmailLayout documents
//   ├── sections/{role}/{uuid}.ndjson     Container/Columns subtree w/ content
//   ├── layouts/{shape}/{uuid}.ndjson     structural-only Container/Columns
//   ├── primitives/{type}/{uuid}.ndjson   single non-structural block
//   └── themes/{uuid}.json                style map (no NDJSON)
//
// In parallel, the AI generation pipeline still ships two bundled corpora
// authored before the taxonomy existed:
//
//   skills/email-builder/references/
//   ├── presets/*.ndjson                  16 hardcoded full templates
//   └── recipes/*.ndjson                  18 hardcoded section snippets
//
// Layer A unifies both worlds:
//
//   - `templates` = bundled `presets/*` + user `templates/*`
//   - `sections`  = bundled `recipes/*`  + user `sections/{role}/*`
//   - `layouts`, `primitives`, `themes` = user-saved only (no bundled
//     equivalent yet — Layer B/C will introduce curated bundled defaults
//     if needed once retrieval is in place).
//
// The legacy `PresetEntry` / `RecipeEntry` types and `loadPresets()` /
// `loadRecipes()` / `loadSections()` loaders stay exported for the
// `index.spec.ts` smoke test and any out-of-tree consumers, but
// `loadSkillContext()` returns the unified five-category shape.
// ---------------------------------------------------------------------------

/**
 * Bundled full-template anchor (NDJSON) shipped under `references/presets/`.
 * Kept for the `index.spec.ts` smoke test and any consumer that wants to
 * inspect the bundled-only pool. New code should consume `TemplateEntry`
 * via `loadSkillContext()` instead.
 *
 * @deprecated Prefer `TemplateEntry` from `loadSkillContext().templates`.
 */
export interface PresetEntry {
  slot: number;
  slug: string;
  description: string;
  fontFamily: string;
  ndjson: string;
  blockCount: number;
}

/**
 * Bundled section snippet (NDJSON) shipped under `references/recipes/`.
 * The unified pool returned by `loadSkillContext().sections` carries
 * exactly this shape, so we re-export it as `SectionEntry` below for
 * naming clarity.
 *
 * @deprecated Prefer `SectionEntry` from `loadSkillContext().sections`.
 */
export interface RecipeEntry {
  slot: number;
  slug: string;
  role?: RecipeRole;
  description: string;
  whenToUse: string;
  ndjson: string;
  blockCount: number;
  /** Source of the section — `bundled` ships with the package, `user` was authored via the dev save-section endpoint. */
  source?: 'bundled' | 'user';
}

/**
 * Unified template entry — bundled preset OR user-saved template.
 *
 * `fontFamily` is required for bundled presets (the preset metadata
 * carries it explicitly). User-saved templates do not record a global
 * font family on disk, so the field is optional in the unified shape.
 */
export interface TemplateEntry {
  slot: number;
  slug: string;
  description: string;
  fontFamily?: string;
  ndjson: string;
  blockCount: number;
  source: 'bundled' | 'user';
  /**
   * Free-text relevance signal for retrieval. Aggregates the human-readable
   * metadata (name, tags, usage, description) into a single lowercase string
   * the retrieval layer scores against the user prompt. Never embedded in
   * the prompt itself — selection-time only.
   */
  keywords?: string;
}

/**
 * Unified section entry — bundled recipe OR user-saved section.
 *
 * Mirrors `RecipeEntry` exactly, with `source` non-optional so callers
 * can branch reliably.
 */
export interface SectionEntry {
  slot: number;
  slug: string;
  role?: RecipeRole;
  description: string;
  whenToUse: string;
  ndjson: string;
  blockCount: number;
  source: 'bundled' | 'user';
  /** Aggregated free-text relevance signal (name, tags, role, description). Selection-time only. */
  keywords?: string;
}

/**
 * User-saved structural-only subtree (Container or ColumnsContainer with
 * Container/Columns descendants only — no Heading / Button / Image / etc.)
 * Lives under `references/layouts/{shape}/{uuid}.ndjson`. Shape is the
 * axis the user picked at save time:
 *
 *   - `container`  → root is a `Container`
 *   - `columns-2`  → root is a `ColumnsContainer` with `columnsCount: 2`
 *   - `columns-3`  → root is a `ColumnsContainer` with `columnsCount: 3`
 */
export interface LayoutEntry {
  slot: number;
  slug: string;
  shape: 'container' | 'columns-2' | 'columns-3';
  description: string;
  ndjson: string;
  blockCount: number;
  source: 'user';
}

/**
 * User-saved single non-structural block. Lives under
 * `references/primitives/{type}/{uuid}.ndjson`. `type` mirrors the
 * kebab-cased block type emitted by the dev endpoint
 * (`button`, `divider`, `image`, `notion-text`, `social-media`, `spacer`).
 */
export interface PrimitiveEntry {
  slot: number;
  slug: string;
  type: string;
  description: string;
  ndjson: string;
  blockCount: number;
  source: 'user';
}

/**
 * User-saved theme — a flat JSON document mapping block types to their
 * default style overrides. Lives under `references/themes/{uuid}.json`
 * (NOT NDJSON, single JSON object).
 *
 * `json` carries the raw file contents; the system-prompt formatter
 * extracts a compact palette + per-block style summary for the LLM.
 */
export interface ThemeEntry {
  slot: number;
  slug: string;
  description: string;
  json: string;
  source: 'user';
  /** Aggregated free-text relevance signal (name, description). Selection-time only. */
  keywords?: string;
}

export interface SkillContext {
  skill: string;
  patterns: string;
  /**
   * Unified template pool — bundled `presets/*` first (slot 1..N),
   * then user-saved `templates/*` (slot ≥ 1000). Same wire format
   * (NDJSON whose root block is `EmailLayout`).
   */
  templates: TemplateEntry[];
  /**
   * Unified section pool — bundled `recipes/*` first (slot 1..N), then
   * user-saved `sections/{role}/*` (slot ≥ 1000). Same wire format
   * (NDJSON whose root block is Container or ColumnsContainer).
   */
  sections: SectionEntry[];
  /**
   * User-saved structural-only subtrees. No bundled equivalent yet.
   */
  layouts: LayoutEntry[];
  /**
   * User-saved single-block primitives. No bundled equivalent yet.
   */
  primitives: PrimitiveEntry[];
  /**
   * User-saved themes. No bundled equivalent yet.
   */
  themes: ThemeEntry[];
  skillsDir: string;
}

export interface LoadSkillContextOptions {
  skillsDir?: string;
}

const cache = new Map<string, SkillContext>();
let presetsCache: PresetEntry[] | null = null;
let recipesCache: RecipeEntry[] | null = null;

function shouldCache(): boolean {
  return process.env.NODE_ENV === 'production';
}

function resolveSkillsDir(explicit?: string): string {
  const raw = explicit ?? process.env.SKILLS_DIR ?? DEFAULT_SKILLS_DIR;
  return resolve(raw);
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Aggregate the human-readable fields of a metadata header into a single
 * lowercase relevance string for the retrieval layer. Pulls `name`,
 * `tags[]`, `usage`, `role`, and `description` when present. The result is
 * never embedded in the prompt — it is scored against the user prompt at
 * selection time only, so it is cheap to over-include here.
 */
function extractKeywords(
  metadata: Record<string, unknown>,
  ...extra: Array<string | undefined>
): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim().length > 0) parts.push(v.trim());
  };
  push(metadata.name);
  push(metadata.usage);
  push(metadata.role);
  push(metadata.description);
  if (Array.isArray(metadata.tags)) {
    for (const tag of metadata.tags) push(tag);
  }
  for (const e of extra) push(e);
  return parts.join(' ').toLowerCase();
}

/**
 * Slot-base for user-authored entries. Bundled corpora live in 1..99; we
 * start user entries at 1000 so a sort-by-slot rendering keeps bundled
 * defaults stable at the top while still allowing user entries to be
 * deterministically ordered.
 */
const USER_SLOT_BASE = 1000;

/**
 * Convert a flat EmailBuilder document (Record<id, block>) into the NDJSON
 * line format the retrieval / few-shot pipeline expects. Root first.
 */
function documentToNdjson(doc: Record<string, unknown>): string {
  const lines: string[] = [];
  if (doc.root) lines.push(JSON.stringify({ id: 'root', block: doc.root }));
  for (const [id, block] of Object.entries(doc)) {
    if (id === 'root') continue;
    lines.push(JSON.stringify({ id, block }));
  }
  return lines.join('\n');
}

function readPresetNdjson(
  skillsDir: string,
  presetsDir: string,
  entry: { slot: number; slug: string; sourceFile?: string },
): string {
  const ndjsonName = `${String(entry.slot).padStart(2, '0')}-${entry.slug}.ndjson`;
  const ndjsonPath = resolve(presetsDir, ndjsonName);
  if (existsSync(ndjsonPath)) return safeReadFile(ndjsonPath);

  // Gallery truth lives in references/json/NN.json (full documents). Prefer
  // the index's sourceFile, then the conventional NN.json slot name.
  const candidates = [
    entry.sourceFile
      ? resolve(skillsDir, entry.sourceFile.replace(/^skills\/email-builder\//, ''))
      : null,
    entry.sourceFile ? resolve(skillsDir, '..', entry.sourceFile) : null,
    resolve(skillsDir, 'references/json', `${String(entry.slot).padStart(2, '0')}.json`),
  ].filter((p): p is string => Boolean(p));

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const raw = safeReadFile(path);
    try {
      const doc = JSON.parse(raw) as Record<string, unknown>;
      return documentToNdjson(doc);
    } catch {
      return raw;
    }
  }

  throw new Error(
    `Preset ${entry.slot}-${entry.slug}: neither ${ndjsonName} nor references/json/${String(entry.slot).padStart(2, '0')}.json found`,
  );
}

export function loadPresets(options: LoadSkillContextOptions = {}): PresetEntry[] {
  if (shouldCache() && presetsCache) return presetsCache;

  const skillsDir = resolveSkillsDir(options.skillsDir);
  const presetsDir = resolve(skillsDir, 'references/presets');
  const indexPath = resolve(presetsDir, 'index.json');

  const indexRaw = safeReadFile(indexPath);
  const entries: Array<{
    slot: number;
    slug: string;
    description: string;
    fontFamily: string;
    blockCount: number;
    sourceFile?: string;
  }> = JSON.parse(indexRaw);

  const presets: PresetEntry[] = entries
    .sort((a, b) => a.slot - b.slot)
    .map((e) => {
      const ndjson = readPresetNdjson(skillsDir, presetsDir, e);
      return {
        slot: e.slot,
        slug: e.slug,
        description: e.description,
        fontFamily: e.fontFamily,
        ndjson,
        blockCount: e.blockCount,
      };
    });

  if (shouldCache()) presetsCache = presets;
  return presets;
}

export function loadRecipes(options: LoadSkillContextOptions = {}): RecipeEntry[] {
  if (shouldCache() && recipesCache) return recipesCache;

  const skillsDir = resolveSkillsDir(options.skillsDir);
  const recipesDir = resolve(skillsDir, 'references/recipes');
  const indexPath = resolve(recipesDir, 'index.json');

  const indexRaw = safeReadFile(indexPath);
  const entries: Array<{
    slot: number;
    slug: string;
    role?: string;
    description: string;
    whenToUse: string;
    blockCount: number;
  }> = JSON.parse(indexRaw);

  const recipes: RecipeEntry[] = entries
    .sort((a, b) => a.slot - b.slot)
    .map((e) => {
      const filename = `${String(e.slot).padStart(2, '0')}-${e.slug}.ndjson`;
      const ndjson = safeReadFile(resolve(recipesDir, filename));
      return {
        slot: e.slot,
        slug: e.slug,
        role: e.role as RecipeEntry['role'],
        description: e.description,
        whenToUse: e.whenToUse,
        ndjson,
        blockCount: e.blockCount,
        source: 'bundled' as const,
      };
    });

  if (shouldCache()) recipesCache = recipes;
  return recipes;
}

/**
 * Parse a UUID-named NDJSON file with a metadata header on line 1 and
 * block entries on subsequent lines.
 *
 * Used by sections / layouts / primitives / templates — they all share
 * the same on-disk wire format introduced by L42-309.
 *
 * Returns `null` when:
 *   - the basename is not a UUID v4
 *   - the file is unreadable
 *   - fewer than 2 non-empty lines (no metadata + at least 1 block)
 *   - any line is not valid JSON
 *   - no `block` entries are present (header-only file)
 *
 * Files that fail to parse are skipped silently rather than failing
 * the whole load — a malformed user file should never break AI
 * generation.
 */
function parseLibraryNdjson(
  filePath: string,
  basename: string,
): {
  metadata: Record<string, unknown>;
  blockNdjson: string;
  blockCount: number;
} | null {
  if (!UUID_V4_REGEX.test(basename)) return null;

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  let metadata: Record<string, unknown> = {};
  const blockLines: string[] = [];
  try {
    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.block === undefined && Object.keys(metadata).length === 0) {
        metadata = parsed;
      } else if (parsed.block !== undefined) {
        blockLines.push(line);
      }
    }
  } catch {
    return null;
  }
  if (blockLines.length === 0) return null;

  return {
    metadata,
    blockNdjson: blockLines.join('\n') + '\n',
    blockCount: blockLines.length,
  };
}

/**
 * Load user-saved sections from `skills/email-builder/references/sections/{role}/{uuid}.ndjson`.
 *
 * After the L42-309 rename (previously `references/components/`), every
 * saved section file:
 *
 *   1. Has a UUID v4 basename (legacy slug-format files are filtered).
 *   2. Carries a metadata header on the first line
 *      (`{ id, name, role, description?, createdAt, updatedAt }`).
 *   3. Has block entries (`{ id, block }`) on subsequent lines.
 *
 * The AI rotation pool wants only the block entries — so we strip the
 * metadata line before feeding the NDJSON downstream. `slug` becomes
 * the metadata `name` (falling back to the UUID) so the rotation
 * directive can show something readable.
 *
 * Slots start at `USER_SLOT_BASE` to avoid collisions with bundled
 * sections (which sit in the 1–99 range).
 */
export function loadSections(options: LoadSkillContextOptions = {}): SectionEntry[] {
  const skillsDir = resolveSkillsDir(options.skillsDir);
  const sectionsDir = resolve(skillsDir, 'references/sections');

  if (!existsSync(sectionsDir)) return [];

  const result: SectionEntry[] = [];
  let nextSlot = USER_SLOT_BASE;

  for (const entry of readdirSync(sectionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const role = entry.name as RecipeRole;
    const roleDir = resolve(sectionsDir, entry.name);
    let files: string[];
    try {
      files = readdirSync(roleDir).filter((f) => f.endsWith('.ndjson'));
    } catch {
      continue;
    }
    for (const file of files) {
      const basename = file.replace(/\.ndjson$/, '');
      const parsed = parseLibraryNdjson(resolve(roleDir, file), basename);
      if (!parsed) continue;

      const id = typeof parsed.metadata.id === 'string' ? parsed.metadata.id : basename;
      const slug =
        typeof parsed.metadata.name === 'string' && parsed.metadata.name.length > 0
          ? parsed.metadata.name
          : id;
      const description =
        typeof parsed.metadata.description === 'string' && parsed.metadata.description.length > 0
          ? parsed.metadata.description
          : `User section (${role}) — ${slug}`;

      result.push({
        slot: nextSlot++,
        slug,
        role,
        description,
        whenToUse: `Variation seed may select this user-authored ${role} layout.`,
        ndjson: parsed.blockNdjson,
        blockCount: parsed.blockCount,
        source: 'user',
        keywords: extractKeywords(parsed.metadata, role, slug),
      });
    }
  }

  return result;
}

/**
 * Load user-saved templates from `skills/email-builder/references/templates/{uuid}.ndjson`.
 *
 * Same wire format as sections — metadata line + block lines. The root
 * block is always `EmailLayout` (validated server-side at save time).
 *
 * The bundled `presets/*` corpus is loaded separately via
 * `loadPresets()`; the unified pool is assembled in `loadSkillContext()`.
 */
export function loadUserTemplates(options: LoadSkillContextOptions = {}): TemplateEntry[] {
  const skillsDir = resolveSkillsDir(options.skillsDir);
  const templatesDir = resolve(skillsDir, 'references/templates');

  if (!existsSync(templatesDir)) return [];

  const result: TemplateEntry[] = [];
  let nextSlot = USER_SLOT_BASE;

  let files: string[];
  try {
    files = readdirSync(templatesDir).filter((f) => f.endsWith('.ndjson'));
  } catch {
    return [];
  }

  for (const file of files) {
    const basename = file.replace(/\.ndjson$/, '');
    const parsed = parseLibraryNdjson(resolve(templatesDir, file), basename);
    if (!parsed) continue;

    const id = typeof parsed.metadata.id === 'string' ? parsed.metadata.id : basename;
    const slug =
      typeof parsed.metadata.name === 'string' && parsed.metadata.name.length > 0
        ? parsed.metadata.name
        : id;
    const description =
      typeof parsed.metadata.description === 'string' && parsed.metadata.description.length > 0
        ? parsed.metadata.description
        : `User template — ${slug}`;

    result.push({
      slot: nextSlot++,
      slug,
      description,
      ndjson: parsed.blockNdjson,
      blockCount: parsed.blockCount,
      source: 'user',
      keywords: extractKeywords(parsed.metadata, slug),
    });
  }

  return result;
}

/**
 * Load user-saved layouts from `skills/email-builder/references/layouts/{shape}/{uuid}.ndjson`.
 * Each `{shape}` subdirectory corresponds to a `LayoutEntry.shape` value.
 */
export function loadLayouts(options: LoadSkillContextOptions = {}): LayoutEntry[] {
  const skillsDir = resolveSkillsDir(options.skillsDir);
  const layoutsDir = resolve(skillsDir, 'references/layouts');

  if (!existsSync(layoutsDir)) return [];

  const ALLOWED_SHAPES = new Set<LayoutEntry['shape']>(['container', 'columns-2', 'columns-3']);

  const result: LayoutEntry[] = [];
  let nextSlot = USER_SLOT_BASE;

  for (const entry of readdirSync(layoutsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!ALLOWED_SHAPES.has(entry.name as LayoutEntry['shape'])) continue;
    const shape = entry.name as LayoutEntry['shape'];
    const shapeDir = resolve(layoutsDir, entry.name);
    let files: string[];
    try {
      files = readdirSync(shapeDir).filter((f) => f.endsWith('.ndjson'));
    } catch {
      continue;
    }
    for (const file of files) {
      const basename = file.replace(/\.ndjson$/, '');
      const parsed = parseLibraryNdjson(resolve(shapeDir, file), basename);
      if (!parsed) continue;

      const id = typeof parsed.metadata.id === 'string' ? parsed.metadata.id : basename;
      const slug =
        typeof parsed.metadata.name === 'string' && parsed.metadata.name.length > 0
          ? parsed.metadata.name
          : id;
      const description =
        typeof parsed.metadata.description === 'string' && parsed.metadata.description.length > 0
          ? parsed.metadata.description
          : `User layout (${shape}) — ${slug}`;

      result.push({
        slot: nextSlot++,
        slug,
        shape,
        description,
        ndjson: parsed.blockNdjson,
        blockCount: parsed.blockCount,
        source: 'user',
      });
    }
  }

  return result;
}

/**
 * Load user-saved primitives from `skills/email-builder/references/primitives/{type}/{uuid}.ndjson`.
 * Each `{type}` subdirectory is a kebab-cased block type.
 */
export function loadPrimitives(options: LoadSkillContextOptions = {}): PrimitiveEntry[] {
  const skillsDir = resolveSkillsDir(options.skillsDir);
  const primitivesDir = resolve(skillsDir, 'references/primitives');

  if (!existsSync(primitivesDir)) return [];

  // Match the kebab-case alphabet emitted by the dev endpoint (lowercase
  // letters + digits + single hyphens). Anything else is a stray dir we
  // shouldn't walk into.
  const TYPE_DIR_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const result: PrimitiveEntry[] = [];
  let nextSlot = USER_SLOT_BASE;

  for (const entry of readdirSync(primitivesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!TYPE_DIR_REGEX.test(entry.name)) continue;
    const type = entry.name;
    const typeDir = resolve(primitivesDir, entry.name);
    let files: string[];
    try {
      files = readdirSync(typeDir).filter((f) => f.endsWith('.ndjson'));
    } catch {
      continue;
    }
    for (const file of files) {
      const basename = file.replace(/\.ndjson$/, '');
      const parsed = parseLibraryNdjson(resolve(typeDir, file), basename);
      if (!parsed) continue;

      const id = typeof parsed.metadata.id === 'string' ? parsed.metadata.id : basename;
      const slug =
        typeof parsed.metadata.name === 'string' && parsed.metadata.name.length > 0
          ? parsed.metadata.name
          : id;
      const description =
        typeof parsed.metadata.description === 'string' && parsed.metadata.description.length > 0
          ? parsed.metadata.description
          : `User primitive (${type}) — ${slug}`;

      result.push({
        slot: nextSlot++,
        slug,
        type,
        description,
        ndjson: parsed.blockNdjson,
        blockCount: parsed.blockCount,
        source: 'user',
      });
    }
  }

  return result;
}

/**
 * Load user-saved themes from `skills/email-builder/references/themes/{uuid}.json`.
 *
 * Themes are flat JSON documents (NOT NDJSON):
 *
 * ```
 * { id, name, createdAt, updatedAt, globals?, blocks? }
 * ```
 *
 * The full file is preserved in `json` so the system-prompt formatter
 * can decide which fields to expose to the LLM (palette, per-block
 * style overrides). Files that fail to parse as JSON or whose basename
 * is not a UUID v4 are skipped silently.
 */
export function loadThemes(options: LoadSkillContextOptions = {}): ThemeEntry[] {
  const skillsDir = resolveSkillsDir(options.skillsDir);
  const themesDir = resolve(skillsDir, 'references/themes');

  if (!existsSync(themesDir)) return [];

  const result: ThemeEntry[] = [];
  let nextSlot = USER_SLOT_BASE;

  let files: string[];
  try {
    files = readdirSync(themesDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  for (const file of files) {
    const basename = file.replace(/\.json$/, '');
    if (!UUID_V4_REGEX.test(basename)) continue;
    const fullPath = resolve(themesDir, file);
    let raw: string;
    try {
      raw = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    let metadata: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      metadata = parsed;
    } catch {
      continue;
    }

    const id = typeof metadata.id === 'string' ? metadata.id : basename;
    const slug = typeof metadata.name === 'string' && metadata.name.length > 0 ? metadata.name : id;
    const description =
      typeof metadata.description === 'string' && metadata.description.length > 0
        ? metadata.description
        : `User theme — ${slug}`;

    result.push({
      slot: nextSlot++,
      slug,
      description,
      json: raw,
      source: 'user',
      keywords: extractKeywords(metadata, slug),
    });
  }

  return result;
}

export function loadSkillContext(options: LoadSkillContextOptions = {}): SkillContext {
  const skillsDir = resolveSkillsDir(options.skillsDir);

  if (shouldCache()) {
    const cached = cache.get(skillsDir);
    if (cached) return cached;
  }

  const skillPath = resolve(skillsDir, 'SKILL.md');
  const patternsPath = resolve(skillsDir, 'references/PATTERNS.md');

  const skill = safeReadFile(skillPath);
  const patterns = safeReadFile(patternsPath);

  // Bundled corpora — stable, indexed by `index.json` files.
  const bundledPresets = loadPresets(options);
  const bundledRecipes = loadRecipes(options);

  // User corpora — loaded fresh on every call. They may have been added
  // since the last request via the dev save-* endpoints, and we never
  // want a stale cache to mask new entries during local dev. The cost
  // is one `readdirSync` + per-file parse per category, all under the
  // skills directory.
  const userTemplates = loadUserTemplates(options);
  const userSections = loadSections(options);
  const layouts = loadLayouts(options);
  const primitives = loadPrimitives(options);
  const themes = loadThemes(options);

  // Bundled presets become the bottom of the templates pool, then
  // user-authored templates above. `slot` is preserved from each
  // source so a downstream sort-by-slot keeps bundled defaults stable
  // at slots 1..N and user entries deterministic at slots ≥ 1000.
  const templates: TemplateEntry[] = [
    ...bundledPresets.map<TemplateEntry>((p) => ({
      slot: p.slot,
      slug: p.slug,
      description: p.description,
      fontFamily: p.fontFamily,
      ndjson: p.ndjson,
      blockCount: p.blockCount,
      source: 'bundled',
      keywords: `${p.slug} ${p.description}`.toLowerCase(),
    })),
    ...userTemplates,
  ];

  // Same merge for sections — bundled recipes first, then user sections.
  const sections: SectionEntry[] = [
    ...bundledRecipes.map<SectionEntry>((r) => ({
      slot: r.slot,
      slug: r.slug,
      role: r.role,
      description: r.description,
      whenToUse: r.whenToUse,
      ndjson: r.ndjson,
      blockCount: r.blockCount,
      source: 'bundled',
      keywords: `${r.slug} ${r.role ?? ''} ${r.description} ${r.whenToUse}`.toLowerCase(),
    })),
    ...userSections,
  ];

  const context: SkillContext = {
    skill,
    patterns,
    templates,
    sections,
    layouts,
    primitives,
    themes,
    skillsDir,
  };

  if (shouldCache()) {
    // Production deployments aren't expected to mutate user-saved
    // categories at runtime — we snapshot once per skillsDir. If that
    // assumption ever breaks (e.g. a deploy that lets users save
    // sections in production via `EB_ENABLE_SAVE_COMPONENTS=true`),
    // drop this branch and re-run the user loaders on every call.
    cache.set(skillsDir, context);
  }
  return context;
}

export function clearSkillContextCache(): void {
  cache.clear();
  presetsCache = null;
  recipesCache = null;
}

function safeReadFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read skill file at ${path}: ${cause}`, { cause: error });
  }
}
