import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { createTag, deleteTag, listTags } from '@maildrill/product';

const TAG = ['Tags'];
const createSchema = z.object({ name: z.string().min(1), color: z.string().nullable().optional() });
const idParam = z.object({ id: z.string().uuid() });

export async function tagRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/tags',
    { schema: { tags: TAG, summary: 'Create a tag', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(await createTag(req.tenantId, req.body.name, req.body.color)),
  );

  app.get('/v1/tags', { schema: { tags: TAG, summary: 'List tags' } }, async (req) => ({
    data: await listTags(req.tenantId),
  }));

  app.delete(
    '/v1/tags/:id',
    { schema: { tags: TAG, summary: 'Delete a tag', params: idParam } },
    async (req, reply) => {
      const ok = await deleteTag(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );
}
