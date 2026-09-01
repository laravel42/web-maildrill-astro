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

type FetchHealth = NonNullable<ApiAdapters['fetchHealth']>;

/**
 * Everything off for now. Roadmap, in order (see
 * `docs/landing-pages-builder-integration.md`):
 *  - `unsplash` / a Maildrill media-library source — the image work.
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
    unsplash: { enabled: false },
    translate: { enabled: false },
  });

/** Adapters for the landing-page editor as embedded in this workspace. */
export const landingBuilderAdapters: ApiAdapters = {
  fetchHealth: health,
};
