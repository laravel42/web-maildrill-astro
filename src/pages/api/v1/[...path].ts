import type { APIRoute } from 'astro';
import { mintServiceToken, serviceBaseUrl } from '@/lib/server/service';

export const prerender = false;

/**
 * BFF proxy: island mutations/reads hit this same-origin route, which mints a
 * tenant-scoped JWT and forwards to workers. The browser never holds
 * a service credential.
 */
export const ALL: APIRoute = async ({ request, params, locals }) => {
  const session = locals.session;
  if (!session?.user?.id || !session.activeTenantId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const token = mintServiceToken({
    userId: session.user.id,
    activeTenantId: session.activeTenantId,
    role: session.role,
  });
  const url = new URL(request.url);
  const target = `${serviceBaseUrl()}/v1/${params.path ?? ''}${url.search}`;

  // Only forward a body (and its content-type) when there actually is one — a
  // bodyless request (e.g. DELETE) must not carry `content-type: application/json`
  // with an empty body, which Fastify rejects as a malformed JSON payload.
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const raw = await request.text();
    if (raw) {
      body = raw;
      headers['content-type'] = request.headers.get('content-type') ?? 'application/json';
    }
  }

  const res = await fetch(target, { method: request.method, headers, body });
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      // Every route here is authenticated, tenant-scoped, and mutable — a
      // browser or intermediary reusing a response would show one workspace's
      // data as another's, or serve provider state (e.g. domain verification)
      // that has since changed.
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
};
