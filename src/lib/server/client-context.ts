import type { APIContext, AstroCookies } from 'astro';

/**
 * Server-side helpers shared by the auth/security BFF routes: real client
 * context forwarded to the workers service, and the two security cookies.
 * The cookies are HttpOnly — token values never reach page JavaScript.
 */

/** Trusted-device token (`<id>.<secret>`, hash-stored server-side). */
export const TRUSTED_DEVICE_COOKIE = 'md_td';
/** Pending second-factor ticket while the user types their TOTP code. */
export const TWOFA_COOKIE = 'md_2fa';

/** Headers carrying the browser's IP + UA through to the workers service. */
export function clientHeaders(
  ctx: Pick<APIContext, 'request' | 'clientAddress'>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const fwd = ctx.request.headers.get('x-forwarded-for');
  let ip = fwd?.split(',')[0]?.trim() ?? '';
  if (!ip) {
    try {
      ip = ctx.clientAddress;
    } catch {
      // Not available (e.g. prerender contexts) — leave empty.
    }
  }
  if (ip) headers['x-client-ip'] = ip;
  const ua = ctx.request.headers.get('user-agent');
  if (ua) headers['x-client-ua'] = ua;
  return headers;
}

const secure = () => import.meta.env.PROD;

export function setTrustedDeviceCookie(
  cookies: AstroCookies,
  token: string,
  expiresAt: string,
): void {
  cookies.set(TRUSTED_DEVICE_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    expires: new Date(expiresAt),
  });
}

export function setTwofaCookie(cookies: AstroCookies, ticket: string): void {
  cookies.set(TWOFA_COOKIE, ticket, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    maxAge: 300,
  });
}

export function clearTwofaCookie(cookies: AstroCookies): void {
  cookies.delete(TWOFA_COOKIE, { path: '/' });
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
