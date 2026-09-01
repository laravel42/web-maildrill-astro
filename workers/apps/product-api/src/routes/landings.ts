import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  createLanding,
  deleteLanding,
  duplicateLanding,
  getLanding,
  listLandings,
  updateLanding,
} from '@maildrill/product';

/**
 * Landing pages (Builder42 sites). Mirrors the templates routes; the only
 * structural difference is that listing is paginated and never returns the site
 * document (see `@maildrill/product`'s `landings.ts` for why).
 *
 * The two publish verbs are declared but answer `not_implemented`: publishing
 * needs tenant domains and a hosting target, which is a separate phase. They
 * exist here so the contract is stable and the UI can render the affordance
 * disabled instead of pretending the concept doesn't exist.
 */
const TAG = ['Landings'];

/**
 * The app-wide `bodyLimit` is 2 MB, which a site document exceeds as soon as it
 * holds a couple of uploaded images (Builder42 inlines assets as data URLs).
 * Per-route limit set just above the editor's own publish-size warning (9 MB) so
 * the editor's preflight, not a 413 from here, is what tells the user a document
 * has grown too large.
 */
const DOCUMENT_BODY_LIMIT = 12 * 1024 * 1024;

const idParam = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'stale']).optional(),
  sort: z.enum(['name', 'updatedAt', 'createdAt', 'publishedAt']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** A `BuilderSite`; opaque to the backend, validated by the editor. */
  document: z.record(z.unknown()).nullable().optional(),
  schemaVersion: z.number().int().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  document: z.record(z.unknown()).nullable().optional(),
  schemaVersion: z.number().int().nullable().optional(),
  siteId: z.string().trim().min(1).max(120).nullable().optional(),
});

export async function landingRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.get(
    '/v1/landings',
    { schema: { tags: TAG, summary: 'List landings', querystring: listQuery } },
    async (req) => listLandings(req.tenantId, req.query),
  );

  app.post(
    '/v1/landings',
    {
      bodyLimit: DOCUMENT_BODY_LIMIT,
      schema: { tags: TAG, summary: 'Create a landing', body: createSchema },
    },
    async (req, reply) =>
      reply.code(201).send(await createLanding({ tenantId: req.tenantId, ...req.body })),
  );

  app.get(
    '/v1/landings/:id',
    { schema: { tags: TAG, summary: 'Get a landing, document included', params: idParam } },
    async (req, reply) => {
      const landing = await getLanding(req.tenantId, req.params.id);
      if (!landing) return reply.code(404).send({ error: 'not_found' });
      return landing;
    },
  );

  app.patch(
    '/v1/landings/:id',
    {
      bodyLimit: DOCUMENT_BODY_LIMIT,
      schema: {
        tags: TAG,
        summary: 'Rename a landing or store a new document revision',
        params: idParam,
        body: updateSchema,
      },
    },
    async (req, reply) => {
      const landing = await updateLanding(req.tenantId, req.params.id, req.body);
      if (!landing) return reply.code(404).send({ error: 'not_found' });
      return landing;
    },
  );

  app.delete(
    '/v1/landings/:id',
    { schema: { tags: TAG, summary: 'Delete a landing', params: idParam } },
    async (req, reply) => {
      const ok = await deleteLanding(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    '/v1/landings/:id/duplicate',
    { schema: { tags: TAG, summary: 'Duplicate a landing as a new draft', params: idParam } },
    async (req, reply) => {
      const copy = await duplicateLanding(req.tenantId, req.params.id);
      if (!copy) return reply.code(404).send({ error: 'not_found' });
      return reply.code(201).send(copy);
    },
  );

  // --- publishing: contract reserved, not implemented yet ---------------------

  app.post(
    '/v1/landings/:id/publish',
    { schema: { tags: TAG, summary: 'Publish a landing (not implemented)', params: idParam } },
    async (req, reply) => {
      // 404 still takes precedence over 501: an unknown id is a client error
      // regardless of whether the feature exists.
      if (!(await getLanding(req.tenantId, req.params.id))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.code(501).send({ error: 'not_implemented' });
    },
  );

  app.delete(
    '/v1/landings/:id/publish',
    { schema: { tags: TAG, summary: 'Unpublish a landing (not implemented)', params: idParam } },
    async (req, reply) => {
      if (!(await getLanding(req.tenantId, req.params.id))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.code(501).send({ error: 'not_implemented' });
    },
  );
}
