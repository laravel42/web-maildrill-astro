import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getMe, verifyLoginCode, type VerifyResult } from '../magic-link';
import { decideCodeLogin, decidePasskeyLogin } from './assurance';
import { logSecurityEvent } from './events';
import { consumeRecoveryCode } from './recovery-service';
import { createAuthSession, type RequestContext } from './sessions';
import { consumeTicket, issueTicket, type IssuedTicket } from './tickets';
import { isTotpEnabled, verifyTotpForUser } from './totp-service';
import {
  issueTrustedDevice,
  validateTrustedDevice,
  type IssuedTrustedDevice,
} from './trusted-devices';
import { verifyPasskeyAssertion } from './webauthn';

/**
 * Login orchestration — the flows behind /v1/auth/*. Every path funnels
 * through the assurance policy (assurance.ts) and ends in either a login
 * ticket (exchanged by Auth.js for a session) or a completed session.
 */

export type CodeLoginResult =
  | { status: 'invalid' }
  | { status: 'requires_second_factor'; twofaTicket: IssuedTicket }
  | { status: 'ok'; result: VerifyResult; sessionId: string; amr: string[] }
  | { status: 'ticket'; loginTicket: IssuedTicket };

/**
 * First factor: verify + consume the emailed code, then apply the 2FA policy.
 * When a second factor is needed the code is already spent — the returned
 * twofa ticket carries that proof forward.
 *
 * `grant` picks the success shape: `session` (legacy Auth.js authorize path)
 * creates the session row immediately; `ticket` (BFF pre-verify path) defers
 * to the ticket exchange so the session is created exactly once.
 */
export async function loginWithCode(
  input: {
    email: string;
    code: string;
    name?: string | null;
    phone?: string | null;
    trustedDeviceToken?: string | null;
    grant?: 'session' | 'ticket';
  },
  ctx: RequestContext,
): Promise<CodeLoginResult> {
  const result = await verifyLoginCode(input.email, input.code, input.name, input.phone);
  if (!result) return { status: 'invalid' };
  const userId = result.user.id;

  const totpEnabled = await isTotpEnabled(userId);
  const trusted = totpEnabled
    ? await validateTrustedDevice(userId, input.trustedDeviceToken)
    : null;
  const decision = decideCodeLogin({ totpEnabled, trustedDevice: Boolean(trusted) });

  if (decision.requiresSecondFactor) {
    const twofaTicket = await issueTicket(userId, 'twofa', decision.amr);
    return { status: 'requires_second_factor', twofaTicket };
  }

  if (input.grant === 'ticket') {
    const loginTicket = await issueTicket(userId, 'login', decision.amr);
    return { status: 'ticket', loginTicket };
  }

  const session = await createAuthSession(userId, decision.amr, ctx);
  await logSecurityEvent({
    userId,
    type: 'login_completed',
    sessionId: session.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { method: 'code', amr: decision.amr, trustedDevice: Boolean(trusted) },
  });
  return { status: 'ok', result, sessionId: session.id, amr: decision.amr };
}

export type SecondFactorResult =
  | { status: 'invalid' }
  | { status: 'invalid_retry'; twofaTicket: IssuedTicket; userId: string }
  | {
      status: 'ok';
      userId: string;
      loginTicket: IssuedTicket;
      trustedDevice: IssuedTrustedDevice | null;
    };

/**
 * Second factor: consume the twofa ticket (single-use — consumed up front so
 * it can never be presented twice), then check a TOTP or recovery code. A
 * wrong code re-issues a fresh twofa ticket so the user can retry a typo
 * without restarting login; the route-level rate limiter caps total attempts.
 * Success yields the terminal login ticket and, when asked, a trusted-device
 * token.
 */
export async function completeSecondFactor(
  input: {
    twofaTicket: string;
    totp?: string | null;
    recoveryCode?: string | null;
    rememberDevice?: boolean;
  },
  ctx: RequestContext,
): Promise<SecondFactorResult> {
  const ticket = await consumeTicket(input.twofaTicket, 'twofa');
  if (!ticket) return { status: 'invalid' };
  const { userId, amr } = ticket;

  let method: 'totp' | 'recovery' | null = null;
  if (input.totp) {
    if (await verifyTotpForUser(userId, input.totp)) method = 'totp';
  } else if (input.recoveryCode) {
    if (await consumeRecoveryCode(userId, input.recoveryCode, ctx)) method = 'recovery';
  }

  if (!method) {
    const reissued = await issueTicket(userId, 'twofa', amr);
    await logSecurityEvent({
      userId,
      type: 'failed_second_factor',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { method: input.totp ? 'totp' : input.recoveryCode ? 'recovery' : 'none' },
    });
    return { status: 'invalid_retry', twofaTicket: reissued, userId };
  }

  const fullAmr = [...amr, method];
  const loginTicket = await issueTicket(userId, 'login', fullAmr);
  const trustedDevice = input.rememberDevice ? await issueTrustedDevice(userId, ctx) : null;
  return { status: 'ok', userId, loginTicket, trustedDevice };
}

export type PasskeyLoginResult =
  { status: 'invalid' } | { status: 'ok'; loginTicket: IssuedTicket };

/** Passkey login: verify the assertion, then mint a login ticket (MFA-grade). */
export async function loginWithPasskey(
  challengeId: string,
  response: AuthenticationResponseJSON,
  ctx: RequestContext,
): Promise<PasskeyLoginResult> {
  const assertion = await verifyPasskeyAssertion(
    'authentication',
    challengeId,
    response,
    null,
    ctx,
  );
  if (!assertion) return { status: 'invalid' };
  const decision = decidePasskeyLogin();
  const loginTicket = await issueTicket(assertion.passkey.userId, 'login', decision.amr);
  return { status: 'ok', loginTicket };
}

export type TicketExchangeResult =
  { status: 'invalid' } | { status: 'ok'; result: VerifyResult; sessionId: string; amr: string[] };

/** Terminal step: swap a login ticket for identity + a session row. */
export async function exchangeLoginTicket(
  token: string,
  ctx: RequestContext,
): Promise<TicketExchangeResult> {
  const ticket = await consumeTicket(token, 'login');
  if (!ticket) return { status: 'invalid' };
  const me = await getMe(ticket.userId);
  if (!me) return { status: 'invalid' };
  const session = await createAuthSession(ticket.userId, ticket.amr, ctx);
  const method = ticket.amr.includes('webauthn')
    ? 'passkey'
    : ticket.amr.includes('recovery')
      ? 'code+recovery'
      : ticket.amr.includes('totp')
        ? 'code+totp'
        : 'code';
  await logSecurityEvent({
    userId: ticket.userId,
    type: 'login_completed',
    sessionId: session.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { method, amr: ticket.amr },
  });
  return { status: 'ok', result: me, sessionId: session.id, amr: ticket.amr };
}
