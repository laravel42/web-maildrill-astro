/**
 * URL helpers for the thumbnail GET endpoint family.
 *
 * Path layout on the backend:
 *
 *   /dev/sections/:role/:id/thumbnail
 *   /dev/layouts/:shape/:id/thumbnail
 *   /dev/templates/:id/thumbnail
 *
 * The rest of the app uses the SINGULAR form of each category
 * (`'section'`, `'layout'`, `'template'`) — same as
 * `LibraryComponentCategory` from `./dnd`. We accept the singular
 * here and pluralise to the URL segment internally so callers don't
 * have to remember to map.
 *
 * Primitives and Themes do NOT have static thumbnails (the former
 * render inline, the latter use a CSS swatch + hover live preview),
 * so this resolver intentionally rejects those categories.
 */

import { resolveBackendUrl } from '../../../components/UnsplashImagePicker/unsplash-api';

/** Categories that have a sibling .png thumbnail file on disk. */
export type ThumbnailUrlCategory = 'section' | 'layout' | 'template';

/** Map our singular categories to their plural URL segment. */
const URL_SEGMENT: Record<ThumbnailUrlCategory, string> = {
  section: 'sections',
  layout: 'layouts',
  template: 'templates',
};

/**
 * Build the absolute URL for a saved item's thumbnail. Templates do
 * not have an axis (`null`); sections / layouts must pass their role
 * / shape value verbatim — the backend validates against its own
 * enums.
 */
export function resolveThumbnailUrl(
  category: ThumbnailUrlCategory,
  axis: string | null,
  id: string,
): string {
  const base = resolveBackendUrl();
  const segment = URL_SEGMENT[category];
  if (category === 'template') {
    return `${base}/dev/${segment}/${encodeURIComponent(id)}/thumbnail`;
  }
  if (axis === null) {
    throw new Error(`category '${category}' requires an axis but received null`);
  }
  return `${base}/dev/${segment}/${encodeURIComponent(axis)}/${encodeURIComponent(id)}/thumbnail`;
}
