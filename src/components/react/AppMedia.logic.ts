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
  { key: 'compact', label: 'Compact' },
] as const;
export type ViewKey = (typeof VIEWS)[number]['key'];

export const ASC_FIRST: Record<SortKey, boolean> = {
  name: true,
  type: true,
  dim: false,
  size: false,
  uploaded: false,
};
export const PAGE_SIZE = 10;
