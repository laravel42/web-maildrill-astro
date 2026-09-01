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
 * Everything off for now except the media library. Roadmap, in order (see
 * `docs/landing-pages-builder-integration.md`):
 *  - `publish` — needs tenant domains and a hosting target.
 *  - `unsplash` — complementary to the media library, not required by it.
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
    unsplash: { enabled: false },
    media: { enabled: true },
    translate: { enabled: false },
  });

/** Adapters for the landing-page editor as embedded in this workspace. */
export const landingBuilderAdapters: ApiAdapters = {
  fetchHealth: health,
  listMedia,
};
