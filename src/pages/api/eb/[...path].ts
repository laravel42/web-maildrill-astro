import type { APIRoute } from 'astro';
import { proxyToEbBackend } from '@/lib/server/eb-proxy';

export const prerender = false;

/**
 * BFF proxy for the email builder's AI backend (generation, themes, prompt
 * improvement, inline text). The browser calls same-origin `/api/eb/*`; this
 * forwards to `@eb/backend` at `/api/*`, keeping provider keys server-side.
 */
export const ALL: APIRoute = (ctx) => proxyToEbBackend(ctx, ctx.params.path ?? '');
