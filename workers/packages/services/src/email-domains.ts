import { and, eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, emailDomains } from '@maildrill/database';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import { ensureInfobipApplication, knownTenantInfobipEntityId } from '@maildrill/identity';
import { resolvePlatformFields, SesProvider } from '@maildrill/providers';
import { createLogger } from '@maildrill/observability';

const log = createLogger({ component: 'email-domains' });

/**
 * Sending-domain management (Settings → Domains). Both providers' domain
 * APIs are account-level — one registration per domain name across the
 * whole account — so we keep a local `email_domains` row that ties each
 * domain to a workspace. List/mutate only return or touch domains this
 * tenant has explicitly registered (or claimed via register when the name
 * already exists on the provider and is unowned). Never auto-inherit the
 * full provider-account domain list.
 *
 * Which provider's API actually gets called is driven by
 * `PROVIDER_EMAIL_DRIVER`: SES when it's `ses`, Infobip otherwise (`infobip`,
 * `cloudflare`, or unset all fall back to Infobip's domain API — Cloudflare's
 * email routing has no equivalent domain-identity concept of its own).
 */

function usesSes(): boolean {
  return config.provider.emailDriver === 'ses';
}

let sesProviderInstance: SesProvider | undefined;
function sesProvider(): SesProvider {
  if (!sesProviderInstance) sesProviderInstance = new SesProvider();
  return sesProviderInstance;
}

export interface EmailDomainDnsRecord {
  recordType: string;
  name: string;
  expectedValue: string;
  verified: boolean;
}

export interface EmailDomain {
  domainName: string;
  /** Active = verified AND cleared by Infobip (some domains need manual review). */
  active: boolean;
  dnsRecords: EmailDomainDnsRecord[];
}

export function emailDomainsConfigured(): boolean {
  if (usesSes()) return Boolean(config.ses.region);
  return Boolean(config.infobip.baseUrl && config.infobip.apiKey);
}

const REQUEST_TIMEOUT_MS = 30_000;

async function infobip(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(new URL(path, config.infobip.baseUrl), {
    method,
    headers: {
      Authorization: `App ${config.infobip.apiKey}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

/**
 * Pull the human-readable reason out of an Infobip error envelope, including
 * per-field validation errors. Without this a caller only sees the status
 * code, which hides things like "targetedDailyTraffic must not be null".
 */
function infobipErrorText(json: Record<string, unknown>): string | null {
  const requestError = (json.requestError ?? {}) as Record<string, unknown>;
  const ex = (requestError.serviceException ?? {}) as Record<string, unknown>;
  const base = typeof ex.text === 'string' ? ex.text : null;
  const validation = (ex.validationErrors ?? {}) as Record<string, unknown>;
  const bits = Object.entries(validation).flatMap(([field, errs]) => {
    const list = Array.isArray(errs) ? errs : [errs];
    return list.filter((e): e is string => typeof e === 'string').map((e) => `${field} ${e}`);
  });
  if (bits.length > 0) return `${base ? `${base}: ` : ''}${bits.join('; ')}`;
  return base;
}

function toDomain(raw: Record<string, unknown>): EmailDomain {
  const records = Array.isArray(raw.dnsRecords) ? raw.dnsRecords : [];
  return {
    domainName: String(raw.domainName ?? ''),
    active: raw.active === true,
    dnsRecords: records.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        recordType: String(rec.recordType ?? ''),
        name: String(rec.name ?? ''),
        expectedValue: String(rec.expectedValue ?? ''),
        verified: rec.verified === true,
      };
    }),
  };
}

function normalizeDomain(domainName: string): string {
  return domainName.trim().toLowerCase();
}

async function ownedNames(tenantId: string): Promise<Set<string>> {
  const rows = await db
    .select({ domainName: emailDomains.domainName })
    .from(emailDomains)
    .where(eq(emailDomains.tenantId, tenantId));
  return new Set(rows.map((r) => r.domainName));
}

async function assertOwned(tenantId: string, domainName: string): Promise<string> {
  const name = normalizeDomain(domainName);
  const rows = await db
    .select({ domainName: emailDomains.domainName })
    .from(emailDomains)
    .where(and(eq(emailDomains.tenantId, tenantId), eq(emailDomains.domainName, name)))
    .limit(1);
  if (!rows[0]) throw new NotFoundError(`${name} is not registered in this workspace`);
  return name;
}

async function claimDomain(tenantId: string, domainName: string): Promise<void> {
  const name = normalizeDomain(domainName);
  const existing = await db
    .select()
    .from(emailDomains)
    .where(eq(emailDomains.domainName, name))
    .limit(1);
  if (existing[0]) {
    if (existing[0].tenantId === tenantId) return;
    throw new ConflictError(`${name} is already claimed by another workspace`);
  }
  await db.insert(emailDomains).values({ tenantId, domainName: name });
}

async function listProviderDomains(): Promise<EmailDomain[]> {
  // 20 is Infobip's hard maximum for this endpoint — larger values 400.
  const { status, json } = await infobip('GET', '/email/1/domains?size=20');
  if (status !== 200) {
    throw new ValidationError(infobipErrorText(json) ?? `could not list domains (${status})`);
  }
  const results = Array.isArray(json.results) ? json.results : [];
  return results.map((r) => toDomain(r as Record<string, unknown>));
}

export async function listEmailDomains(tenantId: string): Promise<EmailDomain[]> {
  const mine = await ownedNames(tenantId);
  if (mine.size === 0) return [];

  if (usesSes()) {
    // SES has no per-account "list mine" call that's cheaper than asking for
    // each owned identity directly — GetEmailIdentity is a single lookup per
    // domain, same cost ListEmailIdentities' enumeration would still need to
    // pay to get DKIM tokens and status per result.
    const provider = sesProvider();
    const domains = await Promise.all(
      Array.from(mine).map((name) => provider.getDomainIdentity(name)),
    );
    return domains.filter((d): d is EmailDomain => d !== null);
  }

  const all = await listProviderDomains();
  // Infobip may echo mixed-case names; ownership rows are always lowercase.
  return all.filter((d) => mine.has(normalizeDomain(d.domainName)));
}

/**
 * Expected daily send volume — Infobip requires it (capacity planning) and
 * rejects the request outright when it is missing. Callers can override; this
 * default suits a new workspace and can be raised in the Infobip portal.
 */
const DEFAULT_TARGETED_DAILY_TRAFFIC = 1000;

export async function registerEmailDomain(
  tenantId: string,
  domainName: string,
  targetedDailyTraffic = DEFAULT_TARGETED_DAILY_TRAFFIC,
): Promise<EmailDomain> {
  const name = normalizeDomain(domainName);
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(name)) {
    throw new ValidationError('enter a valid domain, e.g. mail.acme.com');
  }

  // Already claimed locally — short-circuit before hitting the provider.
  const local = await db.select().from(emailDomains).where(eq(emailDomains.domainName, name)).limit(1);
  if (local[0]) {
    if (local[0].tenantId !== tenantId) {
      throw new ConflictError(`${name} is already claimed by another workspace`);
    }
    const existing = await getEmailDomain(tenantId, name);
    if (existing) return existing;
    throw new ConflictError(`${name} is already registered`);
  }

  if (usesSes()) {
    // SES has no per-workspace domain concept — the whole account shares one
    // IAM policy already scoped to `identity/*` (see IAM setup docs), so a
    // new domain identity needs no application/entity association step the
    // way Infobip's CPaaS X model requires.
    const result = await sesProvider().createDomainIdentity(name);
    if (!result.ok) throw new ValidationError(`could not register ${name}: ${result.error}`);
    await claimDomain(tenantId, name);
    return result.domain;
  }

  // `POST /email/1/domains` takes the CPaaS X identity as top-level fields
  // (not the nested `platform` block the send APIs use), so the domain is
  // filed under the workspace that registered it rather than the bare account.
  //
  // Both halves or neither. Infobip resolves each field into an {id,
  // externalId} pair, and an entity with no application resolves to
  // `application {id: null, externalId: null}` — which it rejects outright:
  //
  //   could not register made.com: illegal combination of arguments:
  //   id: null, externalId: null, id: null, externalId: ws-<tenant>
  //
  // So the application is provisioned rather than required from config.
  // Dropping the entity instead did register the domain, but filed it on the
  // bare account — which answers the error and not the point: the entity is
  // how a workspace's domain is told apart from another's.
  //
  // `ensureInfobipApplication` is one call per process (409 = already there)
  // and returns null when the API key lacks the provisioning scope. In that
  // case the identity is dropped: an unattributed domain beats a failed
  // registration, and the reason is logged at error rather than swallowed.
  const applicationId = await ensureInfobipApplication();
  const resolved = resolvePlatformFields(
    applicationId ?? config.infobip.applicationId,
    config.infobip.entityId,
    (await knownTenantInfobipEntityId(tenantId)) ?? undefined,
  );
  const platform = resolved.applicationId ? resolved : {};
  /**
   * File the domain under this workspace's entity.
   *
   * Called after BOTH paths — a fresh registration and the branch that claims
   * a domain Infobip already had. The second is what left made.com attached to
   * nothing: it existed on the account (created before the identity was sent,
   * or by an earlier failed attempt), so the POST 409'd, the domain was
   * claimed locally, and no entity was ever attached.
   *
   * Non-fatal by design. The domain is registered and usable either way; an
   * association that fails is an attribution gap, not a broken domain, and
   * failing the request here would undo work that already succeeded.
   */
  const associate = async (domainName: string): Promise<void> => {
    const entityId = resolved.entityId;
    const appId = resolved.applicationId;
    if (!entityId || !appId) return;
    // Through `infobip()` like every other call in this file, not through the
    // provider registry: the domain APIs are called directly here, and routing
    // one step through the abstraction meant a driver without the method
    // skipped it silently — which is how this was written the first time and
    // why the association never fired.
    const { status, json } = await infobip('POST', '/provisioning/1/associations', {
      resourceType: 'DOMAIN',
      channel: 'EMAIL',
      applicationId: appId,
      entityId,
      resourceId: domainName,
    });
    // 409 = already associated, which is the desired end state.
    if (status >= 200 && status < 300) return;
    if (status === 409) return;
    log.error(
      { domainName, entityId, status, error: infobipErrorText(json) },
      'domain registered but not associated with the workspace entity — ' +
        'its usage will report against the account, not this workspace',
    );
  };

  const { status, json } = await infobip('POST', '/email/1/domains', {
    domainName: name,
    targetedDailyTraffic,
    ...platform,
  });
  if (status === 200 || status === 201) {
    await claimDomain(tenantId, name);
    await associate(name);
    return toDomain(json);
  }

  // Already registered on Infobip → claim it for this workspace if nobody
  // else owns it locally (covers domains that predate tenant scoping).
  const reason = infobipErrorText(json);
  if (/exist|already|associated/i.test(`${reason ?? ''}${JSON.stringify(json)}`)) {
    const onProvider = (await listProviderDomains().catch(() => [])).find((d) => d.domainName === name);
    if (onProvider) {
      await claimDomain(tenantId, name);
      // The domain predates this workspace's claim on it, so the identity was
      // never sent at creation — attach it now.
      await associate(name);
      return onProvider;
    }
  }
  throw new ValidationError(
    reason ? `could not register ${name}: ${reason}` : `could not register ${name} (${status})`,
  );
}

export async function getEmailDomain(
  tenantId: string,
  domainName: string,
): Promise<EmailDomain | null> {
  const name = normalizeDomain(domainName);
  const owned = await db
    .select({ domainName: emailDomains.domainName })
    .from(emailDomains)
    .where(and(eq(emailDomains.tenantId, tenantId), eq(emailDomains.domainName, name)))
    .limit(1);
  if (!owned[0]) return null;

  if (usesSes()) return sesProvider().getDomainIdentity(name);

  const { status, json } = await infobip('GET', `/email/1/domains/${encodeURIComponent(name)}`);
  if (status === 404) return null;
  if (status !== 200) {
    throw new ValidationError(infobipErrorText(json) ?? `domain lookup failed (${status})`);
  }
  return toDomain(json);
}

/**
 * Remove a sending domain from the provider. Irreversible: the DKIM key and
 * sending identity are destroyed, so re-adding the same domain later issues
 * new DNS records that must be published again.
 */
export async function deleteEmailDomain(tenantId: string, domainName: string): Promise<void> {
  const name = await assertOwned(tenantId, domainName);

  if (usesSes()) {
    await sesProvider().deleteDomainIdentity(name);
  } else {
    const { status, json } = await infobip('DELETE', `/email/1/domains/${encodeURIComponent(name)}`);
    // Already gone is a success for the caller's purposes.
    if (status !== 204 && status !== 200 && status !== 404) {
      throw new ValidationError(infobipErrorText(json) ?? `could not delete ${name} (${status})`);
    }
  }

  await db
    .delete(emailDomains)
    .where(and(eq(emailDomains.tenantId, tenantId), eq(emailDomains.domainName, name)));
}

/**
 * Ask the provider to re-check DNS, then return the refreshed state. SES has
 * no forced-recheck API — it polls DNS on its own schedule — so for SES this
 * just re-fetches the identity's current (possibly still-pending) status.
 */
export async function verifyEmailDomain(
  tenantId: string,
  domainName: string,
): Promise<EmailDomain> {
  const name = await assertOwned(tenantId, domainName);
  if (!usesSes()) {
    await infobip('POST', `/email/1/domains/${encodeURIComponent(name)}/verify`);
  }
  const domain = await getEmailDomain(tenantId, name);
  if (!domain) throw new ValidationError(`${name} is not registered`);
  return domain;
}
