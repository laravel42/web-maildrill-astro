import { defineMiddleware } from 'astro:middleware';
import { getSession } from 'auth-astro/server';
import { mintServiceToken, serviceBaseUrl } from '@/lib/server/service';

const PROTECTED = /^\/(app|dashboard)(\/|$)/;

/** In-process cache of sessionsRevokedAt ISO strings (or null), TTL 30s. */
const revokeCache = new Map<string, { at: string | null; expires: number }>();
const REVOKE_TTL_MS = 30_000;

async function fetchSessionsRevokedAt(
  userId: string,
  activeTenantId: string,
  role: string | null | undefined,
): Promise<string | null> {
  const hit = revokeCache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.at;

  try {
    const token = mintServiceToken({ userId, activeTenantId, role });
    const res = await fetch(`${serviceBaseUrl()}/v1/me/session-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      revokeCache.set(userId, { at: null, expires: Date.now() + REVOKE_TTL_MS });
      return null;
    }
    const data = (await res.json()) as { sessionsRevokedAt?: string | null };
    const at = data.sessionsRevokedAt ?? null;
    revokeCache.set(userId, { at, expires: Date.now() + REVOKE_TTL_MS });
    return at;
  } catch {
    return null;
  }
}

function clearAuthCookies(headers: Headers): void {
  const names = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
  ];
  for (const name of names) {
    headers.append(
      'Set-Cookie',
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered (static) routes have no real request — skip session work so we
  // don't touch request headers at build time.
  if (context.isPrerendered) {
    context.locals.session = null;
    return next();
  }

  const session = await getSession(context.request);
  context.locals.session = (session as unknown as App.Locals['session']) ?? null;

  if (PROTECTED.test(context.url.pathname)) {
    if (!session) {
      return context.redirect(`/login?next=${encodeURIComponent(context.url.pathname)}`);
    }

    const s = session as typeof session & {
      authTime?: number | null;
      activeTenantId?: string | null;
      role?: string | null;
    };
    const userId = session.user && 'id' in session.user ? String(session.user.id) : null;
    const authTime = typeof s.authTime === 'number' ? s.authTime : null;
    const tenantId = s.activeTenantId ?? null;

    if (userId && authTime && tenantId) {
      const revokedIso = await fetchSessionsRevokedAt(userId, tenantId, s.role);
      if (revokedIso) {
        const revokedSec = Math.floor(new Date(revokedIso).getTime() / 1000);
        if (authTime < revokedSec) {
          const headers = new Headers({ Location: '/login?reason=signed-out' });
          clearAuthCookies(headers);
          return new Response(null, { status: 302, headers });
        }
      }
    }
  }

  return next();
});
