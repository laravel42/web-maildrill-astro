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
export const PAGE_SIZE = 15;

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
