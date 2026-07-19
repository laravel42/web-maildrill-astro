import type { APIRoute } from 'astro';
import { proxyToEbBackend } from '@/lib/server/eb-proxy';

export const prerender = false;

/**
 * Same-origin proxy for the editor's Unsplash image picker. The builder fetches
 * `<origin>/api/images/{search,track,quota}`; this forwards to `@eb/backend`,
 * which holds the Unsplash Access Key. Requires an authenticated session.
 */
export const ALL: APIRoute = (ctx) => proxyToEbBackend(ctx, `images/${ctx.params.path ?? ''}`);
