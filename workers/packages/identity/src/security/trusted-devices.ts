import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, trustedDevices, type TrustedDeviceRow } from '@maildrill/database';
import type { Tx } from '@maildrill/database';
import {
  composeOpaqueToken,
  mintOpaqueSecret,
  secretMatchesHash,
  splitOpaqueToken,
} from './crypto';
import { logSecurityEvent } from './events';
import { deviceLabel, parseUserAgent } from './ua';
import type { RequestContext } from './sessions';

/**
 * Devices the user chose to trust after a second-factor challenge. The
 * browser holds `<rowId>.<secret>` in an HttpOnly cookie; only sha256(secret)
 * is stored, so a DB leak can't mint valid device tokens. Trust is the token,
 * never a fingerprint.
 */

export interface IssuedTrustedDevice {
  id: string;
  token: string;
  expiresAt: Date;
}

export async function issueTrustedDevice(
  userId: string,
  ctx: RequestContext,
  tx?: Tx,
): Promise<IssuedTrustedDevice> {
  const runner = tx ?? db;
  const { secret, hash } = mintOpaqueSecret();
  const parsed = parseUserAgent(ctx.userAgent);
  const expiresAt = new Date(Date.now() + config.security.trustedDeviceTtlDays * 86_400_000);
  const rows = await runner
    .insert(trustedDevices)
    .values({
      userId,
      tokenHash: hash,
      name: deviceLabel(ctx.userAgent),
      browser: parsed.browser,
      os: parsed.os,
      ip: ctx.ip ?? null,
      expiresAt,
    })
    .returning({ id: trustedDevices.id });
  const id = rows[0]!.id;
  await logSecurityEvent(
    { userId, type: 'trusted_device_added', entityId: id, ip: ctx.ip, userAgent: ctx.userAgent },
    tx,
  );
  return { id, token: composeOpaqueToken(id, secret), expiresAt };
}

/**
 * Validate a presented device token for a user. Bumps `last_used_at` on
 * success. Never a bypass for a revoked/expired row or another user's device.
 */
export async function validateTrustedDevice(
  userId: string,
  token: string | null | undefined,
): Promise<TrustedDeviceRow | null> {
  if (!token) return null;
  const parts = splitOpaqueToken(token);
  if (!parts) return null;
  const rows = await db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.id, parts.id),
        eq(trustedDevices.userId, userId),
        isNull(trustedDevices.revokedAt),
        gt(trustedDevices.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !secretMatchesHash(parts.secret, row.tokenHash)) return null;
  await db
    .update(trustedDevices)
    .set({ lastUsedAt: new Date() })
    .where(eq(trustedDevices.id, row.id))
    .catch(() => undefined);
  return row;
}

/** The row id a presented token claims — for the "this device" UI marker. */
export function trustedDeviceIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return splitOpaqueToken(token)?.id ?? null;
}

export async function listTrustedDevices(userId: string): Promise<TrustedDeviceRow[]> {
  return db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, userId),
        isNull(trustedDevices.revokedAt),
        gt(trustedDevices.expiresAt, new Date()),
      ),
    )
    .orderBy(trustedDevices.createdAt);
}

export async function revokeTrustedDevice(
  userId: string,
  deviceId: string,
  ctx: RequestContext & { actorSessionId?: string | null },
): Promise<boolean> {
  const rows = await db
    .update(trustedDevices)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(trustedDevices.id, deviceId),
        eq(trustedDevices.userId, userId),
        isNull(trustedDevices.revokedAt),
      ),
    )
    .returning({ id: trustedDevices.id });
  if (!rows[0]) return false;
  await logSecurityEvent({
    userId,
    type: 'trusted_device_revoked',
    sessionId: ctx.actorSessionId ?? null,
    entityId: deviceId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return true;
}

/** Revoke all trusted devices except (optionally) the current one. */
export async function revokeOtherTrustedDevices(
  userId: string,
  keepDeviceId: string | null,
  ctx: RequestContext & { actorSessionId?: string | null },
): Promise<number> {
  return db.transaction(async (tx) => {
    const conditions = [eq(trustedDevices.userId, userId), isNull(trustedDevices.revokedAt)];
    if (keepDeviceId) conditions.push(ne(trustedDevices.id, keepDeviceId));
    const rows = await tx
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: trustedDevices.id });
    await logSecurityEvent(
      {
        userId,
        type: 'trusted_devices_revoked_others',
        sessionId: ctx.actorSessionId ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { count: rows.length, keptCurrent: Boolean(keepDeviceId) },
      },
      tx,
    );
    return rows.length;
  });
}

/** Drop every trusted device — used when the authenticator is disabled. */
export async function revokeAllTrustedDevices(userId: string, tx?: Tx): Promise<number> {
  const runner = tx ?? db;
  const rows = await runner
    .update(trustedDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(trustedDevices.userId, userId), isNull(trustedDevices.revokedAt)))
    .returning({ id: trustedDevices.id });
  return rows.length;
}
