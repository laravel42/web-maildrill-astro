import { createHmac } from 'node:crypto';
import createClient from 'openapi-fetch';
import type { paths } from './api.product';

export interface ServiceCtx {
  userId: string;
  activeTenantId: string;
  role?: string | null;
  /** Auth.js session row id (`sid` claim) — enables per-session checks. */
  sessionId?: string | null;
  /** Login instant (unix seconds) — enables recent-auth enforcement. */
  authTime?: number | null;
}

export function serviceBaseUrl(): string {
  return process.env.API_BASE_URL ?? import.meta.env.API_BASE_URL ?? 'http://localhost:3001';
}

/**
 * Messaging API origin (`/v1/messages*`, `/webhooks/*`, `/admin/*`).
 * Defaults to the product API URL when running the unified `pnpm dev` process.
 * Set `MESSAGING_API_BASE_URL` (e.g. http://localhost:3002) for a split deploy.
 */
export function messagingBaseUrl(): string {
  return (
    process.env.MESSAGING_API_BASE_URL ??
    import.meta.env.MESSAGING_API_BASE_URL ??
    serviceBaseUrl()
  );
}

/** Pick the backend that owns a `/v1/...` path segment (no leading slash). */
export function v1BackendBaseUrl(path: string): string {
  if (path === 'messages' || path.startsWith('messages/')) {
    return messagingBaseUrl();
  }
  return serviceBaseUrl();
}

/** Mint a short-lived HS256 JWT the workers accepts (tenant-scoped). */
export function mintServiceToken(ctx: ServiceCtx): string {
  const secret = process.env.JWT_SECRET ?? import.meta.env.JWT_SECRET;
  if (!secret || secret === 'change-me' || secret === 'change-me-in-production') {
    if (import.meta.env.PROD) {
      throw new Error('JWT_SECRET must be set to a strong value in production');
    }
  }
  const resolved = secret && secret.length > 0 ? secret : 'change-me';
  const b64 = (v: string) => Buffer.from(v).toString('base64url');
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(
    JSON.stringify({
      tenantId: ctx.activeTenantId,
      userId: ctx.userId,
      role: ctx.role ?? undefined,
      sessionId: ctx.sessionId ?? undefined,
      authTime: ctx.authTime ?? undefined,
      exp: Math.floor(Date.now() / 1000) + 300,
    }),
  );
  const sig = createHmac('sha256', resolved).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/** Typed product-API client bound to the caller's tenant. Server-only. */
export function productClient(ctx: ServiceCtx) {
  return createClient<paths>({
    baseUrl: serviceBaseUrl(),
    headers: { Authorization: `Bearer ${mintServiceToken(ctx)}` },
  });
}
