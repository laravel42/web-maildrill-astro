import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '@maildrill/config';
import { ensureTenantByName, matchWorkspaceApiKey } from '@maildrill/services';
import { verifyJwtHS256 } from './jwt';
import { emitAuthCache, emitAuthGate } from './observers';

export { verifyJwtHS256 } from './jwt';
export type { JwtClaims } from './jwt';
export {
  setAuthGateSink,
  setAuthCacheSink,
  type AuthGateEvent,
  type AuthCacheEvent,
} from './observers';

declare module 'fastify' {
  interface FastifyRequest {
    /** Tenant resolved by the auth preHandler; always set on protected routes. */
    tenantId: string;
    /** User id (present only for JWT/session auth, not API-key auth). */
    userId?: string;
    /** Membership role carried in the session JWT, when present. */
    role?: string;
  }
}

export interface AuthContext {
  tenantId: string;
  userId?: string;
  role?: string;
}

const tenantCache = new Map<string, string>();

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function tenantForApiKey(keyId: string): Promise<string> {
  const cached = tenantCache.get(keyId);
  if (cached) {
    emitAuthCache({ type: 'hit', key: `api-key:${keyId}`, value: cached });
    return cached;
  }
  emitAuthCache({ type: 'miss', key: `api-key:${keyId}` });
  const tenant = await ensureTenantByName(keyId);
  tenantCache.set(keyId, tenant.id);
  emitAuthCache({ type: 'set', key: `api-key:${keyId}`, value: tenant.id });
  return tenant.id;
}

async function matchApiKey(pair: string): Promise<string | null> {
  const idx = pair.indexOf(':');
  if (idx === -1) return null;
  const id = pair.slice(0, idx);
  const secret = pair.slice(idx + 1);
  const match = config.auth.apiKeys.find((k) => k.id === id);
  if (match && safeEqual(secret, match.secret)) return tenantForApiKey(id);
  // Env pairs are the ops fallback; workspace-created keys (Settings → API
  // keys, `mk_…` ids) live in the database and are revocable per tenant.
  return matchWorkspaceApiKey(pair);
}

type AuthMethod = 'api-key' | 'jwt' | 'bearer-api-key' | 'none';

async function resolveAuth(
  req: FastifyRequest,
): Promise<{ ctx: AuthContext; method: AuthMethod } | null> {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string') {
    const tenantId = await matchApiKey(apiKey);
    return tenantId ? { ctx: { tenantId }, method: 'api-key' } : null;
  }

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.split('.').length === 3) {
      try {
        const claims = verifyJwtHS256(token, config.auth.jwtSecret);
        if (typeof claims.tenantId !== 'string') return null;
        return {
          ctx: {
            tenantId: claims.tenantId,
            userId: typeof claims.userId === 'string' ? claims.userId : undefined,
            role: typeof claims.role === 'string' ? claims.role : undefined,
          },
          method: 'jwt',
        };
      } catch {
        return null;
      }
    }
    const tenantId = await matchApiKey(token);
    return tenantId ? { ctx: { tenantId }, method: 'bearer-api-key' } : null;
  }
  return null;
}

/** Fastify preHandler: authenticate the caller and attach tenant/user context. */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const resolved = await resolveAuth(req);
  if (!resolved) {
    emitAuthGate({
      ability: 'authenticate',
      result: 'denied',
      method: 'none',
      path: req.url,
    });
    await reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  const { ctx, method } = resolved;
  emitAuthGate({
    ability: 'authenticate',
    result: 'allowed',
    method,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    path: req.url,
  });
  req.tenantId = ctx.tenantId;
  req.userId = ctx.userId;
  req.role = ctx.role;
}
