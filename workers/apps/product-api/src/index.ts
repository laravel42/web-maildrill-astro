import { config } from "@maildrill/config";
import { logger } from "@maildrill/observability";
import { closeDb } from "@maildrill/database";
import { buildProductServer } from "./server";

const app = buildProductServer();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "product-api shutting down");
  try {
    await app.close();
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
  .listen({ host: config.productApi.host, port: config.productApi.port })
  .then(() =>
    logger.info(
      { port: config.productApi.port, host: config.productApi.host },
      "product-api listening",
    ),
  )
  .catch((err: unknown) => {
    logger.error({ err }, "product-api failed to start");
    process.exit(1);
  });
