import type { FastifyRequest } from 'fastify';
import type { RequestContext } from '@maildrill/identity';

/**
 * Client context for security bookkeeping. The Astro BFF talks to this API
 * server-side, so the connection peer is always the frontend host — the real
 * browser context arrives in `x-client-ip` / `x-client-ua`, which only the
 * BFF (authenticated by service JWT or calling loopback auth routes) sets.
 */
export function clientCtx(req: FastifyRequest): RequestContext {
  const ip = req.headers['x-client-ip'];
  const ua = req.headers['x-client-ua'];
  return {
    ip: typeof ip === 'string' && ip ? ip : (req.ip ?? null),
    userAgent: typeof ua === 'string' && ua ? ua : (req.headers['user-agent'] ?? null),
  };
}
