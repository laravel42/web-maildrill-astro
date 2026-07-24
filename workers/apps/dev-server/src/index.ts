import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "@maildrill/config";
import { logger, metrics } from "@maildrill/observability";
import { closeDb, pool } from "@maildrill/database";
import { sharedConnection, shutdownQueues } from "@maildrill/queues";
import { isValidationError, setupOpenApi } from "@maildrill/httpkit";
import { messagingRoutes } from "../../api/src/server";
import { productRoutes } from "../../product-api/src/server";
import {
  startCampaignDeliveryPoller,
  startDispatchWorker,
  startEventsWorker,
  startMaintenance,
  startPublisher,
  startScheduler,
  startTemplateApprovalPoller,
} from "../../workers/src/roles";
import type { StopFn } from "../../workers/src/poller";
import { emailBuilderHealth, emailBuilderRoutes } from "@maildrill/email-builder-api";
import telescopePlugin from "@node-telescope/fastify";
import { PostgresStorage } from "@node-telescope/storage-postgres";
import {
  instrumentAllTelescope,
  recordTelescopeException,
} from "./telescope";

/**
 * Single-process dev server.
 *
 * Runs the messaging API, the product API and the EmailBuilder AI backend on
 * one Fastify instance and one port, so local development is one command and
 * one log stream instead of three processes on three ports.
 *
 * The three apps stay independently deployable — this only composes their route
 * plugins. Their paths don't overlap:
 *   /v1/messages, /webhooks/*, /admin/*  → messaging
 *   /v1/* (everything else)              → product
 *   /api/*                               → email builder
 *
 * Health, metrics and the OpenAPI document are registered once here rather than
 * per app, since each app defines its own copy and duplicates would collide.
 */
const app = Fastify({
  logger: false,
  // The most permissive of the three: product uses 2 MB, messaging 1 MB, and
  // the builder posts generated documents that can exceed both.
  bodyLimit: 8_388_608,
});

setupOpenApi(app, {
  title: "Maildrill (unified dev)",
  version: "0.1.0",
  description:
    "Messaging, product and EmailBuilder routes on one port for local development. Auth: x-api-key or Bearer JWT.",
});

await app.register(cors, {
  origin: process.env.CORS_ORIGINS?.trim()
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  maxAge: 600,
});

/*
 * Node Telescope — a Laravel-Telescope-style dashboard at /__telescope showing
 * every request/response, errors, and (optionally) queries. Registered before
 * the route plugins so its hooks capture them all. Backed by Postgres (its own
 * `telescope_*` tables in the app DB, created lazily). Enabled in non-production
 * by default; force with TELESCOPE_ENABLED=1 / disable with =0. It records
 * request/response bodies, so keep it off in production.
 */
const telescopeEnabled =
  process.env.TELESCOPE_ENABLED != null
    ? process.env.TELESCOPE_ENABLED !== "0"
    : !config.isProd;
let telescopeStorage: PostgresStorage | null = null;
if (telescopeEnabled) {
  telescopeStorage = new PostgresStorage(config.db.url);
  await app.register(telescopePlugin, {
    storage: telescopeStorage,
    path: "/__telescope",
    ignorePaths: ["/health", "/health/live", "/health/ready", "/metrics", "/__telescope"],
    hiddenRequestHeaders: ["authorization", "cookie", "set-cookie", "x-api-key"],
    hiddenRequestParameters: ["password", "token", "secret", "code"],
  });
  logger.info({ path: "/__telescope" }, "telescope dashboard enabled");
}

app.get("/health/live", async () => ({ status: "ok" }));

app.get("/health/ready", async (_req, reply) => {
  try {
    await pool.query("select 1");
    await sharedConnection().ping();
    return { status: "ready" };
  } catch (err) {
    return reply.code(503).send({
      status: "unready",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/metrics", async (_req, reply) => {
  void reply.header("content-type", "text/plain; version=0.0.4");
  return metrics.render();
});

// The editor probes this before enabling AI features.
app.get("/health", async () => emailBuilderHealth());

await app.register(productRoutes);
await app.register(messagingRoutes);
await app.register(emailBuilderRoutes);

app.setErrorHandler((err, req, reply) => {
  if (isValidationError(err)) {
    return reply.code(400).send({ error: "validation", issues: err.validation });
  }
  // Route plugins don't set their own error handler, so real errors walk up to
  // here — record them in Telescope's Exceptions tab (validation 400s excluded).
  if (telescopeEnabled) recordTelescopeException(app, err);
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  logger.error(
    { err: err instanceof Error ? err.message : String(err), url: req.url },
    "dev-server request error",
  );
  return reply.code(statusCode).send({ error: "internal_error" });
});

// Wire every Telescope watcher sink before workers start and before listen, so
// (a) onResponse hooks can still be registered, and (b) worker/poller startups
// are captured in Commands / Schedule / Jobs.
if (telescopeEnabled) {
  instrumentAllTelescope(app);
}

/*
 * Queue workers run in this process too, so `pnpm dev` is one command for the
 * whole stack. Set DEV_WORKERS=0 to serve HTTP only — useful when running
 * `pnpm worker` separately to watch its output, or to keep a dev API from
 * dispatching anything at all.
 */
const workerStops: StopFn[] = [];
if (process.env.DEV_WORKERS !== "0") {
  workerStops.push(
    startDispatchWorker(),
    startEventsWorker(),
    startPublisher(),
    startScheduler(),
    startMaintenance(),
    startTemplateApprovalPoller(),
    startCampaignDeliveryPoller(),
  );
  logger.info({ provider: config.provider.driver }, "dev-server workers started");
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "dev-server shutting down");
  try {
    await app.close();
    await Promise.allSettled(workerStops.map((stop) => stop()));
    if (telescopeStorage) await telescopeStorage.close().catch(() => undefined);
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

const port = Number(process.env.DEV_SERVER_PORT ?? config.productApi.port);
await app.listen({ host: config.api.host, port });
logger.info({ port, apps: ["product", "messaging", "email-builder"] }, "dev-server listening");
