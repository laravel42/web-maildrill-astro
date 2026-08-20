import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { channelSchema } from '@maildrill/domain';
import { authenticate } from '@maildrill/authz';
import type { Subscriber } from '@maildrill/database';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { getUser } from '@maildrill/identity';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  mergeSubscriberTokens,
  resolveMessageContent,
  resolveTemplatePlaceholders,
  updateTemplate,
} from '@maildrill/product';
import {
  refreshTemplateStatus,
  submitMessage,
  submitTemplateForApproval,
} from '@maildrill/services';

const TAG = ['Templates'];
const createSchema = z.object({
  name: z.string().min(1),
  channel: channelSchema.optional(),
  subject: z.string().nullable().optional(),
  preheader: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  builderDoc: z.record(z.unknown()).nullable().optional(),
  category: z.string().nullable().optional(),
  favorite: z.boolean().optional(),
  language: z.string().nullable().optional(),
  components: z.record(z.unknown()).nullable().optional(),
});
const idParam = z.object({ id: z.string().uuid() });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;
const testSendBody = z.object({
  /** Explicit recipients; empty/omitted falls back to the signed-in user. */
  to: z.array(z.string().trim().min(1).max(320)).max(10).optional(),
});

export async function templateRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/templates',
    { schema: { tags: TAG, summary: 'Create a template', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(await createTemplate({ tenantId: req.tenantId, ...req.body })),
  );

  app.get('/v1/templates', { schema: { tags: TAG, summary: 'List templates' } }, async (req) => ({
    data: await listTemplates(req.tenantId),
  }));

  app.get(
    '/v1/templates/:id',
    { schema: { tags: TAG, summary: 'Get a template', params: idParam } },
    async (req, reply) => {
      const tpl = await getTemplate(req.tenantId, req.params.id);
      if (!tpl) return reply.code(404).send({ error: 'not_found' });
      return tpl;
    },
  );

  app.patch(
    '/v1/templates/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Update a template',
        params: idParam,
        body: createSchema.partial(),
      },
    },
    async (req, reply) => {
      const tpl = await updateTemplate(req.tenantId, req.params.id, req.body);
      if (!tpl) return reply.code(404).send({ error: 'not_found' });
      return tpl;
    },
  );

  app.delete(
    '/v1/templates/:id',
    { schema: { tags: TAG, summary: 'Delete a template', params: idParam } },
    async (req, reply) => {
      const ok = await deleteTemplate(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    '/v1/templates/:id/submit',
    {
      schema: {
        tags: TAG,
        summary: 'Submit a WhatsApp template for Meta approval',
        params: idParam,
      },
    },
    async (req, reply) => {
      const { template, error } = await submitTemplateForApproval(req.tenantId, req.params.id);
      if (!template) return reply.code(404).send({ error: 'not_found' });
      if (error) return reply.code(422).send({ error });
      return template;
    },
  );

  app.post(
    '/v1/templates/:id/test-send',
    {
      schema: {
        tags: TAG,
        summary: 'Send the template as a real test message to one or more recipients',
        params: idParam,
        body: testSendBody,
      },
    },
    async (req, reply) => {
      const template = await getTemplate(req.tenantId, req.params.id);
      if (!template) return reply.code(404).send({ error: 'not_found' });
      const user = req.userId ? await getUser(req.userId) : null;

      const isEmail = template.channel === 'email';
      const requested = [...new Set((req.body.to ?? []).map((s) => s.trim()).filter(Boolean))];
      const bad = requested.find((v) => !(isEmail ? EMAIL_RE : PHONE_RE).test(v));
      if (bad) {
        return reply.code(400).send({
          error: `“${bad}” is not a valid ${isEmail ? 'email address' : 'phone number'}.`,
        });
      }
      const destinations = requested.length
        ? requested
        : [isEmail ? (user?.email ?? '') : (user?.phone ?? '').trim()].filter(Boolean);
      if (destinations.length === 0) {
        return reply.code(400).send({
          error: isEmail
            ? 'Add at least one email address.'
            : 'Add at least one phone number (or set one on your profile).',
        });
      }

      const ids: string[] = [];
      for (const to of destinations) {
        // Merge tags render per destination — {{email}}/{{phone}} become the
        // address being tested, the name falls back to the tester's — through
        // the same content assembly a campaign send uses (incl. the approved-
        // WhatsApp template path and its placeholder fallback chain).
        const recipient = {
          email: isEmail ? to : (user?.email ?? ''),
          name: user?.name ?? '',
          phone: isEmail ? (user?.phone ?? '') : to,
          attributes: {},
        } as Subscriber;
        let content = resolveMessageContent(template, recipient, undefined, template.channel);
        if (isEmail && !content.subject) content.subject = template.name;
        if (template.channel === 'whatsapp' && template.approvalStatus !== 'approved') {
          // Unapproved templates test as a plain session message; fill the
          // numbered {{n}} placeholders through the same fallback chain the
          // approved path uses so the test reads like the real message would.
          const components = (template.components ?? {}) as { body?: { text?: unknown } };
          const raw =
            typeof components.body?.text === 'string'
              ? components.body.text
              : (template.text ?? '');
          const values = resolveTemplatePlaceholders(template, recipient);
          const filled = raw.replace(
            /\{\{\s*(\d+)\s*\}\}/g,
            (m, n: string) => values[Number(n) - 1] || m,
          );
          content = { text: mergeSubscriberTokens(filled, recipient) };
        }
        const { message } = await submitMessage({
          tenantId: req.tenantId,
          channel: template.channel,
          to,
          content,
        });
        ids.push(message.id);
      }
      return reply.code(202).send({ ids, to: destinations, channel: template.channel });
    },
  );

  app.post(
    '/v1/templates/:id/refresh-status',
    {
      schema: {
        tags: TAG,
        summary: "Refresh a WhatsApp template's approval status from the provider",
        params: idParam,
      },
    },
    async (req, reply) => {
      const { template, error } = await refreshTemplateStatus(req.tenantId, req.params.id);
      if (!template) return reply.code(404).send({ error: 'not_found' });
      if (error) return reply.code(422).send({ error });
      return template;
    },
  );
}
