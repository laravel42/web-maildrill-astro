import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getQueue, QUEUE_NAMES } from "@maildrill/queues";
import { listDeadLetters } from "@maildrill/services";
import { authenticate } from "@maildrill/authz";
import type { ZodTypeProvider } from "@maildrill/httpkit";

const TAG = ["Admin"];
const limitQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function adminRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", authenticate);

  app.get("/admin/queues", { schema: { tags: TAG, summary: "BullMQ queue job counts" } }, async () => {
    const names = Object.values(QUEUE_NAMES);
    const entries = await Promise.all(
      names.map(async (n) => [n, await getQueue(n).getJobCounts()] as const),
    );
    return Object.fromEntries(entries);
  });

  app.get(
    "/admin/dead-letters",
    { schema: { tags: TAG, summary: "List dead-lettered jobs", querystring: limitQuery } },
    async (req) => {
      const rows = await listDeadLetters(req.query.limit ?? 50);
      return { data: rows };
    },
  );
}
