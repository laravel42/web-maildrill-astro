import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';
import {
  TRUSTED_DEVICE_COOKIE,
  clientHeaders,
  json,
  setTwofaCookie,
} from '@/lib/server/client-context';

export const prerender = false;

/**
 * BFF: verify an emailed sign-in code (first factor). Consumes the code and
 * answers with either a one-time login ticket for `signIn('credentials')`, or
 * a second-factor challenge (the 2FA ticket rides an HttpOnly cookie — never
 * the page). A valid trusted-device cookie skips the challenge.
 */
export const POST: APIRoute = async (ctx) => {
  const { request, cookies } = ctx;
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    code?: unknown;
    name?: unknown;
    phone?: unknown;
  };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!email || !code) return json(400, { error: 'email and code required' });

  const trustedDevice = cookies.get(TRUSTED_DEVICE_COOKIE)?.value;
  let res: Response;
  try {
    res = await fetch(`${serviceBaseUrl()}/v1/auth/code/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...clientHeaders(ctx) },
      body: JSON.stringify({
        email,
        code,
        grant: 'ticket',
        ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
        ...(typeof body.phone === 'string' && body.phone.trim()
          ? { phone: body.phone.trim() }
          : {}),
        ...(trustedDevice ? { trustedDeviceToken: trustedDevice } : {}),
      }),
    });
  } catch {
    return json(502, { error: 'auth_backend_unreachable' });
  }

  if (res.status === 429) return json(429, { error: 'rate_limited' });
  if (!res.ok) return json(401, { error: 'invalid_or_expired' });

  const data = (await res.json()) as
    { requiresSecondFactor: true; twofaTicket: string } | { ticket: string };
  if ('requiresSecondFactor' in data) {
    setTwofaCookie(cookies, data.twofaTicket);
    return json(200, { requiresSecondFactor: true });
  }
  return json(200, { ticket: data.ticket });
};
