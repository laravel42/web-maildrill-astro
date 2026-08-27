import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import {
  automationEvents,
  automationRuns,
  closeDb,
  db,
  subscriberTags,
  tags,
} from '@maildrill/database';
import { FlowActionType, FlowTriggerType } from '@maildrill/activepieces-core';
import { listTags, upsertSubscriber } from '@maildrill/product';
import { ensureTenantByName } from '@maildrill/services';
import { shutdownQueues } from '@maildrill/queues';
import {
  createAutomation,
  dispatchAutomationEvents,
  executeAutomationRun,
  getAutomation,
  getRun,
  installAutomationEventSink,
  installSubscriptionFilter,
  listRuns,
  publishAutomation,
  refreshSubscriptions,
  runAutomationMaintenance,
  saveDraft,
  uninstallSubscriptionFilter,
} from './index';

/**
 * Full-pipeline test against real Postgres + Redis:
 *
 *   domain event → automation_events → dispatcher → run → engine → Maildrill action
 *
 * Enable with:
 *   docker compose up -d && pnpm db:migrate && RUN_E2E=1 pnpm test
 */
const run = process.env.RUN_E2E === '1';

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** Trigger: subscriber created → action: add tag. */
function tagOnCreate(tagName: string, extraStep?: Record<string, unknown>) {
  const addTag = {
    name: 'tag_them',
    displayName: 'Add tag',
    valid: true,
    type: FlowActionType.PIECE,
    settings: {
      pieceName: '@maildrill/subscribers',
      pieceVersion: '1.0.0',
      actionName: 'add_tag',
      input: { subscriberId: '{{trigger.subscriber.id}}', tagName },
    },
    nextAction: extraStep ?? null,
  };
  return {
    trigger: {
      name: 'trigger',
      displayName: 'Subscriber created',
      valid: true,
      type: FlowTriggerType.PIECE,
      settings: {
        pieceName: '@maildrill/subscribers',
        pieceVersion: '1.0.0',
        triggerName: 'subscriber_created',
        input: {},
      },
      nextAction: addTag,
    },
  };
}

/**
 * Drain the dispatcher and settle everything it produced.
 *
 * Deliberately tolerant of a REAL worker running alongside the test (a `pnpm dev` in
 * another terminal consumes the same `automation-run` queue). `claimRun` is atomic, so
 * whichever gets there first wins and the other no-ops — the test therefore drives the run
 * *and* waits for it, instead of assuming it is the only executor. Without this the suite
 * passes alone and fails whenever the dev server is up, which is precisely when people run
 * it.
 */
async function drain(tenantId: string): Promise<string[]> {
  await dispatchAutomationEvents();
  const created = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.tenantId, tenantId),
        inArray(automationRuns.status, ['queued', 'running']),
      ),
    );
  for (const row of created) await settle(tenantId, row.id);
  return created.map((r) => r.id);
}

/** Execute a run (or wait out whoever else is executing it) until it stops moving. */
async function settle(tenantId: string, runId: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await executeAutomationRun(tenantId, runId);
    const [row] = await db
      .select({ status: automationRuns.status })
      .from(automationRuns)
      .where(eq(automationRuns.id, runId))
      .limit(1);
    if (!row) return;
    if (row.status !== 'queued' && row.status !== 'running') return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe.skipIf(!run)('automations (e2e — needs Postgres + Redis)', () => {
  beforeAll(() => {
    installAutomationEventSink();
    installSubscriptionFilter();
  });

  afterAll(async () => {
    uninstallSubscriptionFilter();
    await shutdownQueues();
    await closeDb();
  });

  it('runs a published automation end to end when its trigger fires', async () => {
    const tenant = await ensureTenantByName(unique('auto-e2e'));
    const tagName = unique('welcomed');

    const automation = await createAutomation({
      tenantId: tenant.id,
      name: 'Welcome sequence',
    });
    expect(automation.status).toBe('draft');
    expect(automation.published).toBeNull();

    const saved = await saveDraft(tenant.id, automation.id, tagOnCreate(tagName));
    expect(saved?.errors).toEqual([]);

    const published = await publishAutomation(tenant.id, automation.id, null);
    expect(published?.errors).toEqual([]);
    expect(published?.detail.status).toBe('active');
    expect(published?.detail.publishedVersion).toBe(1);
    // Publishing opens the NEXT draft, so editing can never mutate what is running.
    expect(published?.detail.version).toBe(2);

    await refreshSubscriptions();

    const subscriber = await upsertSubscriber({
      tenantId: tenant.id,
      email: `${unique('ada')}@maildrill.net`,
      name: 'Ada',
      // Explicit status skips the MX lookup — this test is about automations, not DNS.
      status: 'active',
    });

    const runIds = await drain(tenant.id);
    expect(runIds).toHaveLength(1);

    const detail = await getRun(tenant.id, runIds[0]!);
    expect(detail?.run.status).toBe('succeeded');
    expect(detail?.steps.map((s) => s.stepName)).toEqual(['trigger', 'tag_them']);
    expect(detail?.steps.every((s) => s.status === 'succeeded')).toBe(true);

    // The action really happened: the tag exists and is applied.
    const applied = await db
      .select({ name: tags.name })
      .from(subscriberTags)
      .innerJoin(tags, eq(tags.id, subscriberTags.tagId))
      .where(eq(subscriberTags.subscriberId, subscriber.id));
    expect(applied.map((t) => t.name)).toContain(tagName);
  }, 30_000);

  it('parks on a Wait and finishes after the delay elapses', async () => {
    const tenant = await ensureTenantByName(unique('auto-e2e-delay'));
    const tagName = unique('later');

    const automation = await createAutomation({ tenantId: tenant.id, name: 'Delayed' });
    // Wait 1 day, then tag. The wait must not occupy anything.
    const definition = {
      trigger: {
        name: 'trigger',
        displayName: 'Subscriber created',
        valid: true,
        type: FlowTriggerType.PIECE,
        settings: {
          pieceName: '@maildrill/subscribers',
          pieceVersion: '1.0.0',
          triggerName: 'subscriber_created',
          input: {},
        },
        nextAction: {
          name: 'hold',
          displayName: 'Wait',
          valid: true,
          type: FlowActionType.PIECE,
          settings: {
            pieceName: '@maildrill/logic',
            pieceVersion: '1.0.0',
            actionName: 'delay',
            input: { amount: 1, unit: 'days' },
          },
          nextAction: {
            name: 'tag_them',
            displayName: 'Add tag',
            valid: true,
            type: FlowActionType.PIECE,
            settings: {
              pieceName: '@maildrill/subscribers',
              pieceVersion: '1.0.0',
              actionName: 'add_tag',
              input: { subscriberId: '{{trigger.subscriber.id}}', tagName },
            },
            nextAction: null,
          },
        },
      },
    };
    await saveDraft(tenant.id, automation.id, definition);
    await publishAutomation(tenant.id, automation.id, null);
    await refreshSubscriptions();

    const subscriber = await upsertSubscriber({
      tenantId: tenant.id,
      email: `${unique('grace')}@maildrill.net`,
      status: 'active',
    });

    const runIds = await drain(tenant.id);
    expect(runIds).toHaveLength(1);
    const runId = runIds[0]!;

    const parked = await getRun(tenant.id, runId);
    expect(parked?.run.status).toBe('waiting');
    expect(parked?.run.resumeStepName).toBe('hold');
    expect(parked?.run.resumeAt).toBeTruthy();
    // Nothing after the Wait has executed yet.
    expect(parked?.steps.map((s) => s.stepName)).toEqual(['trigger', 'hold']);

    // Simulate the day passing, then let the durability sweep wake it.
    await db
      .update(automationRuns)
      .set({ resumeAt: new Date(Date.now() - 1_000) })
      .where(eq(automationRuns.id, runId));

    await runAutomationMaintenance();
    await settle(tenant.id, runId);

    const finished = await getRun(tenant.id, runId);
    expect(finished?.run.status).toBe('succeeded');
    expect(finished?.steps.map((s) => s.stepName)).toEqual(['trigger', 'hold', 'tag_them']);

    const applied = await db
      .select({ name: tags.name })
      .from(subscriberTags)
      .innerJoin(tags, eq(tags.id, subscriberTags.tagId))
      .where(eq(subscriberTags.subscriberId, subscriber.id));
    expect(applied.map((t) => t.name)).toContain(tagName);
  }, 30_000);

  it('starts exactly one run per event, however often it is redelivered', async () => {
    const tenant = await ensureTenantByName(unique('auto-e2e-idem'));
    const automation = await createAutomation({ tenantId: tenant.id, name: 'Idempotent' });
    await saveDraft(tenant.id, automation.id, tagOnCreate(unique('once')));
    await publishAutomation(tenant.id, automation.id, null);
    await refreshSubscriptions();

    await upsertSubscriber({
      tenantId: tenant.id,
      email: `${unique('dup')}@maildrill.net`,
      status: 'active',
    });
    await dispatchAutomationEvents();

    // Replay the same occurrence: reset the event row and dispatch again. In production
    // this is a provider redelivering a report.
    await db
      .update(automationEvents)
      .set({ status: 'pending', processedAt: null })
      .where(eq(automationEvents.tenantId, tenant.id));
    await dispatchAutomationEvents();

    const runs = await listRuns(tenant.id, { automationId: automation.id });
    expect(runs.total).toBe(1);
  }, 30_000);

  it('keeps one workspace’s events out of another workspace’s automations', async () => {
    const alice = await ensureTenantByName(unique('auto-e2e-alice'));
    const bob = await ensureTenantByName(unique('auto-e2e-bob'));

    const bobsAutomation = await createAutomation({ tenantId: bob.id, name: 'Bob only' });
    await saveDraft(bob.id, bobsAutomation.id, tagOnCreate(unique('bob-tag')));
    await publishAutomation(bob.id, bobsAutomation.id, null);
    await refreshSubscriptions();

    // Alice creates a subscriber. Bob's automation must not see it.
    await upsertSubscriber({
      tenantId: alice.id,
      email: `${unique('alice')}@maildrill.net`,
      status: 'active',
    });
    await dispatchAutomationEvents();

    const bobsRuns = await listRuns(bob.id, { automationId: bobsAutomation.id });
    expect(bobsRuns.total).toBe(0);

    // And Alice cannot read Bob's automation even knowing its id.
    expect(await getAutomation(alice.id, bobsAutomation.id)).toBeNull();
    // Nor its runs.
    const aliceRuns = await listRuns(alice.id, { automationId: bobsAutomation.id });
    expect(aliceRuns.total).toBe(0);
  }, 30_000);

  it('leaves the published definition alone while the draft is edited', async () => {
    const tenant = await ensureTenantByName(unique('auto-e2e-version'));
    const firstTag = unique('v1-tag');
    const secondTag = unique('v2-tag');

    const automation = await createAutomation({ tenantId: tenant.id, name: 'Versioned' });
    await saveDraft(tenant.id, automation.id, tagOnCreate(firstTag));
    const published = await publishAutomation(tenant.id, automation.id, null);
    const publishedVersionId = published!.detail.published!.id;
    await refreshSubscriptions();

    // Edit the draft — v2 — without publishing it.
    const edited = await saveDraft(tenant.id, automation.id, tagOnCreate(secondTag));
    expect(edited?.detail.hasUnpublishedChanges).toBe(true);
    expect(edited?.detail.published?.id).toBe(publishedVersionId);

    const subscriber = await upsertSubscriber({
      tenantId: tenant.id,
      email: `${unique('linus')}@maildrill.net`,
      status: 'active',
    });
    await drain(tenant.id);

    const applied = (
      await db
        .select({ name: tags.name })
        .from(subscriberTags)
        .innerJoin(tags, eq(tags.id, subscriberTags.tagId))
        .where(eq(subscriberTags.subscriberId, subscriber.id))
    ).map((t) => t.name);

    // The run used the PUBLISHED definition, not the edited draft.
    expect(applied).toContain(firstTag);
    expect(applied).not.toContain(secondTag);
    // And the workspace has no stray tag from the unpublished draft.
    expect((await listTags(tenant.id)).map((t) => t.name)).not.toContain(secondTag);
  }, 30_000);

  it('does not run a paused automation', async () => {
    const tenant = await ensureTenantByName(unique('auto-e2e-paused'));
    const automation = await createAutomation({ tenantId: tenant.id, name: 'Paused' });
    await saveDraft(tenant.id, automation.id, tagOnCreate(unique('never')));
    await publishAutomation(tenant.id, automation.id, null);

    const { setAutomationStatus } = await import('./index');
    await setAutomationStatus(tenant.id, automation.id, 'paused');
    await refreshSubscriptions();

    await upsertSubscriber({
      tenantId: tenant.id,
      email: `${unique('paused')}@maildrill.net`,
      status: 'active',
    });
    await dispatchAutomationEvents();

    expect((await listRuns(tenant.id, { automationId: automation.id })).total).toBe(0);
  }, 30_000);

  it('records a failing step with its error and stops the run there', async () => {
    const tenant = await ensureTenantByName(unique('auto-e2e-fail'));
    const automation = await createAutomation({ tenantId: tenant.id, name: 'Fails' });

    // Add-to-list pointing at a list that does not exist in this workspace.
    const definition = tagOnCreate(unique('ok-tag'), {
      name: 'join_list',
      displayName: 'Add to list',
      valid: true,
      type: FlowActionType.PIECE,
      settings: {
        pieceName: '@maildrill/subscribers',
        pieceVersion: '1.0.0',
        actionName: 'add_to_list',
        input: {
          subscriberId: '{{trigger.subscriber.id}}',
          listId: '00000000-0000-4000-8000-000000000000',
        },
      },
      nextAction: null,
    });
    await saveDraft(tenant.id, automation.id, definition);
    await publishAutomation(tenant.id, automation.id, null);
    await refreshSubscriptions();

    await upsertSubscriber({
      tenantId: tenant.id,
      email: `${unique('fails')}@maildrill.net`,
      status: 'active',
    });
    const runIds = await drain(tenant.id);
    const detail = await getRun(tenant.id, runIds[0]!);

    expect(detail?.run.status).toBe('failed');
    expect(detail?.run.error).toMatchObject({ stepName: 'join_list', category: 'permanent' });
    const failing = detail?.steps.find((s) => s.stepName === 'join_list');
    expect(failing?.status).toBe('failed');
    expect(failing?.errorMessage).toContain('list not found');
    // The earlier step succeeded and is journaled, so the inspector shows where it got to.
    expect(detail?.steps.find((s) => s.stepName === 'tag_them')?.status).toBe('succeeded');
  }, 30_000);
});
