import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  RATE_LIMITS,
  completeSecondFactor,
  exchangeLoginTicket,
  loginWithCode,
  loginWithPasskey,
  rateLimiter,
  requestLoginCode,
  sendWelcomeEmail,
  startPasskeyAuthentication,
} from '@maildrill/identity';
import { clientCtx } from './client-ctx';

const TAG = ['Auth'];
const requestSchema = z.object({ email: z.string().email() });
const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
  /** Sign-up form's full name — stored only when this verify creates the user. */
  name: z.string().trim().max(240).optional(),
  /** Sign-up form's phone (E.164-ish) — stored only when this verify creates the user. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,24}$/)
    .optional(),
  /** Trusted-device cookie value, forwarded by the BFF when present. */
  trustedDeviceToken: z.string().max(256).optional(),
  /** `ticket` (BFF pre-verify) defers session creation to the ticket exchange. */
  grant: z.enum(['session', 'ticket']).optional(),
});
const welcomeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(120).optional(),
});
const twofaSchema = z.object({
  twofaTicket: z.string().min(10).max(256),
  totp: z.string().max(16).optional(),
  recoveryCode: z.string().max(24).optional(),
  rememberDevice: z.boolean().optional(),
});
const passkeyVerifySchema = z.object({
  challengeId: z.string().uuid(),
  /** WebAuthn AuthenticationResponseJSON — validated by @simplewebauthn. */
  credential: z.record(z.unknown()),
});
const exchangeSchema = z.object({ ticket: z.string().min(10).max(256) });

/**
 * Public (BFF-called) auth endpoints. Not behind the API-key hook — the frontend
 * proxies these server-side; the browser never calls them directly.
 */
export async function authRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/v1/auth/code/request',
    {
      schema: {
        tags: TAG,
        summary: 'Email a 6-digit sign-in code (+ auto-login link)',
        body: requestSchema,
      },
    },
    async (req, reply) => {
      // Cap code emails per address and per client IP; still 202 (no
      // enumeration, no oracle for the limiter state).
      const ctx = clientCtx(req);
      const { max, windowMs } = RATE_LIMITS.codeRequest;
      const emailOk = rateLimiter.hit(`code-req:${req.body.email.toLowerCase()}`, max, windowMs).ok;
      const ipOk = ctx.ip ? rateLimiter.hit(`code-req-ip:${ctx.ip}`, max * 3, windowMs).ok : true;
      if (emailOk && ipOk) await requestLoginCode(req.body.email, ctx);
      return reply.code(202).send({ ok: true });
    },
  );

  app.post(
    '/v1/auth/code/verify',
    {
      schema: {
        tags: TAG,
        summary: 'Verify a login code — identity + session, or a 2FA challenge',
        body: verifySchema,
      },
    },
    async (req, reply) => {
      const outcome = await loginWithCode(
        {
          email: req.body.email,
          code: req.body.code,
          name: req.body.name || null,
          phone: req.body.phone || null,
          trustedDeviceToken: req.body.trustedDeviceToken || null,
          grant: req.body.grant,
        },
        clientCtx(req),
      );
      if (outcome.status === 'invalid') {
        return reply.code(401).send({ error: 'invalid_or_expired' });
      }
      if (outcome.status === 'requires_second_factor') {
        // 200: the code WAS valid (and is now consumed); the login just isn't
        // finished. Callers that ignore this shape fail closed — no session.
        return {
          requiresSecondFactor: true as const,
          twofaTicket: outcome.twofaTicket.ticket,
          twofaTicketExpiresAt: outcome.twofaTicket.expiresAt.toISOString(),
        };
      }
      if (outcome.status === 'ticket') {
        return { ticket: outcome.loginTicket.ticket };
      }
      return {
        user: {
          id: outcome.result.user.id,
          email: outcome.result.user.email,
          name: outcome.result.user.name,
          phone: outcome.result.user.phone,
        },
        workspaces: outcome.result.workspaces,
        session: { id: outcome.sessionId, amr: outcome.amr },
      };
    },
  );

  app.post(
    '/v1/auth/2fa/verify',
    {
      schema: {
        tags: TAG,
        summary: 'Complete the second factor (TOTP or recovery code)',
        body: twofaSchema,
      },
    },
    async (req, reply) => {
      const ctx = clientCtx(req);
      // Attempts are keyed by ticket-carried user after consumption; before
      // that, key by IP so an attacker can't burn someone's budget remotely.
      if (ctx.ip) {
        const { max, windowMs } = RATE_LIMITS.secondFactor;
        if (!rateLimiter.hit(`2fa-ip:${ctx.ip}`, max * 3, windowMs).ok) {
          return reply.code(429).send({ error: 'rate_limited' });
        }
      }
      const outcome = await completeSecondFactor(
        {
          twofaTicket: req.body.twofaTicket,
          totp: req.body.totp || null,
          recoveryCode: req.body.recoveryCode || null,
          rememberDevice: Boolean(req.body.rememberDevice),
        },
        ctx,
      );
      if (outcome.status === 'invalid') {
        return reply.code(401).send({ error: 'invalid_or_expired' });
      }
      if (outcome.status === 'invalid_retry') {
        const limit = req.body.recoveryCode ? RATE_LIMITS.recoveryCode : RATE_LIMITS.secondFactor;
        if (!rateLimiter.hit(`2fa:${outcome.userId}`, limit.max, limit.windowMs).ok) {
          return reply.code(429).send({ error: 'rate_limited' });
        }
        return reply.code(401).send({
          error: 'invalid_code',
          twofaTicket: outcome.twofaTicket.ticket,
        });
      }
      rateLimiter.clear(`2fa:${outcome.userId}`);
      return {
        ticket: outcome.loginTicket.ticket,
        trustedDevice: outcome.trustedDevice
          ? {
              token: outcome.trustedDevice.token,
              expiresAt: outcome.trustedDevice.expiresAt.toISOString(),
            }
          : null,
      };
    },
  );

  app.post(
    '/v1/auth/passkey/options',
    {
      schema: {
        tags: TAG,
        summary: 'WebAuthn authentication options (discoverable credentials)',
      },
    },
    async (req, reply) => {
      const ctx = clientCtx(req);
      if (ctx.ip) {
        const { max, windowMs } = RATE_LIMITS.passkeyLogin;
        if (!rateLimiter.hit(`pk-opt:${ctx.ip}`, max * 2, windowMs).ok) {
          return reply.code(429).send({ error: 'rate_limited' });
        }
      }
      const { options, challengeId } = await startPasskeyAuthentication('authentication', null);
      return { options, challengeId };
    },
  );

  app.post(
    '/v1/auth/passkey/verify',
    {
      schema: {
        tags: TAG,
        summary: 'Verify a WebAuthn assertion, returning a login ticket',
        body: passkeyVerifySchema,
      },
    },
    async (req, reply) => {
      const ctx = clientCtx(req);
      if (ctx.ip) {
        const { max, windowMs } = RATE_LIMITS.passkeyLogin;
        if (!rateLimiter.hit(`pk-login:${ctx.ip}`, max, windowMs).ok) {
          return reply.code(429).send({ error: 'rate_limited' });
        }
      }
      const outcome = await loginWithPasskey(
        req.body.challengeId,
        req.body.credential as never,
        ctx,
      );
      // Generic failure — no distinction between unknown credential, bad
      // signature, expired challenge, or wrong origin.
      if (outcome.status !== 'ok') return reply.code(401).send({ error: 'invalid_or_expired' });
      return { ticket: outcome.loginTicket.ticket };
    },
  );

  app.post(
    '/v1/auth/ticket/exchange',
    {
      schema: {
        tags: TAG,
        summary: 'Exchange a one-time login ticket for identity + session',
        body: exchangeSchema,
      },
    },
    async (req, reply) => {
      const outcome = await exchangeLoginTicket(req.body.ticket, clientCtx(req));
      if (outcome.status !== 'ok') return reply.code(401).send({ error: 'invalid_or_expired' });
      return {
        user: {
          id: outcome.result.user.id,
          email: outcome.result.user.email,
          name: outcome.result.user.name,
          phone: outcome.result.user.phone,
        },
        workspaces: outcome.result.workspaces,
        session: { id: outcome.sessionId, amr: outcome.amr },
      };
    },
  );

  app.post(
    '/v1/auth/welcome',
    { schema: { tags: TAG, summary: 'Send the sign-up welcome email', body: welcomeSchema } },
    async (req, reply) => {
      // Fire the send but always 202 — the address is never enumerated and the
      // sign-up UX shouldn't hinge on the provider's response.
      void sendWelcomeEmail(req.body.email, req.body.firstName);
      return reply.code(202).send({ ok: true });
    },
  );
}
