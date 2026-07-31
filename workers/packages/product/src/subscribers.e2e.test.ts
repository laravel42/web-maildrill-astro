import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '@maildrill/database';
import { ensureTenantByName } from '@maildrill/services';
import { deleteSubscriber, updateSubscriber, upsertSubscriber } from './subscribers';

// Needs real Postgres. Enable with: RUN_E2E=1 pnpm test
const run = process.env.RUN_E2E === '1';

describe.skipIf(!run)('updateSubscriber attributes (e2e — needs Postgres)', () => {
  afterAll(async () => {
    await closeDb();
  });

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
