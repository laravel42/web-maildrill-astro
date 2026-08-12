import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '@maildrill/database';
import { ensureTenantByName } from '@maildrill/services';
import { deleteSubscriber, importSubscribers, updateSubscriber, upsertSubscriber } from './subscribers';
import { resolveAudience } from './audience';

// Needs real Postgres. Enable with: RUN_E2E=1 pnpm test
const run = process.env.RUN_E2E === '1';

afterAll(async () => {
  await closeDb();
});

describe.skipIf(!run)('updateSubscriber attributes (e2e — needs Postgres)', () => {
  it('merges attributes instead of replacing the whole blob', async () => {
    const tenant = await ensureTenantByName('attrs-e2e-tenant');
    // Unique per run: upsert is keyed on (tenant, email) and would otherwise
    // reuse a row whose attributes a previous run already merged into.
    const email = `attrs-${process.pid}-${process.hrtime.bigint()}@example.com`;

    const created = await upsertSubscriber({
      tenantId: tenant.id,
      email,
      attributes: { plan: 'pro', location: 'Berlin', signupSource: 'webinar' },
    });

    // The app saves tags alone; everything else must survive.
    const updated = await updateSubscriber(tenant.id, created.id, {
      attributes: { tags: ['vip'] },
    });

    expect(updated?.attributes).toEqual({
      plan: 'pro',
      location: 'Berlin',
      signupSource: 'webinar',
      tags: ['vip'],
    });

    // A later save of a different key must not drop the tags either.
    const again = await updateSubscriber(tenant.id, created.id, {
      attributes: { location: 'Lisbon' },
    });
    expect(again?.attributes).toEqual({
      plan: 'pro',
      location: 'Lisbon',
      signupSource: 'webinar',
      tags: ['vip'],
    });

    await deleteSubscriber(tenant.id, created.id);
  });
});

describe.skipIf(!run)('address validation on add (e2e — needs Postgres)', () => {
  const uniq = `${process.pid}-${process.hrtime.bigint()}`;

  it('marks an undeliverable address invalid instead of refusing it', async () => {
    const tenant = await ensureTenantByName(`validate-e2e-${uniq}`);
    const sub = await upsertSubscriber({
      tenantId: tenant.id,
      email: `nobody-${uniq}@nonexistent-domain-xyzq.com`,
    });
    // Stored, not dropped — the row is in the CRM with a reason attached.
    expect(sub.status).toBe('invalid');
    expect((sub.attributes as Record<string, unknown>).invalid_reason).toBe('mx');
    expect((sub.attributes as Record<string, unknown>).invalid_detail).toBeTruthy();
  });

  it('leaves a deliverable address active', async () => {
    const tenant = await ensureTenantByName(`validate-ok-e2e-${uniq}`);
    const sub = await upsertSubscriber({ tenantId: tenant.id, email: `ok-${uniq}@gmail.com` });
    expect(sub.status).toBe('active');
    expect((sub.attributes as Record<string, unknown>).invalid_reason).toBeUndefined();
  });

  it('respects an explicit status from the caller', async () => {
    const tenant = await ensureTenantByName(`validate-explicit-e2e-${uniq}`);
    const sub = await upsertSubscriber({
      tenantId: tenant.id,
      email: `unsub-${uniq}@nonexistent-domain-xyzq.com`,
      status: 'unsubscribed',
    });
    expect(sub.status).toBe('unsubscribed');
  });

  it('validates a bulk import row by row', async () => {
    const tenant = await ensureTenantByName(`validate-import-e2e-${uniq}`);
    const result = await importSubscribers(tenant.id, [
      { email: `good-${uniq}@gmail.com` },
      { email: `bad-${uniq}@nonexistent-domain-xyzq.com` },
      { email: `throwaway-${uniq}@mailinator.com` },
    ]);
    expect(result.created).toBe(3);
    expect(result.failed).toBe(0); // invalid is a status, not an import failure
  });

  it('suspends sending: an invalid subscriber is never in the audience', async () => {
    const tenant = await ensureTenantByName(`validate-audience-e2e-${uniq}`);
    const ok = await upsertSubscriber({
      tenantId: tenant.id,
      email: `reachable-${uniq}@gmail.com`,
    });
    const bad = await upsertSubscriber({
      tenantId: tenant.id,
      email: `unreachable-${uniq}@nonexistent-domain-xyzq.com`,
    });
    expect(bad.status).toBe('invalid');

    // Both handed in explicitly, so this proves the status filter itself —
    // not which subscribers a list or segment happened to select.
    const audience = await resolveAudience(tenant.id, { subscriberIds: [ok.id, bad.id] }, 'email', {
      limit: 100,
    });
    const addresses = audience.map((s) => s.email);
    expect(addresses).toContain(`reachable-${uniq}@gmail.com`);
    expect(addresses).not.toContain(`unreachable-${uniq}@nonexistent-domain-xyzq.com`);
  });
});
