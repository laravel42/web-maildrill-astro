/**
 * Local fixtures for the Media Library screen (AppMedia.tsx).
 * The shared mock-data `mediaAssets` array is intentionally minimal (3 rows,
 * a coarse image|file type). The design needs a richer record per file —
 * dimensions, a CSS-placeholder thumbnail, a badge label, a display size and
 * a specific file type — plus enough rows to exercise pagination.
 *
 * We therefore keep a screen-local `MediaFile` shape here, seed the 15
 * hand-authored files from the design, fold in the 3 shared `mediaAssets`
 * (so the screen genuinely consumes the shared source), and append a
 * deterministic batch of generated rows. Everything is static/fixed-string so
 * SSR and hydration always agree (no Date.now(), no randomness).
 */
import { mediaAssets } from './mock-data';

export type MediaFileType = 'JPEG' | 'PNG' | 'SVG' | 'PDF' | 'XLSX' | 'DOCX';

export type MediaFile = {
  id: string;
  name: string;
  /** "1200 × 600" for images, "—" for documents. */
  dim: string;
  /** Badge text drawn on the placeholder thumbnail — may be empty for photos. */
  label: string;
  /** CSS background (gradient or solid) for the placeholder thumbnail. */
  thumb: string;
  /** Foreground color for the badge label. */
  fg: string;
  /** Human display size, e.g. "248 KB" or "1.2 MB". */
  size: string;
  type: MediaFileType;
  /** Relative upload time, e.g. "2h ago". */
  uploaded: string;
};

/** Fixed folder buckets, in display order. */
export const FOLDER_ORDER = ['All files', 'Images', 'PDF', 'Spreadsheets', 'Docs'] as const;
export type MediaFolder = (typeof FOLDER_ORDER)[number];

/** Map a file type to its folder bucket. */
export function folderOf(type: MediaFileType): Exclude<MediaFolder, 'All files'> {
  if (type === 'JPEG' || type === 'PNG' || type === 'SVG') return 'Images';
  if (type === 'PDF') return 'PDF';
  if (type === 'XLSX') return 'Spreadsheets';
  return 'Docs';
}

// ---- 15 hand-authored seed files (from the design) --------------------------
const SEED: MediaFile[] = [
  { id: 'm1', name: 'summer-sale-banner.jpg', dim: '1200 × 600', label: 'SUMMER SALE', thumb: 'linear-gradient(150deg,#4f46e5,#6d28d9)', fg: '#fff', size: '248 KB', type: 'JPEG', uploaded: '2h ago' },
  { id: 'm2', name: 'teacher-portrait.png', dim: '1200 × 800', label: '', thumb: 'linear-gradient(135deg,#93c5fd,#3b82f6)', fg: '#fff', size: '512 KB', type: 'PNG', uploaded: '5h ago' },
  { id: 'm3', name: 'product-1.jpg', dim: '1100 × 800', label: '', thumb: 'linear-gradient(160deg,#e5e7eb,#d1d5db)', fg: '#6b7280', size: '196 KB', type: 'JPEG', uploaded: '1d ago' },
  { id: 'm4', name: 'logo-maildrill.png', dim: '512 × 512', label: '✉', thumb: 'linear-gradient(150deg,#f97316,#ea580c)', fg: '#fff', size: '24 KB', type: 'PNG', uploaded: '1d ago' },
  { id: 'm5', name: 'illustration-01.png', dim: '1200 × 800', label: '', thumb: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)', fg: '#fff', size: '320 KB', type: 'PNG', uploaded: '3d ago' },
  { id: 'm6', name: 'product-2.jpg', dim: '900 × 900', label: '', thumb: 'linear-gradient(150deg,#6d28d9,#4c1d95)', fg: '#fff', size: '174 KB', type: 'JPEG', uploaded: '3d ago' },
  { id: 'm7', name: 'texture-paper.jpg', dim: '1500 × 600', label: '', thumb: '#e7e0d2', fg: '#57534e', size: '410 KB', type: 'JPEG', uploaded: '1w ago' },
  { id: 'm8', name: 'icon-check.svg', dim: '—', label: '✓', thumb: '#e7f6ec', fg: '#15803d', size: '2 KB', type: 'SVG', uploaded: '1w ago' },
  { id: 'm9', name: 'banner-education.jpg', dim: '1200 × 800', label: 'MEET THE TEACHER!', thumb: '#c9b79c', fg: '#3f2f1c', size: '388 KB', type: 'JPEG', uploaded: '2w ago' },
  { id: 'm10', name: 'welcome-hero.jpg', dim: '1200 × 600', label: 'WELCOME', thumb: '#f6b8a0', fg: '#7c2d12', size: '264 KB', type: 'JPEG', uploaded: '2w ago' },
  { id: 'm11', name: 'q3-campaign-report.pdf', dim: '—', label: 'PDF', thumb: '#fee2e2', fg: '#b91c1c', size: '1.2 MB', type: 'PDF', uploaded: '4h ago' },
  { id: 'm12', name: 'brand-guidelines.pdf', dim: '—', label: 'PDF', thumb: '#fee2e2', fg: '#b91c1c', size: '3.4 MB', type: 'PDF', uploaded: '6d ago' },
  { id: 'm13', name: 'subscriber-list-export.xlsx', dim: '—', label: 'XLS', thumb: '#dcfce7', fg: '#15803d', size: '86 KB', type: 'XLSX', uploaded: '2d ago' },
  { id: 'm14', name: 'campaign-calendar.xlsx', dim: '—', label: 'XLS', thumb: '#dcfce7', fg: '#15803d', size: '54 KB', type: 'XLSX', uploaded: '1w ago' },
  { id: 'm15', name: 'onboarding-copy.docx', dim: '—', label: 'DOC', thumb: '#dbeafe', fg: '#1d4ed8', size: '42 KB', type: 'DOCX', uploaded: '3d ago' },
];

// ---- Fold in the 3 shared mock-data assets ----------------------------------
const EXT_TYPE: Record<string, MediaFileType> = {
  png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', svg: 'SVG', pdf: 'PDF', xlsx: 'XLSX', docx: 'DOCX',
};
const NOW = new Date('2026-07-17T18:00:00Z').getTime();
function agoFromIso(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}
const IMG_LOOK: Record<string, { thumb: string; fg: string; dim: string }> = {
  'hero-spring.png': { thumb: 'linear-gradient(150deg,#34d399,#059669)', fg: '#fff', dim: '1200 × 600' },
  'logo-dark.svg': { thumb: '#1f1e1b', fg: '#fff', dim: '—' },
  'price-sheet.pdf': { thumb: '#fee2e2', fg: '#b91c1c', dim: '—' },
};
const SHARED: MediaFile[] = mediaAssets.map((a) => {
  const ext = a.name.split('.').pop()?.toLowerCase() ?? '';
  const type = EXT_TYPE[ext] ?? 'PNG';
  const look = IMG_LOOK[a.name] ?? { thumb: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)', fg: '#fff', dim: '1200 × 800' };
  const label = type === 'PDF' ? 'PDF' : type === 'XLSX' ? 'XLS' : type === 'DOCX' ? 'DOC' : type === 'SVG' ? 'SVG' : '';
  return {
    id: a.id,
    name: a.name,
    dim: look.dim,
    label,
    thumb: look.thumb,
    fg: look.fg,
    size: `${a.sizeKb} KB`,
    type,
    uploaded: agoFromIso(a.updatedAt),
  };
});

// ---- Deterministic generated batch (pagination) -----------------------------
const BASE_NAMES = ['banner', 'hero', 'product', 'illustration', 'texture', 'icon', 'photo', 'graphic', 'cover', 'thumbnail', 'logo', 'background', 'header', 'promo', 'asset'];
const IMG_POOL: { type: MediaFileType; thumb: string; fg: string }[] = [
  { type: 'JPEG', thumb: 'linear-gradient(150deg,#4f46e5,#6d28d9)', fg: '#fff' },
  { type: 'PNG', thumb: 'linear-gradient(135deg,#93c5fd,#3b82f6)', fg: '#fff' },
  { type: 'JPEG', thumb: 'linear-gradient(160deg,#e5e7eb,#d1d5db)', fg: '#6b7280' },
  { type: 'PNG', thumb: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)', fg: '#fff' },
  { type: 'JPEG', thumb: '#e7e0d2', fg: '#57534e' },
  { type: 'SVG', thumb: '#e7f6ec', fg: '#15803d' },
  { type: 'PNG', thumb: 'linear-gradient(150deg,#f97316,#ea580c)', fg: '#fff' },
  { type: 'JPEG', thumb: 'linear-gradient(150deg,#22c55e,#16a34a)', fg: '#fff' },
];
const DOC_POOL: { type: MediaFileType; thumb: string; fg: string; label: string; ext: string }[] = [
  { type: 'PDF', thumb: '#fee2e2', fg: '#b91c1c', label: 'PDF', ext: 'pdf' },
  { type: 'XLSX', thumb: '#dcfce7', fg: '#15803d', label: 'XLS', ext: 'xlsx' },
  { type: 'DOCX', thumb: '#dbeafe', fg: '#1d4ed8', label: 'DOC', ext: 'docx' },
];
const DIMS = ['1200 × 600', '1200 × 800', '900 × 900', '1500 × 600', '1100 × 800', '800 × 800', '1600 × 900', '512 × 512'];
const AGES = ['1d ago', '2d ago', '3d ago', '4d ago', '5d ago', '6d ago', '1w ago', '2w ago', '3w ago'];
const EXT_OF: Record<string, string> = { JPEG: 'jpg', PNG: 'png', SVG: 'svg' };

const GEN_COUNT = 42;
const GENERATED: MediaFile[] = Array.from({ length: GEN_COUNT }, (_, i) => {
  const base = BASE_NAMES[i % BASE_NAMES.length];
  const n = Math.floor(i / BASE_NAMES.length) + 2;
  const isDoc = i % 5 === 4;
  if (isDoc) {
    const d = DOC_POOL[i % DOC_POOL.length];
    const kb = 40 + ((i * 53) % 900);
    const size = i % 7 === 0 ? `${(1 + ((i * 11) % 40) / 10).toFixed(1)} MB` : `${kb} KB`;
    return {
      id: `mg${i}`,
      name: `${base}-${n}.${d.ext}`,
      dim: '—',
      label: d.label,
      thumb: d.thumb,
      fg: d.fg,
      size,
      type: d.type,
      uploaded: AGES[i % AGES.length],
    };
  }
  const img = IMG_POOL[i % IMG_POOL.length];
  const kb = 30 + ((i * 37) % 470);
  return {
    id: `mg${i}`,
    name: `${base}-${n}.${EXT_OF[img.type] ?? 'jpg'}`,
    dim: DIMS[i % DIMS.length],
    label: '',
    thumb: img.thumb,
    fg: img.fg,
    size: `${kb} KB`,
    type: img.type,
    uploaded: AGES[i % AGES.length],
  };
});

export const mediaFiles: MediaFile[] = [...SEED, ...SHARED, ...GENERATED];
