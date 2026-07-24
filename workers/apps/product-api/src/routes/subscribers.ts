import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "@maildrill/authz";
import type { ZodTypeProvider } from "@maildrill/httpkit";
import {
  assignTag,
  deleteSubscriber,
  getSubscriberWithRelations,
  listSubscribersWithRelations,
  subscriberActivity,
  subscriberLists,
  setSubscriberStatus,
  unassignTag,
  updateSubscriber,
  upsertSubscriber,
} from "@maildrill/product";

const statusEnum = z.enum(["active", "unsubscribed", "bounced", "complained"]);

const upsertSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(1).optional(),
  name: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
  status: statusEnum.optional(),
});

const patchSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: statusEnum.optional(),
  attributes: z.record(z.unknown()).optional(),
});

const listQuery = z.object({
  status: statusEnum.optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const idParam = z.object({ id: z.string().uuid() });
const tagParams = z.object({ id: z.string().uuid(), tagId: z.string().uuid() });

const TAG = ["Subscribers"];

export async function subscriberRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  app.post(
    "/v1/subscribers",
    { schema: { tags: TAG, summary: "Create or update a subscriber (upsert by email)", body: upsertSchema } },
    async (req, reply) => {
      const sub = await upsertSubscriber({ tenantId: req.tenantId, ...req.body });
      return reply.code(201).send(sub);
    },
  );

  app.get(
    "/v1/subscribers",
    { schema: { tags: TAG, summary: "List subscribers", querystring: listQuery } },
    async (req) => {
      const data = await listSubscribersWithRelations(req.tenantId, {
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return { data };
    },
  );

  app.get(
    "/v1/subscribers/:id",
    { schema: { tags: TAG, summary: "Get a subscriber", params: idParam } },
    async (req, reply) => {
      const sub = await getSubscriberWithRelations(req.tenantId, req.params.id);
      if (!sub) return reply.code(404).send({ error: "not_found" });
      return sub;
    },
  );

  app.get(
    "/v1/subscribers/:id/lists",
    { schema: { tags: TAG, summary: "Lists this subscriber belongs to", params: idParam } },
    async (req) => ({ data: await subscriberLists(req.tenantId, req.params.id) }),
  );

  app.get(
    "/v1/subscribers/:id/activity",
    { schema: { tags: TAG, summary: "Subscriber engagement + recent activity", params: idParam } },
    async (req) => await subscriberActivity(req.tenantId, req.params.id),
  );

  app.patch(
    "/v1/subscribers/:id",
    { schema: { tags: TAG, summary: "Update a subscriber", params: idParam, body: patchSchema } },
    async (req, reply) => {
      const sub = await updateSubscriber(req.tenantId, req.params.id, req.body);
      if (!sub) return reply.code(404).send({ error: "not_found" });
      return sub;
    },
  );

  app.delete(
    "/v1/subscribers/:id",
    { schema: { tags: TAG, summary: "Delete a subscriber", params: idParam } },
    async (req, reply) => {
      const ok = await deleteSubscriber(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    "/v1/subscribers/:id/unsubscribe",
    { schema: { tags: TAG, summary: "Unsubscribe a subscriber", params: idParam } },
    async (req, reply) => {
      const sub = await setSubscriberStatus(req.tenantId, req.params.id, "unsubscribed");
      if (!sub) return reply.code(404).send({ error: "not_found" });
      return sub;
    },
  );

  app.post(
    "/v1/subscribers/:id/tags/:tagId",
    { schema: { tags: TAG, summary: "Assign a tag to a subscriber", params: tagParams } },
    async (req, reply) => {
      await assignTag(req.tenantId, req.params.tagId, req.params.id);
      return reply.code(204).send();
    },
  );

  app.delete(
    "/v1/subscribers/:id/tags/:tagId",
    { schema: { tags: TAG, summary: "Remove a tag from a subscriber", params: tagParams } },
    async (req, reply) => {
      await unassignTag(req.params.tagId, req.params.id);
      return reply.code(204).send();
    },
  );
}
