import type { APIRoute } from 'astro';
import { mintServiceToken, v1BackendBaseUrl } from '@/lib/server/service';
import { TRUSTED_DEVICE_COOKIE, clientHeaders } from '@/lib/server/client-context';

export const prerender = false;

/**
 * BFF proxy: island mutations/reads hit this same-origin route, which mints a
 * tenant-scoped JWT and forwards to workers. The browser never holds
 * a service credential. `/v1/messages*` goes to the messaging API when
 * `MESSAGING_API_BASE_URL` is set; everything else hits the product API.
 */
export const ALL: APIRoute = async (ctx) => {
  const { request, params, locals, cookies } = ctx;
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
    // Session id + login instant power per-session revocation and the
    // recent-authentication gate on sensitive security mutations.
    sessionId: session.sid ?? null,
    authTime: session.authTime ?? null,
  });
  const url = new URL(request.url);
  const path = params.path ?? '';
  const target = `${v1BackendBaseUrl(path)}/v1/${path}${url.search}`;

  // Only forward a body (and its content-type) when there actually is one — a
  // bodyless request (e.g. DELETE) must not carry `content-type: application/json`
  // with an empty body, which Fastify rejects as a malformed JSON payload.
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    // Browser context for session/device bookkeeping in the security routes.
    ...clientHeaders(ctx),
  };
  const trustedDevice = cookies.get(TRUSTED_DEVICE_COOKIE)?.value;
  if (trustedDevice) headers['x-trusted-device'] = trustedDevice;
  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const raw = await request.text();
    if (raw) {
      body = raw;
      headers['content-type'] = request.headers.get('content-type') ?? 'application/json';
    }
  }

  let res: Response;
  try {
    res = await fetch(target, { method: request.method, headers, body });
  } catch (err) {
    // Backend cold-start / restart (tsx watch) surfaces as undici "fetch failed"
    // + ECONNREFUSED. Map that to a clean 502 so the island can recover instead
    // of an unhandled TypeError in the Astro endpoint.
    const cause = err instanceof Error ? err.cause : undefined;
    const detail =
      cause instanceof Error
        ? cause.message
        : err instanceof Error
          ? err.message
          : 'upstream unreachable';
    console.error(`[bff] upstream fetch failed → ${target}: ${detail}`);
    return new Response(
      JSON.stringify({
        error: 'bad_gateway',
        message: 'Product API is unreachable. If you just restarted, wait a second and retry.',
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  }
  const out = new Headers({
    'content-type': res.headers.get('content-type') ?? 'application/json',
    // Every route here is authenticated, tenant-scoped, and mutable — a
    // browser or intermediary reusing a response would show one workspace's
    // data as another's, or serve provider state (e.g. domain verification)
    // that has since changed.
    'cache-control': 'no-store, no-cache, must-revalidate',
  });

  // File responses need their disposition to survive the proxy. Rebuilding the
  // header map from scratch dropped it, so every receipt downloaded as
  // `receipt.pdf` — the last path segment — instead of its own number, and a
  // second download silently became `receipt (1).pdf`. Copied explicitly
  // rather than forwarding everything: the upstream's own cache-control,
  // set-cookie and CORS headers must NOT leak through this boundary.
  const disposition = res.headers.get('content-disposition');
  if (disposition) out.set('content-disposition', disposition);

  return new Response(res.body, { status: res.status, headers: out });
};
