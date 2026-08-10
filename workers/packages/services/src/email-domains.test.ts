import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, db, emailDomains } from '@maildrill/database';
import { ConflictError, NotFoundError } from '@maildrill/domain';
import { ensureTenantByName } from './tenants';
import {
  deleteEmailDomain,
  listEmailDomains,
  registerEmailDomain,
  verifyEmailDomain,
} from './email-domains';

// Needs real Postgres + mocked Infobip. Enable with: RUN_E2E=1 pnpm test
const run = process.env.RUN_E2E === '1';

function domainPayload(name: string, active = false) {
  return {
    domainName: name,
    active,
    dnsRecords: [
      {
        recordType: 'TXT',
        name: name,
        expectedValue: 'v=spf1',
        verified: active,
      },
    ],
  };
}

describe.skipIf(!run)('email domains tenant isolation (e2e)', () => {
  const providerDomains = new Map<string, ReturnType<typeof domainPayload>>();

  beforeEach(() => {
    providerDomains.clear();
    providerDomains.set('alpha.example.com', domainPayload('alpha.example.com', true));
    providerDomains.set('beta.example.com', domainPayload('beta.example.com'));

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        const path = new URL(url).pathname + new URL(url).search;

        if (method === 'GET' && path.startsWith('/email/1/domains?')) {
          return new Response(JSON.stringify({ results: [...providerDomains.values()] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (method === 'GET' && path.startsWith('/email/1/domains/')) {
          const name = decodeURIComponent(path.split('/').pop()!);
          const found = providerDomains.get(name);
          if (!found) return new Response('{}', { status: 404 });
          return new Response(JSON.stringify(found), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (method === 'POST' && path === '/email/1/domains') {
          const body = JSON.parse(String(init?.body ?? '{}')) as { domainName?: string };
          const name = (body.domainName ?? 'new.example.com').toLowerCase();
          const created = domainPayload(name);
          providerDomains.set(name, created);
          return new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (method === 'POST' && path.endsWith('/verify')) {
          return new Response('{}', { status: 200 });
        }
        if (method === 'DELETE') {
          const name = decodeURIComponent(path.split('/').pop()!);
          providerDomains.delete(name);
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
      }),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete(emailDomains);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('lists only domains claimed by the tenant', async () => {
    const a = await ensureTenantByName(`domains-a-${process.pid}`);
    const b = await ensureTenantByName(`domains-b-${process.pid}`);

    await db.insert(emailDomains).values([
      { tenantId: a.id, domainName: 'alpha.example.com' },
      { tenantId: b.id, domainName: 'beta.example.com' },
    ]);

    const forA = await listEmailDomains(a.id);
    const forB = await listEmailDomains(b.id);

    expect(forA.map((d) => d.domainName)).toEqual(['alpha.example.com']);
    expect(forB.map((d) => d.domainName)).toEqual(['beta.example.com']);
  });

  it('refuses to mutate another tenant’s domain', async () => {
    const a = await ensureTenantByName(`domains-mut-a-${process.pid}`);
    const b = await ensureTenantByName(`domains-mut-b-${process.pid}`);
    await db.insert(emailDomains).values({ tenantId: a.id, domainName: 'alpha.example.com' });

    await expect(deleteEmailDomain(b.id, 'alpha.example.com')).rejects.toBeInstanceOf(NotFoundError);
    await expect(verifyEmailDomain(b.id, 'alpha.example.com')).rejects.toBeInstanceOf(NotFoundError);

    // Still owned by A
    const remaining = await listEmailDomains(a.id);
    expect(remaining.map((d) => d.domainName)).toEqual(['alpha.example.com']);
  });

  it('claims a newly registered domain for the registering tenant only', async () => {
    const a = await ensureTenantByName(`domains-reg-a-${process.pid}`);
    const b = await ensureTenantByName(`domains-reg-b-${process.pid}`);

    const created = await registerEmailDomain(a.id, 'gamma.example.com');
    expect(created.domainName).toBe('gamma.example.com');

    expect((await listEmailDomains(a.id)).map((d) => d.domainName)).toContain('gamma.example.com');
    expect((await listEmailDomains(b.id)).map((d) => d.domainName)).not.toContain(
      'gamma.example.com',
    );

    await expect(registerEmailDomain(b.id, 'gamma.example.com')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
