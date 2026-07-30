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

/** Built-in type buckets used when an asset has no custom `folder`. */
export const TYPE_FOLDER_ORDER = [
  'Images',
  'Audio',
  'PDF',
  'Spreadsheets',
  'Docs',
] as const;

export type MediaTypeFolder = (typeof TYPE_FOLDER_ORDER)[number];
/** Folder tab value: all files, a custom library folder, or a type bucket. */
export type MediaFolder = 'All files' | string;

/** Map a file type to its default folder bucket. */
export function folderOf(type: MediaFileType): MediaTypeFolder {
  if (type === 'JPEG' || type === 'PNG' || type === 'SVG') return 'Images';
  if (type === 'MP3' || type === 'WAV' || type === 'AUDIO') return 'Audio';
  if (type === 'PDF') return 'PDF';
  if (type === 'XLSX') return 'Spreadsheets';
  return 'Docs';
}

/** Effective library folder for filtering/tabs — custom folder wins over type. */
export function libraryFolderOf(file: {
  folder?: string | null;
  type: MediaFileType;
}): string {
  const custom = file.folder?.trim();
  return custom || folderOf(file.type);
}

/** Display label for a folder slug (e.g. "nature" → "Nature"). */
export function folderLabel(folder: string): string {
  if (folder === 'All files' || (TYPE_FOLDER_ORDER as readonly string[]).includes(folder)) {
    return folder;
  }
  return folder
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// No seed files — the Media Library renders live assets once storage is wired.
export const mediaFiles: MediaFile[] = [];
