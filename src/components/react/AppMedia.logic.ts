import type { MediaFileType } from '@/lib/app/media-data';
import type { SortKey } from './AppMedia.types';

// ---- helpers (deterministic; no Date.now / no randomness) -------------------
export function agoMin(s: string): number {
  const m = s.match(/(\d+)\s*([smhdw])/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const mult =
    m[2] === 's' ? 1 / 60 : m[2] === 'm' ? 1 : m[2] === 'h' ? 60 : m[2] === 'd' ? 1440 : 10080;
  return n * mult;
}
export function sizeBytes(s: string): number {
  const m = s.match(/([\d.]+)\s*(KB|MB|GB|B)/i);
  if (!m) return 0;
  const u = m[2].toUpperCase();
  const mult = u === 'GB' ? 1e9 : u === 'MB' ? 1e6 : u === 'KB' ? 1e3 : 1;
  return parseFloat(m[1]) * mult;
}
export function dimFirst(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Uniform tag chip colours (matches `@/lib/app/tag-style`). */
export function tagStyle(_tag?: string): { bg: string; c: string } {
  return { bg: 'var(--surface2)', c: 'var(--text3)' };
}

export const TYPE_ORDER: MediaFileType[] = [
  'JPEG',
  'PNG',
  'SVG',
  'MP3',
  'WAV',
  'AUDIO',
  'PDF',
  'XLSX',
  'DOCX',
];
export const POPOVER_TYPES: MediaFileType[] = ['JPEG', 'PNG', 'SVG'];

export const VIEWS = [
  { key: 'grid', label: 'Grid' },
  { key: 'list', label: 'List' },
] as const;
export type ViewKey = (typeof VIEWS)[number]['key'];

export const ASC_FIRST: Record<SortKey, boolean> = {
  name: true,
  type: true,
  dim: false,
  size: false,
  uploaded: false,
};
export { PAGE_SIZE } from './shared/pagination';

/** Orientation filter options (square images match both). */
export const ORIENTATIONS = ['Landscape', 'Portrait'] as const;
export type OrientationFilter = (typeof ORIENTATIONS)[number];

/** Named aspect-ratio buckets for the Media Library filter. */
export const ASPECT_RATIOS = [
  { key: '1:1', w: 1, h: 1 },
  { key: '16:9', w: 16, h: 9 },
  { key: '9:16', w: 9, h: 16 },
  { key: '4:3', w: 4, h: 3 },
  { key: '3:2', w: 3, h: 2 },
] as const;
export type AspectRatioKey = (typeof ASPECT_RATIOS)[number]['key'];

export const ASPECT_RATIO_KEYS: AspectRatioKey[] = ASPECT_RATIOS.map((r) => r.key);

/** Relative tolerance when matching a pixel size to a named ratio. */
const RATIO_TOLERANCE = 0.06;

export function parseDim(dim: string): { width: number; height: number } | null {
  const m = dim.match(/(\d+)\s*[×x]\s*(\d+)/i);
  if (!m) return null;
  const width = parseInt(m[1]!, 10);
  const height = parseInt(m[2]!, 10);
  if (!width || !height) return null;
  return { width, height };
}

export function mediaSize(file: {
  width?: number | null;
  height?: number | null;
  dim?: string;
}): { width: number; height: number } | null {
  if (file.width && file.height) return { width: file.width, height: file.height };
  if (file.dim) return parseDim(file.dim);
  return null;
}

/** Square counts as both landscape and portrait. */
export function matchesOrientation(
  width: number,
  height: number,
  selected: ReadonlySet<string>,
): boolean {
  if (selected.size === 0) return true;
  if (width === height) {
    return selected.has('Landscape') || selected.has('Portrait');
  }
  if (width > height) return selected.has('Landscape');
  return selected.has('Portrait');
}

export function matchesAspectRatio(
  width: number,
  height: number,
  selected: ReadonlySet<string>,
): boolean {
  if (selected.size === 0) return true;
  const actual = width / height;
  for (const r of ASPECT_RATIOS) {
    if (!selected.has(r.key)) continue;
    const target = r.w / r.h;
    if (Math.abs(actual - target) / target <= RATIO_TOLERANCE) return true;
  }
  return false;
}

/** Strip path + extension for a clean media display name. */
export function displayNameFromFile(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  return base.replace(/\.[a-z0-9]+$/i, '') || base;
}

/** Normalize a media title to kebab-case (stored asset name). */
export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/['’]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 120);
}

/**
 * Suggest searchable tags from a filename (word tokens after splitting on
 * hyphens/underscores). Mirrors the workers descriptive-tagger heuristic.
 */
export function tagsFromFilename(filename: string): string[] {
  const cleaned = displayNameFromFile(filename).replace(/[-_]+/g, ' ').toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of cleaned.split(/\s+/)) {
    const tag = part.replace(/[^a-z0-9]+/g, '').trim();
    if (tag.length < 3 || /^\d+$/.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Cover twin edge length for library Grid/List previews. */
export const MEDIA_THUMB_SIZE = 250;

/** Decode while the object URL stays alive through `fn` (covers SVG paint). */
async function withDecodedImage<T>(
  file: File,
  fn: (img: HTMLImageElement) => T | Promise<T>,
): Promise<T> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not decode image'));
      el.src = url;
    });
    return await fn(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Downscale an image for the vision suggest endpoint (keeps payloads small).
 * Returns JPEG base64 (no data: prefix) + content type.
 */
export async function imageToSuggestPayload(
  file: File,
  maxEdge = 1280,
): Promise<{ imageBase64: string; contentType: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('not an image');
  }
  // SVG: send as-is (already tiny text); vision models accept it as image/svg+xml.
  if (file.type === 'image/svg+xml') {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return { imageBase64: btoa(binary), contentType: 'image/svg+xml' };
  }

  return withDecodedImage(file, (img) => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(img, 0, 0, tw, th);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    return { imageBase64: base64, contentType: 'image/jpeg' };
  });
}

/** Longest-edge cap applied to library/template uploads before the S3 PUT. */
export const MEDIA_MAX_EDGE = 1024;

/**
 * Downscale an oversized raster upload so its longest edge is `maxEdge`,
 * keeping the aspect ratio and (where the browser can encode it) the source
 * format; AVIF falls through to WebP with a matching rename. Vectors (SVG)
 * and GIFs (canvas would freeze the animation) pass through untouched, as
 * does anything that fails to decode or re-encode — best-effort by design:
 * the upload must never fail because the resize did.
 */
export async function downscaleToMaxEdge(file: File, maxEdge = MEDIA_MAX_EDGE): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    return await withDecodedImage(file, async (img) => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 1 || h < 1 || Math.max(w, h) <= maxEdge) return file;

      const scale = maxEdge / Math.max(w, h);
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, tw, th);

      const attempts: Array<{ type: string; ext: string; quality: number }> =
        file.type === 'image/png'
          ? [{ type: 'image/png', ext: 'png', quality: 0.92 }]
          : file.type === 'image/webp'
            ? [{ type: 'image/webp', ext: 'webp', quality: 0.9 }]
            : file.type === 'image/avif'
              ? [
                  { type: 'image/avif', ext: 'avif', quality: 0.9 },
                  { type: 'image/webp', ext: 'webp', quality: 0.9 },
                ]
              : [{ type: 'image/jpeg', ext: 'jpg', quality: 0.9 }];
      for (const attempt of attempts) {
        const blob = await canvasToBlob(canvas, attempt.type, attempt.quality);
        // toBlob silently falls back to PNG for unsupported types — only
        // accept a blob that is actually the format we asked for.
        if (blob && blob.size > 0 && blob.type === attempt.type) {
          const base = file.name.replace(/\.[^.]+$/, '') || 'upload';
          return new File([blob], `${base}.${attempt.ext}`, { type: attempt.type });
        }
      }
      return file;
    });
  } catch {
    return file;
  }
}

/**
 * Build a 250×250 cover-crop twin for library tiles. Prefer WebP; fall back to
 * JPEG. Returns null when the browser can't rasterize the file (best-effort —
 * upload still succeeds with the full-size preview fallback).
 */
export async function imageToThumb250File(file: File): Promise<File | null> {
  if (!file.type.startsWith('image/')) return null;
  try {
    return await withDecodedImage(file, async (img) => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 1 || h < 1) return null;

      const size = MEDIA_THUMB_SIZE;
      const scale = Math.max(size / w, size / h);
      const sw = size / scale;
      const sh = size / scale;
      const sx = (w - sw) / 2;
      const sy = (h - sh) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

      const webp = await canvasToBlob(canvas, 'image/webp', 0.82);
      if (webp && webp.size > 0) {
        return new File([webp], 'thumb-250.webp', { type: 'image/webp' });
      }
      const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.82);
      if (jpeg && jpeg.size > 0) {
        return new File([jpeg], 'thumb-250.jpg', { type: 'image/jpeg' });
      }
      return null;
    });
  } catch {
    return null;
  }
}
