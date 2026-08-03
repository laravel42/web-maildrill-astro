import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getUser } from '../users';
import { requestLoginCode, verifyLoginCode } from '../magic-link';
import { logSecurityEvent } from './events';
import { consumeRecoveryCode } from './recovery-service';
import { elevateSession, type RequestContext } from './sessions';
import { verifyTotpForUser } from './totp-service';
import { startPasskeyAuthentication, verifyPasskeyAssertion } from './webauthn';

/**
 * Step-up ("recent authentication") challenges. Sensitive mutations require a
 * fresh login or a completed challenge here; success stamps
 * `elevated_until` on the caller's session row.
 */

export type ReauthMethod = 'totp' | 'recovery' | 'passkey' | 'code';

interface ReauthCtx extends RequestContext {
  sessionId: string;
}

async function finish(
  userId: string,
  ctx: ReauthCtx,
  method: ReauthMethod,
  ok: boolean,
): Promise<{ ok: boolean; elevatedUntil: Date | null }> {
  if (!ok) {
    await logSecurityEvent({
      userId,
      type: 'reauth_failed',
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { method },
    });
    return { ok: false, elevatedUntil: null };
  }
  const until = await elevateSession(userId, ctx.sessionId);
  await logSecurityEvent({
    userId,
    type: 'reauth_succeeded',
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { method },
  });
  return { ok: true, elevatedUntil: until };
}

export async function reauthWithTotp(
  userId: string,
  code: string,
  ctx: ReauthCtx,
): Promise<{ ok: boolean; elevatedUntil: Date | null }> {
  return finish(userId, ctx, 'totp', await verifyTotpForUser(userId, code));
}

export async function reauthWithRecoveryCode(
  userId: string,
  code: string,
  ctx: ReauthCtx,
): Promise<{ ok: boolean; elevatedUntil: Date | null }> {
  return finish(userId, ctx, 'recovery', await consumeRecoveryCode(userId, code, ctx));
}

export async function startReauthPasskey(userId: string) {
  return startPasskeyAuthentication('reauth', userId);
}

export async function reauthWithPasskey(
  userId: string,
  challengeId: string,
  response: AuthenticationResponseJSON,
  ctx: ReauthCtx,
): Promise<{ ok: boolean; elevatedUntil: Date | null }> {
  const assertion = await verifyPasskeyAssertion('reauth', challengeId, response, userId, ctx);
  return finish(userId, ctx, 'passkey', Boolean(assertion));
}

/** Email a fresh code to the account address (magic-link-only accounts). */
export async function requestReauthCode(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;
  await requestLoginCode(user.email);
  return true;
}

/** Verify an emailed code for step-up. Consumes the code like a login would. */
export async function reauthWithEmailCode(
  userId: string,
  code: string,
  ctx: ReauthCtx,
): Promise<{ ok: boolean; elevatedUntil: Date | null }> {
  const user = await getUser(userId);
  if (!user) return finish(userId, ctx, 'code', false);
  const result = await verifyLoginCode(user.email, code);
  return finish(userId, ctx, 'code', Boolean(result && result.user.id === userId));
}
