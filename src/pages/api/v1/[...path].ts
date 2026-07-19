import type { APIRoute } from 'astro';
import { mintServiceToken, serviceBaseUrl } from '@/lib/server/service';

export const prerender = false;

/**
 * BFF proxy: island mutations/reads hit this same-origin route, which mints a
 * tenant-scoped JWT and forwards to maildrill-service. The browser never holds
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

  const init: RequestInit = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': request.headers.get('content-type') ?? 'application/json',
    },
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const res = await fetch(target, init);
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
};
