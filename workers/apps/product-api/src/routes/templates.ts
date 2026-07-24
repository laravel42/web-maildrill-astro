import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { channelSchema } from "@maildrill/domain";
import { authenticate } from "@maildrill/authz";
import type { ZodTypeProvider } from "@maildrill/httpkit";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "@maildrill/product";
import { refreshTemplateStatus, submitTemplateForApproval } from "@maildrill/services";

const TAG = ["Templates"];
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

export async function templateRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  app.post("/v1/templates", { schema: { tags: TAG, summary: "Create a template", body: createSchema } }, async (req, reply) =>
    reply.code(201).send(await createTemplate({ tenantId: req.tenantId, ...req.body })),
  );

  app.get("/v1/templates", { schema: { tags: TAG, summary: "List templates" } }, async (req) => ({
    data: await listTemplates(req.tenantId),
  }));

  app.get("/v1/templates/:id", { schema: { tags: TAG, summary: "Get a template", params: idParam } }, async (req, reply) => {
    const tpl = await getTemplate(req.tenantId, req.params.id);
    if (!tpl) return reply.code(404).send({ error: "not_found" });
    return tpl;
  });

  app.patch(
    "/v1/templates/:id",
    { schema: { tags: TAG, summary: "Update a template", params: idParam, body: createSchema.partial() } },
    async (req, reply) => {
      const tpl = await updateTemplate(req.tenantId, req.params.id, req.body);
      if (!tpl) return reply.code(404).send({ error: "not_found" });
      return tpl;
    },
  );

  app.delete("/v1/templates/:id", { schema: { tags: TAG, summary: "Delete a template", params: idParam } }, async (req, reply) => {
    const ok = await deleteTemplate(req.tenantId, req.params.id);
    return reply.code(ok ? 204 : 404).send();
  });

  app.post(
    "/v1/templates/:id/submit",
    { schema: { tags: TAG, summary: "Submit a WhatsApp template for Meta approval", params: idParam } },
    async (req, reply) => {
      const { template, error } = await submitTemplateForApproval(req.tenantId, req.params.id);
      if (!template) return reply.code(404).send({ error: "not_found" });
      if (error) return reply.code(422).send({ error });
      return template;
    },
  );

  app.post(
    "/v1/templates/:id/refresh-status",
    { schema: { tags: TAG, summary: "Refresh a WhatsApp template's approval status from the provider", params: idParam } },
    async (req, reply) => {
      const { template, error } = await refreshTemplateStatus(req.tenantId, req.params.id);
      if (!template) return reply.code(404).send({ error: "not_found" });
      if (error) return reply.code(422).send({ error });
      return template;
    },
  );
}
