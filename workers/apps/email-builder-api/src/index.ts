import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";

import { emailBuilderHealth, emailBuilderRoutes } from "./app.js";

/**
 * Standalone entrypoint. Kept so the AI backend can still run on its own port;
 * the unified dev server mounts `emailBuilderRoutes` in-process instead.
 */

/**
 * Allowed CORS origins from `CORS_ORIGINS` (comma-separated). Falls back to
 * `'*'` so local dev stays permissive; production must set an explicit list.
 */
function resolveAllowedOrigins(): string | string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return "*";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length === 0 ? "*" : origins;
}

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: resolveAllowedOrigins(),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600,
});

app.get("/", (_request, reply) => reply.send("EmailBuilder AI backend"));
app.get("/health", (_request, reply) => reply.send(emailBuilderHealth()));

await app.register(emailBuilderRoutes);

const port = Number(process.env.EB_PORT ?? process.env.PORT ?? 3100);
await app.listen({ port, host: "0.0.0.0" });
console.log(`AI backend listening on http://localhost:${port}`);

export default app;
