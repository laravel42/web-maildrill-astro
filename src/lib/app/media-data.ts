/**
 * Types and folder vocabulary for the Media Library screen (AppMedia.tsx). The
 * seed/generated file fixtures were removed — media will come from the service
 * once storage is wired. Only the record shape and folder buckets remain.
 */

export type MediaFileType = 'JPEG' | 'PNG' | 'SVG' | 'PDF' | 'XLSX' | 'DOCX' | 'MP3' | 'WAV' | 'AUDIO';

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
export const FOLDER_ORDER = [
  'All files',
  'Images',
  'Audio',
  'PDF',
  'Spreadsheets',
  'Docs',
] as const;
export type MediaFolder = (typeof FOLDER_ORDER)[number];

/** Map a file type to its folder bucket. */
export function folderOf(type: MediaFileType): Exclude<MediaFolder, 'All files'> {
  if (type === 'JPEG' || type === 'PNG' || type === 'SVG') return 'Images';
  if (type === 'MP3' || type === 'WAV' || type === 'AUDIO') return 'Audio';
  if (type === 'PDF') return 'PDF';
  if (type === 'XLSX') return 'Spreadsheets';
  return 'Docs';
}

// No seed files — the Media Library renders live assets once storage is wired.
export const mediaFiles: MediaFile[] = [];
