import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';
import { clientHeaders, json } from '@/lib/server/client-context';

export const prerender = false;

/** BFF: WebAuthn authentication options for the login page (discoverable). */
export const POST: APIRoute = async (ctx) => {
  try {
    const res = await fetch(`${serviceBaseUrl()}/v1/auth/passkey/options`, {
      method: 'POST',
      headers: clientHeaders(ctx),
    });
    if (res.status === 429) return json(429, { error: 'rate_limited' });
    if (!res.ok) return json(502, { error: 'auth_backend_unreachable' });
    return json(200, await res.json());
  } catch {
    return json(502, { error: 'auth_backend_unreachable' });
  }
};
