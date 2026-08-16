import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '@maildrill/database';
import { ensureTenantByName } from '@maildrill/services';
import {
  countSubscribers,
  deleteSubscriber,
  importSubscribers,
  subscriberChannelCounts,
  updateSubscriber,
  upsertSubscriber,
} from './subscribers';
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

describe.skipIf(!run)('roster filters: list and counts agree (e2e — needs Postgres)', () => {
  const uniq = `${process.pid}-${process.hrtime.bigint()}`;
  /**
   * A tenant with a known shape: 3 active (2 with a phone), 1 bounced (phone),
   * 1 unsubscribed (no phone). Statuses are passed explicitly so address
   * validation stays out of it — this is about the filter builder, not MX.
   */
  const seed = async () => {
    const tenant = await ensureTenantByName(`counts-e2e-${uniq}`);
    const rows: [string, string | undefined, 'active' | 'bounced' | 'unsubscribed'][] = [
      ['a1', '+15550000001', 'active'],
      ['a2', '+15550000002', 'active'],
      ['a3', undefined, 'active'],
      ['b1', '+15550000003', 'bounced'],
      ['u1', undefined, 'unsubscribed'],
    ];
    for (const [tag, phone, status] of rows) {
      await upsertSubscriber({
        tenantId: tenant.id,
        email: `${tag}-${uniq}@gmail.com`,
        ...(phone ? { phone } : {}),
        status,
      });
    }
    return tenant;
  };

  it('gives the same number for a channel tab and the list total', async () => {
    const tenant = await seed();
    for (const filters of [
      {},
      { status: 'active' as const },
      { statuses: ['active', 'bounced'] as const },
    ]) {
      for (const channel of ['email', 'sms'] as const) {
        const opts = {
          ...filters,
          channel,
          statuses: filters.statuses ? [...filters.statuses] : undefined,
        };
        const total = await countSubscribers(tenant.id, opts);
        const counts = await subscriberChannelCounts(tenant.id, opts);
        // The tab and the footer describe one set. They did not: the channel
        // aggregates used to be computed over a status-agnostic filter set, so
        // Status=Active read 1,000,229 on the Email tab against a footer of
        // 920,211 on the perf workspace.
        expect(counts[channel]).toBe(total);
      }
    }
  });

  it('keeps byStatus blind to the status filter and bound to the channel', async () => {
    const tenant = await seed();
    const withFilter = await subscriberChannelCounts(tenant.id, {
      channel: 'email',
      status: 'active',
    });
    // A menu that counted only the selected status would report every other
    // option as zero, so the roster could never leave the status it is on.
    expect(withFilter.byStatus.unsubscribed).toBe(1);
    expect(withFilter.byStatus.bounced).toBe(1);
    expect(withFilter.byStatus.active).toBe(3);

    // ...but it IS scoped to the tab: only 3 of the 5 have a phone number, so
    // the SMS tab's menu must not count the two who do not.
    const sms = await subscriberChannelCounts(tenant.id, { channel: 'sms' });
    expect(sms.byStatus.active).toBe(2);
    expect(sms.byStatus.unsubscribed).toBe(0);
    expect(sms.byStatus.bounced).toBe(1);
    const smsTotal = Object.values(sms.byStatus).reduce((a, b) => a + b, 0);
    expect(smsTotal).toBe(sms.sms);
  });

  it('binds a hostile tag name as a parameter instead of building a literal', async () => {
    const tenant = await seed();
    // The tag/list filters used to hand-build `array['…']` with sql.raw. This
    // payload closed the literal on the list branch, which did not escape at
    // all. Bound, it is data: zero matches, no error, no widening.
    const hostile = ["x' or 1=1) or (select 1=1) --", "o'brien"];
    expect(await countSubscribers(tenant.id, { tagNames: hostile })).toBe(0);
    const counts = await subscriberChannelCounts(tenant.id, { tagNames: hostile });
    expect(counts.email).toBe(0);
  });
});
