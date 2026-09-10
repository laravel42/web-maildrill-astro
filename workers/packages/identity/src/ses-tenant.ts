/**
 * Per-workspace AWS SES Tenants (SES Multi-Tenant Management).
 *
 * Mirrors `infobip-entity.ts` exactly — same lifecycle, same reasoning, same
 * failure posture — for the equivalent SES concept. A workspace's SES tenant
 * reuses the same `ws-<tenantId>` id `entityIdForTenant` already computes for
 * Infobip (SES tenant names allow letters/digits/hyphens/underscores up to 64
 * chars, which that id satisfies), so there is exactly one deterministic
 * per-workspace identifier, not two.
 *
 * `SesProvider.createEntity` is the ONLY thing that creates the tenant and
 * associates it with the account's shared sending identity/configuration set.
 * It is best-effort — a signup must not fail because AWS did — but
 * "best-effort" is not "optional": until it succeeds, the tenant does not
 * exist and `SendEmail`'s `TenantName` param would be rejected, so dispatch
 * only ever passes a tenant name once `sesTenantProvisionedAt` confirms it.
 *
 * Only relevant when the SES email driver is actually selected — provisioning
 * is skipped entirely otherwise, so no deployment needs AWS credentials it
 * isn't already using.
 */
import { eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, tenants } from '@maildrill/database';
import { logger, metrics } from '@maildrill/observability';
import { getProvider } from '@maildrill/providers';
import { entityIdForTenant } from './infobip-entity';

const log = logger.child({ mod: 'ses-tenant' });

function sesSelected(): boolean {
  return config.provider.emailDriver === 'ses';
}

/**
 * Assign the workspace its SES tenant name and register it with SES.
 *
 * The id assignment is local and happens regardless (so sends can be tagged
 * immediately once SES becomes the active driver), but the remote call is
 * skipped entirely when SES isn't selected — no AWS calls, no credential
 * requirement, for every deployment still on Infobip/Cloudflare/mock. Only an
 * acknowledged call stamps `sesTenantProvisionedAt`.
 */
export async function provisionSesTenant(tenant: { id: string; name: string }): Promise<string> {
  const tenantName = entityIdForTenant(tenant.id);
  await db.update(tenants).set({ sesTenantName: tenantName }).where(eq(tenants.id, tenant.id));
  tenantCache.set(tenant.id, { tenantName, expires: Date.now() + CACHE_TTL_MS });

  if (!sesSelected()) {
    metrics.inc('ses_tenant_provision_total', { outcome: 'skipped_not_selected' });
    return tenantName;
  }

  const provider = getProvider('ses');
  if (!provider.createEntity) {
    metrics.inc('ses_tenant_provision_total', { outcome: 'unsupported' });
    return tenantName;
  }
  try {
    const result = await provider.createEntity({ entityId: tenantName, entityName: tenant.name });
    if (result.ok) {
      await db
        .update(tenants)
        .set({ sesTenantProvisionedAt: new Date() })
        .where(eq(tenants.id, tenant.id));
      metrics.inc('ses_tenant_provision_total', {
        outcome: result.existed === true ? 'existed' : 'created',
      });
      log.info({ tenantName, existed: result.existed === true }, 'ses tenant provisioned');
    } else {
      metrics.inc('ses_tenant_provision_total', { outcome: 'failed' });
      log.error({ tenantName, error: result.error }, 'ses tenant provisioning failed');
    }
  } catch (err) {
    metrics.inc('ses_tenant_provision_total', { outcome: 'threw' });
    log.error({ tenantName, err }, 'ses tenant provisioning threw');
  }
  return tenantName;
}

/**
 * Cache of tenant → SES tenant name. Dispatch resolves this per message, so
 * the lookup must not be a database round-trip on every send. Names never
 * change once assigned, so the TTL only bounds how long a backfilled row
 * keeps reporting null.
 */
const CACHE_TTL_MS = 300_000;
const tenantCache = new Map<string, { tenantName: string | null; expires: number }>();

/** Test seam — drop memoised names between cases. */
export function clearSesTenantCache(): void {
  tenantCache.clear();
}

/**
 * The workspace's SES tenant name only if SES is provisioned AND confirmed —
 * never provisions, and returns null whenever SES isn't the active email
 * driver. Dispatch calls this on every email send; anything else would spend
 * a lookup (or worse, an AWS call) on workspaces that will never use it.
 */
export async function tenantSesTenantName(tenantId: string): Promise<string | null> {
  if (!sesSelected()) return null;

  const hit = tenantCache.get(tenantId);
  if (hit && hit.expires > Date.now()) return hit.tenantName;

  const rows = await db
    .select({ tenantName: tenants.sesTenantName, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    tenantCache.set(tenantId, { tenantName: null, expires: Date.now() + CACHE_TTL_MS });
    return null;
  }
  if (row.tenantName) {
    tenantCache.set(tenantId, { tenantName: row.tenantName, expires: Date.now() + CACHE_TTL_MS });
    return row.tenantName;
  }
  return provisionSesTenant({ id: tenantId, name: row.name });
}
