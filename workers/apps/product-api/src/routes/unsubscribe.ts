import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { applyUnsubscribe, verifyUnsubscribeToken, verifyWebviewToken } from '@maildrill/services';
import { renderWebview } from '@maildrill/product';
import { rateLimiter } from '@maildrill/identity';
import { clientCtx } from './client-ctx';

/**
 * Public one-click unsubscribe intake.
 *
 * Deliberately unauthenticated and in its own plugin so it never picks up the
 * `authenticate` hook: the recipient is holding an email, not a session. The
 * HMAC in the token is the authentication, exactly as the billing webhook's
 * signature is.
 *
 * Always answers 204, whether or not the token resolves: the endpoint is a
 * public URL and must not report whether a given token or subscriber exists.
 */
export async function unsubscribeRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/v1/public/unsubscribe',
    {
      schema: {
        tags: ['Public'],
        summary: 'Honour a signed one-click unsubscribe link',
        body: z.object({ token: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      // Signature checks are cheap but not free; cap per IP so the endpoint
      // cannot be used to grind tokens.
      const ip = clientCtx(req).ip;
      if (ip && !rateLimiter.hit(`unsub-ip:${ip}`, 60, 60_000).ok) {
        return reply.code(204).send();
      }
      const claims = verifyUnsubscribeToken(req.body.token);
      if (claims) await applyUnsubscribe(claims);
      return reply.code(204).send();
    },
  );

  /**
   * The email behind a "view in browser" link. Unauthenticated for the same
   * reason: the reader has an email, not a session. 404 on anything that does
   * not verify, so the URL is not an oracle for which campaigns exist.
   */
  app.post(
    '/v1/public/webview',
    {
      schema: {
        tags: ['Public'],
        summary: 'Render the email behind a signed view-in-browser link',
        body: z.object({ token: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const ip = clientCtx(req).ip;
      if (ip && !rateLimiter.hit(`webview-ip:${ip}`, 120, 60_000).ok) {
        return reply.code(404).send({ error: 'not_found' });
      }
      const claims = verifyWebviewToken(req.body.token);
      const rendered = claims ? await renderWebview(claims) : null;
      if (!rendered) return reply.code(404).send({ error: 'not_found' });
      return reply.send(rendered);
    },
  );
}
