import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import {
  authSessions,
  db,
  magicLinkTokens,
  securityEvents,
  users,
  type User,
} from '@maildrill/database';

const E164 = /^\+\d{7,16}$/;

export function isValidE164(phone: string): boolean {
  return E164.test(phone);
}

/** Deep-ish merge for profile preferences: top-level keys replace; `notifications` merges. */
export function mergePreferences(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'notifications' && value && typeof value === 'object' && !Array.isArray(value)) {
      const prev =
        current.notifications &&
        typeof current.notifications === 'object' &&
        !Array.isArray(current.notifications)
          ? (current.notifications as Record<string, unknown>)
          : {};
      next.notifications = { ...prev, ...(value as Record<string, unknown>) };
    } else {
      next[key] = value;
    }
  }
  return next;
}

export async function findOrCreateUser(
  email: string,
  name?: string | null,
  phone?: string | null,
): Promise<{ user: User; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const inserted = await db
    .insert(users)
    .values({ email: normalized, name: name ?? null, phone: phone ?? null })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (inserted[0]) return { user: inserted[0], created: true };

  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const user = existing[0]!;

  // Sign-up verify can race after a prior login-code create: stamp missing
  // profile fields when the form provided them.
  const nextName = !user.name && name?.trim() ? name.trim() : undefined;
  let nextPhone: string | undefined;
  if (!user.phone && phone?.trim()) {
    const raw = phone.trim();
    const candidate = isValidE164(raw)
      ? raw
      : isValidE164(`+${raw.replace(/\D/g, '')}`)
        ? `+${raw.replace(/\D/g, '')}`
        : undefined;
    if (candidate) nextPhone = candidate;
  }

  if (nextName === undefined && nextPhone === undefined) {
    return { user, created: false };
  }

  const updated = await db
    .update(users)
    .set({
      ...(nextName !== undefined ? { name: nextName } : {}),
      ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();
  return { user: updated[0]!, created: false };
}

export async function getUser(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export type UpdateMeInput = {
  name?: string | null;
  phone?: string | null;
  preferences?: Record<string, unknown>;
};

export async function updateMe(userId: string, input: UpdateMeInput): Promise<User | null> {
  const current = await getUser(userId);
  if (!current) return null;

  if (input.phone !== undefined && input.phone !== null && input.phone !== '') {
    if (!isValidE164(input.phone)) {
      throw new Error('invalid_phone');
    }
  }

  const set: {
    updatedAt: Date;
    name?: string | null;
    phone?: string | null;
    preferences?: Record<string, unknown>;
  } = { updatedAt: new Date() };

  if (input.name !== undefined) set.name = input.name?.trim() || null;
  if (input.phone !== undefined) {
    set.phone = input.phone === null || input.phone === '' ? null : input.phone;
  }
  if (input.preferences) {
    const currentPrefs =
      current.preferences && typeof current.preferences === 'object'
        ? (current.preferences as Record<string, unknown>)
        : {};
    set.preferences = mergePreferences(currentPrefs, input.preferences);
  }

  const rows = await db.update(users).set(set).where(eq(users.id, userId)).returning();
  return rows[0] ?? null;
}

export type RecentSignIn = { at: string; method: 'login_code' };

export async function listRecentSignIns(email: string, limit = 10): Promise<RecentSignIn[]> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({
      consumedAt: magicLinkTokens.consumedAt,
      createdAt: magicLinkTokens.createdAt,
    })
    .from(magicLinkTokens)
    .where(and(eq(magicLinkTokens.email, normalized), isNotNull(magicLinkTokens.consumedAt)))
    .orderBy(desc(magicLinkTokens.consumedAt))
    .limit(limit);

  return rows.map((r) => ({
    at: (r.consumedAt ?? r.createdAt).toISOString(),
    method: 'login_code' as const,
  }));
}

export async function revokeAllSessions(
  userId: string,
): Promise<{ sessionsRevokedAt: Date } | null> {
  const user = await getUser(userId);
  if (!user) return null;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ sessionsRevokedAt: now, updatedAt: now })
      .where(eq(users.id, userId));
    await tx
      .delete(magicLinkTokens)
      .where(and(eq(magicLinkTokens.email, user.email), isNull(magicLinkTokens.consumedAt)));
    // Session rows too, so the per-session registry agrees with the kill switch.
    await tx
      .update(authSessions)
      .set({ revokedAt: now })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
    await tx.insert(securityEvents).values({
      userId,
      eventType: 'sessions_revoked_all',
      metadata: {},
    });
  });
  return { sessionsRevokedAt: now };
}

/** Epoch seconds for Auth.js iat comparison; null means never revoked. */
export async function getSessionsRevokedAt(userId: string): Promise<Date | null> {
  const user = await getUser(userId);
  return user?.sessionsRevokedAt ?? null;
}
