import type { MediaFile, MediaFileType } from '@/lib/app/media-data';

/** Shape of an asset as returned by maildrill-service /v1/media. */
export interface ApiMediaAsset {
  id: string;
  name: string;
  folder?: string | null;
  tags?: string[];
  sizeBytes?: number | null;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
  /** Public CloudFront URL. */
  url: string;
  createdAt?: string | null;
}

const TYPE_BY_MIME: Record<string, MediaFileType> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'PNG',
  'image/webp': 'PNG',
  'image/avif': 'PNG',
  'image/svg+xml': 'SVG',
  'application/pdf': 'PDF',
};

export function typeOf(contentType?: string | null, name?: string): MediaFileType {
  if (contentType && TYPE_BY_MIME[contentType]) return TYPE_BY_MIME[contentType];
  const ext = (name ?? '').split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  if (ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'avif') return 'PNG';
  if (ext === 'svg') return 'SVG';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'xlsx' || ext === 'csv') return 'XLSX';
  return 'DOCX';
}

export function fmtSize(bytes?: number | null): string {
  if (bytes == null) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const THUMBS = [
  'linear-gradient(150deg,#4f46e5,#6d28d9)',
  'linear-gradient(150deg,#06b6d4,#0891b2)',
  'linear-gradient(150deg,#22c55e,#16a34a)',
  'linear-gradient(150deg,#f59e0b,#d97706)',
];

/**
 * Map a stored asset onto the grid's row shape. `preview` carries the real
 * CloudFront URL so image tiles show the actual file; the gradient is only a
 * fallback for formats that can't be rendered inline.
 */
export function toMediaFile(a: ApiMediaAsset, index = 0): MediaFile & {
  preview: string;
  tags: string[];
} {
  const type = typeOf(a.contentType, a.name);
  const isImage = Boolean(a.contentType?.startsWith('image/'));
  return {
    id: a.id,
    name: a.name,
    dim: a.width && a.height ? `${a.width} × ${a.height}` : '—',
    label: isImage ? '' : type,
    thumb: THUMBS[index % THUMBS.length]!,
    fg: '#fff',
    size: fmtSize(a.sizeBytes),
    type,
    uploaded: a.createdAt ?? new Date().toISOString(),
    preview: isImage ? a.url : '',
    tags: a.tags ?? [],
  };
}

export function toMediaFiles(rows: ApiMediaAsset[]) {
  return rows.map((r, i) => toMediaFile(r, i));
}
