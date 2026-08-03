import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { apiKeys, db, type ApiKeyRow } from '@maildrill/database';
import { NotFoundError, ValidationError } from '@maildrill/domain';

/**
 * Workspace-scoped API keys (Settings → API keys). Wire format matches the
 * env `API_KEYS` pairs — `keyId:secret` in `x-api-key` or `Authorization:
 * Bearer` — so callers are indistinguishable; authz just checks the DB after
 * the env list misses. Secrets are stored as sha256 and shown exactly once.
 */

export type ApiKeyScope = 'full' | 'send' | 'read';
const SCOPES: readonly ApiKeyScope[] = ['full', 'send', 'read'];

export interface WorkspaceApiKey {
  id: string;
  name: string;
  keyId: string;
  scope: string;
  createdAt: Date;
  revokedAt: Date | null;
}

function toPublic(row: ApiKeyRow): WorkspaceApiKey {
  return {
    id: row.id,
    name: row.name,
    keyId: row.keyId,
    scope: row.scope,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

export async function listApiKeys(tenantId: string): Promise<WorkspaceApiKey[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))
    .orderBy(apiKeys.createdAt);
  return rows.map(toPublic);
}

export async function createApiKey(
  tenantId: string,
  input: { name: string; scope?: string },
): Promise<{ key: WorkspaceApiKey; /** Shown once — never retrievable again. */ secret: string }> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('give the key a name');
  const scope = (input.scope ?? 'full') as ApiKeyScope;
  if (!SCOPES.includes(scope)) throw new ValidationError('unknown scope');

  const keyId = `mk_${randomBytes(6).toString('hex')}`;
  const secretPart = randomBytes(24).toString('hex');
  const inserted = await db
    .insert(apiKeys)
    .values({ tenantId, name, keyId, secretHash: sha256Hex(secretPart), scope })
    .returning();

  return { key: toPublic(inserted[0]!), secret: `${keyId}:${secretPart}` };
}

export async function revokeApiKey(tenantId: string, id: string): Promise<WorkspaceApiKey> {
  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))
    .returning();
  if (!updated[0]) throw new NotFoundError('api key not found (or already revoked)');
  return toPublic(updated[0]);
}

/**
 * Resolve a `keyId:secret` pair to its tenant, or null. Used by authz after
 * the env API_KEYS list misses. Constant-time hash comparison.
 */
export async function matchWorkspaceApiKey(pair: string): Promise<string | null> {
  const idx = pair.indexOf(':');
  if (idx === -1) return null;
  const keyId = pair.slice(0, idx);
  const secret = pair.slice(idx + 1);
  if (!keyId.startsWith('mk_') || !secret) return null;

  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyId, keyId), isNull(apiKeys.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const a = Buffer.from(sha256Hex(secret));
  const b = Buffer.from(row.secretHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return row.tenantId;
}
