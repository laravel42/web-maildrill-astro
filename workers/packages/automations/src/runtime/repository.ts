import { and, count, desc, eq, gt, ilike, inArray, max, or, sql } from 'drizzle-orm';
import {
  automationRuns,
  automations,
  automationStepRuns,
  automationVersions,
  automationWebhooks,
  db,
  type AutomationRow,
  type AutomationRunRow,
  type AutomationStepRunRow,
  type AutomationVersionRow,
} from '@maildrill/database';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import { FlowTriggerType, type FlowVersionDefinition } from '@maildrill/activepieces-core';
import { validateForPublish, type ValidationIssue } from './validation';
import { mintWebhookToken } from './webhooks';

/**
 * Persistence for automations.
 *
 * Every exported function takes `tenantId` first and puts it in the WHERE clause. There is
 * deliberately no `getAutomationById(id)` — an un-scoped read is the bug this shape exists
 * to make unwritable.
 */

const EMPTY_TRIGGER = {
  name: 'trigger',
  displayName: 'Trigger',
  valid: false,
  type: FlowTriggerType.EMPTY,
  settings: {},
  nextAction: null,
};

export interface AutomationSummary {
  id: string;
  name: string;
  description: string | null;
  status: AutomationRow['status'];
  /** Human label for the published (or draft) trigger, for the list column. */
  triggerLabel: string | null;
  version: number;
  publishedVersion: number | null;
  hasUnpublishedChanges: boolean;
  runCount: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationDetail extends AutomationSummary {
  draft: AutomationVersionRow;
  published: AutomationVersionRow | null;
  webhook: { url: string; prefix: string } | null;
}

function triggerLabelOf(version: AutomationVersionRow | null): string | null {
  const trigger = version?.trigger as { displayName?: unknown } | undefined;
  return typeof trigger?.displayName === 'string' ? trigger.displayName : null;
}

function sameDefinition(a: AutomationVersionRow | null, b: AutomationVersionRow | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a.trigger) === JSON.stringify(b.trigger);
}

export interface ListAutomationsOptions {
  search?: string;
  status?: AutomationRow['status'];
  limit?: number;
  offset?: number;
}

export async function listAutomations(
  tenantId: string,
  opts: ListAutomationsOptions = {},
): Promise<{ items: AutomationSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const filters = [eq(automations.tenantId, tenantId)];
  if (opts.status) filters.push(eq(automations.status, opts.status));
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    const match = or(ilike(automations.name, term), ilike(automations.description, term));
    if (match) filters.push(match);
  }
  const where = and(...filters);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(automations)
      .where(where)
      .orderBy(desc(automations.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(automations).where(where),
  ]);

  if (rows.length === 0) return { items: [], total: totals[0]?.total ?? 0 };

  const ids = rows.map((r) => r.id);
  const versionIds = rows.flatMap((r) =>
    [r.draftVersionId, r.publishedVersionId].filter((v): v is string => Boolean(v)),
  );

  // Run stats for exactly this page — never a workspace-wide aggregate.
  const [stats, versions] = await Promise.all([
    db
      .select({
        automationId: automationRuns.automationId,
        runs: count(),
        lastRunAt: max(automationRuns.createdAt),
      })
      .from(automationRuns)
      .where(and(eq(automationRuns.tenantId, tenantId), inArray(automationRuns.automationId, ids)))
      .groupBy(automationRuns.automationId),
    versionIds.length > 0
      ? db
          .select()
          .from(automationVersions)
          .where(
            and(
              eq(automationVersions.tenantId, tenantId),
              inArray(automationVersions.id, versionIds),
            ),
          )
      : Promise.resolve([] as AutomationVersionRow[]),
  ]);

  const statById = new Map(stats.map((s) => [s.automationId, s]));
  const versionById = new Map(versions.map((v) => [v.id, v]));

  return {
    items: rows.map((row) => {
      const draft = row.draftVersionId ? (versionById.get(row.draftVersionId) ?? null) : null;
      const published = row.publishedVersionId
        ? (versionById.get(row.publishedVersionId) ?? null)
        : null;
      const stat = statById.get(row.id);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        triggerLabel: triggerLabelOf(published ?? draft),
        version: draft?.version ?? 1,
        publishedVersion: published?.version ?? null,
        hasUnpublishedChanges: Boolean(published) && !sameDefinition(draft, published),
        runCount: stat?.runs ?? 0,
        lastRunAt: stat?.lastRunAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),
    total: totals[0]?.total ?? 0,
  };
}

async function loadVersion(
  tenantId: string,
  versionId: string | null,
): Promise<AutomationVersionRow | null> {
  if (!versionId) return null;
  const [row] = await db
    .select()
    .from(automationVersions)
    .where(and(eq(automationVersions.id, versionId), eq(automationVersions.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function getAutomation(
  tenantId: string,
  id: string,
): Promise<AutomationDetail | null> {
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;

  const [draft, published, webhookRow, stat] = await Promise.all([
    loadVersion(tenantId, row.draftVersionId),
    loadVersion(tenantId, row.publishedVersionId),
    db
      .select()
      .from(automationWebhooks)
      .where(
        and(eq(automationWebhooks.automationId, id), eq(automationWebhooks.tenantId, tenantId)),
      )
      .limit(1),
    db
      .select({ runs: count(), lastRunAt: max(automationRuns.createdAt) })
      .from(automationRuns)
      .where(and(eq(automationRuns.tenantId, tenantId), eq(automationRuns.automationId, id))),
  ]);

  if (!draft) throw new ConflictError('automation has no draft version');

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    triggerLabel: triggerLabelOf(published ?? draft),
    version: draft.version,
    publishedVersion: published?.version ?? null,
    hasUnpublishedChanges: Boolean(published) && !sameDefinition(draft, published),
    runCount: stat[0]?.runs ?? 0,
    lastRunAt: stat[0]?.lastRunAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    draft,
    published,
    // The plaintext token is unrecoverable by design; the UI shows the prefix and offers
    // to mint a replacement.
    webhook: webhookRow[0] ? { url: '', prefix: webhookRow[0].tokenPrefix } : null,
  };
}

export async function createAutomation(input: {
  tenantId: string;
  name: string;
  description?: string | null;
  createdBy?: string | null;
  /** Optional starting definition, e.g. from Duplicate. */
  definition?: unknown;
}): Promise<AutomationDetail> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('automation name is required');

  const id = await db.transaction(async (tx) => {
    const [automation] = await tx
      .insert(automations)
      .values({
        tenantId: input.tenantId,
        name,
        description: input.description ?? null,
        status: 'draft',
        createdBy: input.createdBy ?? null,
      })
      .returning();
    const created = automation!;

    const trigger =
      input.definition && typeof input.definition === 'object'
        ? ((input.definition as { trigger?: unknown }).trigger ?? EMPTY_TRIGGER)
        : EMPTY_TRIGGER;

    const [version] = await tx
      .insert(automationVersions)
      .values({
        automationId: created.id,
        tenantId: input.tenantId,
        version: 1,
        state: 'draft',
        trigger: trigger as Record<string, unknown>,
        valid: false,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    await tx
      .update(automations)
      .set({ draftVersionId: version!.id, updatedAt: new Date() })
      .where(eq(automations.id, created.id));

    return created.id;
  });

  const detail = await getAutomation(input.tenantId, id);
  if (!detail) throw new NotFoundError('automation not found after creation');
  return detail;
}

export async function updateAutomationMeta(
  tenantId: string,
  id: string,
  patch: { name?: string; description?: string | null },
): Promise<AutomationDetail | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new ValidationError('automation name is required');
    set.name = name;
  }
  if (patch.description !== undefined) set.description = patch.description;

  const rows = await db
    .update(automations)
    .set(set)
    .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)))
    .returning({ id: automations.id });
  if (rows.length === 0) return null;
  return getAutomation(tenantId, id);
}

/**
 * Save the draft definition. Never touches the published version — that is the whole
 * point of the draft/publish split: a run that started under v4 keeps executing v4 while
 * v5 is being edited.
 */
export async function saveDraft(
  tenantId: string,
  id: string,
  definition: unknown,
): Promise<{ detail: AutomationDetail; errors: ValidationIssue[] } | null> {
  const current = await getAutomation(tenantId, id);
  if (!current) return null;
  if (current.status === 'archived') {
    throw new ConflictError('an archived automation cannot be edited');
  }

  const result = await validateForPublish(tenantId, definition);
  const trigger = (definition as { trigger?: unknown } | null)?.trigger;
  if (!trigger || typeof trigger !== 'object') {
    throw new ValidationError('flow definition must contain a trigger');
  }

  await db
    .update(automationVersions)
    .set({
      trigger: trigger as Record<string, unknown>,
      valid: result.valid,
      validationErrors: result.errors,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automationVersions.id, current.draft.id),
        eq(automationVersions.tenantId, tenantId),
        eq(automationVersions.state, 'draft'),
      ),
    );

  await db
    .update(automations)
    .set({ updatedAt: new Date() })
    .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)));

  const detail = await getAutomation(tenantId, id);
  return detail ? { detail, errors: result.errors } : null;
}

/**
 * Publish the draft.
 *
 * Promotes the draft to `published`, points the automation at it, and immediately opens
 * the *next* draft as a copy — so the published definition is frozen the moment anyone
 * starts editing again, with no window in which an edit mutates what is running.
 */
export async function publishAutomation(
  tenantId: string,
  id: string,
  userId: string | null,
): Promise<{ detail: AutomationDetail; errors: ValidationIssue[] } | null> {
  const current = await getAutomation(tenantId, id);
  if (!current) return null;
  if (current.status === 'archived') {
    throw new ConflictError('an archived automation cannot be published');
  }

  const definition: FlowVersionDefinition = {
    trigger: current.draft.trigger as unknown as FlowVersionDefinition['trigger'],
  };
  const result = await validateForPublish(tenantId, definition);
  if (!result.valid) {
    await db
      .update(automationVersions)
      .set({ valid: false, validationErrors: result.errors, updatedAt: new Date() })
      .where(eq(automationVersions.id, current.draft.id));
    return { detail: current, errors: result.errors };
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    // Archive the version this replaces, so history reads as a chain rather than a set of
    // rows that all claim to be published.
    if (current.published) {
      await tx
        .update(automationVersions)
        .set({ state: 'archived', updatedAt: now })
        .where(eq(automationVersions.id, current.published.id));
    }
    await tx
      .update(automationVersions)
      .set({
        state: 'published',
        valid: true,
        validationErrors: [],
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(automationVersions.id, current.draft.id));

    const [nextDraft] = await tx
      .insert(automationVersions)
      .values({
        automationId: id,
        tenantId,
        version: current.draft.version + 1,
        state: 'draft',
        trigger: current.draft.trigger,
        valid: true,
        createdBy: userId,
      })
      .returning();

    await tx
      .update(automations)
      .set({
        publishedVersionId: current.draft.id,
        draftVersionId: nextDraft!.id,
        // Publishing is what makes an automation live; a paused one stays paused so
        // "publish a fix" does not silently restart a workflow somebody halted.
        status: current.status === 'paused' ? 'paused' : 'active',
        publishedAt: now,
        updatedAt: now,
      })
      .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)));
  });

  // A published webhook trigger needs a URL to receive on.
  const triggerSettings = current.draft.trigger as { settings?: { pieceName?: string } };
  if (triggerSettings.settings?.pieceName === '@maildrill/webhook') {
    await ensureWebhook(tenantId, id);
  }

  const detail = await getAutomation(tenantId, id);
  return detail ? { detail, errors: [] } : null;
}

export async function setAutomationStatus(
  tenantId: string,
  id: string,
  status: AutomationRow['status'],
): Promise<AutomationDetail | null> {
  const current = await getAutomation(tenantId, id);
  if (!current) return null;
  if (status === 'active' && !current.published) {
    throw new ConflictError('publish this automation before activating it');
  }
  await db
    .update(automations)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)));
  return getAutomation(tenantId, id);
}

export async function deleteAutomation(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(automations)
    .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)))
    .returning({ id: automations.id });
  return rows.length > 0;
}

/** Mint (or replace) the automation's webhook token. Returns the plaintext ONCE. */
export async function ensureWebhook(
  tenantId: string,
  automationId: string,
): Promise<{ token: string; prefix: string }> {
  const minted = mintWebhookToken();
  await db
    .insert(automationWebhooks)
    .values({
      tenantId,
      automationId,
      tokenHash: minted.hash,
      tokenPrefix: minted.prefix,
    })
    .onConflictDoUpdate({
      target: automationWebhooks.automationId,
      set: { tokenHash: minted.hash, tokenPrefix: minted.prefix },
    });
  return { token: minted.token, prefix: minted.prefix };
}

export interface VersionSummary {
  id: string;
  version: number;
  state: AutomationVersionRow['state'];
  valid: boolean;
  publishedAt: Date | null;
  createdAt: Date;
}

export async function listVersions(
  tenantId: string,
  automationId: string,
): Promise<VersionSummary[]> {
  const rows = await db
    .select({
      id: automationVersions.id,
      version: automationVersions.version,
      state: automationVersions.state,
      valid: automationVersions.valid,
      publishedAt: automationVersions.publishedAt,
      createdAt: automationVersions.createdAt,
    })
    .from(automationVersions)
    .where(
      and(
        eq(automationVersions.tenantId, tenantId),
        eq(automationVersions.automationId, automationId),
      ),
    )
    .orderBy(desc(automationVersions.version));
  return rows;
}

// --- runs -------------------------------------------------------------------------

export interface ListRunsOptions {
  automationId?: string;
  status?: AutomationRunRow['status'];
  limit?: number;
  offset?: number;
}

export async function listRuns(
  tenantId: string,
  opts: ListRunsOptions = {},
): Promise<{ items: AutomationRunRow[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const filters = [eq(automationRuns.tenantId, tenantId)];
  if (opts.automationId) filters.push(eq(automationRuns.automationId, opts.automationId));
  if (opts.status) filters.push(eq(automationRuns.status, opts.status));
  const where = and(...filters);

  const [items, totals] = await Promise.all([
    db
      .select()
      .from(automationRuns)
      .where(where)
      .orderBy(desc(automationRuns.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(automationRuns).where(where),
  ]);
  return { items, total: totals[0]?.total ?? 0 };
}

export async function getRun(
  tenantId: string,
  runId: string,
): Promise<{ run: AutomationRunRow; steps: AutomationStepRunRow[] } | null> {
  const [run] = await db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.tenantId, tenantId)))
    .limit(1);
  if (!run) return null;
  const steps = await db
    .select()
    .from(automationStepRuns)
    .where(and(eq(automationStepRuns.runId, runId), eq(automationStepRuns.tenantId, tenantId)))
    .orderBy(automationStepRuns.seq);
  return { run, steps };
}

export async function cancelRun(tenantId: string, runId: string): Promise<boolean> {
  const rows = await db
    .update(automationRuns)
    .set({ status: 'cancelled', completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(automationRuns.id, runId),
        eq(automationRuns.tenantId, tenantId),
        inArray(automationRuns.status, ['queued', 'running', 'waiting']),
      ),
    )
    .returning({ id: automationRuns.id });
  return rows.length > 0;
}

/**
 * Concurrency cap per workspace: one runaway automation must not consume every worker
 * slot in the cluster. Counts in-flight runs only.
 */
export async function inFlightRunCount(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.tenantId, tenantId),
        inArray(automationRuns.status, ['queued', 'running']),
      ),
    );
  return row?.total ?? 0;
}

/** Runs that a worker claimed and never finished — the stall sweeper's input. */
export async function reclaimStalledRuns(stallMs: number): Promise<AutomationRunRow[]> {
  const cutoff = new Date(Date.now() - stallMs);
  return db
    .update(automationRuns)
    .set({ status: 'queued', claimedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(automationRuns.status, 'running'),
        sql`${automationRuns.claimedAt} is not null`,
        sql`${automationRuns.claimedAt} < ${cutoff}`,
      ),
    )
    .returning();
}

/** Waiting runs whose delay has elapsed — the resume sweeper's input. */
export async function dueWaitingRuns(limit: number): Promise<AutomationRunRow[]> {
  return db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.status, 'waiting'),
        sql`${automationRuns.resumeAt} is not null`,
        sql`${automationRuns.resumeAt} <= now()`,
      ),
    )
    .orderBy(automationRuns.resumeAt)
    .limit(limit);
}

/** Automations that are live and whose published trigger listens for `eventType`. */
export async function activeVersionsForEvent(
  tenantId: string,
): Promise<{ automation: AutomationRow; version: AutomationVersionRow }[]> {
  const rows = await db
    .select({ automation: automations, version: automationVersions })
    .from(automations)
    .innerJoin(automationVersions, eq(automationVersions.id, automations.publishedVersionId))
    .where(
      and(
        eq(automations.tenantId, tenantId),
        eq(automations.status, 'active'),
        gt(automationVersions.version, 0),
      ),
    );
  return rows;
}
