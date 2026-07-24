/**
 * Slim DTO returned by the `/api/images/*` endpoints.
 *
 * We intentionally narrow Unsplash's huge photo payload to only the fields
 * the picker UI needs. The shape is stable across the public and random
 * endpoints so the frontend can treat them uniformly.
 */
export interface UnsplashPhotoDTO {
  /** Upstream Unsplash photo id — persisted on the block as `data-unsplash-id`. */
  id: string;
  /**
   * Directly hotlinkable URLs per API Terms §6. Pick `regular` when inserting
   * into an email (1080px wide) and `thumb`/`small` for the picker grid.
   * `raw` is the Imgix base URL — append your own resize params to it.
   */
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  /** BlurHash string for rendering a placeholder while the tile loads. */
  blurHash: string | null;
  width: number;
  height: number;
  /** Dominant colour — useful as a solid placeholder fallback. */
  color: string | null;
  /** Photographer-supplied description, if any. */
  description: string | null;
  /** Alt text. Falls back to description, then to a generic string. */
  alt: string;
  /**
   * Pre-computed attribution string, e.g. `"Photo by Jane Doe on Unsplash"`.
   * The frontend writes this into the `Image` block's `alt` prop when a
   * photo is selected, preserving photographer credit per API Terms §9.
   */
  attribution: string;
  user: {
    name: string;
    username: string;
    /**
     * Profile URL with UTMs already appended per API Terms §9 requirement.
     * Example: `https://unsplash.com/@janedoe?utm_source=email-builder-online&utm_medium=referral`.
     */
    profileUrl: string;
  };
  links: {
    /** HTML page for the photo on unsplash.com, with UTMs. */
    html: string;
    /**
     * The opaque tracking URL that MUST be hit via `/api/images/track` when
     * the user actually uses the photo (API Terms §6). Do not hit it on hover
     * or on every render — only once per insertion.
     */
    downloadLocation: string;
  };
  /** Unsplash homepage URL with UTMs — used for the "on Unsplash" link in credit lines. */
  unsplashUrl: string;
  /** Registered app name slug — frontend uses this for UTM consistency without hardcoding. */
  appName: string;
}

export interface UnsplashSearchResponseDTO {
  total: number;
  totalPages: number;
  results: UnsplashPhotoDTO[];
  /**
   * `X-Ratelimit-Remaining` echoed from upstream so the frontend can show a
   * warning as we approach the demo quota (50 req/h) or production quota
   * (1000 req/h).
   */
  rateLimitRemaining: number | null;
}
