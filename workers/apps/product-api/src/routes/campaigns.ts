import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { channelSchema, ConflictError, NotFoundError } from '@maildrill/domain';
import { authenticate } from '@maildrill/authz';
import { config } from '@maildrill/config';
import {
  PAGE,
  clampLimit,
  decodeCursor,
  encodeCursor,
  overFetch,
  shapeOf,
  toCursorPage,
  type ZodTypeProvider,
} from '@maildrill/httpkit';
import {
  CAMPAIGN_EVENT_KINDS,
  CAMPAIGN_RATE_BUCKETS,
  CAMPAIGN_SORTS,
  campaignBoardCounts,
  campaignMessageSummary,
  countCampaigns,
  createCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignEngagement,
  listCampaignMessagesPage,
  listCampaignsPage,
  sendCampaign,
  sendCampaignDraft,
  updateCampaign,
  type CampaignRateBucket,
} from '@maildrill/product';

const TAG = ['Campaigns'];
const idParam = z.object({ id: z.string().uuid() });

const campaignStatus = z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused']);
const bucketEnum = z.enum(CAMPAIGN_RATE_BUCKETS);
const bucketParam = z.union([bucketEnum, z.array(bucketEnum).max(CAMPAIGN_RATE_BUCKETS.length)]);

const listQuery = z.object({
  channel: channelSchema.optional(),
  /** Repeatable: ?status=sent&status=sending — the union of those statuses. */
  status: z.union([campaignStatus, z.array(campaignStatus).max(8)]).optional(),
  /** Campaigns targeting one list, for the list detail page. */
  listId: z.string().uuid().optional(),
  /** Case-insensitive match on campaign name or audience label. */
  q: z.string().trim().min(1).max(200).optional(),
  /** Only campaigns updated at or before this ISO moment — a history window. */
  updatedBefore: z.coerce.date().optional(),
  /** Repeatable open-rate bands: ?opens=high&opens=mid. */
  opens: bucketParam.optional(),
  /** Repeatable click-rate bands. */
  clicks: bucketParam.optional(),
  sort: z.enum(CAMPAIGN_SORTS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  /** Opaque keyset token from a previous page's `next_cursor`. */
  cursor: z.string().min(1).max(1024).optional(),
  /** Numbered jump to a page never walked to. Sequential paging uses `cursor`. */
  page: z.coerce.number().int().positive().max(100_000).optional(),
  // A string, not z.coerce.boolean(): Boolean('0') is true, so coercion would
  // read `withTotal=0` as a request for the count.
  withTotal: z.string().optional(),
});

/** Normalise a repeatable query param to an array, or undefined when absent. */
function asArray<T>(v: T | T[] | undefined): T[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}
const createSchema = z.object({
  name: z.string().min(1),
  channel: channelSchema.optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused']).optional(),
  listId: z.string().uuid().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  content: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});

const sendSchema = z
  .object({
    name: z.string().optional(),
    channel: channelSchema,
    listId: z.string().uuid().optional(),
    segmentId: z.string().uuid().optional(),
    subscriberIds: z.array(z.string().uuid()).optional(),
    templateId: z.string().uuid().optional(),
    content: z.record(z.unknown()).optional(),
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((v) => v.listId || v.segmentId || v.subscriberIds?.length, {
    message: 'one of listId, segmentId, or subscriberIds is required',
  })
  .refine((v) => v.templateId || v.content, {
    message: 'templateId or content is required',
  });

export async function campaignRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/campaigns/send',
    {
      schema: {
        tags: ['Campaigns'],
        summary: 'Resolve an audience and submit a campaign to the messaging engine',
        body: sendSchema,
      },
    },
    async (req, reply) => {
      const result = await sendCampaign({
        tenantId: req.tenantId,
        name: req.body.name,
        channel: req.body.channel,
        selector: {
          listId: req.body.listId,
          segmentId: req.body.segmentId,
          subscriberIds: req.body.subscriberIds,
        },
        templateId: req.body.templateId,
        content: req.body.content,
        scheduledAt: req.body.scheduledAt ?? null,
      });
      return reply.code(202).send(result);
    },
  );

  // Send a saved draft in place. Separate from /v1/campaigns/send because that
  // route always creates a new campaign; this one sends the draft the user has
  // been editing, which is what the app's "Send now" button needs.
  app.post(
    '/v1/campaigns/:id/send',
    {
      schema: {
        tags: TAG,
        summary: 'Send an existing campaign draft using its saved audience and content',
        params: idParam,
        body: z.object({ sendNow: z.boolean().optional() }).optional(),
      },
    },
    async (req, reply) => {
      try {
        const result = await sendCampaignDraft(
          req.tenantId,
          req.params.id,
          req.body?.sendNow ? null : undefined,
        );
        return reply.code(202).send(result);
      } catch (err) {
        // A draft that is missing, already sending, or has nothing to send is a
        // client-correctable state — surface it instead of a blank 500.
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: 'not_found', message: err.message });
        }
        if (err instanceof ConflictError) {
          return reply.code(409).send({ error: 'conflict', message: err.message });
        }
        throw err;
      }
    },
  );

  // ---- Campaign drafts (CRUD) --------------------------------------------

  app.post(
    '/v1/campaigns',
    { schema: { tags: TAG, summary: 'Create a campaign draft', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(
        await createCampaign({
          tenantId: req.tenantId,
          ...req.body,
          scheduledAt: req.body.scheduledAt ?? null,
        }),
      ),
  );

  app.get(
    '/v1/campaigns',
    {
      schema: {
        tags: TAG,
        summary: 'List campaigns (keyset-paginated)',
        description:
          'Returns { items, next_cursor, has_more }; pass next_cursor back as ?cursor= for the ' +
          'following page. `total` is included only with ?withTotal=1. Outcome counters are ' +
          'rolled up in SQL for the campaigns on the page only, so the cost of a page does not ' +
          'grow with the size of `messages`. Sorting by recipients/failed/openRate/clickRate, ' +
          'or filtering by ?opens=/?clicks=, orders the whole workspace by an aggregate and so ' +
          'rolls up every message once — ask for it only when you mean it.',
        querystring: listQuery,
      },
    },
    async (req, reply) => {
      const sort = req.query.sort ?? 'updatedAt';
      const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
      const limit = clampLimit(req.query.limit ?? PAGE.default);
      const filters = {
        channel: req.query.channel,
        statuses: asArray(req.query.status),
        listId: req.query.listId,
        q: req.query.q,
        updatedBefore: req.query.updatedBefore,
        opens: asArray<CampaignRateBucket>(req.query.opens),
        clicks: asArray<CampaignRateBucket>(req.query.clicks),
      };

      // Everything that changes which rows come back, and in what order, is
      // bound into the cursor, so a token minted under one filter or sort is
      // refused rather than resuming from a position that means nothing in the
      // new ordering.
      const shape = shapeOf({
        ...filters,
        statuses: filters.statuses?.slice().sort().join(','),
        // Part of the shape: it changes which rows the cursor is walking.
        updatedBefore: filters.updatedBefore?.toISOString(),
        // Sorted, so ?opens=low&opens=mid and ?opens=mid&opens=low are one
        // cursor shape rather than two.
        opens: filters.opens?.slice().sort().join(','),
        clicks: filters.clicks?.slice().sort().join(','),
        sort,
        dir,
      });

      // Only `updatedAt` is a timestamp, and a keyset cursor carries a
      // timestamp. The other sorts page by number instead — affordable here in
      // a way it is not on the roster, because `campaigns` is a small table
      // (a workspace has thousands, not millions) and OFFSET over it never
      // touches `messages`.
      const after =
        req.query.cursor && sort === 'updatedAt'
          ? decodeCursor(config.auth.jwtSecret, req.query.cursor, {
              tenantId: req.tenantId,
              shape,
            })
          : null;
      if (req.query.cursor && sort !== 'updatedAt') {
        return reply.code(400).send({
          error: 'unsupported_cursor',
          message: `cursor pagination is only available with sort=updatedAt; use ?page= with sort=${sort}`,
        });
      }

      const rows = await listCampaignsPage(req.tenantId, {
        ...filters,
        sort,
        dir,
        limit: overFetch(limit),
        ...(after ? { after: { at: after.at, id: after.id } } : {}),
        // A jump pays the OFFSET cost once; the cursor it returns puts the
        // caller back on the keyset path for Next.
        ...(!after && req.query.page && req.query.page > 1
          ? { offset: (req.query.page - 1) * limit }
          : {}),
      });

      const page = toCursorPage(rows, limit, (row) =>
        // row.cursorAt, not updatedAt: the key has to survive the round trip at
        // the precision Postgres stores it.
        encodeCursor(config.auth.jwtSecret, {
          at: row.cursorAt,
          id: row.id,
          t: req.tenantId,
          s: shape,
        }),
      );
      const body = { ...page, items: page.items.map(({ cursorAt: _c, ...row }) => row) };

      const wantsTotal = req.query.withTotal === '1' || req.query.withTotal === 'true';
      if (!wantsTotal) return body;
      return { ...body, total: await countCampaigns(req.tenantId, { ...filters, sort, dir }) };
    },
  );

  app.get(
    '/v1/campaigns/counts',
    {
      schema: {
        tags: TAG,
        summary: 'Per-channel and per-status campaign counts',
        description:
          'One grouped read of `campaigns` — no message data. The board fetches this once per ' +
          'channel, not per page, so its tab and status counts describe the workspace rather ' +
          'than the ten rows in hand.',
        querystring: z.object({ channel: channelSchema.optional() }),
      },
    },
    async (req) => campaignBoardCounts(req.tenantId, { channel: req.query.channel }),
  );

  app.get(
    '/v1/campaigns/:id',
    { schema: { tags: TAG, summary: 'Get a campaign', params: idParam } },
    async (req, reply) => {
      const campaign = await getCampaign(req.tenantId, req.params.id);
      if (!campaign) return reply.code(404).send({ error: 'not_found' });
      return campaign;
    },
  );

  app.get(
    '/v1/campaigns/:id/messages',
    {
      schema: {
        tags: TAG,
        summary: 'Per-recipient message outcomes for a campaign report (keyset-paginated)',
        description:
          'Returns { items, next_cursor, has_more }; pass next_cursor back as ?cursor= for the ' +
          'following page. ?kind= narrows to one report event tab IN SQL, so the rows and the ' +
          'per-tab counts from /messages/counts always describe the same set — this used to ' +
          'return an uncapped-looking 200-row sample that the browser then filtered and ' +
          'counted, which made every tab on a campaign over 200 recipients report the sample. ' +
          'The campaign id and the kind are both bound into the cursor, so a token cannot be ' +
          'replayed against another campaign or another tab.',
        params: idParam,
        querystring: z.object({
          limit: z.coerce.number().int().positive().max(100).optional(),
          /** Opaque keyset token from a previous page's `next_cursor`. */
          cursor: z.string().min(1).max(1024).optional(),
          /** Numbered jump to a page never walked to. Sequential paging uses `cursor`. */
          page: z.coerce.number().int().positive().max(100_000).optional(),
          kind: z.enum(CAMPAIGN_EVENT_KINDS).optional(),
        }),
      },
    },
    async (req, reply) => {
      const limit = clampLimit(req.query.limit ?? PAGE.default);
      // The campaign is part of the shape, not just the path: without it a
      // cursor minted on one report would resume another one's rows.
      const shape = shapeOf({ campaignId: req.params.id, kind: req.query.kind });
      // Throws CursorError (400 via the app error handler) on a malformed,
      // forged, cross-tenant or stale-shape token.
      const after = req.query.cursor
        ? decodeCursor(config.auth.jwtSecret, req.query.cursor, {
            tenantId: req.tenantId,
            shape,
          })
        : null;

      try {
        const rows = await listCampaignMessagesPage(req.tenantId, req.params.id, {
          kind: req.query.kind,
          limit: overFetch(limit),
          ...(after ? { after: { at: after.at, id: after.id } } : {}),
          // A numbered jump resolves its start position in SQL and comes back
          // with a cursor, so Next from there is an ordinary keyset page.
          ...(!after && req.query.page && req.query.page > 1
            ? { offset: (req.query.page - 1) * limit }
            : {}),
        });
        const page = toCursorPage(rows, limit, (row) =>
          // row.cursorAt, not `at`: the key has to survive the round trip at
          // the precision Postgres stores it (see the data layer's cursorAt).
          encodeCursor(config.auth.jwtSecret, {
            at: row.cursorAt,
            id: row.id,
            t: req.tenantId,
            s: shape,
          }),
        );
        // The resume key travels in the cursor, not on the row.
        return { ...page, items: page.items.map(({ cursorAt: _c, ...row }) => row) };
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: 'not_found', message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    '/v1/campaigns/:id/messages/counts',
    {
      schema: {
        tags: TAG,
        summary: 'Per-tab recipient-event counts and rate series for a campaign report',
        description:
          "One grouped scan of the campaign's messages. The report fetches this once per " +
          'campaign, never per page, so its event tabs describe the campaign rather than the ' +
          'ten rows in hand. `byKind` partitions the campaign — furthest stage wins, so a ' +
          'message that was read counts under opened/seen and not also under delivered — and ' +
          'sums to `total`. `series` is the same scan bucketed over time, cumulative, for the ' +
          'rate-card sparks.',
        params: idParam,
      },
    },
    async (req, reply) => {
      try {
        return await campaignMessageSummary(req.tenantId, req.params.id);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: 'not_found', message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    '/v1/campaigns/:id/engagement',
    {
      schema: {
        tags: TAG,
        summary: 'Device and top-link breakdown from Infobip tracking events',
        params: idParam,
      },
    },
    async (req, reply) => {
      const campaign = await getCampaign(req.tenantId, req.params.id);
      if (!campaign) return reply.code(404).send({ error: 'not_found' });
      return getCampaignEngagement(req.tenantId, req.params.id);
    },
  );

  app.patch(
    '/v1/campaigns/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Update a campaign draft',
        params: idParam,
        body: createSchema.partial(),
      },
    },
    async (req, reply) => {
      const campaign = await updateCampaign(req.tenantId, req.params.id, req.body);
      if (!campaign) return reply.code(404).send({ error: 'not_found' });
      return campaign;
    },
  );

  app.delete(
    '/v1/campaigns/:id',
    { schema: { tags: TAG, summary: 'Delete a campaign', params: idParam } },
    async (req, reply) => {
      const ok = await deleteCampaign(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );
}
