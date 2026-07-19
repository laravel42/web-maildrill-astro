import type { APIRoute } from 'astro';

export const prerender = false;

/** Base URL of the EmailBuilder.js AI/image backend (@eb/backend). */
function ebBaseUrl(): string {
  return process.env.EB_BACKEND_URL ?? import.meta.env.EB_BACKEND_URL ?? 'http://localhost:3100';
}

/**
 * BFF proxy for the email builder's backend (AI generation, themes, prompt
 * improvement, Unsplash). The browser calls same-origin `/api/eb/*`; this route
 * forwards to `@eb/backend` (keeping provider API keys server-side) and streams
 * the response through unbuffered so SSE token streams reach the editor live.
 * Requires an authenticated session — only signed-in users can spend AI budget.
 */
export const ALL: APIRoute = async ({ request, params, locals }) => {
  if (!locals.session?.user?.id) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const target = `${ebBaseUrl()}/api/${params.path ?? ''}${url.search}`;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');
  if (contentType) headers['content-type'] = contentType;
  if (accept) headers['accept'] = accept;

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const raw = await request.text();
    if (raw) body = raw;
  }

  let res: Response;
  try {
    res = await fetch(target, { method: request.method, headers, body });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'ai_backend_unreachable',
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  // Pass the (possibly streaming) body straight through.
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-cache, no-transform',
    },
  });
};
