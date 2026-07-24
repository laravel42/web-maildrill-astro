import { config } from "@maildrill/config";
import { logger } from "@maildrill/observability";
import { closeDb } from "@maildrill/database";
import { shutdownQueues } from "@maildrill/queues";
import { buildServer } from "./server";

const app = buildServer();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "api shutting down");
  try {
    await app.close();
    await shutdownQueues();
    await closeDb();
  } catch (err) {
    logger.error({ err }, "error during shutdown");
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

app
  .listen({ host: config.api.host, port: config.api.port })
  .then(() => logger.info({ port: config.api.port, host: config.api.host }, "api listening"))
  .catch((err: unknown) => {
    logger.error({ err }, "api failed to start");
    process.exit(1);
  });
