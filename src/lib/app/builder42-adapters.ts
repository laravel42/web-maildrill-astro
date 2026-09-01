/**
 * Adapters handed to the vendored Builder42 editor (`packages/builder42/`).
 *
 * Why this exists at all: the editor's `apiClient.ts` reaches its OWN standalone
 * Express backend on relative `/api/*` paths whenever no adapter is registered.
 * This host has no such backend, so an unset adapter is not "feature off", it is
 * a request to a route that does not exist here — `/api/health` 404s on every
 * mount of the image inspector, and `listPublishedSites`/`translateTexts`/
 * `fetchTranslateUsage` (which have no adapter hook at all) would do the same.
 *
 * Reporting capabilities explicitly is what actually turns those surfaces off:
 * the editor gates them on this response (`ImageSourceField`, `AiSectionGenerator`,
 * `TranslationModal`, `SeoSettings`, `PublishPanel`, and `PublishedSitesList`,
 * which checks `publish.capabilities.list` before it would call the
 * adapter-less endpoint). Flip a flag here as each integration lands.
 */
import type { ApiAdapters } from 'builder42';
import { api } from '@/lib/app/api';
import { anyMatchesSearchQuery } from '@/lib/app/search-match';
import type { ApiMediaAsset } from '@/lib/app/media-map';

type FetchHealth = NonNullable<ApiAdapters['fetchHealth']>;
type ListMedia = NonNullable<ApiAdapters['listMedia']>;
type SearchImages = NonNullable<ApiAdapters['searchImages']>;
type DownloadImage = NonNullable<ApiAdapters['downloadImage']>;

/**
 * Slim DTO returned by `email-builder-api`'s `/api/images/search`
 * (`workers/apps/email-builder-api/src/unsplash/dto.ts`). Only the fields
 * Builder42's `ImageSearchResult` (packages/builder42/shared/api.ts) needs
 * are picked out below — the full DTO also carries `blurHash`,
 * `attribution`, `links.downloadLocation`, etc. that this contract doesn't
 * surface.
 */
interface UnsplashPhotoDto {
  id: string;
  description: string | null;
  urls: { thumb: string; small: string; regular: string };
  user: { name: string; profileUrl: string };
  unsplashUrl: string;
  width: number;
  height: number;
  links: { downloadLocation: string };
}

interface UnsplashSearchResponseDto {
  results: UnsplashPhotoDto[];
  total: number;
  totalPages: number;
}

/**
 * Same-origin, auth-gated proxy already mounted for the email builder's
 * Unsplash picker (`src/pages/api/images/[...path].ts` → `proxyToEbBackend`
 * → `email-builder-api`'s `/api/images/*`, which holds `UNSPLASH_API_KEY`).
 * Reused as-is for the landing editor: no new BFF route, no key exposed to
 * the browser.
 */
const IMAGES_PROXY_BASE = '/api/images';

/**
 * `downloadLocation` (tracking ping URL) and a hotlinkable image URL per
 * photo id, stashed from the search response. `DownloadImageFn`'s contract
 * only passes `photoId` back, so both must be cached here rather than
 * re-derived — Unsplash has no public "fetch by id" URL scheme, only the
 * `urls.*` already returned by search.
 */
const downloadLocationByPhotoId = new Map<string, string>();
const imageUrlByPhotoId = new Map<string, string>();

const searchImages: SearchImages = async (query, page, perPage) => {
  const url = new URL(`${IMAGES_PROXY_BASE}/search`, window.location.origin);
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Unsplash search failed with status ${res.status}`);
  const dto = (await res.json()) as UnsplashSearchResponseDto;

  const results = dto.results.map((photo) => {
    downloadLocationByPhotoId.set(photo.id, photo.links.downloadLocation);
    imageUrlByPhotoId.set(photo.id, photo.urls.regular);
    return {
      id: photo.id,
      description: photo.description,
      urls: photo.urls,
      author: { name: photo.user.name, url: photo.user.profileUrl },
      unsplashUrl: photo.unsplashUrl,
      width: photo.width,
      height: photo.height,
    };
  });

  return { results, total: dto.total, totalPages: dto.totalPages };
};

/**
 * Fires the download-tracking ping (fire-and-forget from the caller's point
 * of view — errors here must not block insertion, per API Terms §6) then
 * fetches the actual image bytes from the URL cached during search, so the
 * editor can inline it as a data URL, same as the email builder's
 * `UnsplashPicker` does.
 */
const downloadImage: DownloadImage = async (photoId) => {
  const downloadLocation = downloadLocationByPhotoId.get(photoId);
  if (downloadLocation) {
    void fetch(`${IMAGES_PROXY_BASE}/track`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ downloadLocation }),
      keepalive: true,
    }).catch(() => undefined);
  }

  const imageUrl = imageUrlByPhotoId.get(photoId);
  if (!imageUrl) {
    throw new Error(`No cached URL for Unsplash photo ${photoId} — search again before selecting`);
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download Unsplash photo ${photoId}`);
  return res.blob();
};

function isImage(a: ApiMediaAsset): boolean {
  if (a.contentType) return a.contentType.startsWith('image/');
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(a.name);
}

/**
 * Lists the tenant's media library for the landing editor's image picker
 * (docs/landing-pages-builder-integration.md §4b). `GET /v1/media` has no
 * server-side query/pagination (it returns every asset — same call
 * `MediaPickerModal` already makes for the email builder's "Browse
 * gallery"), so this filters and paginates in memory to satisfy the
 * `ListMediaFn` contract the editor expects.
 */
const listMedia: ListMedia = async (query, page, perPage) => {
  const res = await api.get<{ data: ApiMediaAsset[] }>('media');
  const images = (res.data ?? [])
    .filter(isImage)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const q = query.trim();
  const filtered = q
    ? images.filter((a) => anyMatchesSearchQuery([a.name, ...(a.tags ?? [])], q))
    : images;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const results = filtered.slice(start, start + perPage).map((a) => ({
    id: a.id,
    url: a.url,
    thumbUrl: a.thumbUrl?.trim() || undefined,
    fileName: a.name,
    mimeType: a.contentType ?? 'application/octet-stream',
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    bytes: a.sizeBytes ?? undefined,
  }));

  return { results, total, totalPages };
};

/**
 * Everything off except the media library and Unsplash. Roadmap, in order
 * (see `docs/landing-pages-builder-integration.md`):
 *  - `publish` — needs tenant domains and a hosting target.
 *  - `ai` — only if a reusable Maildrill AI pipeline exists.
 *  - `translate` — Maildrill has no translation feature; the editor's chrome is
 *    pinned to English (`locale="en"`) and the auto-translate UI stays hidden
 *    rather than removed, so it can be switched on without a code change.
 */
const health: FetchHealth = () =>
  Promise.resolve({
    status: 'ok',
    ai: { enabled: false },
    publish: {
      enabled: false,
      provider: 'none',
      capabilities: {
        customSubdomain: false,
        openableUrl: false,
        list: false,
        remove: false,
      },
    },
    unsplash: { enabled: true },
    media: { enabled: true },
    translate: { enabled: false },
  });

/** Adapters for the landing-page editor as embedded in this workspace. */
export const landingBuilderAdapters: ApiAdapters = {
  fetchHealth: health,
  listMedia,
  searchImages,
  downloadImage,
};
