import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db, recoveryCodes, userTotp } from '@maildrill/database';
import { decryptSecret, encryptSecret } from './crypto';
import { logSecurityEvent } from './events';
import { hashRecoveryCode, generateRecoveryCodes } from './recovery-codes';
import { revokeAllTrustedDevices } from './trusted-devices';
import { generateTotpSecret, totpSetupUri, verifyTotpCode } from './totp';
import type { RequestContext } from './sessions';

/**
 * TOTP authenticator lifecycle. A row with `confirmed_at` null is an
 * in-progress setup: it never satisfies a challenge, and starting setup again
 * replaces it. Confirmation is what turns 2FA on — and atomically issues the
 * recovery-code set.
 */

export interface TotpStatus {
  enabled: boolean;
  enabledAt: Date | null;
  pendingSetup: boolean;
  recoveryCodesRemaining: number;
}

export async function getTotpStatus(userId: string): Promise<TotpStatus> {
  const rows = await db.select().from(userTotp).where(eq(userTotp.userId, userId)).limit(1);
  const row = rows[0];
  const remaining = row?.confirmedAt
    ? await db
        .select({ id: recoveryCodes.id })
        .from(recoveryCodes)
        .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))
        .then((r) => r.length)
    : 0;
  return {
    enabled: Boolean(row?.confirmedAt),
    enabledAt: row?.confirmedAt ?? null,
    pendingSetup: Boolean(row && !row.confirmedAt),
    recoveryCodesRemaining: remaining,
  };
}

export async function isTotpEnabled(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userTotp.id })
    .from(userTotp)
    .where(and(eq(userTotp.userId, userId), isNotNull(userTotp.confirmedAt)))
    .limit(1);
  return Boolean(rows[0]);
}

export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
}

/**
 * Begin (or restart) authenticator setup. Refuses when 2FA is already
 * confirmed — the authenticator must be disabled first. The plaintext secret
 * leaves the server only here, during setup.
 */
export async function startTotpSetup(
  userId: string,
  accountLabel: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<TotpSetup | null> {
  if (await isTotpEnabled(userId)) return null;
  const secret = generateTotpSecret();
  const secretEnc = encryptSecret(secret);
  await db.transaction(async (tx) => {
    await tx.delete(userTotp).where(and(eq(userTotp.userId, userId), isNull(userTotp.confirmedAt)));
    await tx.insert(userTotp).values({ userId, secretEnc });
    await logSecurityEvent(
      {
        userId,
        type: 'totp_setup_started',
        sessionId: ctx.sessionId ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
  });
  return { secret, otpauthUrl: totpSetupUri(secret, accountLabel) };
}

/**
 * Confirm setup with a live code. On success the row becomes active and a
 * fresh recovery-code set is generated in the same transaction — the
 * plaintext codes are returned exactly once.
 */
export async function confirmTotpSetup(
  userId: string,
  code: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<{ recoveryCodes: string[] } | null> {
  const rows = await db
    .select()
    .from(userTotp)
    .where(and(eq(userTotp.userId, userId), isNull(userTotp.confirmedAt)))
    .limit(1);
  const pending = rows[0];
  if (!pending) return null;
  const check = verifyTotpCode(decryptSecret(pending.secretEnc), code);
  if (!check.ok) return null;

  const codes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx
      .update(userTotp)
      .set({ confirmedAt: new Date(), lastUsedStep: check.step, updatedAt: new Date() })
      .where(eq(userTotp.id, pending.id));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx
      .insert(recoveryCodes)
      .values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })));
    await logSecurityEvent(
      {
        userId,
        type: 'totp_enabled',
        sessionId: ctx.sessionId ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
    await logSecurityEvent(
      {
        userId,
        type: 'recovery_codes_generated',
        sessionId: ctx.sessionId ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { count: codes.length },
      },
      tx,
    );
  });
  return { recoveryCodes: codes };
}

/**
 * Disable the authenticator: removes the TOTP config, all recovery codes and
 * all trusted devices in one transaction — none of them mean anything without
 * a second factor.
 */
export async function disableTotp(
  userId: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<boolean> {
  const rows = await db
    .select({ id: userTotp.id, confirmedAt: userTotp.confirmedAt })
    .from(userTotp)
    .where(eq(userTotp.userId, userId))
    .limit(1);
  if (!rows[0]) return false;
  await db.transaction(async (tx) => {
    await tx.delete(userTotp).where(eq(userTotp.userId, userId));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await revokeAllTrustedDevices(userId, tx);
    await logSecurityEvent(
      {
        userId,
        type: 'totp_disabled',
        sessionId: ctx.sessionId ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
  });
  return true;
}

/**
 * Check a TOTP code against the user's confirmed secret, advancing the replay
 * guard on success.
 */
export async function verifyTotpForUser(userId: string, code: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(userTotp)
    .where(and(eq(userTotp.userId, userId), isNotNull(userTotp.confirmedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  const check = verifyTotpCode(decryptSecret(row.secretEnc), code, {
    lastUsedStep: row.lastUsedStep,
  });
  if (!check.ok) return false;
  await db
    .update(userTotp)
    .set({ lastUsedStep: check.step, updatedAt: new Date() })
    .where(eq(userTotp.id, row.id));
  return true;
}
