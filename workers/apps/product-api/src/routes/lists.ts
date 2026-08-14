import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  addToList,
  createList,
  deleteList,
  getList,
  getSubscriber,
  getTemplate,
  listLists,
  listMembersOf,
  removeFromList,
  updateList,
  createListConfirmation,
  listRequiresConfirmation,
} from '@maildrill/product';
import { getWorkspace, submitMessage } from '@maildrill/services';

const TAG = ['Lists'];
const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  gdprConsent: z.boolean().optional(),
  doubleOptIn: z.boolean().optional(),
  doubleOptOut: z.boolean().optional(),
  doubleOptInTemplateId: z.string().uuid().nullable().optional(),
  doubleOptOutTemplateId: z.string().uuid().nullable().optional(),
  welcomeEmailTemplateId: z.string().uuid().nullable().optional(),
  goodbyeEmailTemplateId: z.string().uuid().nullable().optional(),
});
const idParam = z.object({ id: z.string().uuid() });
const memberParams = z.object({ id: z.string().uuid(), subscriberId: z.string().uuid() });
const memberBody = z.object({ subscriberId: z.string().uuid() });
const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export async function listRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/lists',
    { schema: { tags: TAG, summary: 'Create a list', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(await createList({ tenantId: req.tenantId, ...req.body })),
  );

  app.get('/v1/lists', { schema: { tags: TAG, summary: 'List lists' } }, async (req) => ({
    data: await listLists(req.tenantId),
  }));

  app.get(
    '/v1/lists/:id',
    { schema: { tags: TAG, summary: 'Get a list', params: idParam } },
    async (req, reply) => {
      const list = await getList(req.tenantId, req.params.id);
      if (!list) return reply.code(404).send({ error: 'not_found' });
      return list;
    },
  );

  app.patch(
    '/v1/lists/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Update a list',
        params: idParam,
        body: createSchema.partial(),
      },
    },
    async (req, reply) => {
      const list = await updateList(req.tenantId, req.params.id, req.body);
      if (!list) return reply.code(404).send({ error: 'not_found' });
      return list;
    },
  );

  app.delete(
    '/v1/lists/:id',
    { schema: { tags: TAG, summary: 'Delete a list', params: idParam } },
    async (req, reply) => {
      const ok = await deleteList(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    '/v1/lists/:id/members',
    {
      schema: {
        tags: TAG,
        summary: 'Add a subscriber to a list',
        params: idParam,
        body: memberBody,
      },
    },
    async (req, reply) => {
      const list = await getList(req.tenantId, req.params.id);
      if (!list) return reply.code(404).send({ error: 'not_found' });

      // Check if double opt-in is required.
      const ws = await getWorkspace(req.tenantId);
      const templateId = listRequiresConfirmation(list, 'subscribe', ws?.settings);

      if (templateId) {
        // Double opt-in flow: create a pending confirmation and send the email.
        const sub = await getSubscriber(req.tenantId, req.body.subscriberId);
        if (!sub) return reply.code(404).send({ error: 'subscriber_not_found' });

        const tpl = await getTemplate(req.tenantId, templateId);
        const pending = await createListConfirmation({
          tenantId: req.tenantId,
          listId: list.id,
          subscriberId: sub.id,
          action: 'subscribe',
        });

        // Send the confirmation email via the messaging pipeline.
        const confirmUrl = `${process.env.APP_URL ?? 'https://app.maildrill.net'}/confirm/${pending.id}/${pending.token}`;
        await submitMessage({
          tenantId: req.tenantId,
          channel: 'email',
          to: sub.email,
          recipientId: sub.id,
          content: {
            templateId,
            subject: tpl?.subject ?? `Confirm your subscription to ${list.name}`,
            html: tpl?.html ?? undefined,
            confirmUrl,
            listName: list.name,
          },
          idempotencyKey: `doi:${list.id}:${sub.id}:${Date.now()}`,
        });

        return reply.code(202).send({ pending: true, message: 'Confirmation email sent' });
      }

      await addToList(req.tenantId, req.params.id, req.body.subscriberId);
      return reply.code(204).send();
    },
  );

  app.delete(
    '/v1/lists/:id/members/:subscriberId',
    { schema: { tags: TAG, summary: 'Remove a subscriber from a list', params: memberParams } },
    async (req, reply) => {
      const list = await getList(req.tenantId, req.params.id);
      if (!list) return reply.code(404).send({ error: 'not_found' });

      // Check if double opt-out is required.
      const ws = await getWorkspace(req.tenantId);
      const templateId = listRequiresConfirmation(list, 'unsubscribe', ws?.settings);

      if (templateId) {
        // Double opt-out flow: create a pending confirmation and send the email.
        const sub = await getSubscriber(req.tenantId, req.params.subscriberId);
        if (!sub) return reply.code(404).send({ error: 'subscriber_not_found' });

        const tpl = await getTemplate(req.tenantId, templateId);
        const pending = await createListConfirmation({
          tenantId: req.tenantId,
          listId: list.id,
          subscriberId: sub.id,
          action: 'unsubscribe',
        });

        const confirmUrl = `${process.env.APP_URL ?? 'https://app.maildrill.net'}/confirm/${pending.id}/${pending.token}`;
        await submitMessage({
          tenantId: req.tenantId,
          channel: 'email',
          to: sub.email,
          recipientId: sub.id,
          content: {
            templateId,
            subject: tpl?.subject ?? `Confirm removal from ${list.name}`,
            html: tpl?.html ?? undefined,
            confirmUrl,
            listName: list.name,
          },
          idempotencyKey: `doo:${list.id}:${sub.id}:${Date.now()}`,
        });

        return reply.code(202).send({ pending: true, message: 'Confirmation email sent' });
      }

      await removeFromList(req.params.id, req.params.subscriberId);
      return reply.code(204).send();
    },
  );

  app.get(
    '/v1/lists/:id/members',
    {
      schema: { tags: TAG, summary: 'List list members', params: idParam, querystring: listQuery },
    },
    async (req) => ({
      data: await listMembersOf(req.tenantId, req.params.id, {
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    }),
  );
}
