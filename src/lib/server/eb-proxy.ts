import type { APIContext } from 'astro';

/**
 * Base URL of the EmailBuilder.js AI/image backend.
 *
 * Defaults to the product/unified API origin (`pnpm dev` mounts EB on the same
 * port). Set `EB_API_BASE_URL` (e.g. http://localhost:3003) when the builder
 * runs as its own process (Docker / Ploi split).
 */
export function ebBaseUrl(): string {
  return (
    process.env.EB_API_BASE_URL ??
    import.meta.env.EB_API_BASE_URL ??
    process.env.API_BASE_URL ??
    import.meta.env.API_BASE_URL ??
    'http://localhost:3001'
  );
}

/**
 * Auth-gated streaming proxy to @eb/backend. `subPath` is appended to
 * `${ebBaseUrl()}/api/`. Keeps provider keys server-side and streams the
 * (possibly SSE) response through unbuffered. Returns 401 without a session and
 * a clean 502 when the backend is unreachable.
 */
export async function proxyToEbBackend(ctx: APIContext, subPath: string): Promise<Response> {
  const { request, locals } = ctx;
  if (!locals.session?.user?.id) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const target = `${ebBaseUrl()}/api/${subPath}${url.search}`;

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

  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-cache, no-transform',
    },
  });
}
