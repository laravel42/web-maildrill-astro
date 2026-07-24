import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "@maildrill/config";
import { ingestWebhook } from "@maildrill/services";
import type { WebhookKind } from "@maildrill/providers";
import type { ZodTypeProvider } from "@maildrill/httpkit";

const KNOWN_PROVIDERS = new Set(["infobip", "mock"]);
const KNOWN_KINDS = new Set<WebhookKind>(["delivery", "engagement", "voice", "template"]);

const params = z.object({ provider: z.string(), kind: z.string() });
const query = z.object({ secret: z.string().optional() });

function secretOk(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.webhooks.infobipSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function webhookRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();

  // Not behind the API-key auth hook — authenticated by a shared webhook secret.
  app.post(
    "/webhooks/:provider/:kind",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Provider delivery/engagement/voice webhook (secret-gated via x-webhook-secret or ?secret=)",
        params,
        querystring: query,
      },
    },
    async (req, reply) => {
      const { provider, kind } = req.params;
      if (!KNOWN_PROVIDERS.has(provider) || !KNOWN_KINDS.has(kind as WebhookKind)) {
        return reply.code(404).send({ error: "unknown_webhook" });
      }

      const headerSecret = req.headers["x-webhook-secret"];
      const secret = typeof headerSecret === "string" ? headerSecret : req.query.secret;
      if (!secretOk(secret)) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const body = req.body ?? {};
      const result = await ingestWebhook({
        provider,
        kind: kind as WebhookKind,
        headers: req.headers,
        body,
        rawBody: JSON.stringify(body),
      });
      return reply.code(202).send({ webhookEventId: result.webhookEventId, duplicate: result.duplicate });
    },
  );
}
