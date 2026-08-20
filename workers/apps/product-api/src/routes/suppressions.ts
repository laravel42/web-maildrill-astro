import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { channelSchema } from '@maildrill/domain';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { addSuppression, listSuppressions, removeSuppression } from '@maildrill/product';

const TAG = ['Suppressions'];
const createSchema = z.object({
  address: z.string().min(1),
  channel: channelSchema,
  reason: z.string().optional(),
});
const listQuery = z.object({ channel: channelSchema.optional() });
const idParam = z.object({ id: z.string().uuid() });

export async function suppressionRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/suppressions',
    { schema: { tags: TAG, summary: 'Add a suppression', body: createSchema } },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await addSuppression(req.tenantId, req.body.address, req.body.channel, req.body.reason),
        ),
  );

  app.get(
    '/v1/suppressions',
    { schema: { tags: TAG, summary: 'List suppressions', querystring: listQuery } },
    async (req) => ({ data: await listSuppressions(req.tenantId, req.query.channel) }),
  );

  app.delete(
    '/v1/suppressions/:id',
    { schema: { tags: TAG, summary: 'Remove a suppression', params: idParam } },
    async (req, reply) => {
      const ok = await removeSuppression(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );
}
