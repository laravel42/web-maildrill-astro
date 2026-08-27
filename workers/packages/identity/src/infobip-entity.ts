/**
 * Per-workspace Infobip CPaaS X entities.
 *
 * Every workspace gets its own entity id so outbound traffic is attributable
 * per workspace inside the one shared Infobip account — usage and billing
 * reporting, nothing more. It is deliberately **not** a data boundary: that
 * was tested against the live account and rejected (see
 * `workers/docs/infobip-api-scheme.md`). Postgres remains the system of record.
 *
 * `POST /provisioning/1/entities` at workspace creation is the ONLY thing that
 * creates the entity. It is best-effort — a signup must not fail because a
 * provider call did — but "best-effort" is not "optional": until it succeeds,
 * the entity does not exist and every send tagged with the id is unattributable.
 *
 * There is no second path. Infobip does not auto-create an entity from an
 * unknown `entityId` carried on a traffic API call: verified 2026-08-17 against
 * the live account, where a workspace with 153 accepted, entity-tagged sends
 * still returned 404 from `GET /provisioning/1/entities/{id}`. An earlier
 * version of this comment claimed that fallback worked and used it to justify
 * swallowing a 403, which kept the feature silently inert for a week.
 *
 * The failure mode to watch for is an API key without the provisioning scope:
 * every local row still gets an id and looks provisioned, so
 * `infobipEntityProvisionedAt` is what separates "assigned" from "confirmed".
 */
import { eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, tenants } from '@maildrill/database';
import { logger, metrics } from '@maildrill/observability';
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
 * The id assignment is local and happens regardless, so sends can be tagged
 * immediately; the remote call cannot block a signup. Only an acknowledged
 * call stamps `infobipEntityProvisionedAt` — a row with an id but no stamp is
 * the "looks fine locally, absent at the provider" state. Returns the entity
 * id so callers can use it right away.
 */
export async function provisionTenantEntity(tenant: {
  id: string;
  name: string;
}): Promise<string> {
  const entityId = entityIdForTenant(tenant.id);
  await db.update(tenants).set({ infobipEntityId: entityId }).where(eq(tenants.id, tenant.id));
  entityCache.set(tenant.id, { entityId, expires: Date.now() + CACHE_TTL_MS });

  const provider = getProvider();
  if (!provider.createEntity) {
    metrics.inc('infobip_entity_provision_total', { outcome: 'unsupported' });
    return entityId;
  }
  try {
    const result = await provider.createEntity({ entityId, entityName: tenant.name });
    if (result.ok) {
      await db
        .update(tenants)
        .set({ infobipEntityProvisionedAt: new Date() })
        .where(eq(tenants.id, tenant.id));
      metrics.inc('infobip_entity_provision_total', {
        outcome: result.existed === true ? 'existed' : 'created',
      });
      log.info({ entityId, existed: result.existed === true }, 'infobip entity provisioned');
    } else if (result.forbidden) {
      // Not benign, despite being the common misconfiguration: nothing else
      // ever creates this entity, so the workspace's traffic stays
      // unattributable until the key gets the provisioning scope and this runs
      // again. Logged at error precisely because it used to be a warning
      // nobody read.
      metrics.inc('infobip_entity_provision_total', { outcome: 'forbidden' });
      log.error(
        { entityId, error: result.error },
        'infobip provisioning forbidden — API key lacks the provisioning scope; ' +
          'this workspace has no entity and its usage cannot be attributed',
      );
    } else {
      metrics.inc('infobip_entity_provision_total', { outcome: 'failed' });
      log.error({ entityId, error: result.error }, 'infobip entity provisioning failed');
    }
  } catch (err) {
    metrics.inc('infobip_entity_provision_total', { outcome: 'threw' });
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
 * The workspace's entity id if one is ALREADY assigned — never provisions.
 *
 * For callers that only want to stamp an outbound request with the workspace
 * it belongs to (domain registration, voice preview). A read of that kind must
 * not create a resource at the provider as a side effect: the cost of a null
 * here is one unattributed call, whereas provisioning-on-read turns any such
 * request — including one from a test with a stubbed `fetch`, which does not
 * intercept the provider's `https.request` — into a live entity write.
 *
 * Only positive hits are memoised, so this can never mask the backfill that
 * `tenantInfobipEntityId` performs for rows predating the column.
 */
export async function knownTenantInfobipEntityId(tenantId: string): Promise<string | null> {
  const hit = entityCache.get(tenantId);
  if (hit && hit.expires > Date.now()) return hit.entityId;

  const rows = await db
    .select({ entityId: tenants.infobipEntityId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const entityId = rows[0]?.entityId ?? null;
  if (entityId) entityCache.set(tenantId, { entityId, expires: Date.now() + CACHE_TTL_MS });
  return entityId;
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

// ---------------------------------------------------------------------------
// Application (account-wide)
// ---------------------------------------------------------------------------

/**
 * The CPaaS X application every workspace's traffic is filed under.
 *
 * Entities are per workspace; an application is not — it models the use case
 * or environment, so one serves the whole account. It exists because Infobip
 * refuses an entity that arrives without an application:
 *
 *   illegal combination of arguments: id: null, externalId: null,
 *   id: null, externalId: ws-<tenant>
 *
 * Which is why domains registered with no application attached to no entity
 * at all. Provisioned lazily and remembered for the life of the process: it
 * is one call per deploy, and a 409 (already there) is success.
 */
const APPLICATION_NAME = 'Maildrill';

let applicationReady: Promise<string | null> | null = null;

export function infobipApplicationId(): string {
  return config.infobip.applicationId.trim() || 'maildrill';
}

export async function ensureInfobipApplication(): Promise<string | null> {
  applicationReady ??= (async () => {
    const applicationId = infobipApplicationId();
    const provider = getProvider();
    if (!provider.createApplication) {
      metrics.inc('infobip_application_provision_total', { outcome: 'unsupported' });
      return null;
    }
    try {
      const result = await provider.createApplication({
        applicationId,
        applicationName: APPLICATION_NAME,
      });
      if (result.ok) {
        metrics.inc('infobip_application_provision_total', {
          outcome: result.existed === true ? 'existed' : 'created',
        });
        log.info({ applicationId, existed: result.existed === true }, 'infobip application ready');
        return applicationId;
      }
      // Same reasoning as the entity path: without this, every entity we send
      // is rejected, so a quiet warning would hide the cause of a hard failure.
      metrics.inc('infobip_application_provision_total', {
        outcome: result.forbidden ? 'forbidden' : 'failed',
      });
      log.error(
        { applicationId, error: result.error },
        result.forbidden
          ? 'infobip provisioning forbidden — API key lacks the provisioning scope; ' +
              'workspace entities cannot be attached without an application'
          : 'infobip application provisioning failed',
      );
      // Retry on the next call rather than caching the failure for the life of
      // the process — a scope granted after boot should not need a restart.
      applicationReady = null;
      return null;
    } catch (err) {
      metrics.inc('infobip_application_provision_total', { outcome: 'threw' });
      log.error({ applicationId, err }, 'infobip application provisioning threw');
      applicationReady = null;
      return null;
    }
  })();
  return applicationReady;
}
