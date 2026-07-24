/**
 * Shared NDJSON helpers for the dev-only library endpoints
 * (sections, primitives, layouts, templates).
 *
 * Centralises the wire format every category uses:
 *
 *   - Line 1 of the file is a metadata header (`{ id, name, ... }`).
 *   - Subsequent lines are block entries (`{ id, block }`).
 *   - Block ids are renumbered to `component-{shortId}-{n}` on save so
 *     childrenIds references inside the subtree become self-contained.
 *
 * The category-specific routes (`dev-save-section`, `dev-save-primitive`,
 * etc.) compose these helpers + their own Zod schemas + their own axis
 * field (role / type / shape / none). Per-category root-type validation
 * stays in each route file.
 *
 * No filesystem writes / reads happen in this module — see
 * `dev-library-paths.ts` for path resolution.
 */

import { z } from 'zod';

/**
 * Single entry on a non-metadata line of the NDJSON file. The `block`
 * payload is opaque to this module; each category route validates the
 * shape upstream via Zod.
 */
export type LibraryBlockEntry = { id: string; block: unknown };

/**
 * Optional thumbnail metadata attached to the NDJSON header. The
 * binary itself is NOT stored here — it lives as a sibling file under
 * `{category}/[axis/]{uuid}.{format}`. This struct just records what
 * was captured, when, and how big.
 *
 * Path is derived from `(category, axis, id)` so renames never touch
 * the thumbnail file. Missing field on the header means "no thumbnail
 * yet"; the listing endpoint exposes that as `hasThumbnail: false`.
 */
export type ThumbnailMetadata = {
  format: 'png' | 'webp';
  width: number;
  height: number;
  sizeBytes: number;
  capturedAt: string;
};

/**
 * Hard cap on the on-disk thumbnail file size. Matches the value used
 * by `dev-library-thumbnails.ts` filesystem helpers; the Zod schema
 * mirrors the cap so a malformed metadata header alone can't make us
 * think we've stored an oversized PNG.
 */
export const MAX_THUMBNAIL_BYTES = 512 * 1024;

/**
 * Zod schema for `ThumbnailMetadata`. Used both when validating an
 * incoming save (multipart includes the dimensions calculated client
 * side) and when re-parsing an NDJSON header on read. Tight bounds:
 *
 * - `format`: only `png` and `webp` ever stored. PNG is the default
 *   format the client captures with; WebP is reserved for future
 *   migration. Anything else → reject the header (treated as missing).
 * - `width` / `height`: positive integers, capped at 4096 px to keep
 *   us inside browser canvas limits and disk size sanity.
 * - `sizeBytes`: positive integer ≤ `MAX_THUMBNAIL_BYTES`.
 * - `capturedAt`: any ISO-8601-ish string (`datetime()` is too strict —
 *   we accept `Z` and offset variants for back-compat with manual
 *   regenerate flows that may run against older entries).
 */
export const thumbnailMetadataSchema = z
  .object({
    format: z.enum(['png', 'webp']),
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
    sizeBytes: z.number().int().positive().max(MAX_THUMBNAIL_BYTES),
    capturedAt: z.string().min(1),
  })
  .strict();

/**
 * Build a `ThumbnailMetadata` object from raw inputs (e.g. multipart
 * form data) and validate it in one step. Throws `ZodError` on bad
 * input; routes catch and translate to `400 invalid_request`.
 */
export function buildThumbnailMetadata(input: {
  format: 'png' | 'webp';
  width: number;
  height: number;
  sizeBytes: number;
  capturedAt: string;
}): ThumbnailMetadata {
  return thumbnailMetadataSchema.parse(input);
}

/**
 * Best-effort parse of a `thumbnail` field on a parsed NDJSON header.
 *
 * Returns the validated `ThumbnailMetadata` if the field exists AND
 * matches the schema. Returns `undefined` if the field is missing
 * (back-compat with pre-thumbnail files) OR malformed (corrupt header
 * gracefully degrades to "no thumbnail" rather than 500-ing the read).
 *
 * Each route uses this on file-read paths so an old NDJSON without a
 * thumbnail field never fails to load.
 */
export function parseThumbnailMetadata(raw: unknown): ThumbnailMetadata | undefined {
  if (raw === undefined || raw === null) return undefined;
  const result = thumbnailMetadataSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/**
 * Fields every metadata header must carry. Categories extend this with
 * their own axis (`role` for sections, `type` for primitives, `shape`
 * for layouts; templates add nothing).
 *
 * `thumbnail` is optional and back-compat: pre-feature NDJSON files
 * have no such field and round-trip fine through `parseLibraryFile` /
 * `serialiseLibraryFile`.
 */
export type LibraryMetadataBase = {
  id: string;
  name: string;
  description?: string;
  /**
   * Optional, normalised (trimmed + lowercased + de-duplicated) list of
   * free-text tags used by the drawer search / filter UI. Optional and
   * back-compat: pre-feature NDJSON files have no `tags` field and
   * round-trip fine. Capped at `MAX_TAGS`, each `TAG_MAX_LENGTH` chars.
   */
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  thumbnail?: ThumbnailMetadata;
};

/** Max number of tags per item, and max length of each tag (post-trim). */
export const MAX_TAGS = 12;
export const TAG_MAX_LENGTH = 32;

/**
 * Zod schema for incoming `tags` on save / update. Rejects over-length
 * tags and arrays beyond `MAX_TAGS`; case-folding and de-duplication
 * happen in `normalizeTags` after parsing.
 */
export const tagsSchema = z.array(z.string().trim().min(1).max(TAG_MAX_LENGTH)).max(MAX_TAGS).optional();

/**
 * Normalise a raw tag list: trim, lowercase, drop empties, de-duplicate,
 * and cap at `MAX_TAGS`. Returns `undefined` when nothing survives so
 * empty arrays are never written to the header.
 */
export function normalizeTags(tags: readonly string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim().toLowerCase().slice(0, TAG_MAX_LENGTH);
    if (t.length === 0 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Best-effort parse of a `tags` field on a parsed NDJSON header.
 * Returns normalised tags, or `undefined` when missing / malformed
 * (graceful degrade for legacy / corrupt headers — same pattern as
 * `parseThumbnailMetadata`).
 */
export function parseTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return normalizeTags(raw as unknown[] as string[]);
}

/**
 * Structural caps. Independent of the gating decision (env var vs
 * production) — they protect the filesystem write path against
 * payloads that are accidentally too large or pathological:
 *
 * - `MAX_BLOCKS`: a "component" is a section, not an entire template.
 *   Templates raise this in their own route file via a separate
 *   constant — not a per-call override.
 * - `MAX_NDJSON_BYTES`: total written-to-disk size cap (header +
 *   lines).
 */
export const MAX_BLOCKS = 50;
export const MAX_NDJSON_BYTES = 200 * 1024;

export class PayloadTooLargeError extends Error {
  constructor(
    public readonly bytes: number,
    public readonly limit: number = MAX_NDJSON_BYTES
  ) {
    super(`NDJSON payload exceeds ${limit} bytes (got ${bytes})`);
  }
}

/**
 * Renumber every block id to the `component-{shortId}-{n}` convention
 * and rewrite all childrenIds references to match.
 *
 * `shortId` is the first 8 hex chars of the component's UUID, which
 * keeps the resulting ids readable while still globally unique within
 * the file scope.
 *
 * The first entry of the input array is treated as the component root
 * and always receives suffix `-1`. Subsequent entries are numbered in
 * input order so author intent (the order rows appear in the UI) is
 * preserved.
 *
 * Unknown referenced ids (children that aren't part of the saved
 * subtree) are dropped with a warning rather than carried as-is — they
 * would point outside the component and break splicing on re-insert.
 */
export function renumberBlocks(
  blocks: LibraryBlockEntry[],
  id: string
): { entries: LibraryBlockEntry[]; droppedRefs: string[] } {
  const shortId = id.slice(0, 8);
  const idMap = new Map<string, string>();
  blocks.forEach((b, i) => idMap.set(b.id, `component-${shortId}-${i + 1}`));

  const droppedRefs: string[] = [];
  const remap = (oldId: string): string | null => {
    const next = idMap.get(oldId);
    if (next) return next;
    droppedRefs.push(oldId);
    return null;
  };

  const entries: LibraryBlockEntry[] = blocks.map((b) => {
    const newId = idMap.get(b.id)!;
    // Deep clone so we don't mutate the request body.
    const cloned = JSON.parse(JSON.stringify(b.block)) as Record<string, unknown>;
    const data = (cloned as { data?: Record<string, unknown> }).data;
    if (data !== undefined && data !== null && typeof data === 'object') {
      const dataObj = data as Record<string, unknown>;
      // Top-level `data.childrenIds` is used by `EmailLayout` (root of
      // a Template). Sections / primitives / layouts root at non-
      // EmailLayout blocks so this branch is a no-op for them, but
      // walking it unconditionally keeps the helper agnostic of the
      // root block type.
      if (Array.isArray(dataObj.childrenIds)) {
        dataObj.childrenIds = (dataObj.childrenIds as string[])
          .map((id) => remap(id))
          .filter((v): v is string => v !== null);
      }
      const props = (dataObj as { props?: Record<string, unknown> }).props;
      if (props !== undefined && props !== null && typeof props === 'object') {
        const propsObj = props as Record<string, unknown>;
        if (Array.isArray(propsObj.childrenIds)) {
          propsObj.childrenIds = (propsObj.childrenIds as string[])
            .map((id) => remap(id))
            .filter((v): v is string => v !== null);
        }
        if (Array.isArray(propsObj.columns)) {
          propsObj.columns = (propsObj.columns as Array<Record<string, unknown>>).map((col) => {
            const childIds = Array.isArray(col.childrenIds) ? (col.childrenIds as string[]) : [];
            return {
              ...col,
              childrenIds: childIds.map((id) => remap(id)).filter((v): v is string => v !== null),
            };
          });
        }
      }
    }
    return { id: newId, block: cloned };
  });

  return { entries, droppedRefs };
}

/**
 * Serialise metadata + entries as NDJSON. Throws `PayloadTooLargeError`
 * when the result exceeds the size limit.
 *
 * The size limit defaults to `MAX_NDJSON_BYTES`. Templates pass a
 * larger limit since a full document is bigger than a single section.
 */
export function serialiseLibraryFile<M extends LibraryMetadataBase>(
  metadata: M,
  entries: LibraryBlockEntry[],
  byteLimit: number = MAX_NDJSON_BYTES
): string {
  const lines: string[] = [JSON.stringify(metadata)];
  for (const e of entries) lines.push(JSON.stringify(e));
  const ndjson = lines.join('\n') + '\n';
  const bytes = Buffer.byteLength(ndjson, 'utf8');
  if (bytes > byteLimit) throw new PayloadTooLargeError(bytes, byteLimit);
  return ndjson;
}

/**
 * Parse an NDJSON file into `{ metadata, entries }`. The metadata
 * header is the first line that does NOT have a `block` field; every
 * subsequent line is treated as a block entry. Throws on a malformed
 * file (no metadata, missing required base fields, or entries with no
 * `block` field).
 *
 * The `metadata` is returned as a wide `LibraryMetadataBase &
 * Record<string, unknown>` so callers can read their axis-specific
 * fields (`role`, `type`, `shape`) without an extra cast. Each route
 * is expected to validate axis values before trusting them — see the
 * `ROLE_VALUES.includes(...)` style guard in `dev-save-section`.
 */
export function parseLibraryFile<M extends LibraryMetadataBase = LibraryMetadataBase>(
  raw: string
): { metadata: M & Record<string, unknown>; entries: LibraryBlockEntry[] } {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('empty file');

  let metadata: (M & Record<string, unknown>) | null = null;
  const entries: LibraryBlockEntry[] = [];
  for (const line of lines) {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (metadata === null && parsed.block === undefined) {
      // First non-entry line is metadata.
      if (
        typeof parsed.id !== 'string' ||
        typeof parsed.name !== 'string' ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.updatedAt !== 'string'
      ) {
        throw new Error('malformed metadata header');
      }
      // Gracefully degrade malformed thumbnail metadata to "no thumbnail"
      // so legacy / corrupt headers never break loading.
      const thumbnailField = parseThumbnailMetadata(parsed.thumbnail);
      if (thumbnailField !== undefined) {
        parsed.thumbnail = thumbnailField;
      } else if ('thumbnail' in parsed) {
        delete parsed.thumbnail;
      }
      // Same graceful-degrade treatment for tags: normalise when valid,
      // strip when missing / malformed so legacy headers never break.
      const tagsField = parseTags(parsed.tags);
      if (tagsField !== undefined) {
        parsed.tags = tagsField;
      } else if ('tags' in parsed) {
        delete parsed.tags;
      }
      metadata = parsed as M & Record<string, unknown>;
    } else if (typeof parsed.id === 'string' && parsed.block !== undefined) {
      entries.push({ id: parsed.id, block: parsed.block });
    } else {
      throw new Error('malformed block entry');
    }
  }
  if (!metadata) throw new Error('missing metadata header');
  return { metadata, entries };
}
