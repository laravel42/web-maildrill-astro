import type { MediaFile, MediaFileType } from '@/lib/app/media-data';

/** Shape of an asset as returned by workers /v1/media. */
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
  /** 250×250 cover twin for Grid/List; omit/null falls back to `url`. */
  thumbUrl?: string | null;
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
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/ogg': 'AUDIO',
  'audio/mp4': 'AUDIO',
  'audio/x-m4a': 'AUDIO',
  'audio/aac': 'AUDIO',
};

export function typeOf(contentType?: string | null, name?: string): MediaFileType {
  if (contentType && TYPE_BY_MIME[contentType]) return TYPE_BY_MIME[contentType];
  const ext = (name ?? '').split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  if (ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'avif') return 'PNG';
  if (ext === 'svg') return 'SVG';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'xlsx' || ext === 'csv') return 'XLSX';
  if (ext === 'mp3') return 'MP3';
  if (ext === 'wav') return 'WAV';
  if (ext === 'ogg' || ext === 'm4a' || ext === 'aac') return 'AUDIO';
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
 * Map a stored asset onto the grid's row shape. `preview` prefers the 250×250
 * twin for tiles; `url` stays the full original for download/insert/drawer.
 * Gradient `thumb` is only a fallback for non-image formats.
 */
export function toMediaFile(
  a: ApiMediaAsset,
  index = 0,
): MediaFile & {
  preview: string;
  url: string;
  tags: string[];
  folder: string | null;
  width: number | null;
  height: number | null;
} {
  const type = typeOf(a.contentType, a.name);
  const isImage = Boolean(a.contentType?.startsWith('image/'));
  const width = a.width && a.width > 0 ? a.width : null;
  const height = a.height && a.height > 0 ? a.height : null;
  const tileUrl = (a.thumbUrl?.trim() || a.url) ?? '';
  return {
    id: a.id,
    name: a.name,
    dim: width && height ? `${width} × ${height}` : '—',
    label: isImage ? '' : type,
    thumb: THUMBS[index % THUMBS.length]!,
    fg: '#fff',
    size: fmtSize(a.sizeBytes),
    type,
    /* LATENT DEFECT: `media_assets.created_at` is NOT NULL, so the fallback is
       unreachable — but it fabricates rather than admitting absence, and would
       stamp every affected row "just now" if the column ever went nullable. */
    uploaded: a.createdAt ?? new Date().toISOString(),
    preview: isImage ? tileUrl : '',
    url: a.url ?? '',
    tags: a.tags ?? [],
    folder: a.folder?.trim() || null,
    width,
    height,
  };
}

export function toMediaFiles(rows: ApiMediaAsset[]) {
  return rows.map((r, i) => toMediaFile(r, i));
}
