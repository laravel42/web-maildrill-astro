import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authenticate } from "@maildrill/authz";
import { ConflictError, NotFoundError, ValidationError } from "@maildrill/domain";
import type { ZodTypeProvider } from "@maildrill/httpkit";
import {
  confirmUpload,
  createUploadTicket,
  deleteMedia,
  listMedia,
  mediaConfigured,
  mediaSuggestConfigured,
  suggestMediaMetadata,
  updateMedia,
} from "@maildrill/product";

const TAG = ["Media"];
const idParam = z.object({ id: z.string().uuid() });

const ticketSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const confirmSchema = z.object({
  storageKey: z.string().min(1),
  name: z.string().min(1),
  contentType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  folder: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  thumbStorageKey: z.string().min(1).nullable().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  folder: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const suggestSchema = z.object({
  /** Raw base64 or a data: URL. */
  imageBase64: z.string().min(1),
  contentType: z.string().min(1),
});

export async function mediaRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  /* Lets the UI say "media isn't set up" instead of failing on first upload. */
  app.get(
    "/v1/media/status",
    { schema: { tags: TAG, summary: "Whether media storage is configured" } },
    async () => ({
      configured: mediaConfigured(),
      suggestConfigured: mediaSuggestConfigured(),
    }),
  );

  app.post(
    "/v1/media/suggest-metadata",
    {
      schema: {
        tags: TAG,
        summary: "Vision-powered name + tags for a staged image",
        body: suggestSchema,
      },
    },
    async (req, reply) => {
      try {
        return await suggestMediaMetadata(req.body);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.get("/v1/media", { schema: { tags: TAG, summary: "List media assets" } }, async (req) => ({
    data: await listMedia(req.tenantId),
  }));

  app.post(
    "/v1/media/upload-url",
    {
      schema: {
        tags: TAG,
        summary: "Presigned S3 PUT for a direct browser upload",
        body: ticketSchema,
      },
    },
    async (req, reply) => {
      try {
        return await createUploadTicket(req.tenantId, req.body);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.post(
    "/v1/media",
    {
      schema: {
        tags: TAG,
        summary: "Register an uploaded object as a media asset",
        body: confirmSchema,
      },
    },
    async (req, reply) => {
      try {
        return reply.code(201).send(await confirmUpload(req.tenantId, req.body));
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.patch(
    "/v1/media/:id",
    {
      schema: {
        tags: TAG,
        summary: "Rename, move, or retag an asset",
        params: idParam,
        body: patchSchema,
      },
    },
    async (req, reply) => {
      const updated = await updateMedia(req.tenantId, req.params.id, req.body);
      return updated ? updated : reply.code(404).send({ error: "not_found" });
    },
  );

  app.delete(
    "/v1/media/:id",
    { schema: { tags: TAG, summary: "Delete an asset and its stored object", params: idParam } },
    async (req, reply) => {
      try {
        await deleteMedia(req.tenantId, req.params.id);
        return reply.code(204).send();
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );
}

/** Storage misconfiguration and bad input are client-visible, not 500s. */
function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof ValidationError) {
    return reply.code(400).send({ error: "validation", message: err.message });
  }
  if (err instanceof NotFoundError) {
    return reply.code(404).send({ error: "not_found", message: err.message });
  }
  if (err instanceof ConflictError) {
    return reply.code(503).send({ error: "unavailable", message: err.message });
  }
  throw err;
}
