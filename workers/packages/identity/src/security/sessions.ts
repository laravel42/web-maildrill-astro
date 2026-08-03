import { and, eq, gt, isNull, lt, ne, or } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, authSessions, type AuthSessionRow } from '@maildrill/database';
import { logSecurityEvent } from './events';
import { parseUserAgent } from './ua';

/**
 * Server-side registry for the stateless Auth.js JWT sessions. Every login
 * creates a row; the JWT carries the row id as `sid`; the Astro middleware
 * checks the row so individual sessions can be revoked server-side.
 */

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export async function createAuthSession(
  userId: string,
  amr: string[],
  ctx: RequestContext,
): Promise<AuthSessionRow> {
  const parsed = parseUserAgent(ctx.userAgent);
  const rows = await db
    .insert(authSessions)
    .values({
      userId,
      amr,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      browser: parsed.browser,
      os: parsed.os,
      deviceType: parsed.deviceType,
      expiresAt: new Date(Date.now() + config.security.sessionTtlDays * 86_400_000),
    })
    .returning();
  return rows[0]!;
}

/** Is this session still usable? (exists, unrevoked, unexpired) */
export async function isSessionActive(userId: string, sessionId: string): Promise<boolean> {
  const rows = await db
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

/** Throttled activity stamp — at most one write per minute per session. */
export async function touchSession(userId: string, sessionId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 60_000);
  await db
    .update(authSessions)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        or(isNull(authSessions.lastSeenAt), lt(authSessions.lastSeenAt, cutoff)),
      ),
    )
    .catch(() => undefined);
}

export async function listSessions(userId: string): Promise<AuthSessionRow[]> {
  return db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(authSessions.createdAt);
}

/** Revoke one session the user owns. Returns false when no such live row. */
export async function revokeSession(
  userId: string,
  sessionId: string,
  ctx: RequestContext & { actorSessionId?: string | null },
): Promise<boolean> {
  const rows = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
      ),
    )
    .returning({ id: authSessions.id });
  if (!rows[0]) return false;
  await logSecurityEvent({
    userId,
    type: 'session_revoked',
    sessionId: ctx.actorSessionId ?? null,
    entityId: sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return true;
}

/** Revoke every live session except the caller's. Returns the count. */
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
  ctx: RequestContext,
): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authSessions.userId, userId),
          ne(authSessions.id, currentSessionId),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning({ id: authSessions.id });
    await logSecurityEvent(
      {
        userId,
        type: 'sessions_revoked_others',
        sessionId: currentSessionId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { count: rows.length },
      },
      tx,
    );
    return rows.length;
  });
}

/** Revoke every session row (used by the legacy sign-out-everywhere path). */
export async function revokeAllSessionRows(userId: string): Promise<number> {
  const rows = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
    .returning({ id: authSessions.id });
  return rows.length;
}

/** Stamp a fresh-authentication window on the session after a reauth challenge. */
export async function elevateSession(userId: string, sessionId: string): Promise<Date> {
  const until = new Date(Date.now() + config.security.reauthWindowMinutes * 60_000);
  await db
    .update(authSessions)
    .set({ elevatedUntil: until })
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)));
  return until;
}

/**
 * Recent-authentication gate for sensitive mutations: satisfied by a login
 * (`authTime`) inside the reauth window, or a completed reauth challenge
 * (`elevated_until` in the future).
 */
export async function isElevated(
  userId: string,
  sessionId: string | null,
  authTime: number | null,
): Promise<boolean> {
  const windowMs = config.security.reauthWindowMinutes * 60_000;
  if (authTime && Date.now() - authTime * 1000 < windowMs) return true;
  if (!sessionId) return false;
  const rows = await db
    .select({ elevatedUntil: authSessions.elevatedUntil })
    .from(authSessions)
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)))
    .limit(1);
  const until = rows[0]?.elevatedUntil;
  return Boolean(until && until.getTime() > Date.now());
}
