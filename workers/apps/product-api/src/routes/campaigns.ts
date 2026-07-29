import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { channelSchema, ConflictError, NotFoundError } from '@maildrill/domain';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaignMessages,
  listCampaigns,
  sendCampaign,
  sendCampaignDraft,
  updateCampaign,
} from '@maildrill/product';

const TAG = ['Campaigns'];
const idParam = z.object({ id: z.string().uuid() });
const createSchema = z.object({
  name: z.string().min(1),
  channel: channelSchema.optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused']).optional(),
  listId: z.string().uuid().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  content: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});

const sendSchema = z
  .object({
    name: z.string().optional(),
    channel: channelSchema,
    listId: z.string().uuid().optional(),
    segmentId: z.string().uuid().optional(),
    subscriberIds: z.array(z.string().uuid()).optional(),
    templateId: z.string().uuid().optional(),
    content: z.record(z.unknown()).optional(),
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((v) => v.listId || v.segmentId || v.subscriberIds?.length, {
    message: 'one of listId, segmentId, or subscriberIds is required',
  })
  .refine((v) => v.templateId || v.content, {
    message: 'templateId or content is required',
  });

export async function campaignRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/campaigns/send',
    {
      schema: {
        tags: ['Campaigns'],
        summary: 'Resolve an audience and submit a campaign to the messaging engine',
        body: sendSchema,
      },
    },
    async (req, reply) => {
      const result = await sendCampaign({
        tenantId: req.tenantId,
        name: req.body.name,
        channel: req.body.channel,
        selector: {
          listId: req.body.listId,
          segmentId: req.body.segmentId,
          subscriberIds: req.body.subscriberIds,
        },
        templateId: req.body.templateId,
        content: req.body.content,
        scheduledAt: req.body.scheduledAt ?? null,
      });
      return reply.code(202).send(result);
    },
  );

  // Send a saved draft in place. Separate from /v1/campaigns/send because that
  // route always creates a new campaign; this one sends the draft the user has
  // been editing, which is what the app's "Send now" button needs.
  app.post(
    '/v1/campaigns/:id/send',
    {
      schema: {
        tags: TAG,
        summary: 'Send an existing campaign draft using its saved audience and content',
        params: idParam,
        body: z.object({ sendNow: z.boolean().optional() }).optional(),
      },
    },
    async (req, reply) => {
      try {
        const result = await sendCampaignDraft(
          req.tenantId,
          req.params.id,
          req.body?.sendNow ? null : undefined,
        );
        return reply.code(202).send(result);
      } catch (err) {
        // A draft that is missing, already sending, or has nothing to send is a
        // client-correctable state — surface it instead of a blank 500.
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: 'not_found', message: err.message });
        }
        if (err instanceof ConflictError) {
          return reply.code(409).send({ error: 'conflict', message: err.message });
        }
        throw err;
      }
    },
  );

  // ---- Campaign drafts (CRUD) --------------------------------------------

  app.post(
    '/v1/campaigns',
    { schema: { tags: TAG, summary: 'Create a campaign draft', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(
        await createCampaign({
          tenantId: req.tenantId,
          ...req.body,
          scheduledAt: req.body.scheduledAt ?? null,
        }),
      ),
  );

  app.get('/v1/campaigns', { schema: { tags: TAG, summary: 'List campaigns' } }, async (req) => ({
    data: await listCampaigns(req.tenantId),
  }));

  app.get(
    '/v1/campaigns/:id',
    { schema: { tags: TAG, summary: 'Get a campaign', params: idParam } },
    async (req, reply) => {
      const campaign = await getCampaign(req.tenantId, req.params.id);
      if (!campaign) return reply.code(404).send({ error: 'not_found' });
      return campaign;
    },
  );

  app.get(
    '/v1/campaigns/:id/messages',
    {
      schema: {
        tags: TAG,
        summary: 'Per-recipient message outcomes for a campaign report',
        params: idParam,
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).optional() }),
      },
    },
    async (req) => ({
      data: await listCampaignMessages(req.tenantId, req.params.id, req.query.limit ?? 200),
    }),
  );

  app.patch(
    '/v1/campaigns/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Update a campaign draft',
        params: idParam,
        body: createSchema.partial(),
      },
    },
    async (req, reply) => {
      const campaign = await updateCampaign(req.tenantId, req.params.id, req.body);
      if (!campaign) return reply.code(404).send({ error: 'not_found' });
      return campaign;
    },
  );

  app.delete(
    '/v1/campaigns/:id',
    { schema: { tags: TAG, summary: 'Delete a campaign', params: idParam } },
    async (req, reply) => {
      const ok = await deleteCampaign(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );
}
