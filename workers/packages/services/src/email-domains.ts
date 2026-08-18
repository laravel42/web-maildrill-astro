import { and, eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, emailDomains } from '@maildrill/database';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import { knownTenantInfobipEntityId } from '@maildrill/identity';
import { resolvePlatformFields } from '@maildrill/providers';

/**
 * Sending-domain management (Settings → Domains). Infobip's domain API is
 * account-level — one registration per domain name across the whole Infobip
 * account — so we keep a local `email_domains` row that ties each domain to a
 * workspace. List/mutate only return or touch domains this tenant has
 * explicitly registered (or claimed via register when the name already exists
 * on Infobip and is unowned). Never auto-inherit the full Infobip account list.
 */

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

  // Already claimed locally — short-circuit before hitting Infobip.
  const local = await db.select().from(emailDomains).where(eq(emailDomains.domainName, name)).limit(1);
  if (local[0]) {
    if (local[0].tenantId !== tenantId) {
      throw new ConflictError(`${name} is already claimed by another workspace`);
    }
    const existing = await getEmailDomain(tenantId, name);
    if (existing) return existing;
    throw new ConflictError(`${name} is already registered`);
  }

  // `POST /email/1/domains` takes the CPaaS X identity as top-level fields
  // (not the nested `platform` block the send APIs use), so the domain is
  // filed under the workspace that registered it rather than the bare account.
  const platform = resolvePlatformFields(
    config.infobip.applicationId,
    config.infobip.entityId,
    (await knownTenantInfobipEntityId(tenantId)) ?? undefined,
  );
  const { status, json } = await infobip('POST', '/email/1/domains', {
    domainName: name,
    targetedDailyTraffic,
    ...platform,
  });
  if (status === 200 || status === 201) {
    await claimDomain(tenantId, name);
    return toDomain(json);
  }

  // Already registered on Infobip → claim it for this workspace if nobody
  // else owns it locally (covers domains that predate tenant scoping).
  const reason = infobipErrorText(json);
  if (/exist|already|associated/i.test(`${reason ?? ''}${JSON.stringify(json)}`)) {
    const onProvider = (await listProviderDomains().catch(() => [])).find((d) => d.domainName === name);
    if (onProvider) {
      await claimDomain(tenantId, name);
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
  const { status, json } = await infobip('DELETE', `/email/1/domains/${encodeURIComponent(name)}`);
  // Already gone is a success for the caller's purposes.
  if (status !== 204 && status !== 200 && status !== 404) {
    throw new ValidationError(infobipErrorText(json) ?? `could not delete ${name} (${status})`);
  }
  await db
    .delete(emailDomains)
    .where(and(eq(emailDomains.tenantId, tenantId), eq(emailDomains.domainName, name)));
}

/** Ask Infobip to re-check DNS, then return the refreshed state. */
export async function verifyEmailDomain(
  tenantId: string,
  domainName: string,
): Promise<EmailDomain> {
  const name = await assertOwned(tenantId, domainName);
  await infobip('POST', `/email/1/domains/${encodeURIComponent(name)}/verify`);
  const domain = await getEmailDomain(tenantId, name);
  if (!domain) throw new ValidationError(`${name} is not registered`);
  return domain;
}
