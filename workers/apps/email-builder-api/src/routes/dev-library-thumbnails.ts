/**
 * Filesystem helpers for the Components Library thumbnail siblings.
 *
 * Each saved item in Sections / Layouts / Templates persists an
 * OPTIONAL `{uuid}.png` next to its `{uuid}.ndjson` (themes get
 * neither — they use a CSS swatch + hover live preview, not a static
 * thumbnail file).
 *
 *   skills/email-builder/references/sections/hero/{uuid}.ndjson
 *   skills/email-builder/references/sections/hero/{uuid}.png      ← here
 *
 * Path is fully derived from `(category, axis | null, id, format)` —
 * we never store the path in metadata, so renames do not invalidate
 * thumbnails. Deletes use the same derivation to wipe both files
 * atomically.
 *
 * No Hono / route logic in this module: keep it import-free of route
 * layer so it stays trivially testable from a Node script.
 */

import { existsSync, mkdirSync, readFileSync, type Stats, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { SKILLS_REFERENCES_DIR } from './dev-library-paths.js';

/**
 * Categories that produce a sibling thumbnail file.
 *
 * Primitives are EXCLUDED on purpose — they render inline via mini
 * iframe (the listing endpoint includes the block payload). Themes are
 * EXCLUDED on purpose — they use a CSS-only swatch.
 *
 * If we ever change that, extend this union and add the corresponding
 * GET / POST routes; the helpers below already accept any string axis
 * value so no changes here are required.
 */
export type ThumbnailCategory = 'sections' | 'layouts' | 'templates';

/**
 * Supported on-disk formats. PNG is what the client actually captures
 * with `html-to-image.toBlob({ type: 'image/png' })`. WebP is reserved
 * for a future migration; the read path returns the same bytes either
 * way.
 */
export type ThumbnailFormat = 'png' | 'webp';

/**
 * Hard cap on stored thumbnail size. Mirrored in `dev-library-ndjson.ts`
 * so that a malformed metadata header alone can't make us believe an
 * oversized file is on disk.
 *
 * Sized to comfortably accommodate emails with imagery / rich
 * backgrounds. Empirically:
 *
 *   - Pure-text email at 280×400 @1x: ~10–30 KB
 *   - Email with one hero image: ~80–200 KB
 *   - Photographic / gradient-heavy: 200–400 KB
 *
 * 512 KB leaves headroom for the upper end of the range without
 * letting accidental oversize uploads pile on disk. With 50 saved
 * sections at the cap, total storage is ~25 MB — fine for a dev tool.
 */
export const MAX_THUMBNAIL_BYTES = 512 * 1024;

/**
 * Thrown by `writeThumbnailFile` when the buffer exceeds the cap.
 * Routes catch this and translate to `413 thumbnail_too_large`.
 */
export class ThumbnailTooLargeError extends Error {
  constructor(
    public readonly bytes: number,
    public readonly limit: number = MAX_THUMBNAIL_BYTES
  ) {
    super(`thumbnail payload exceeds ${limit} bytes (got ${bytes})`);
    this.name = 'ThumbnailTooLargeError';
  }
}

/**
 * Maps a `(category, axis, id, format)` tuple to the absolute on-disk
 * path of the sibling thumbnail. The mapping mirrors the NDJSON file
 * layout exactly:
 *
 *   sections/{role}/{uuid}.png
 *   layouts/{shape}/{uuid}.png
 *   templates/{uuid}.png
 *
 * Templates have no axis, so callers pass `null`. The function does
 * NOT validate the axis value — each route validates against its own
 * enum (ROLE_VALUES, SHAPE_VALUES, etc) before reaching here.
 */
export function getThumbnailPath(
  category: ThumbnailCategory,
  axis: string | null,
  id: string,
  format: ThumbnailFormat = 'png'
): string {
  const segments: string[] = [SKILLS_REFERENCES_DIR, category];
  if (axis !== null) segments.push(axis);
  segments.push(`${id}.${format}`);
  return resolve(...segments);
}

/**
 * Write a thumbnail buffer to its target path, creating parent
 * directories as needed.
 *
 * Throws `ThumbnailTooLargeError` if the buffer exceeds
 * `MAX_THUMBNAIL_BYTES`. Routes always validate the buffer BEFORE
 * persisting the NDJSON header so we never end up with metadata
 * referencing a thumbnail that wasn't actually written.
 */
export function writeThumbnailFile(filePath: string, buffer: Buffer): void {
  if (buffer.byteLength > MAX_THUMBNAIL_BYTES) {
    throw new ThumbnailTooLargeError(buffer.byteLength);
  }
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, buffer);
}

/**
 * Read a thumbnail file's bytes from disk, or `null` if it doesn't
 * exist. Used by `GET /dev/{category}/[:axis/]:id/thumbnail` to stream
 * the binary back to the client. Returning `null` (instead of
 * throwing) lets the route convert "no thumbnail" into a clean 404
 * without try/catch.
 */
export function readThumbnailFile(filePath: string): Buffer | null {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Stat a thumbnail file for ETag generation (mtime-based) and
 * Cache-Control. Returns `null` if missing / unreadable.
 */
export function statThumbnailFile(filePath: string): Stats | null {
  if (!existsSync(filePath)) return null;
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Idempotent delete. Used by route DELETE handlers to clean the
 * sibling file when an item is removed. A missing file is success
 * (the only failure mode worth surfacing is a permission error, which
 * is exceedingly rare in dev-mode local filesystem ops).
 */
export function deleteThumbnailFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    unlinkSync(filePath);
  } catch {
    // Swallow — caller already deleted the NDJSON sibling, the worst
    // we can do is leave a stale .png that gets overwritten next save.
  }
}

/**
 * Detect a PNG file by its magic bytes (8-byte signature
 * `89 50 4E 47 0D 0A 1A 0A`). Used to validate uploads before writing
 * — guards against routes accidentally accepting JPEG/GIF/etc just
 * because the client labelled the form field as `thumbnail`.
 *
 * Returns `null` when the buffer is too short or doesn't match. We
 * reserve `'webp'` as a future format; a WebP-aware check should be
 * added when we switch the client capture format.
 */
export function detectThumbnailFormat(buffer: Buffer): ThumbnailFormat | null {
  if (buffer.byteLength < 8) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // WebP: RIFF....WEBP (offset 8: 'WEBP')
  if (
    buffer.byteLength >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Extract `(width, height)` from a PNG IHDR chunk. PNG layout:
 *
 *   bytes 0..7:   signature (already validated by `detectThumbnailFormat`)
 *   bytes 8..11:  IHDR chunk length (always 13)
 *   bytes 12..15: IHDR chunk type ("IHDR")
 *   bytes 16..19: width  (uint32 big-endian)
 *   bytes 20..23: height (uint32 big-endian)
 *   ... more CRC + chunks
 *
 * Returns `null` when the buffer is too short to contain the IHDR
 * chunk or the dimensions are zero (corrupt header). Routes use this
 * to populate `ThumbnailMetadata` server-side so we never trust
 * client-supplied dimensions.
 */
export function extractPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.byteLength < 24) return null;
  // Verify IHDR chunk type at offset 12.
  if (
    buffer[12] !== 0x49 || // I
    buffer[13] !== 0x48 || // H
    buffer[14] !== 0x44 || // D
    buffer[15] !== 0x52 // R
  ) {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

/**
 * Extract `(width, height)` from a WebP file. WebP has THREE sub-formats:
 *
 *   - VP8  (lossy)     — what `canvas.toBlob('image/webp')` produces
 *                        in modern browsers by default.
 *   - VP8L (lossless)  — emitted by some encoders / image editors.
 *   - VP8X (extended)  — used when the file has alpha, animation, ICC,
 *                        EXIF or XMP metadata. Modern browsers may emit
 *                        this for images with alpha channels.
 *
 * Container layout:
 *
 *   bytes 0..3:   "RIFF"
 *   bytes 4..7:   file size minus 8 (uint32 LE)
 *   bytes 8..11:  "WEBP"
 *   bytes 12..15: chunk identifier (one of "VP8 ", "VP8L", "VP8X")
 *   bytes 16..19: chunk payload size (uint32 LE)
 *   bytes 20+:    chunk payload — layout depends on identifier.
 *
 * VP8 (lossy) payload:
 *   bytes 20..22: frame tag (3 bytes)
 *   bytes 23..25: start code 0x9d 0x01 0x2a
 *   bytes 26..27: width  — low 14 bits of uint16 LE (top 2 bits are scale)
 *   bytes 28..29: height — low 14 bits of uint16 LE
 *
 * VP8L (lossless) payload:
 *   byte  20:     signature 0x2F
 *   bytes 21..24: bit-packed:
 *                   bits  0..13 → width  - 1
 *                   bits 14..27 → height - 1
 *                   bit  28     → alpha hint
 *                   bits 29..31 → version
 *
 * VP8X (extended) payload:
 *   bytes 20..23: feature flags + reserved (ignored here)
 *   bytes 24..26: canvas width  - 1 (uint24 LE)
 *   bytes 27..29: canvas height - 1 (uint24 LE)
 *
 * Returns `null` when the buffer is too short for the detected sub-format
 * or the dimensions decode to zero.
 */
export function extractWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.byteLength < 30) return null;
  // Verify the RIFF...WEBP signature here too — `detectThumbnailFormat`
  // already does this but keeping the check makes this helper safe to
  // call standalone (e.g. from tests).
  if (
    buffer[0] !== 0x52 || // R
    buffer[1] !== 0x49 || // I
    buffer[2] !== 0x46 || // F
    buffer[3] !== 0x46 || // F
    buffer[8] !== 0x57 || // W
    buffer[9] !== 0x45 || // E
    buffer[10] !== 0x42 || // B
    buffer[11] !== 0x50 // P
  ) {
    return null;
  }
  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8 ') {
    // Lossy: width/height at offset 26/28, lower 14 bits of uint16 LE.
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    if (width === 0 || height === 0) return null;
    return { width, height };
  }

  if (chunkType === 'VP8L') {
    // Lossless: bit-packed in bytes 21..24, after the 0x2F signature.
    if (buffer[20] !== 0x2f) return null;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = (((b1 & 0x3f) << 8) | b0) + 1;
    const height = (((b3 & 0x0f) << 10) | (b2 << 2) | (b1 >> 6)) + 1;
    if (width === 0 || height === 0) return null;
    return { width, height };
  }

  if (chunkType === 'VP8X') {
    // Extended: canvas dims at offset 24/27 as uint24 LE (-1 stored).
    const widthMinus1 = buffer[24] | (buffer[25] << 8) | (buffer[26] << 16);
    const heightMinus1 = buffer[27] | (buffer[28] << 8) | (buffer[29] << 16);
    return { width: widthMinus1 + 1, height: heightMinus1 + 1 };
  }

  return null;
}

/**
 * Format-dispatching dimension extractor. Use this from routes so
 * the call site doesn't have to branch on `format` itself.
 */
export function extractImageDimensions(
  buffer: Buffer,
  format: ThumbnailFormat
): { width: number; height: number } | null {
  if (format === 'png') return extractPngDimensions(buffer);
  if (format === 'webp') return extractWebpDimensions(buffer);
  return null;
}
