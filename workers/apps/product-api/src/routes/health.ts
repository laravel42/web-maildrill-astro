import type { FastifyInstance } from "fastify";
import { pool } from "@maildrill/database";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_req, reply) => {
    try {
      await pool.query("select 1");
      return { status: "ready" };
    } catch (err) {
      return reply.code(503).send({
        status: "unready",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
