import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';
import { clientHeaders, json } from '@/lib/server/client-context';

export const prerender = false;

/**
 * BFF: verify a WebAuthn assertion from the login page. Success returns a
 * one-time login ticket for `signIn('credentials')`; failures are generic.
 */
export const POST: APIRoute = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as {
    challengeId?: unknown;
    credential?: unknown;
  };
  if (
    typeof body.challengeId !== 'string' ||
    !body.credential ||
    typeof body.credential !== 'object'
  ) {
    return json(400, { error: 'invalid_request' });
  }
  try {
    const res = await fetch(`${serviceBaseUrl()}/v1/auth/passkey/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...clientHeaders(ctx) },
      body: JSON.stringify({ challengeId: body.challengeId, credential: body.credential }),
    });
    if (res.status === 429) return json(429, { error: 'rate_limited' });
    if (!res.ok) return json(401, { error: 'invalid_or_expired' });
    return json(200, await res.json());
  } catch {
    return json(502, { error: 'auth_backend_unreachable' });
  }
};
