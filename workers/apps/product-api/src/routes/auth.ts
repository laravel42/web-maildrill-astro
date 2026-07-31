import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { requestLoginCode, sendWelcomeEmail, verifyLoginCode } from '@maildrill/identity';

const TAG = ['Auth'];
const requestSchema = z.object({ email: z.string().email() });
const verifySchema = z.object({ email: z.string().email(), code: z.string().min(4).max(8) });
const welcomeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(120).optional(),
});

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
      await requestLoginCode(req.body.email);
      // Always 202 regardless of whether the email is known (no enumeration).
      return reply.code(202).send({ ok: true });
    },
  );

  app.post(
    '/v1/auth/code/verify',
    {
      schema: {
        tags: TAG,
        summary: 'Verify a login code, returning identity + workspaces',
        body: verifySchema,
      },
    },
    async (req, reply) => {
      const result = await verifyLoginCode(req.body.email, req.body.code);
      if (!result) return reply.code(401).send({ error: 'invalid_or_expired' });
      return {
        user: { id: result.user.id, email: result.user.email, name: result.user.name },
        workspaces: result.workspaces,
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
