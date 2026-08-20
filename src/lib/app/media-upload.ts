/**
 * Upload an image into the workspace media library (presigned S3 PUT + confirm).
 * Used by the email builder's Upload tab and any other host that needs the
 * same path as AppMedia without opening the media modal.
 */
import { api } from '@/lib/app/api';
import type { ApiMediaAsset } from '@/lib/app/media-map';
import {
  downscaleToMaxEdge,
  imageToThumb250File,
  toKebabCase,
} from '@/components/react/AppMedia.logic';

/** Turn a `data:` URL (what ImageInput reads via FileReader) into a File. */
export function dataUrlToFile(dataUrl: string, baseName = 'upload'): File {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('invalid image data');
  const contentType = m[1]!;
  const binary = atob(m[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = (contentType.split('/')[1] ?? 'bin').replace('jpeg', 'jpg');
  const safe = toKebabCase(baseName) || 'upload';
  return new File([bytes], `${safe}.${ext}`, { type: contentType });
}

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not decode image'));
      el.src = url;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload a profile photo. Avatars go through the `/me/avatar` endpoints and
 * live under their own `avatars/<userId>/` S3 prefix — apart from the
 * `tenants/<id>/` media-library objects — and are never registered as media
 * assets. Returns the public URL the profile should display.
 */
export async function uploadAvatarPhoto(file: File): Promise<string> {
  const ticket = await api.post<{ storageKey: string; uploadUrl: string; publicUrl: string }>(
    'me/avatar/upload-ticket',
    { filename: file.name, contentType: file.type, sizeBytes: file.size },
  );
  const put = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`upload failed (${put.status})`);
  await api.post('me/avatar', { storageKey: ticket.storageKey });
  return ticket.publicUrl;
}

export async function uploadMediaFile(
  input: File,
  opts?: { name?: string; folder?: string | null },
): Promise<ApiMediaAsset> {
  // Cap the longest edge at 1024 before any bytes leave the browser.
  const file = await downscaleToMaxEdge(input);
  const ticket = await api.post<{ storageKey: string; uploadUrl: string; publicUrl?: string }>(
    'media/upload-url',
    { filename: file.name, contentType: file.type, sizeBytes: file.size },
  );
  const put = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`upload failed (${put.status})`);

  let thumbStorageKey: string | null = null;
  try {
    const thumb = await imageToThumb250File(file);
    if (thumb) {
      const thumbTicket = await api.post<{ storageKey: string; uploadUrl: string }>(
        'media/upload-url',
        { filename: thumb.name, contentType: thumb.type, sizeBytes: thumb.size },
      );
      const thumbPut = await fetch(thumbTicket.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': thumb.type },
        body: thumb,
      });
      if (thumbPut.ok) thumbStorageKey = thumbTicket.storageKey;
    }
  } catch {
    /* preview falls back to full URL */
  }

  const dims = await imageSize(file);
  const name =
    toKebabCase(opts?.name ?? file.name.replace(/\.[^.]+$/, '')) || `upload-${Date.now()}`;

  return api.post<ApiMediaAsset>('media', {
    storageKey: ticket.storageKey,
    name,
    contentType: file.type,
    sizeBytes: file.size,
    folder: opts?.folder ?? null,
    tags: [],
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    thumbStorageKey,
  });
}
