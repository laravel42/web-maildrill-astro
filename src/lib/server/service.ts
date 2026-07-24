import { createHmac } from 'node:crypto';
import createClient from 'openapi-fetch';
import type { paths } from './api.product';

export interface ServiceCtx {
  userId: string;
  activeTenantId: string;
  role?: string | null;
}

export function serviceBaseUrl(): string {
  return process.env.API_BASE_URL ?? import.meta.env.API_BASE_URL ?? 'http://localhost:3001';
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
