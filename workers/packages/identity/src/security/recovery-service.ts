import { and, eq, isNull } from 'drizzle-orm';
import { db, recoveryCodes } from '@maildrill/database';
import { logSecurityEvent } from './events';
import { generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode } from './recovery-codes';
import { isTotpEnabled } from './totp-service';
import type { RequestContext } from './sessions';

/**
 * Recovery-code consumption and regeneration. Codes exist only while the
 * authenticator is enabled; each is single-use, enforced by a guarded UPDATE.
 */

export async function consumeRecoveryCode(
  userId: string,
  code: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<boolean> {
  if (!looksLikeRecoveryCode(code)) return false;
  const rows = await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(recoveryCodes.userId, userId),
        eq(recoveryCodes.codeHash, hashRecoveryCode(code)),
        isNull(recoveryCodes.usedAt),
      ),
    )
    .returning({ id: recoveryCodes.id });
  if (!rows[0]) return false;
  await logSecurityEvent({
    userId,
    type: 'recovery_code_used',
    sessionId: ctx.sessionId ?? null,
    entityId: rows[0].id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return true;
}

/**
 * Replace the whole set. Only valid while 2FA is enabled; every previous code
 * (used or not) is invalidated in the same transaction. Plaintext is returned
 * exactly once.
 */
export async function regenerateRecoveryCodes(
  userId: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<string[] | null> {
  if (!(await isTotpEnabled(userId))) return null;
  const codes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx
      .insert(recoveryCodes)
      .values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })));
    await logSecurityEvent(
      {
        userId,
        type: 'recovery_codes_regenerated',
        sessionId: ctx.sessionId ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { count: codes.length },
      },
      tx,
    );
  });
  return codes;
}
