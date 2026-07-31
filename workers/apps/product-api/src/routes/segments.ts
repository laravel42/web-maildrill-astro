import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  countSegmentRules,
  createSegment,
  deleteSegment,
  evaluateSegment,
  evaluateSegmentRules,
  getSegment,
  listSegments,
  updateSegment,
} from '@maildrill/product';

const TAG = ['Segments'];
const ruleSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'exists', 'not_exists']),
  value: z.unknown().optional(),
});
const matchType = z.enum(['all', 'any']);
const idParam = z.object({ id: z.string().uuid() });
const evalQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  matchType: matchType.default('all'),
  rules: z.array(ruleSchema).default([]),
});
const previewSchema = z.object({
  matchType: matchType.default('all'),
  rules: z.array(ruleSchema).default([]),
  limit: z.number().int().positive().max(1000).optional(),
});

export async function segmentRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/segments',
    { schema: { tags: TAG, summary: 'Create a segment', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(await createSegment({ tenantId: req.tenantId, ...req.body })),
  );

  app.get('/v1/segments', { schema: { tags: TAG, summary: 'List segments' } }, async (req) => ({
    data: await listSegments(req.tenantId),
  }));

  app.get(
    '/v1/segments/:id',
    { schema: { tags: TAG, summary: 'Get a segment', params: idParam } },
    async (req, reply) => {
      const seg = await getSegment(req.tenantId, req.params.id);
      if (!seg) return reply.code(404).send({ error: 'not_found' });
      return seg;
    },
  );

  app.patch(
    '/v1/segments/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Update a segment',
        params: idParam,
        body: createSchema.partial(),
      },
    },
    async (req, reply) => {
      const seg = await updateSegment(req.tenantId, req.params.id, req.body);
      if (!seg) return reply.code(404).send({ error: 'not_found' });
      return seg;
    },
  );

  app.delete(
    '/v1/segments/:id',
    { schema: { tags: TAG, summary: 'Delete a segment', params: idParam } },
    async (req, reply) => {
      const ok = await deleteSegment(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    '/v1/segments/preview',
    {
      schema: {
        tags: TAG,
        summary: 'Preview an ad-hoc rule set: matching subscribers + total count',
        body: previewSchema,
      },
    },
    async (req) => {
      const { rules, matchType: mt, limit } = req.body;
      const [data, count] = await Promise.all([
        evaluateSegmentRules(req.tenantId, rules, mt, { limit }),
        countSegmentRules(req.tenantId, rules, mt),
      ]);
      return { count, data };
    },
  );

  app.get(
    '/v1/segments/:id/subscribers',
    {
      schema: {
        tags: TAG,
        summary: 'Evaluate a saved segment',
        params: idParam,
        querystring: evalQuery,
      },
    },
    async (req, reply) => {
      const data = await evaluateSegment(req.tenantId, req.params.id, {
        limit: req.query.limit,
        offset: req.query.offset,
      });
      if (data === null) return reply.code(404).send({ error: 'not_found' });
      return { data };
    },
  );
}
