import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  verifyUnsubscribeSignature,
  getList,
  getSubscriber,
  getTemplate,
  removeFromList,
  renderTemplate,
  listRequiresConfirmation,
  createListConfirmation,
} from '@maildrill/product';
import { getWorkspace, submitMessage } from '@maildrill/services';
import { db, listMembers } from '@maildrill/database';
import { and, eq } from 'drizzle-orm';

/**
 * Public unsubscribe endpoint. No authentication — the HMAC signature is the proof.
 * Handles both direct unsubscribe and double opt-out flows.
 */
export async function unsubscribeRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  const unsubParams = z.object({
    listId: z.string().uuid(),
    subscriberId: z.string().uuid(),
    sig: z.string().min(1),
  });

  // GET — verify signature and return list info (the frontend page uses this).
  app.get(
    '/v1/unsubscribe/:listId/:subscriberId/:sig',
    { schema: { summary: 'Unsubscribe a subscriber from a list (public, signed)', params: unsubParams } },
    async (req, reply) => {
      const { listId, subscriberId, sig } = req.params;

      if (!verifyUnsubscribeSignature(listId, subscriberId, sig)) {
        return reply.code(400).send({ error: 'invalid_signature', message: 'This unsubscribe link is invalid.' });
      }

      // Look up the list to get tenant context and check double opt-out.
      const listRows = await db.select().from(listMembers).where(
        and(eq(listMembers.listId, listId), eq(listMembers.subscriberId, subscriberId)),
      ).limit(1);

      if (listRows.length === 0) {
        return { ok: true, alreadyUnsubscribed: true, message: 'You are already unsubscribed from this list.' };
      }

      const tenantId = listRows[0]!.tenantId;
      const list = await getList(tenantId, listId);
      if (!list) {
        return reply.code(404).send({ error: 'not_found', message: 'List not found.' });
      }

      // Check if double opt-out is required.
      const ws = await getWorkspace(tenantId);
      const templateId = listRequiresConfirmation(list, 'unsubscribe', ws?.settings);

      if (templateId) {
        // Double opt-out: send confirmation email, don't remove yet.
        const sub = await getSubscriber(tenantId, subscriberId);
        if (!sub) {
          return reply.code(404).send({ error: 'subscriber_not_found' });
        }

        const tpl = await getTemplate(tenantId, templateId);
        const pending = await createListConfirmation({
          tenantId,
          listId: list.id,
          subscriberId: sub.id,
          action: 'unsubscribe',
        });

        const confirmUrl = `${process.env.APP_URL ?? 'https://app.maildrill.net'}/confirm/${pending.id}/${pending.token}`;
        const rendered = tpl ? renderTemplate(tpl, sub) : {};
        void submitMessage({
          tenantId,
          channel: 'email',
          to: sub.email,
          recipientId: sub.id,
          content: {
            templateId,
            subject: (rendered.subject as string) ?? `Confirm removal from ${list.name}`,
            html: (rendered.html as string) ?? undefined,
            confirmUrl,
            listName: list.name,
          },
          idempotencyKey: `unsub-doo:${list.id}:${sub.id}:${Date.now()}`,
        }).catch(() => {});

        return {
          ok: true,
          doubleOptOut: true,
          listName: list.name,
          message: `A confirmation email has been sent. Please check your inbox to confirm removal from ${list.name}.`,
        };
      }

      // Direct unsubscribe — no double opt-out.
      await removeFromList(listId, subscriberId);

      // Send goodbye email if configured.
      if (list.goodbyeEmailTemplateId) {
        const sub = await getSubscriber(tenantId, subscriberId);
        if (sub) {
          const tpl = await getTemplate(tenantId, list.goodbyeEmailTemplateId);
          if (tpl) {
            const rendered = renderTemplate(tpl, sub);
            void submitMessage({
              tenantId,
              channel: 'email',
              to: sub.email,
              recipientId: sub.id,
              content: {
                templateId: list.goodbyeEmailTemplateId,
                subject: (rendered.subject as string) ?? `You've been removed from ${list.name}`,
                html: (rendered.html as string) ?? undefined,
                listName: list.name,
              },
              idempotencyKey: `goodbye:${list.id}:${sub.id}:${Date.now()}`,
            }).catch(() => {});
          }
        }
      }

      return { ok: true, listName: list.name, message: `You have been unsubscribed from ${list.name}.` };
    },
  );
}
