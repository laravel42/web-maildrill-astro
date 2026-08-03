import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { config } from '@maildrill/config';
import { db, passkeys, webauthnChallenges, type PasskeyRow } from '@maildrill/database';
import { createLogger } from '@maildrill/observability';
import { deviceLabel } from './ua';
import { logSecurityEvent } from './events';
import type { RequestContext } from './sessions';

const log = createLogger({ component: 'webauthn' });

/**
 * WebAuthn ceremonies. Challenges are server-generated, stored hashed-equal
 * (they are public within the ceremony), bound to a purpose (and user for
 * registration/reauth), single-use, and expire after five minutes. All
 * verification — origin, rpID, signature, counter, credential ownership —
 * happens server-side via @simplewebauthn/server.
 */

export type ChallengePurpose = 'registration' | 'authentication' | 'reauth';

const CHALLENGE_TTL_MS = 5 * 60_000;
/**
 * Browser-enforced ceremony deadline, sent in the options. Deliberately above
 * the frontend's own timers (30s without a platform authenticator, 90s with —
 * see src/lib/app/webauthn.ts) so the client aborts first with a message that
 * names the missing hardware, instead of the browser's opaque NotAllowedError.
 */
const CEREMONY_TIMEOUT_MS = 120_000;

async function storeChallenge(
  purpose: ChallengePurpose,
  challenge: string,
  userId: string | null,
): Promise<string> {
  // Opportunistic sweep so abandoned ceremonies don't accumulate.
  await db
    .delete(webauthnChallenges)
    .where(lt(webauthnChallenges.expiresAt, new Date(Date.now() - 3_600_000)))
    .catch(() => undefined);
  const rows = await db
    .insert(webauthnChallenges)
    .values({
      userId,
      purpose,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning({ id: webauthnChallenges.id });
  return rows[0]!.id;
}

/**
 * Atomically consume a stored challenge. Consumed on retrieval — before
 * verification — so a failed verification still burns the challenge and the
 * response can never be replayed.
 */
async function consumeChallenge(
  challengeId: string,
  purpose: ChallengePurpose,
  userId: string | null,
): Promise<string | null> {
  const now = new Date();
  const conditions = [
    eq(webauthnChallenges.id, challengeId),
    eq(webauthnChallenges.purpose, purpose),
    isNull(webauthnChallenges.consumedAt),
    gt(webauthnChallenges.expiresAt, now),
  ];
  if (userId) conditions.push(eq(webauthnChallenges.userId, userId));
  const rows = await db
    .update(webauthnChallenges)
    .set({ consumedAt: now })
    .where(and(...conditions))
    .returning({ challenge: webauthnChallenges.challenge });
  return rows[0]?.challenge ?? null;
}

// ---------------------------------------------------------------------------
// Registration (Profile page, authenticated)
// ---------------------------------------------------------------------------

export interface RegistrationOptionsResult {
  options: PublicKeyCredentialCreationOptionsJSON;
  challengeId: string;
}

export async function startPasskeyRegistration(
  userId: string,
  email: string,
  displayName: string | null,
): Promise<RegistrationOptionsResult> {
  const existing = await listPasskeys(userId);
  const options = await generateRegistrationOptions({
    rpName: config.security.rpName,
    rpID: config.security.rpId,
    userName: email,
    userDisplayName: displayName ?? email,
    timeout: CEREMONY_TIMEOUT_MS,
    attestationType: 'none',
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: p.transports as never,
    })),
    authenticatorSelection: {
      // Discoverable where supported; both platform (Touch ID, Face ID,
      // Windows Hello, Android) and cross-platform (security keys) allowed.
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257], // ES256 + RS256
  });
  const challengeId = await storeChallenge('registration', options.challenge, userId);
  return { options, challengeId };
}

export interface CompletedRegistration {
  passkey: PasskeyRow;
}

export async function completePasskeyRegistration(
  userId: string,
  challengeId: string,
  response: RegistrationResponseJSON,
  name: string | null,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<
  | CompletedRegistration
  | { error: 'invalid_challenge' | 'verification_failed' | 'duplicate_credential' }
> {
  const challenge = await consumeChallenge(challengeId, 'registration', userId);
  if (!challenge) return { error: 'invalid_challenge' };

  let verified = false;
  let info: Awaited<ReturnType<typeof verifyRegistrationResponse>>['registrationInfo'];
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.security.webauthnOrigins,
      expectedRPID: config.security.rpId,
      requireUserVerification: false,
    });
    verified = result.verified;
    info = result.registrationInfo;
  } catch (err) {
    log.warn({ err: (err as Error).message, userId }, 'passkey registration rejected');
  }
  if (!verified || !info) {
    await logSecurityEvent({
      userId,
      type: 'passkey_login_failed',
      sessionId: ctx.sessionId ?? null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { phase: 'registration' },
    });
    return { error: 'verification_failed' };
  }

  const { credential, credentialDeviceType, credentialBackedUp } = info;
  const duplicate = await db
    .select({ id: passkeys.id })
    .from(passkeys)
    .where(eq(passkeys.credentialId, credential.id))
    .limit(1);
  if (duplicate[0]) return { error: 'duplicate_credential' };

  const rows = await db
    .insert(passkeys)
    .values({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name?.trim() || deviceLabel(ctx.userAgent),
    })
    .returning();
  const passkey = rows[0]!;
  await logSecurityEvent({
    userId,
    type: 'passkey_registered',
    sessionId: ctx.sessionId ?? null,
    entityId: passkey.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { name: passkey.name, deviceType: passkey.deviceType },
  });
  return { passkey };
}

// ---------------------------------------------------------------------------
// Authentication (login page, unauthenticated; also reauth challenges)
// ---------------------------------------------------------------------------

export interface AuthenticationOptionsResult {
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}

/**
 * Options for a discoverable-credential login: no user handle up front, no
 * allowCredentials (which would leak whether an email has passkeys). For a
 * reauth challenge the user is known, so the challenge row is user-bound.
 */
export async function startPasskeyAuthentication(
  purpose: 'authentication' | 'reauth',
  userId: string | null,
): Promise<AuthenticationOptionsResult> {
  const options = await generateAuthenticationOptions({
    rpID: config.security.rpId,
    timeout: CEREMONY_TIMEOUT_MS,
    userVerification: 'preferred',
    allowCredentials: [],
  });
  const challengeId = await storeChallenge(purpose, options.challenge, userId);
  return { options, challengeId };
}

export interface PasskeyAssertionSuccess {
  passkey: PasskeyRow;
  userVerified: boolean;
}

/**
 * Verify an assertion. Looks the credential up by id (which also determines
 * the user for discoverable login), verifies signature/origin/rpID against
 * the consumed challenge, enforces credential ownership when a user is
 * expected, and persists the new counter.
 */
export async function verifyPasskeyAssertion(
  purpose: 'authentication' | 'reauth',
  challengeId: string,
  response: AuthenticationResponseJSON,
  expectedUserId: string | null,
  ctx: RequestContext,
): Promise<PasskeyAssertionSuccess | null> {
  const challenge = await consumeChallenge(challengeId, purpose, expectedUserId);
  if (!challenge) return null;

  const rows = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, response.id))
    .limit(1);
  const passkey = rows[0];
  if (!passkey || (expectedUserId && passkey.userId !== expectedUserId)) {
    await logSuspiciousAssertion(
      expectedUserId ?? passkey?.userId ?? null,
      ctx,
      'unknown_credential',
    );
    return null;
  }

  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.security.webauthnOrigins,
      expectedRPID: config.security.rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports as never,
      },
      requireUserVerification: false,
    });
    if (!result.verified) {
      await logSuspiciousAssertion(passkey.userId, ctx, 'not_verified');
      return null;
    }
    await db
      .update(passkeys)
      .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() })
      .where(eq(passkeys.id, passkey.id));
    return { passkey, userVerified: result.authenticationInfo.userVerified };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'passkey assertion rejected');
    await logSuspiciousAssertion(passkey.userId, ctx, 'verification_error');
    return null;
  }
}

async function logSuspiciousAssertion(
  userId: string | null,
  ctx: RequestContext,
  reason: string,
): Promise<void> {
  if (!userId) return; // no user to attribute the event to
  await logSecurityEvent({
    userId,
    type: 'passkey_login_failed',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { reason },
  });
}

// ---------------------------------------------------------------------------
// Credential management
// ---------------------------------------------------------------------------

export async function listPasskeys(userId: string): Promise<PasskeyRow[]> {
  return db.select().from(passkeys).where(eq(passkeys.userId, userId)).orderBy(passkeys.createdAt);
}

export async function renamePasskey(
  userId: string,
  passkeyId: string,
  name: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<boolean> {
  const rows = await db
    .update(passkeys)
    .set({ name: name.trim() })
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)))
    .returning({ id: passkeys.id });
  if (!rows[0]) return false;
  await logSecurityEvent({
    userId,
    type: 'passkey_renamed',
    sessionId: ctx.sessionId ?? null,
    entityId: passkeyId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { name: name.trim() },
  });
  return true;
}

export async function removePasskey(
  userId: string,
  passkeyId: string,
  ctx: RequestContext & { sessionId?: string | null },
): Promise<boolean> {
  const rows = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)))
    .returning({ id: passkeys.id, name: passkeys.name });
  if (!rows[0]) return false;
  await logSecurityEvent({
    userId,
    type: 'passkey_removed',
    sessionId: ctx.sessionId ?? null,
    entityId: passkeyId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { name: rows[0].name },
  });
  return true;
}
