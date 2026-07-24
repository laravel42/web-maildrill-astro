import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "@maildrill/authz";
import type { ZodTypeProvider } from "@maildrill/httpkit";
import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
} from "@maildrill/product";

const TAG = ["Custom fields"];

/*
 * Custom field definitions are workspace-wide, not per-list: a subscriber's
 * values live in one flat `subscribers.attributes` bag and a subscriber can be
 * on many lists, so scoping a key's type to a list would let the same key carry
 * two types for one subscriber. The list drawer edits this shared catalogue.
 */

// Keys address a jsonb attribute, so keep them to a safe identifier shape
// rather than accepting whatever was typed.
const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "key must be lowercase letters, digits and underscores");

const createSchema = z.object({
  key: keySchema,
  label: z.string().min(1).max(120).optional(),
  type: z.enum(["text", "number", "date", "boolean"]).default("text"),
});
const idParam = z.object({ id: z.string().uuid() });

/** `first_name` -> `First name`, so a key alone is enough to create a field. */
function humanize(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function customFieldRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  app.get(
    "/v1/custom-fields",
    { schema: { tags: TAG, summary: "List custom field definitions" } },
    async (req) => ({ data: await listCustomFields(req.tenantId) }),
  );

  app.post(
    "/v1/custom-fields",
    { schema: { tags: TAG, summary: "Define a custom field", body: createSchema } },
    async (req, reply) => {
      const { key, type } = req.body;
      const { field, created } = await createCustomField(
        req.tenantId,
        key,
        req.body.label ?? humanize(key),
        type,
      );
      // A duplicate key is a real conflict for someone adding a field by hand,
      // even though the underlying upsert is happy to be idempotent.
      if (!created) return reply.code(409).send({ error: "key_taken" });
      return reply.code(201).send(field);
    },
  );

  app.delete(
    "/v1/custom-fields/:id",
    { schema: { tags: TAG, summary: "Remove a custom field definition", params: idParam } },
    async (req, reply) => {
      const ok = await deleteCustomField(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );
}
