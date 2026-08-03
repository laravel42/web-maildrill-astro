import { config } from '@maildrill/config';
import { ConflictError, ValidationError } from '@maildrill/domain';

/**
 * Sending-domain management (Settings → Domains), proxying Infobip's email
 * domain API. NOTE: Infobip domains are ACCOUNT-level, not per-tenant — every
 * workspace on this install sees the same list. Fine for the current
 * single-workspace reality; revisit before real multi-tenancy.
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

export async function listEmailDomains(): Promise<EmailDomain[]> {
  // 20 is Infobip's hard maximum for this endpoint — larger values 400.
  const { status, json } = await infobip('GET', '/email/1/domains?size=20');
  if (status !== 200) {
    throw new ValidationError(infobipErrorText(json) ?? `could not list domains (${status})`);
  }
  const results = Array.isArray(json.results) ? json.results : [];
  return results.map((r) => toDomain(r as Record<string, unknown>));
}

/**
 * Expected daily send volume — Infobip requires it (capacity planning) and
 * rejects the request outright when it is missing. Callers can override; this
 * default suits a new workspace and can be raised in the Infobip portal.
 */
const DEFAULT_TARGETED_DAILY_TRAFFIC = 1000;

export async function registerEmailDomain(
  domainName: string,
  targetedDailyTraffic = DEFAULT_TARGETED_DAILY_TRAFFIC,
): Promise<EmailDomain> {
  const name = domainName.trim().toLowerCase();
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(name)) {
    throw new ValidationError('enter a valid domain, e.g. mail.acme.com');
  }
  const { status, json } = await infobip('POST', '/email/1/domains', {
    domainName: name,
    targetedDailyTraffic,
  });
  if (status === 200 || status === 201) return toDomain(json);

  // Already registered → surface it as a conflict, not a generic failure.
  // Infobip words this as "associated with another account" even when the
  // domain belongs to *this* account, so confirm against our own list before
  // passing that confusing message on.
  const reason = infobipErrorText(json);
  if (/exist|already|associated/i.test(`${reason ?? ''}${JSON.stringify(json)}`)) {
    const ours = (await listEmailDomains().catch(() => [])).some((d) => d.domainName === name);
    if (ours) throw new ConflictError(`${name} is already registered`);
  }
  throw new ValidationError(
    reason ? `could not register ${name}: ${reason}` : `could not register ${name} (${status})`,
  );
}

export async function getEmailDomain(domainName: string): Promise<EmailDomain | null> {
  const { status, json } = await infobip(
    'GET',
    `/email/1/domains/${encodeURIComponent(domainName)}`,
  );
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
export async function deleteEmailDomain(domainName: string): Promise<void> {
  const name = domainName.trim().toLowerCase();
  const { status, json } = await infobip('DELETE', `/email/1/domains/${encodeURIComponent(name)}`);
  // Already gone is a success for the caller's purposes.
  if (status === 204 || status === 200 || status === 404) return;
  throw new ValidationError(infobipErrorText(json) ?? `could not delete ${name} (${status})`);
}

/** Ask Infobip to re-check DNS, then return the refreshed state. */
export async function verifyEmailDomain(domainName: string): Promise<EmailDomain> {
  await infobip('POST', `/email/1/domains/${encodeURIComponent(domainName)}/verify`);
  const domain = await getEmailDomain(domainName);
  if (!domain) throw new ValidationError(`${domainName} is not registered`);
  return domain;
}
