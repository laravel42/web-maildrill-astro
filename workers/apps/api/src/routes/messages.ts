import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { channelSchema } from "@maildrill/domain";
import {
  cancelMessage,
  getMessage,
  listMessageEvents,
  retryMessage,
  submitMessage,
} from "@maildrill/services";
import { authenticate } from "@maildrill/authz";
import type { ZodTypeProvider } from "@maildrill/httpkit";
import { messageSummary } from "../serialize";

const TAG = ["Messages"];
const submitSchema = z.object({
  channel: channelSchema,
  to: z.string().min(1),
  content: z.record(z.unknown()).optional(),
  provider: z.string().min(1).optional(),
  recipientId: z.string().min(1).optional(),
  campaignId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  idempotencyKey: z.string().min(1).optional(),
});
const idParam = z.object({ id: z.string().uuid() });
const eventsQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  before: z.coerce.date().optional(),
});

export async function messageRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  app.post(
    "/v1/messages",
    { schema: { tags: TAG, summary: "Submit a message (durable-then-return; idempotent on Idempotency-Key)", body: submitSchema } },
    async (req, reply) => {
      const headerKey = req.headers["idempotency-key"];
      const idempotencyKey =
        req.body.idempotencyKey ?? (typeof headerKey === "string" ? headerKey : undefined);

      const { message, deduplicated } = await submitMessage({
        tenantId: req.tenantId,
        channel: req.body.channel,
        to: req.body.to,
        content: req.body.content,
        provider: req.body.provider,
        recipientId: req.body.recipientId,
        campaignId: req.body.campaignId,
        scheduledAt: req.body.scheduledAt ?? null,
        idempotencyKey,
      });
      return reply.code(deduplicated ? 200 : 201).send(messageSummary(message));
    },
  );

  app.get("/v1/messages/:id", { schema: { tags: TAG, summary: "Get a message", params: idParam } }, async (req, reply) => {
    const m = await getMessage(req.tenantId, req.params.id);
    if (!m) return reply.code(404).send({ error: "not_found" });
    return messageSummary(m);
  });

  app.get(
    "/v1/messages/:id/events",
    { schema: { tags: TAG, summary: "List a message's normalized event history", params: idParam, querystring: eventsQuery } },
    async (req) => {
      const events = await listMessageEvents(req.tenantId, req.params.id, {
        limit: req.query.limit,
        before: req.query.before,
      });
      return {
        data: events.map((e) => ({
          id: e.id,
          type: e.eventType,
          providerStatus: e.providerStatus,
          occurredAt: e.occurredAt,
          createdAt: e.createdAt,
        })),
      };
    },
  );

  app.post("/v1/messages/:id/cancel", { schema: { tags: TAG, summary: "Cancel a message while eligible", params: idParam } }, async (req, reply) => {
    const { message, cancelled } = await cancelMessage(req.tenantId, req.params.id);
    if (!message) return reply.code(404).send({ error: "not_found" });
    return cancelled
      ? messageSummary(message)
      : reply.code(409).send({ error: "not_cancellable", status: message.status });
  });

  app.post("/v1/messages/:id/retry", { schema: { tags: TAG, summary: "Retry a failed message (new generation)", params: idParam } }, async (req, reply) => {
    const { message, retried } = await retryMessage(req.tenantId, req.params.id);
    if (!message) return reply.code(404).send({ error: "not_found" });
    return retried
      ? messageSummary(message)
      : reply.code(409).send({ error: "not_retryable", status: message.status });
  });
}
