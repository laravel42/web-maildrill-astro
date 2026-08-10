/**
 * Per-workspace Infobip CPaaS X entities.
 *
 * Every workspace gets its own entity id so outbound traffic is attributable
 * per workspace inside the one shared Infobip account — usage and billing
 * reporting, nothing more. It is deliberately **not** a data boundary: that
 * was tested against the live account and rejected (see
 * `workers/docs/infobip-api-scheme.md`). Postgres remains the system of record.
 *
 * Two things create the entity on Infobip's side:
 *
 *  1. `POST /provisioning/1/entities` at workspace creation, which also gives
 *     it a readable `entityName` in the portal. The live account's key
 *     currently answers 403 UNAUTHORIZED on `/provisioning`, so this is
 *     best-effort and never blocks a signup.
 *  2. Infobip auto-creating it the first time a message carries an unknown
 *     `entityId` (entityName then equals the id). This is the path that
 *     actually works today, which is why (1) failing is not fatal.
 */
import { eq } from 'drizzle-orm';
import { db, tenants } from '@maildrill/database';
import { logger } from '@maildrill/observability';
import { getProvider } from '@maildrill/providers';

const log = logger.child({ mod: 'infobip-entity' });

/**
 * Entity id for a workspace. Deterministic so it can be recomputed for rows
 * that predate the column, and URL-safe because Infobip uses it as a path
 * parameter (a UUID needs no encoding).
 */
export function entityIdForTenant(tenantId: string): string {
  return `ws-${tenantId}`;
}

/**
 * Assign the workspace its entity id and register it with Infobip.
 *
 * The column write is the source of truth and happens regardless; the remote
 * call is best-effort. Returns the entity id so callers can use it right away.
 */
export async function provisionTenantEntity(tenant: {
  id: string;
  name: string;
}): Promise<string> {
  const entityId = entityIdForTenant(tenant.id);
  await db.update(tenants).set({ infobipEntityId: entityId }).where(eq(tenants.id, tenant.id));
  entityCache.set(tenant.id, { entityId, expires: Date.now() + CACHE_TTL_MS });

  const provider = getProvider();
  if (!provider.createEntity) return entityId;
  try {
    const result = await provider.createEntity({ entityId, entityName: tenant.name });
    if (result.ok) {
      log.info({ entityId, existed: result.existed === true }, 'infobip entity provisioned');
    } else if (result.forbidden) {
      // Expected on accounts whose key has no provisioning scope. The entity
      // still materialises on the first tagged send.
      log.warn({ entityId }, 'infobip provisioning forbidden — entity will auto-create on send');
    } else {
      log.error({ entityId, error: result.error }, 'infobip entity provisioning failed');
    }
  } catch (err) {
    log.error({ entityId, err }, 'infobip entity provisioning threw');
  }
  return entityId;
}

/**
 * Cache of tenant → entity id. Dispatch resolves this per message, so the
 * lookup must not be a database round-trip on every send. Entity ids never
 * change once assigned, so the TTL only bounds how long a backfilled row keeps
 * reporting null.
 */
const CACHE_TTL_MS = 300_000;
const entityCache = new Map<string, { entityId: string | null; expires: number }>();

/** Test seam — drop memoised ids between cases. */
export function clearEntityCache(): void {
  entityCache.clear();
}

/**
 * The workspace's entity id, or null when it has none and one cannot be
 * assigned. Rows predating the column are backfilled on first read so old
 * workspaces start reporting under their own entity too.
 */
export async function tenantInfobipEntityId(tenantId: string): Promise<string | null> {
  const hit = entityCache.get(tenantId);
  if (hit && hit.expires > Date.now()) return hit.entityId;

  const rows = await db
    .select({ entityId: tenants.infobipEntityId, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    entityCache.set(tenantId, { entityId: null, expires: Date.now() + CACHE_TTL_MS });
    return null;
  }
  if (row.entityId) {
    entityCache.set(tenantId, { entityId: row.entityId, expires: Date.now() + CACHE_TTL_MS });
    return row.entityId;
  }
  return provisionTenantEntity({ id: tenantId, name: row.name });
}
