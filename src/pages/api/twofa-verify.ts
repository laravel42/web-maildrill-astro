import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';
import {
  TWOFA_COOKIE,
  clearTwofaCookie,
  clientHeaders,
  json,
  setTrustedDeviceCookie,
  setTwofaCookie,
} from '@/lib/server/client-context';

export const prerender = false;

/**
 * BFF: complete the second factor (TOTP or recovery code) for the pending
 * challenge held in the HttpOnly 2FA cookie. Success returns a one-time login
 * ticket for `signIn('credentials')` and, when "remember this device" was
 * chosen, sets the trusted-device cookie.
 */
export const POST: APIRoute = async (ctx) => {
  const { request, cookies } = ctx;
  const twofaTicket = cookies.get(TWOFA_COOKIE)?.value;
  if (!twofaTicket) return json(401, { error: 'challenge_expired' });

  const body = (await request.json().catch(() => ({}))) as {
    totp?: unknown;
    recoveryCode?: unknown;
    rememberDevice?: unknown;
  };
  const totp = typeof body.totp === 'string' ? body.totp.trim() : '';
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  if (!totp && !recoveryCode) return json(400, { error: 'code required' });

  let res: Response;
  try {
    res = await fetch(`${serviceBaseUrl()}/v1/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...clientHeaders(ctx) },
      body: JSON.stringify({
        twofaTicket,
        ...(totp ? { totp } : {}),
        ...(recoveryCode ? { recoveryCode } : {}),
        rememberDevice: body.rememberDevice === true,
      }),
    });
  } catch {
    return json(502, { error: 'auth_backend_unreachable' });
  }

  if (res.status === 429) return json(429, { error: 'rate_limited' });
  if (!res.ok) {
    // A wrong code re-issues a fresh single-use challenge ticket — keep the
    // cookie current so the user can retry without restarting login.
    const data = (await res.json().catch(() => ({}))) as { twofaTicket?: string };
    if (data.twofaTicket) {
      setTwofaCookie(cookies, data.twofaTicket);
      return json(401, { error: 'invalid_code' });
    }
    clearTwofaCookie(cookies);
    return json(401, { error: 'challenge_expired' });
  }

  const data = (await res.json()) as {
    ticket: string;
    trustedDevice: { token: string; expiresAt: string } | null;
  };
  clearTwofaCookie(cookies);
  if (data.trustedDevice) {
    setTrustedDeviceCookie(cookies, data.trustedDevice.token, data.trustedDevice.expiresAt);
  }
  return json(200, { ticket: data.ticket });
};
