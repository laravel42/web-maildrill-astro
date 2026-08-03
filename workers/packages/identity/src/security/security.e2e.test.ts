import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, db, magicLinkTokens, users } from '@maildrill/database';
import { sha256Hex } from '@maildrill/domain';
import { findOrCreateUser } from '../users';
import {
  completeSecondFactor,
  consumeRecoveryCode,
  confirmTotpSetup,
  consumeTicket,
  disableTotp,
  elevateSession,
  exchangeLoginTicket,
  getTotpStatus,
  isElevated,
  isSessionActive,
  isTotpEnabled,
  issueTicket,
  issueTrustedDevice,
  listPasskeys,
  listSecurityEvents,
  listSessions,
  listTrustedDevices,
  loginWithCode,
  loginWithPasskey,
  regenerateRecoveryCodes,
  removePasskey,
  revokeOtherSessions,
  revokeSession,
  revokeTrustedDevice,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  startTotpSetup,
  totpCodeAt,
  validateTrustedDevice,
  verifyPasskeyAssertion,
  completePasskeyRegistration,
} from './index';
import { FakeAuthenticator } from './testing/fake-authenticator';

// Needs real Postgres. Enable with: RUN_E2E=1 pnpm test
const run = process.env.RUN_E2E === '1';

const CTX = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36' };

/** Unique throwaway account per call; rows cascade-delete with the user. */
async function freshUser(tag: string) {
  const email = `sec-${tag}-${process.pid}-${process.hrtime.bigint()}@example.com`;
  const { user } = await findOrCreateUser(email, 'Security Test', null);
  return user;
}

/** Plant a login code directly (the e2e path used by the Playwright setup). */
let codeSeq = 0;
async function plantLoginCode(email: string): Promise<string> {
  // Unique per call: the token hash is unique-indexed and verify consumes it.
  codeSeq += 1;
  const code = String(100_000 + ((codeSeq * 7919) % 900_000)).slice(0, 6);
  await db.insert(magicLinkTokens).values({
    email,
    tokenHash: sha256Hex(`${email}:${code}`),
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  return code;
}

describe.skipIf(!run)('account security flows (e2e — needs Postgres)', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id));
    }
    await closeDb();
  });

  async function trackedUser(tag: string) {
    const user = await freshUser(tag);
    createdUserIds.push(user.id);
    return user;
  }

  // -----------------------------------------------------------------------
  // Magic-link login + sessions
  // -----------------------------------------------------------------------

  it('code login without 2FA creates a revocable session (magic-link regression)', async () => {
    const user = await trackedUser('login');
    const code = await plantLoginCode(user.email);
    const outcome = await loginWithCode({ email: user.email, code }, CTX);
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.result.user.id).toBe(user.id);
    expect(outcome.amr).toEqual(['code']);

    expect(await isSessionActive(user.id, outcome.sessionId)).toBe(true);
    const sessions = await listSessions(user.id);
    expect(sessions.map((s) => s.id)).toContain(outcome.sessionId);
    expect(sessions[0]!.browser).toBe('Chrome');

    // Consumed codes cannot log in twice.
    const replay = await loginWithCode({ email: user.email, code }, CTX);
    expect(replay.status).toBe('invalid');

    // Individual revocation.
    expect(await revokeSession(user.id, outcome.sessionId, CTX)).toBe(true);
    expect(await isSessionActive(user.id, outcome.sessionId)).toBe(false);
    expect(await revokeSession(user.id, outcome.sessionId, CTX)).toBe(false);
  });

  it('revoke-others keeps only the current session', async () => {
    const user = await trackedUser('revoke-others');
    const sessions = [];
    for (let i = 0; i < 3; i += 1) {
      const code = await plantLoginCode(user.email);
      const outcome = await loginWithCode({ email: user.email, code }, CTX);
      if (outcome.status === 'ok') sessions.push(outcome.sessionId);
    }
    expect(sessions).toHaveLength(3);
    const keep = sessions[2]!;
    const revoked = await revokeOtherSessions(user.id, keep, CTX);
    expect(revoked).toBe(2);
    expect(await isSessionActive(user.id, keep)).toBe(true);
    expect(await isSessionActive(user.id, sessions[0]!)).toBe(false);
  });

  it('users cannot touch each other’s sessions', async () => {
    const alice = await trackedUser('alice');
    const mallory = await trackedUser('mallory');
    const code = await plantLoginCode(alice.email);
    const outcome = await loginWithCode({ email: alice.email, code }, CTX);
    if (outcome.status !== 'ok') throw new Error('login failed');
    expect(await revokeSession(mallory.id, outcome.sessionId, CTX)).toBe(false);
    expect(await isSessionActive(alice.id, outcome.sessionId)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // TOTP + recovery codes + trusted devices
  // -----------------------------------------------------------------------

  it('runs the full 2FA lifecycle: setup, challenge, recovery, trusted device, disable', async () => {
    const user = await trackedUser('twofa');

    // Setup: unconfirmed rows never count as enabled.
    const setup = await startTotpSetup(user.id, user.email, { ...CTX, sessionId: null });
    expect(setup).not.toBeNull();
    expect(setup!.otpauthUrl).toContain('otpauth://totp/');
    expect(await isTotpEnabled(user.id)).toBe(false);

    // Confirm with a live code → enabled + one-time recovery codes.
    const confirmed = await confirmTotpSetup(user.id, totpCodeAt(setup!.secret, Date.now()), {
      ...CTX,
      sessionId: null,
    });
    expect(confirmed).not.toBeNull();
    expect(confirmed!.recoveryCodes).toHaveLength(10);
    expect(await isTotpEnabled(user.id)).toBe(true);
    const status = await getTotpStatus(user.id);
    expect(status.recoveryCodesRemaining).toBe(10);

    // Login now demands the second factor.
    const code = await plantLoginCode(user.email);
    const first = await loginWithCode({ email: user.email, code }, CTX);
    expect(first.status).toBe('requires_second_factor');
    if (first.status !== 'requires_second_factor') return;

    // Wrong TOTP: rejected, but a fresh challenge ticket allows a retry.
    const bad = await completeSecondFactor(
      { twofaTicket: first.twofaTicket.ticket, totp: '000000' },
      CTX,
    );
    expect(bad.status).toBe('invalid_retry');
    if (bad.status !== 'invalid_retry') return;

    // The consumed ticket cannot be replayed.
    const replayed = await completeSecondFactor(
      { twofaTicket: first.twofaTicket.ticket, totp: '000000' },
      CTX,
    );
    expect(replayed.status).toBe('invalid');

    // Correct TOTP (next window, ahead of the confirm step) + remember device.
    const good = await completeSecondFactor(
      {
        twofaTicket: bad.twofaTicket.ticket,
        totp: totpCodeAt(setup!.secret, Date.now() + 30_000),
        rememberDevice: true,
      },
      CTX,
    );
    expect(good.status).toBe('ok');
    if (good.status !== 'ok') return;
    expect(good.trustedDevice).not.toBeNull();

    // Exchange the login ticket for identity + session (single-use).
    const exchanged = await exchangeLoginTicket(good.loginTicket.ticket, CTX);
    expect(exchanged.status).toBe('ok');
    if (exchanged.status !== 'ok') return;
    expect(exchanged.amr).toEqual(['code', 'totp']);
    const again = await exchangeLoginTicket(good.loginTicket.ticket, CTX);
    expect(again.status).toBe('invalid');

    // The trusted device skips the next challenge.
    const code2 = await plantLoginCode(user.email);
    const trustedLogin = await loginWithCode(
      { email: user.email, code: code2, trustedDeviceToken: good.trustedDevice!.token },
      CTX,
    );
    expect(trustedLogin.status).toBe('ok');
    if (trustedLogin.status === 'ok') {
      expect(trustedLogin.amr).toEqual(['code', 'trusted_device']);
    }

    // Trusted-device validation is scoped and revocable.
    const other = await trackedUser('other');
    expect(await validateTrustedDevice(other.id, good.trustedDevice!.token)).toBeNull();
    expect(await revokeTrustedDevice(user.id, good.trustedDevice!.id, CTX)).toBe(true);
    expect(await validateTrustedDevice(user.id, good.trustedDevice!.token)).toBeNull();

    // Recovery codes: single-use, then regeneration invalidates the rest.
    const recovery = confirmed!.recoveryCodes[0]!;
    expect(await consumeRecoveryCode(user.id, recovery, { ...CTX, sessionId: null })).toBe(true);
    expect(await consumeRecoveryCode(user.id, recovery, { ...CTX, sessionId: null })).toBe(false);
    const regenerated = await regenerateRecoveryCodes(user.id, { ...CTX, sessionId: null });
    expect(regenerated).toHaveLength(10);
    const oldCode = confirmed!.recoveryCodes[1]!;
    expect(await consumeRecoveryCode(user.id, oldCode, { ...CTX, sessionId: null })).toBe(false);
    expect(
      await consumeRecoveryCode(user.id, regenerated![0]!, { ...CTX, sessionId: null }),
    ).toBe(true);

    // A recovery code also satisfies the login challenge.
    const code3 = await plantLoginCode(user.email);
    const challenge3 = await loginWithCode({ email: user.email, code: code3 }, CTX);
    expect(challenge3.status).toBe('requires_second_factor');
    if (challenge3.status === 'requires_second_factor') {
      const viaRecovery = await completeSecondFactor(
        { twofaTicket: challenge3.twofaTicket.ticket, recoveryCode: regenerated![1]! },
        CTX,
      );
      expect(viaRecovery.status).toBe('ok');
    }

    // Disable: everything 2FA-related goes with it.
    expect(await disableTotp(user.id, { ...CTX, sessionId: null })).toBe(true);
    expect(await isTotpEnabled(user.id)).toBe(false);
    expect((await getTotpStatus(user.id)).recoveryCodesRemaining).toBe(0);
    expect(await listTrustedDevices(user.id)).toHaveLength(0);
    const code4 = await plantLoginCode(user.email);
    const relogin = await loginWithCode({ email: user.email, code: code4 }, CTX);
    expect(relogin.status).toBe('ok');

    // The audit trail recorded the journey.
    const events = await listSecurityEvents(user.id);
    const types = events.map((e) => e.eventType);
    for (const expected of [
      'totp_setup_started',
      'totp_enabled',
      'recovery_codes_generated',
      'failed_second_factor',
      'trusted_device_added',
      'trusted_device_revoked',
      'recovery_code_used',
      'recovery_codes_regenerated',
      'totp_disabled',
      'login_completed',
    ]) {
      expect(types).toContain(expected);
    }
    // No secrets in the log.
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(setup!.secret);
    for (const c of regenerated!) expect(serialized).not.toContain(c);
  });

  // -----------------------------------------------------------------------
  // Passkeys (full ceremonies against the DB-backed service)
  // -----------------------------------------------------------------------

  it('registers, uses, and removes a passkey end to end', async () => {
    const user = await trackedUser('passkey');
    const authr = new FakeAuthenticator({ userHandle: user.id });

    // Registration.
    const reg = await startPasskeyRegistration(user.id, user.email, 'Security Test');
    const completed = await completePasskeyRegistration(
      user.id,
      reg.challengeId,
      authr.register(reg.options.challenge) as never,
      'Test key',
      { ...CTX, sessionId: null },
    );
    expect('passkey' in completed).toBe(true);
    if (!('passkey' in completed)) return;
    expect(completed.passkey.name).toBe('Test key');

    // A consumed registration challenge cannot be replayed.
    const replay = await completePasskeyRegistration(
      user.id,
      reg.challengeId,
      authr.register(reg.options.challenge) as never,
      null,
      { ...CTX, sessionId: null },
    );
    expect('error' in replay && replay.error).toBe('invalid_challenge');

    // The same credential cannot be registered twice.
    const reg2 = await startPasskeyRegistration(user.id, user.email, null);
    const dup = await completePasskeyRegistration(
      user.id,
      reg2.challengeId,
      authr.register(reg2.options.challenge) as never,
      null,
      { ...CTX, sessionId: null },
    );
    expect('error' in dup && dup.error).toBe('duplicate_credential');

    // Login via discoverable assertion → ticket → session with webauthn amr.
    const auth = await startPasskeyAuthentication('authentication', null);
    const login = await loginWithPasskey(
      auth.challengeId,
      authr.authenticate(auth.options.challenge) as never,
      CTX,
    );
    expect(login.status).toBe('ok');
    if (login.status !== 'ok') return;
    const session = await exchangeLoginTicket(login.loginTicket.ticket, CTX);
    expect(session.status).toBe('ok');
    if (session.status === 'ok') expect(session.amr).toEqual(['webauthn']);

    // Counter advanced on the stored credential.
    const stored = await listPasskeys(user.id);
    expect(stored[0]!.counter).toBe(1);
    expect(stored[0]!.lastUsedAt).not.toBeNull();

    // A stale (cloned-authenticator) counter is rejected.
    const auth2 = await startPasskeyAuthentication('authentication', null);
    const staleAssertion = authr.authenticate(auth2.options.challenge, { counter: 1 });
    const stale = await verifyPasskeyAssertion(
      'authentication',
      auth2.challengeId,
      staleAssertion as never,
      null,
      CTX,
    );
    expect(stale).toBeNull();

    // Ownership: another user cannot rename/remove it.
    const other = await trackedUser('pk-other');
    expect(await removePasskey(other.id, stored[0]!.id, { ...CTX, sessionId: null })).toBe(false);
    expect(await removePasskey(user.id, stored[0]!.id, { ...CTX, sessionId: null })).toBe(true);
    expect(await listPasskeys(user.id)).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Tickets + elevation
  // -----------------------------------------------------------------------

  it('tickets are single-use, purpose-bound, and expire', async () => {
    const user = await trackedUser('tickets');
    const { ticket } = await issueTicket(user.id, 'login', ['code']);
    expect(await consumeTicket(ticket, 'twofa')).toBeNull(); // wrong purpose
    expect(await consumeTicket(ticket, 'login')).toEqual({ userId: user.id, amr: ['code'] });
    expect(await consumeTicket(ticket, 'login')).toBeNull(); // spent
    expect(await consumeTicket('bogus.token', 'login')).toBeNull();
  });

  it('recent-authentication gate honors login freshness and elevation', async () => {
    const user = await trackedUser('elevation');
    const code = await plantLoginCode(user.email);
    const outcome = await loginWithCode({ email: user.email, code }, CTX);
    if (outcome.status !== 'ok') throw new Error('login failed');
    const sid = outcome.sessionId;

    const nowSec = Math.floor(Date.now() / 1000);
    // Fresh login (authTime now) is elevated; a day-old one is not.
    expect(await isElevated(user.id, sid, nowSec)).toBe(true);
    expect(await isElevated(user.id, sid, nowSec - 86_400)).toBe(false);
    // A reauth challenge stamps the session.
    const until = await elevateSession(user.id, sid);
    expect(until.getTime()).toBeGreaterThan(Date.now());
    expect(await isElevated(user.id, sid, nowSec - 86_400)).toBe(true);
    // Another user's sid never elevates.
    const other = await trackedUser('elev-other');
    expect(await isElevated(other.id, sid, nowSec - 86_400)).toBe(false);
  });

  it('trusted devices expire', async () => {
    const user = await trackedUser('td-expiry');
    const device = await issueTrustedDevice(user.id, CTX);
    // Force-expire the row, then validation must fail.
    const { trustedDevices } = await import('@maildrill/database');
    await db
      .update(trustedDevices)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(trustedDevices.id, device.id));
    expect(await validateTrustedDevice(user.id, device.token)).toBeNull();
  });
});
