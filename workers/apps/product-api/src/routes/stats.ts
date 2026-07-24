import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { channelSchema } from "@maildrill/domain";
import { authenticate } from "@maildrill/authz";
import type { ZodTypeProvider } from "@maildrill/httpkit";
import { dailyActivity, workspaceSummary } from "@maildrill/product";

const TAG = ["Stats"];
const seriesQuery = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
  channel: channelSchema.optional(),
});

export async function statsRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  app.get(
    "/v1/stats/summary",
    { schema: { tags: TAG, summary: "Workspace counters for the dashboard" } },
    async (req) => workspaceSummary(req.tenantId),
  );

  app.get(
    "/v1/stats/activity",
    {
      schema: {
        tags: TAG,
        summary: "Daily send activity, zero-filled (no open/click data yet)",
        querystring: seriesQuery,
      },
    },
    async (req) => ({
      data: await dailyActivity(req.tenantId, req.query.days ?? 30, req.query.channel),
    }),
  );
}
