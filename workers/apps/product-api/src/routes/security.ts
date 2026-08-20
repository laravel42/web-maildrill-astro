import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import type {
  AuthSessionRow,
  PasskeyRow,
  SecurityEventRow,
  TrustedDeviceRow,
} from '@maildrill/database';
import {
  RATE_LIMITS,
  completePasskeyRegistration,
  confirmTotpSetup,
  disableTotp,
  getTotpStatus,
  getUser,
  isElevated,
  listPasskeys,
  listSecurityEvents,
  listSessions,
  listTrustedDevices,
  rateLimiter,
  reauthWithEmailCode,
  reauthWithPasskey,
  reauthWithRecoveryCode,
  reauthWithTotp,
  regenerateRecoveryCodes,
  removePasskey,
  renamePasskey,
  requestReauthCode,
  revokeOtherSessions,
  revokeOtherTrustedDevices,
  revokeSession,
  revokeTrustedDevice,
  startPasskeyRegistration,
  startReauthPasskey,
  startTotpSetup,
  trustedDeviceIdFromToken,
} from '@maildrill/identity';
import { clientCtx } from './client-ctx';

const TAG = ['Security'];

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

function serializePasskey(p: PasskeyRow) {
  return {
    id: p.id,
    name: p.name,
    deviceType: p.deviceType,
    backedUp: p.backedUp,
    transports: p.transports,
    createdAt: p.createdAt.toISOString(),
    lastUsedAt: iso(p.lastUsedAt),
  };
}

function serializeSession(s: AuthSessionRow, currentSessionId: string | null) {
  return {
    id: s.id,
    current: s.id === currentSessionId,
    amr: s.amr,
    browser: s.browser,
    os: s.os,
    deviceType: s.deviceType,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: iso(s.lastSeenAt),
    expiresAt: s.expiresAt.toISOString(),
  };
}

function serializeDevice(d: TrustedDeviceRow, currentDeviceId: string | null) {
  return {
    id: d.id,
    current: d.id === currentDeviceId,
    name: d.name,
    browser: d.browser,
    os: d.os,
    ip: d.ip,
    createdAt: d.createdAt.toISOString(),
    lastUsedAt: iso(d.lastUsedAt),
    expiresAt: d.expiresAt.toISOString(),
  };
}

function serializeEvent(e: SecurityEventRow) {
  return {
    id: e.id,
    type: e.eventType,
    sessionId: e.sessionId,
    ip: e.ip,
    userAgent: e.userAgent,
    entityId: e.entityId,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  };
}

const codeSchema = z.object({ code: z.string().min(4).max(24) });
const credentialSchema = z.object({
  challengeId: z.string().uuid(),
  credential: z.record(z.unknown()),
});
const idParams = z.object({ id: z.string().uuid() });

/**
 * Account-security management for the signed-in user. Everything is scoped to
 * `req.userId` — a caller can only ever read or mutate their own credentials,
 * sessions, devices, codes, and events. Sensitive mutations additionally
 * require recent authentication (fresh login or a reauth challenge).
 */
export async function securityRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  function userIdOr400(req: FastifyRequest, reply: FastifyReply): string | null {
    if (!req.userId) {
      void reply.code(400).send({ error: 'user_session_required' });
      return null;
    }
    return req.userId;
  }

  /** Recent-auth gate + mutation budget for destructive security actions. */
  async function elevatedOr403(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const userId = req.userId!;
    const { max, windowMs } = RATE_LIMITS.sensitiveMutation;
    if (!rateLimiter.hit(`sec-mut:${userId}`, max, windowMs).ok) {
      await reply.code(429).send({ error: 'rate_limited' });
      return false;
    }
    const ok = await isElevated(userId, req.sessionId ?? null, req.authTime ?? null);
    if (!ok) {
      await reply.code(403).send({ error: 'reauth_required' });
      return false;
    }
    return true;
  }

  function sessionCtx(req: FastifyRequest) {
    return { ...clientCtx(req), sessionId: req.sessionId ?? null };
  }

  // -------------------------------------------------------------------------
  // Overview
  // -------------------------------------------------------------------------

  app.get(
    '/v1/me/security/overview',
    { schema: { tags: TAG, summary: 'Security overview: 2FA status, passkeys, elevation' } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const [totp, keys, elevated] = await Promise.all([
        getTotpStatus(userId),
        listPasskeys(userId),
        isElevated(userId, req.sessionId ?? null, req.authTime ?? null),
      ]);
      return {
        totp: {
          enabled: totp.enabled,
          enabledAt: iso(totp.enabledAt),
          recoveryCodesRemaining: totp.recoveryCodesRemaining,
        },
        passkeys: keys.map(serializePasskey),
        elevated,
      };
    },
  );

  // -------------------------------------------------------------------------
  // Passkeys
  // -------------------------------------------------------------------------

  app.post(
    '/v1/me/security/passkeys/options',
    { schema: { tags: TAG, summary: 'WebAuthn registration options for a new passkey' } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const { max, windowMs } = RATE_LIMITS.passkeyRegister;
      if (!rateLimiter.hit(`pk-reg:${userId}`, max, windowMs).ok) {
        return reply.code(429).send({ error: 'rate_limited' });
      }
      const user = await getUser(userId);
      if (!user) return reply.code(404).send({ error: 'not_found' });
      const displayName =
        (typeof user.preferences.displayName === 'string' && user.preferences.displayName) ||
        user.name;
      return startPasskeyRegistration(userId, user.email, displayName);
    },
  );

  app.post(
    '/v1/me/security/passkeys',
    {
      schema: {
        tags: TAG,
        summary: 'Verify a WebAuthn registration and store the passkey',
        body: credentialSchema.extend({ name: z.string().trim().max(80).optional() }),
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const outcome = await completePasskeyRegistration(
        userId,
        req.body.challengeId,
        req.body.credential as never,
        req.body.name ?? null,
        sessionCtx(req),
      );
      if ('error' in outcome) {
        const status = outcome.error === 'duplicate_credential' ? 409 : 400;
        return reply.code(status).send({ error: outcome.error });
      }
      return { passkey: serializePasskey(outcome.passkey) };
    },
  );

  app.patch(
    '/v1/me/security/passkeys/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Rename a passkey',
        params: idParams,
        body: z.object({ name: z.string().trim().min(1).max(80) }),
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const ok = await renamePasskey(userId, req.params.id, req.body.name, sessionCtx(req));
      if (!ok) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  app.delete(
    '/v1/me/security/passkeys/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Remove a passkey (requires recent authentication)',
        params: idParams,
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!(await elevatedOr403(req, reply))) return;
      const ok = await removePasskey(userId, req.params.id, sessionCtx(req));
      if (!ok) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  // -------------------------------------------------------------------------
  // Authenticator app (TOTP)
  // -------------------------------------------------------------------------

  app.post(
    '/v1/me/security/totp/setup',
    {
      schema: {
        tags: TAG,
        summary: 'Begin authenticator setup (secret + otpauth URI, shown once)',
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const user = await getUser(userId);
      if (!user) return reply.code(404).send({ error: 'not_found' });
      const setup = await startTotpSetup(userId, user.email, sessionCtx(req));
      if (!setup) return reply.code(409).send({ error: 'totp_already_enabled' });
      return setup;
    },
  );

  app.post(
    '/v1/me/security/totp/confirm',
    {
      schema: {
        tags: TAG,
        summary: 'Confirm authenticator setup with a live code; returns recovery codes once',
        body: codeSchema,
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const { max, windowMs } = RATE_LIMITS.secondFactor;
      if (!rateLimiter.hit(`totp-confirm:${userId}`, max, windowMs).ok) {
        return reply.code(429).send({ error: 'rate_limited' });
      }
      const outcome = await confirmTotpSetup(userId, req.body.code, sessionCtx(req));
      if (!outcome) return reply.code(400).send({ error: 'invalid_code' });
      rateLimiter.clear(`totp-confirm:${userId}`);
      return { ok: true, recoveryCodes: outcome.recoveryCodes };
    },
  );

  app.post(
    '/v1/me/security/totp/disable',
    {
      schema: { tags: TAG, summary: 'Disable the authenticator (requires recent authentication)' },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!(await elevatedOr403(req, reply))) return;
      const ok = await disableTotp(userId, sessionCtx(req));
      if (!ok) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  // -------------------------------------------------------------------------
  // Recovery codes
  // -------------------------------------------------------------------------

  app.post(
    '/v1/me/security/recovery-codes/regenerate',
    {
      schema: { tags: TAG, summary: 'Regenerate recovery codes (requires recent authentication)' },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!(await elevatedOr403(req, reply))) return;
      const codes = await regenerateRecoveryCodes(userId, sessionCtx(req));
      if (!codes) return reply.code(409).send({ error: 'totp_not_enabled' });
      return { recoveryCodes: codes };
    },
  );

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  app.get(
    '/v1/me/security/sessions',
    { schema: { tags: TAG, summary: 'Active sessions for the current user' } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const rows = await listSessions(userId);
      return { sessions: rows.map((s) => serializeSession(s, req.sessionId ?? null)) };
    },
  );

  app.post(
    '/v1/me/security/sessions/:id/revoke',
    { schema: { tags: TAG, summary: 'Revoke one session', params: idParams } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const ok = await revokeSession(userId, req.params.id, {
        ...clientCtx(req),
        actorSessionId: req.sessionId ?? null,
      });
      if (!ok) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  app.post(
    '/v1/me/security/sessions/revoke-others',
    {
      schema: { tags: TAG, summary: 'Revoke all other sessions (requires recent authentication)' },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!req.sessionId) return reply.code(400).send({ error: 'session_id_required' });
      if (!(await elevatedOr403(req, reply))) return;
      const count = await revokeOtherSessions(userId, req.sessionId, clientCtx(req));
      return { ok: true, revoked: count };
    },
  );

  // -------------------------------------------------------------------------
  // Trusted devices
  // -------------------------------------------------------------------------

  app.get(
    '/v1/me/security/trusted-devices',
    { schema: { tags: TAG, summary: 'Trusted devices for the current user' } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const header = req.headers['x-trusted-device'];
      const currentId = trustedDeviceIdFromToken(typeof header === 'string' ? header : null);
      const rows = await listTrustedDevices(userId);
      return { devices: rows.map((d) => serializeDevice(d, currentId)) };
    },
  );

  app.post(
    '/v1/me/security/trusted-devices/:id/revoke',
    { schema: { tags: TAG, summary: 'Revoke one trusted device', params: idParams } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const ok = await revokeTrustedDevice(userId, req.params.id, {
        ...clientCtx(req),
        actorSessionId: req.sessionId ?? null,
      });
      if (!ok) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  app.post(
    '/v1/me/security/trusted-devices/revoke-others',
    {
      schema: {
        tags: TAG,
        summary:
          'Revoke all trusted devices except the current one (requires recent authentication)',
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!(await elevatedOr403(req, reply))) return;
      const header = req.headers['x-trusted-device'];
      const keepId = trustedDeviceIdFromToken(typeof header === 'string' ? header : null);
      const count = await revokeOtherTrustedDevices(userId, keepId, {
        ...clientCtx(req),
        actorSessionId: req.sessionId ?? null,
      });
      return { ok: true, revoked: count };
    },
  );

  // -------------------------------------------------------------------------
  // Security activity
  // -------------------------------------------------------------------------

  app.get(
    '/v1/me/security/events',
    {
      schema: {
        tags: TAG,
        summary: 'Recent security activity',
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }),
      },
    },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const rows = await listSecurityEvents(userId, req.query.limit ?? 50);
      return { events: rows.map(serializeEvent) };
    },
  );

  // -------------------------------------------------------------------------
  // Reauth (fresh-authentication challenges)
  // -------------------------------------------------------------------------

  function reauthGate(req: FastifyRequest, reply: FastifyReply): boolean {
    const { max, windowMs } = RATE_LIMITS.secondFactor;
    if (!rateLimiter.hit(`reauth:${req.userId}`, max, windowMs).ok) {
      void reply.code(429).send({ error: 'rate_limited' });
      return false;
    }
    return true;
  }

  app.post(
    '/v1/me/security/reauth/totp',
    { schema: { tags: TAG, summary: 'Step-up with an authenticator code', body: codeSchema } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!req.sessionId) return reply.code(400).send({ error: 'session_id_required' });
      if (!reauthGate(req, reply)) return;
      const result = await reauthWithTotp(userId, req.body.code, {
        ...clientCtx(req),
        sessionId: req.sessionId,
      });
      if (!result.ok) return reply.code(401).send({ error: 'invalid_code' });
      rateLimiter.clear(`reauth:${userId}`);
      return { ok: true, elevatedUntil: result.elevatedUntil!.toISOString() };
    },
  );

  app.post(
    '/v1/me/security/reauth/recovery',
    { schema: { tags: TAG, summary: 'Step-up with a recovery code', body: codeSchema } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!req.sessionId) return reply.code(400).send({ error: 'session_id_required' });
      if (!reauthGate(req, reply)) return;
      const result = await reauthWithRecoveryCode(userId, req.body.code, {
        ...clientCtx(req),
        sessionId: req.sessionId,
      });
      if (!result.ok) return reply.code(401).send({ error: 'invalid_code' });
      rateLimiter.clear(`reauth:${userId}`);
      return { ok: true, elevatedUntil: result.elevatedUntil!.toISOString() };
    },
  );

  app.post(
    '/v1/me/security/reauth/passkey/options',
    { schema: { tags: TAG, summary: 'WebAuthn options for a step-up challenge' } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      return startReauthPasskey(userId);
    },
  );

  app.post(
    '/v1/me/security/reauth/passkey',
    { schema: { tags: TAG, summary: 'Step-up with a passkey assertion', body: credentialSchema } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!req.sessionId) return reply.code(400).send({ error: 'session_id_required' });
      if (!reauthGate(req, reply)) return;
      const result = await reauthWithPasskey(
        userId,
        req.body.challengeId,
        req.body.credential as never,
        { ...clientCtx(req), sessionId: req.sessionId },
      );
      if (!result.ok) return reply.code(401).send({ error: 'invalid_code' });
      rateLimiter.clear(`reauth:${userId}`);
      return { ok: true, elevatedUntil: result.elevatedUntil!.toISOString() };
    },
  );

  app.post(
    '/v1/me/security/reauth/code/request',
    { schema: { tags: TAG, summary: 'Email a step-up code to the account address' } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      const { max, windowMs } = RATE_LIMITS.codeRequest;
      if (!rateLimiter.hit(`reauth-code-req:${userId}`, max, windowMs).ok) {
        return reply.code(429).send({ error: 'rate_limited' });
      }
      await requestReauthCode(userId, clientCtx(req));
      return reply.code(202).send({ ok: true });
    },
  );

  app.post(
    '/v1/me/security/reauth/code/verify',
    { schema: { tags: TAG, summary: 'Step-up with an emailed code', body: codeSchema } },
    async (req, reply) => {
      const userId = userIdOr400(req, reply);
      if (!userId) return;
      if (!req.sessionId) return reply.code(400).send({ error: 'session_id_required' });
      if (!reauthGate(req, reply)) return;
      const result = await reauthWithEmailCode(userId, req.body.code, {
        ...clientCtx(req),
        sessionId: req.sessionId,
      });
      if (!result.ok) return reply.code(401).send({ error: 'invalid_code' });
      rateLimiter.clear(`reauth:${userId}`);
      return { ok: true, elevatedUntil: result.elevatedUntil!.toISOString() };
    },
  );
}
