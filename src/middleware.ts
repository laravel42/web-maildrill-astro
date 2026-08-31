import { defineMiddleware } from 'astro:middleware';
import { getSession } from 'auth-astro/server';
import { mintServiceToken, serviceBaseUrl } from '@/lib/server/service';

const PROTECTED = /^\/(app|dashboard)(\/|$)/;

/** In-process cache of session revocation state, TTL 30s. */
interface RevokeStatus {
  at: string | null;
  sessionRevoked: boolean;
}
const revokeCache = new Map<string, { status: RevokeStatus; expires: number }>();
const REVOKE_TTL_MS = 30_000;

async function fetchRevokeStatus(
  userId: string,
  activeTenantId: string,
  role: string | null | undefined,
  sessionId: string | null,
): Promise<RevokeStatus> {
  const key = `${userId}:${sessionId ?? '-'}`;
  const hit = revokeCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.status;

  const fallback: RevokeStatus = { at: null, sessionRevoked: false };
  try {
    const token = mintServiceToken({ userId, activeTenantId, role, sessionId });
    const res = await fetch(`${serviceBaseUrl()}/v1/me/session-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      revokeCache.set(key, { status: fallback, expires: Date.now() + REVOKE_TTL_MS });
      return fallback;
    }
    const data = (await res.json()) as {
      sessionsRevokedAt?: string | null;
      sessionRevoked?: boolean;
    };
    const status: RevokeStatus = {
      at: data.sessionsRevokedAt ?? null,
      sessionRevoked: Boolean(data.sessionRevoked),
    };
    revokeCache.set(key, { status, expires: Date.now() + REVOKE_TTL_MS });
    return status;
  } catch {
    return fallback;
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
    headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  }
}

// TEMP DEV-ONLY BYPASS — do not commit / do not use in any deployed environment.
// Auth is being reworked in parallel; this lets /app/* render without a real
// session so the email builder can be developed in isolation. Set
// SKIP_AUTH_FOR_BUILDER_WORK=true in your local .env to enable.
const SKIP_AUTH_FOR_BUILDER_WORK = import.meta.env.SKIP_AUTH_FOR_BUILDER_WORK === 'true';

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered (static) routes have no real request — skip session work so we
  // don't touch request headers at build time.
  if (context.isPrerendered) {
    context.locals.session = null;
    return next();
  }

  if (SKIP_AUTH_FOR_BUILDER_WORK) {
    // The BFF proxies (/api/eb/* and /api/v1/*) require a session with a
    // user id (and, for /api/v1, an activeTenantId) — with `null` here they
    // short-circuit to 401 and NEVER forward to the backend, so all AI /
    // workspace calls silently fail even when the backend is up. Populate a
    // dev session so those proxies authorize and forward. Values are
    // overridable via env so they can match the backend's seeded dev IDs.
    context.locals.session = {
      user: {
        id: import.meta.env.DEV_USER_ID ?? 'dev-user',
        email: import.meta.env.DEV_USER_EMAIL ?? 'dev@local.test',
        name: 'Dev User',
      },
      activeTenantId: import.meta.env.DEV_TENANT_ID ?? 'dev-tenant',
      role: import.meta.env.DEV_ROLE ?? 'owner',
    };
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
      sid?: string | null;
    };
    const userId = session.user && 'id' in session.user ? String(session.user.id) : null;
    const authTime = typeof s.authTime === 'number' ? s.authTime : null;
    const tenantId = s.activeTenantId ?? null;

    if (userId && authTime && tenantId) {
      const status = await fetchRevokeStatus(userId, tenantId, s.role, s.sid ?? null);
      // Per-session revocation (Profile → Sessions) or the account-wide
      // kill switch — either signs this request out.
      const revokedSec = status.at ? Math.floor(new Date(status.at).getTime() / 1000) : null;
      if (status.sessionRevoked || (revokedSec !== null && authTime < revokedSec)) {
        const headers = new Headers({ Location: '/login?reason=signed-out' });
        clearAuthCookies(headers);
        return new Response(null, { status: 302, headers });
      }
    }
  }

  return next();
});
