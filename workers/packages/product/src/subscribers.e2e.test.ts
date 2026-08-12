import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '@maildrill/database';
import { ensureTenantByName } from '@maildrill/services';
import { deleteSubscriber, importSubscribers, updateSubscriber, upsertSubscriber } from './subscribers';
import { resolveAudience } from './audience';
import { addToList, createList } from './lists';
import { assertListSendable, listHealth } from '@maildrill/services';
import { db, listMembers } from '@maildrill/database';
import { eq } from 'drizzle-orm';

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

describe.skipIf(!run)('list suspension (e2e — needs Postgres)', () => {
  const uniq = `${process.pid}-${process.hrtime.bigint()}`;

  /** Build a list with `dead` undeliverable members out of `total`. */
  async function listWith(total: number, dead: number, tag: string) {
    const tenant = await ensureTenantByName(`listhealth-${tag}-${uniq}`);
    const list = await createList({ tenantId: tenant.id, name: `list-${tag}-${uniq}` });
    for (let i = 0; i < total; i++) {
      const sub = await upsertSubscriber({
        tenantId: tenant.id,
        email: `lh-${tag}-${uniq}-${i}@gmail.com`,
        status: i < dead ? 'bounced' : 'active',
      });
      await addToList(tenant.id, list.id, sub.id);
    }
    return { tenantId: tenant.id, listId: list.id };
  }

  it('measures the undeliverable share of a list', async () => {
    const { tenantId, listId } = await listWith(30, 3, 'healthy');
    const health = await listHealth(tenantId, listId);
    expect(health.members).toBe(30);
    expect(health.dead).toBe(3);
    expect(health.significant).toBe(true);
    expect(health.suspended).toBe(false);
  });

  it('lets a normally-decayed list send', async () => {
    const { tenantId, listId } = await listWith(30, 3, 'ok'); // 10% bounced, none invalid
    await expect(assertListSendable(tenantId, listId)).resolves.toBeUndefined();
  });

  it('suspends a list that is mostly undeliverable', async () => {
    const { tenantId, listId } = await listWith(30, 15, 'rotten'); // 50%
    await expect(assertListSendable(tenantId, listId)).rejects.toThrow(/list_suspended/);
    expect((await listHealth(tenantId, listId)).suspended).toBe(true);
    // Still refused on the next attempt, while the membership is unchanged.
    await expect(assertListSendable(tenantId, listId)).rejects.toThrow(/list_suspended/);
  });

  it('ignores a list too small for the share to mean anything', async () => {
    const { tenantId, listId } = await listWith(5, 4, 'tiny'); // 80% of 5
    await expect(assertListSendable(tenantId, listId)).resolves.toBeUndefined();
  });

  it('does not judge a list nobody has added to recently', async () => {
    // Same rotten membership, but every member was added before the window —
    // that is an old list, not a bad import, and the bar must not fire.
    const { tenantId, listId } = await listWith(30, 15, 'aged');
    await db
      .update(listMembers)
      .set({ addedAt: new Date(Date.now() - 400 * 86_400_000) })
      .where(eq(listMembers.listId, listId));

    const windowed = await listHealth(tenantId, listId);
    expect(windowed.members).toBe(0);
    expect(windowed.significant).toBe(false);
    await expect(assertListSendable(tenantId, listId)).resolves.toBeUndefined();

    // Widening the window back over them shows the rot is still there.
    const lifetime = await listHealth(tenantId, listId, new Date(0));
    expect(lifetime.members).toBe(30);
    expect(lifetime.deadShare).toBeCloseTo(0.5);
  });
});
