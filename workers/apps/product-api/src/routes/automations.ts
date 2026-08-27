import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import { asClientError, isValidationError, type ZodTypeProvider } from '@maildrill/httpkit';
import { ConflictError, DomainError, NotFoundError } from '@maildrill/domain';
import { logger } from '@maildrill/observability';
import {
  cancelRun,
  createAutomation,
  createConnection,
  deleteAutomation,
  deleteConnection,
  getAutomation,
  getRun,
  lastWebhookPayload,
  listAutomations,
  listConnections,
  listRuns,
  listVersions,
  mintAutomationWebhook,
  pieceCatalog,
  publishAutomation,
  refreshSubscriptions,
  saveDraft,
  setAutomationStatus,
  startManualRun,
  updateAutomationMeta,
  webhookUrl,
} from '@maildrill/automations';
import {
  listListOptions,
  listSegments,
  listTemplates,
  listCampaignsPage,
} from '@maildrill/product';

/**
 * Automations HTTP surface.
 *
 * Two rules hold across every handler:
 *
 *  1. `req.tenantId` is the only source of workspace identity. No route reads a workspace
 *     from the body, the query or the path — the browser never sends one, and the BFF puts
 *     it in a signed token the browser cannot mint.
 *  2. Nothing executes here. `POST /test` enqueues a run and answers with its id; the
 *     composer polls. The API process must never be the thing a workflow blocks.
 */

const TAG = ['Automations'];
const idParam = z.object({ id: z.string().uuid() });
const runIdParam = z.object({ runId: z.string().uuid() });

const listQuery = z.object({
  q: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  /** Optional starting flow, used by Duplicate and by templates. */
  definition: z.unknown().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
});

/**
 * The flow body is validated by the domain (`validateForPublish`), not by a Zod schema on
 * the route. A half-built flow must be *savable* — refusing to persist an incomplete draft
 * would lose the user's work every time they stepped away mid-edit — so the route accepts
 * any object and the publish gate is what enforces correctness.
 */
const draftSchema = z.object({ definition: z.object({}).passthrough() });

const runsQuery = z.object({
  status: z.enum(['queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const testSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  /**
   * `true` (the default) runs in dry-run mode: side-effecting steps report what they would
   * do instead of doing it. Testing a workflow must not mail a real customer by accident.
   */
  dryRun: z.boolean().optional(),
});

const connectionSchema = z.object({
  name: z.string().min(1).max(80),
  pieceName: z.string().min(1).max(120),
  secret: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function automationRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  // --- catalog ---------------------------------------------------------------------
  // Served from the server so no piece definition, prop table or sample payload is ever
  // bundled into the client. The composer fetches this once, on open.
  app.get(
    '/v1/automation-pieces',
    { schema: { tags: TAG, summary: 'Step catalog for the composer' } },
    async () => ({ data: pieceCatalog() }),
  );

  /**
   * Options for a `DYNAMIC_DROPDOWN` prop. Every source is workspace-scoped; an unknown
   * source is 404 rather than an empty list, so a typo in a piece definition is visible.
   */
  app.get(
    '/v1/automation-options/:source',
    {
      schema: {
        tags: TAG,
        summary: 'Choices for a step field (lists, segments, templates, campaigns)',
        params: z.object({ source: z.string().min(1).max(40) }),
      },
    },
    async (req, reply) => {
      const { source } = req.params;
      const tenantId = req.tenantId;

      if (source === 'lists') {
        const rows = await listListOptions(tenantId, { limit: 200 });
        return { data: rows.map((l) => ({ value: l.id, label: l.name })) };
      }
      if (source === 'segments') {
        const rows = await listSegments(tenantId);
        return { data: rows.map((s) => ({ value: s.id, label: s.name })) };
      }
      if (source === 'campaigns') {
        const rows = await listCampaignsPage(tenantId, { limit: 100 });
        return { data: rows.map((c) => ({ value: c.id, label: c.name })) };
      }
      if (source.startsWith('templates')) {
        const channel = source.split(':')[1];
        const rows = await listTemplates(tenantId);
        return {
          data: rows
            .filter((t) => !channel || t.channel === channel)
            // A WhatsApp template Meta has not approved cannot be sent, so offering it
            // would be offering a step that always fails.
            .filter((t) => t.channel !== 'whatsapp' || t.approvalStatus === 'approved')
            .map((t) => ({ value: t.id, label: t.name })),
        };
      }
      return reply.code(404).send({ error: 'unknown_option_source' });
    },
  );

  // --- automations -----------------------------------------------------------------

  app.get(
    '/v1/automations',
    { schema: { tags: TAG, summary: 'List automations', querystring: listQuery } },
    async (req) => {
      const { q, status, limit, offset } = req.query;
      return listAutomations(req.tenantId, { search: q, status, limit, offset });
    },
  );

  app.post(
    '/v1/automations',
    { schema: { tags: TAG, summary: 'Create an automation', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(
        await createAutomation({
          tenantId: req.tenantId,
          name: req.body.name,
          description: req.body.description ?? null,
          createdBy: req.userId ?? null,
          definition: req.body.definition,
        }),
      ),
  );

  app.get(
    '/v1/automations/:id',
    { schema: { tags: TAG, summary: 'Get an automation with its draft', params: idParam } },
    async (req, reply) => {
      const detail = await getAutomation(req.tenantId, req.params.id);
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      return detail;
    },
  );

  app.patch(
    '/v1/automations/:id',
    {
      schema: { tags: TAG, summary: 'Rename an automation', params: idParam, body: patchSchema },
    },
    async (req, reply) => {
      const detail = await updateAutomationMeta(req.tenantId, req.params.id, req.body);
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      return detail;
    },
  );

  app.put(
    '/v1/automations/:id/draft',
    {
      schema: {
        tags: TAG,
        summary: 'Save the draft flow (autosave). Never touches the published version.',
        params: idParam,
        body: draftSchema,
      },
    },
    async (req, reply) => {
      const saved = await saveDraft(req.tenantId, req.params.id, req.body.definition);
      if (!saved) return reply.code(404).send({ error: 'not_found' });
      return { automation: saved.detail, errors: saved.errors };
    },
  );

  app.post(
    '/v1/automations/:id/publish',
    { schema: { tags: TAG, summary: 'Publish the draft', params: idParam } },
    async (req, reply) => {
      const result = await publishAutomation(req.tenantId, req.params.id, req.userId ?? null);
      if (!result) return reply.code(404).send({ error: 'not_found' });
      if (result.errors.length > 0) {
        return reply.code(422).send({ error: 'invalid_flow', errors: result.errors });
      }
      // Shrink the window in which the subscription index has not noticed the new
      // trigger; the dispatcher would pick it up within seconds anyway.
      await refreshSubscriptions();
      return { automation: result.detail, errors: [] };
    },
  );

  app.post(
    '/v1/automations/:id/pause',
    { schema: { tags: TAG, summary: 'Pause an automation', params: idParam } },
    async (req, reply) => {
      const detail = await setAutomationStatus(req.tenantId, req.params.id, 'paused');
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      await refreshSubscriptions();
      return detail;
    },
  );

  app.post(
    '/v1/automations/:id/activate',
    { schema: { tags: TAG, summary: 'Resume a paused automation', params: idParam } },
    async (req, reply) => {
      const detail = await setAutomationStatus(req.tenantId, req.params.id, 'active');
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      await refreshSubscriptions();
      return detail;
    },
  );

  app.post(
    '/v1/automations/:id/archive',
    { schema: { tags: TAG, summary: 'Archive an automation', params: idParam } },
    async (req, reply) => {
      const detail = await setAutomationStatus(req.tenantId, req.params.id, 'archived');
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      await refreshSubscriptions();
      return detail;
    },
  );

  app.post(
    '/v1/automations/:id/duplicate',
    { schema: { tags: TAG, summary: 'Duplicate an automation as a new draft', params: idParam } },
    async (req, reply) => {
      const source = await getAutomation(req.tenantId, req.params.id);
      if (!source) return reply.code(404).send({ error: 'not_found' });
      // Copy the PUBLISHED definition when there is one — that is the version the user
      // means by "this automation"; the draft may be half-edited.
      const definition = { trigger: (source.published ?? source.draft).trigger };
      return reply.code(201).send(
        await createAutomation({
          tenantId: req.tenantId,
          name: `${source.name} (copy)`,
          description: source.description,
          createdBy: req.userId ?? null,
          definition,
        }),
      );
    },
  );

  app.delete(
    '/v1/automations/:id',
    { schema: { tags: TAG, summary: 'Delete an automation', params: idParam } },
    async (req, reply) => {
      const ok = await deleteAutomation(req.tenantId, req.params.id);
      if (ok) await refreshSubscriptions();
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.get(
    '/v1/automations/:id/versions',
    { schema: { tags: TAG, summary: 'Version history', params: idParam } },
    async (req) => ({ data: await listVersions(req.tenantId, req.params.id) }),
  );

  app.post(
    '/v1/automations/:id/test',
    {
      schema: {
        tags: TAG,
        summary: 'Run the draft once against a sample payload',
        params: idParam,
        body: testSchema,
      },
    },
    async (req, reply) => {
      const detail = await getAutomation(req.tenantId, req.params.id);
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      if (!detail.draft.valid) {
        return reply
          .code(422)
          .send({ error: 'invalid_flow', errors: detail.draft.validationErrors });
      }
      const result = await startManualRun({
        tenantId: req.tenantId,
        automationId: detail.id,
        versionId: detail.draft.id,
        payload: req.body.payload ?? {},
        test: req.body.dryRun !== false,
      });
      if (!result.runId) {
        return reply.code(429).send({
          error: result.throttled ? 'too_many_runs' : 'run_not_started',
        });
      }
      return reply.code(202).send({ runId: result.runId });
    },
  );

  app.post(
    '/v1/automations/:id/webhook',
    {
      schema: {
        tags: TAG,
        summary: 'Mint (or rotate) this automation’s webhook URL. Shown once.',
        params: idParam,
      },
    },
    async (req, reply) => {
      const detail = await getAutomation(req.tenantId, req.params.id);
      if (!detail) return reply.code(404).send({ error: 'not_found' });
      const minted = await mintAutomationWebhook(req.tenantId, req.params.id);
      // The plaintext is returned exactly here and never again — only its hash is stored.
      return { url: webhookUrl(minted.token), prefix: minted.prefix };
    },
  );

  app.get(
    '/v1/automations/:id/webhook/last-payload',
    {
      schema: {
        tags: TAG,
        summary: 'The most recent body this automation’s webhook received',
        params: idParam,
      },
    },
    async (req) => ({ payload: await lastWebhookPayload(req.tenantId, req.params.id) }),
  );

  // --- runs -------------------------------------------------------------------------

  app.get(
    '/v1/automations/:id/runs',
    {
      schema: {
        tags: TAG,
        summary: 'Run history for one automation',
        params: idParam,
        querystring: runsQuery,
      },
    },
    async (req) =>
      listRuns(req.tenantId, {
        automationId: req.params.id,
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
  );

  app.get(
    '/v1/automation-runs',
    { schema: { tags: TAG, summary: 'Recent runs across the workspace', querystring: runsQuery } },
    async (req) =>
      listRuns(req.tenantId, {
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
  );

  app.get(
    '/v1/automation-runs/:runId',
    { schema: { tags: TAG, summary: 'One run with its step log', params: runIdParam } },
    async (req, reply) => {
      const found = await getRun(req.tenantId, req.params.runId);
      if (!found) return reply.code(404).send({ error: 'not_found' });
      return found;
    },
  );

  app.post(
    '/v1/automation-runs/:runId/cancel',
    {
      schema: { tags: TAG, summary: 'Cancel a queued, running or waiting run', params: runIdParam },
    },
    async (req, reply) => {
      const ok = await cancelRun(req.tenantId, req.params.runId);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  // --- connections ------------------------------------------------------------------

  app.get(
    '/v1/automation-connections',
    { schema: { tags: TAG, summary: 'Workspace connections (secrets never returned)' } },
    async (req) => ({ data: await listConnections(req.tenantId) }),
  );

  app.post(
    '/v1/automation-connections',
    {
      schema: {
        tags: TAG,
        summary: 'Create or replace a connection',
        body: connectionSchema,
      },
    },
    async (req, reply) =>
      reply.code(201).send(
        await createConnection({
          tenantId: req.tenantId,
          name: req.body.name,
          pieceName: req.body.pieceName,
          secret: req.body.secret,
          metadata: req.body.metadata,
          createdBy: req.userId ?? null,
        }),
      ),
  );

  app.delete(
    '/v1/automation-connections/:id',
    { schema: { tags: TAG, summary: 'Delete a connection', params: idParam } },
    async (req, reply) => {
      const ok = await deleteConnection(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  /*
   * Scoped error handler.
   *
   * `NotFoundError` and `ConflictError` are plain `Error` subclasses in this codebase, so
   * the app-level handler renders them as `internal_error` — which tells the composer to
   * retry a publish that will never succeed. Mapping them here, where the meaning is
   * local, is the smallest correct fix.
   *
   * It repeats the app-level fallbacks rather than delegating: Fastify has no
   * "pass to the parent handler" primitive, and re-throwing inside an error handler is
   * not it.
   */
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
    if (isValidationError(err)) {
      return reply.code(400).send({ error: 'validation', issues: err.validation });
    }
    const client = asClientError(err);
    if (client) return reply.code(client.statusCode).send({ error: client.error });
    if (err instanceof DomainError && err.category === 'validation') {
      return reply.code(400).send({ error: 'validation', message: err.message });
    }
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    logger.error(
      { err: err instanceof Error ? err.message : String(err), url: req.url },
      'automation request error',
    );
    return reply.code(statusCode).send({ error: 'internal_error' });
  });
}
