import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';

export const prerender = false;

/**
 * Public entry point for webhook-triggered automations.
 *
 * Unauthenticated by design — the unguessable token in the path is the credential, because
 * the caller is somebody else's system with no Maildrill session. This proxies to the
 * backend so the URL customers are given lives on the app's own domain and the product API
 * never has to be exposed publicly. It is also why no internal Activepieces or backend URL
 * is ever shown to a customer.
 *
 * Deliberately narrow: only POST, only the body and query, a hard size cap, and no header
 * pass-through beyond content-type. Everything else the backend decides.
 */
const MAX_BODY_BYTES = 128 * 1024;

export const POST: APIRoute = async ({ params, request, url }) => {
  const token = params.token;
  if (!token || token.length < 16 || token.length > 128) {
    return json({ error: 'not_found' }, 404);
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }

  try {
    const target = `${serviceBaseUrl()}/webhooks/automations/${encodeURIComponent(token)}${url.search}`;
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
        // Forwarded so the run log can show where a delivery came from; nothing
        // authenticates on it.
        ...(request.headers.get('user-agent')
          ? { 'user-agent': request.headers.get('user-agent') as string }
          : {}),
      },
      body: body.length > 0 ? body : '{}',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return json({ error: 'service_unavailable' }, 503);
  }
};

/** Anything that is not a POST is answered identically to an unknown token. */
export const ALL: APIRoute = async () => json({ error: 'not_found' }, 404);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
