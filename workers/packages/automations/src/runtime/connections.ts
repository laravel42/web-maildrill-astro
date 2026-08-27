import { and, desc, eq } from 'drizzle-orm';
import { automationConnections, db, type AutomationConnectionRow } from '@maildrill/database';
import { ValidationError } from '@maildrill/domain';
import { decryptSecret, encryptSecret } from '@maildrill/identity';
import { createLogger } from '@maildrill/observability';

const log = createLogger({ component: 'automation-connections' });

/**
 * Workspace-scoped credentials for external pieces.
 *
 * Two rules, both enforced here rather than at the route:
 *   1. a secret is encrypted at rest with the existing account-security key strategy
 *      (AES-256-GCM, `SECURITY_ENCRYPTION_KEY`), and
 *   2. a secret is never returned to a caller — not to the API, not to the composer, not
 *      into flow JSON. A flow stores a connection *id*; only the worker ever decrypts.
 */

/** Safe projection: everything except the ciphertext. */
export interface ConnectionSummary {
  id: string;
  name: string;
  pieceName: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(row: AutomationConnectionRow): ConnectionSummary {
  return {
    id: row.id,
    name: row.name,
    pieceName: row.pieceName,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listConnections(tenantId: string): Promise<ConnectionSummary[]> {
  const rows = await db
    .select()
    .from(automationConnections)
    .where(eq(automationConnections.tenantId, tenantId))
    .orderBy(desc(automationConnections.createdAt));
  return rows.map(toSummary);
}

export async function createConnection(input: {
  tenantId: string;
  name: string;
  pieceName: string;
  secret: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<ConnectionSummary> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('connection name is required');
  if (!input.secret || typeof input.secret !== 'object') {
    throw new ValidationError('connection secret must be a JSON object');
  }
  const rows = await db
    .insert(automationConnections)
    .values({
      tenantId: input.tenantId,
      name,
      pieceName: input.pieceName,
      encryptedSecret: encryptSecret(JSON.stringify(input.secret)),
      metadata: input.metadata ?? {},
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoUpdate({
      target: [automationConnections.tenantId, automationConnections.name],
      set: {
        pieceName: input.pieceName,
        encryptedSecret: encryptSecret(JSON.stringify(input.secret)),
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();
  return toSummary(rows[0]!);
}

export async function deleteConnection(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(automationConnections)
    .where(and(eq(automationConnections.id, id), eq(automationConnections.tenantId, tenantId)))
    .returning({ id: automationConnections.id });
  return rows.length > 0;
}

export async function connectionExists(tenantId: string, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: automationConnections.id })
    .from(automationConnections)
    .where(and(eq(automationConnections.id, id), eq(automationConnections.tenantId, tenantId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Decrypt a connection for one step. Worker-only: nothing on the HTTP path calls this.
 * The tenant predicate is in the WHERE clause, so a connection id lifted from another
 * workspace's flow returns null rather than that workspace's credential.
 */
export async function readConnectionSecret(
  tenantId: string,
  connectionId: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select()
    .from(automationConnections)
    .where(
      and(eq(automationConnections.id, connectionId), eq(automationConnections.tenantId, tenantId)),
    )
    .limit(1);
  if (!row) return null;
  try {
    const parsed: unknown = JSON.parse(decryptSecret(row.encryptedSecret));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch (err) {
    // A key rotation without re-encryption lands here. Fail the step rather than silently
    // running it unauthenticated.
    log.error(
      { connectionId, tenantId, err: err instanceof Error ? err.message : String(err) },
      'automation connection could not be decrypted',
    );
    throw new Error('stored credential could not be decrypted');
  }
}
