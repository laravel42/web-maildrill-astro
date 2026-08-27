import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { closeDb, db, emailDomains, tenants } from '@maildrill/database';
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
  /** Bodies POSTed to /email/1/domains, so the CPaaS X identity can be checked. */
  const registerBodies: Record<string, unknown>[] = [];
  /** Bodies POSTed to /provisioning/1/associations. */
  const associations: Record<string, unknown>[] = [];

  beforeEach(() => {
    providerDomains.clear();
    registerBodies.length = 0;
    associations.length = 0;
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
        if (method === 'POST' && path === '/provisioning/1/applications') {
          return new Response('', { status: 201 });
        }
        if (method === 'POST' && path === '/provisioning/1/associations') {
          associations.push(JSON.parse(String(init?.body ?? '{}')));
          return new Response('', { status: 201 });
        }
        if (method === 'POST' && path === '/email/1/domains') {
          try {
            registerBodies.push(JSON.parse(String(init?.body ?? '{}')));
          } catch {
            registerBodies.push({});
          }
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
    // Scoped to the fixtures. This was `db.delete(emailDomains)` with no
    // WHERE clause: run with RUN_E2E=1 it truncated the real `email_domains`
    // table of whatever DATABASE_URL pointed at, after EVERY test. It deleted
    // a domain someone had just registered on the development database.
    //
    // Every fixture here is `*.example.com` (RFC 2606 reserved, so it can
    // never collide with a domain anyone actually registers), which makes the
    // predicate both safe and complete.
    await db.delete(emailDomains).where(like(emailDomains.domainName, '%.example.com'));
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

  /**
   * Infobip resolves `applicationId` / `entityId` into {id, externalId} pairs
   * and rejects an entity that arrives without an application:
   *
   *   illegal combination of arguments: id: null, externalId: null,
   *   id: null, externalId: ws-<tenant>
   *
   * Workspaces are given an entity automatically while INFOBIP_APPLICATION_ID
   * is commonly unset, so this was reachable with no misconfiguration and
   * broke every registration.
   */
  it('never sends an entity without an application', async () => {
    const t = await ensureTenantByName(`domains-platform-${Date.now()}`);
    // The tenant MUST carry an entity, or this never exercises the path: with
    // no entity nothing is sent, and the assertion below holds for the wrong
    // reason. `ws-<tenantId>` is the shape entity provisioning assigns.
    await db
      .update(tenants)
      .set({ infobipEntityId: `ws-${t.id}` })
      .where(eq(tenants.id, t.id));

    await registerEmailDomain(t.id, 'platform.example.com');

    const body = registerBodies.at(-1) ?? {};
    expect(body).toHaveProperty('domainName', 'platform.example.com');

    // The point of the pairing is attribution, so assert the pair is actually
    // SENT — not merely that a lone entity was avoided. Asserting only the
    // absence passes when nothing is sent at all, which is the failure mode
    // that filed a domain on the bare account.
    expect(body).toHaveProperty('entityId', `ws-${t.id}`);
    expect(body.applicationId).toBeTruthy();

    // And never the half-pair Infobip rejects.
    const lonelyEntity = 'entityId' in body && !body.applicationId;
    expect(lonelyEntity).toBe(false);

    // Filed under the workspace, not merely created with the ids attached —
    // this is the step that was missing for a domain Infobip already had.
    expect(associations.at(-1)).toMatchObject({
      resourceType: 'DOMAIN',
      channel: 'EMAIL',
      entityId: `ws-${t.id}`,
      resourceId: 'platform.example.com',
    });
  });
});
