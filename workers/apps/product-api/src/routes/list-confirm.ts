import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { confirmListAction } from '@maildrill/product';

/**
 * Public endpoint for confirming a list subscribe/unsubscribe action.
 * No authentication required — the token in the URL is the proof.
 */
export async function listConfirmRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  const confirmParams = z.object({
    id: z.string().uuid(),
    token: z.string().min(1),
  });

  app.get(
    '/v1/confirm/:id/:token',
    { schema: { summary: 'Confirm a list subscribe/unsubscribe action', params: confirmParams } },
    async (req, reply) => {
      const result = await confirmListAction(req.params.id, req.params.token);

      if (!result) {
        return reply.code(400).send({
          error: 'invalid_or_expired',
          message: 'This confirmation link is invalid or has expired.',
        });
      }

      const verb = result.action === 'subscribe' ? 'subscribed to' : 'unsubscribed from';
      return {
        ok: true,
        action: result.action,
        listName: result.listName,
        message: `You have been ${verb} ${result.listName}.`,
      };
    },
  );
}
