import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import { channelSchema } from '@maildrill/domain';
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
  LIST_RATE_BUCKETS,
  LIST_SORTS,
  addToList,
  countLists,
  createList,
  deleteList,
  getList,
  getListWithStats,
  listAudienceOptions,
  listBoardFacets,
  listListOptions,
  listListsPage,
  listMembersOf,
  removeFromList,
  updateList,
  type ListRateBucket,
} from '@maildrill/product';

const TAG = ['Lists'];
const channelsSchema = z
  .array(z.enum(['email', 'sms', 'whatsapp', 'voice']))
  .min(1, 'pick at least one channel for this list');

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  channels: channelsSchema.optional(),
  notes: z.string().nullable().optional(),
  gdprConsent: z.boolean().optional(),
  doubleOptIn: z.boolean().optional(),
  doubleOptOut: z.boolean().optional(),
  doubleOptInTemplateId: z.string().uuid().nullable().optional(),
  doubleOptOutTemplateId: z.string().uuid().nullable().optional(),
  welcomeEmailTemplateId: z.string().uuid().nullable().optional(),
  goodbyeEmailTemplateId: z.string().uuid().nullable().optional(),
});
const idParam = z.object({ id: z.string().uuid() });
const memberParams = z.object({ id: z.string().uuid(), subscriberId: z.string().uuid() });
const memberBody = z.object({ subscriberId: z.string().uuid() });
const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const bucketEnum = z.enum(LIST_RATE_BUCKETS);
const bucketParam = z.union([bucketEnum, z.array(bucketEnum).max(LIST_RATE_BUCKETS.length)]);

const listBoardQuery = z.object({
  /** Bounded name/colour projection instead of the board's page. */
  options: z.string().optional(),
  /** Channel tab: lists declared for this channel. */
  channel: channelSchema.optional(),
  /** Repeatable: ?tag=vip&tag=beta — lists carrying any of them. */
  tag: z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).max(24)]).optional(),
  /** Token-prefix match on name, tags and "gdpr". */
  q: z.string().trim().min(1).max(200).optional(),
  /** Repeatable open-rate bands: ?opens=high&opens=mid. */
  opens: bucketParam.optional(),
  /** Repeatable click-rate bands. */
  clicks: bucketParam.optional(),
  sort: z.enum(LIST_SORTS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
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

export async function listRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/lists',
    { schema: { tags: TAG, summary: 'Create a list', body: createSchema } },
    async (req, reply) =>
      reply.code(201).send(await createList({ tenantId: req.tenantId, ...req.body })),
  );

  app.get(
    '/v1/lists/audience',
    {
      schema: {
        tags: TAG,
        summary: 'Lists as the campaign wizard picks them: name, colour, channels, reach',
        description:
          'One query, both member and phone-reach counts. Separate from /v1/lists because the ' +
          'picker renders none of that endpoint\'s growth, trend or engagement aggregates, and ' +
          'does need phone reach — which /v1/lists does not return, and which the wizard used ' +
          'to resolve with a segment preview per list.',
      },
    },
    async (req) => ({ data: await listAudienceOptions(req.tenantId) }),
  );

  app.get(
    '/v1/lists',
    {
      schema: {
        tags: TAG,
        summary: 'List lists (keyset-paginated)',
        description:
          'Returns { items, next_cursor, has_more }; pass next_cursor back as ?cursor= for the ' +
          'following page. `total` is included only with ?withTotal=1. Member counts, growth, ' +
          'the 7-point trend and the engagement counters are rolled up in SQL for the lists on ' +
          'the page only, so the cost of a page does not grow with the size of `list_members`. ' +
          'Sorting by subscribers/growthPct, or filtering by ?opens=/?clicks=, orders the whole ' +
          'workspace by an aggregate and so rolls up every membership once — ask for it only ' +
          'when you mean it. Pass ?options=1 for a bounded name/colour projection with no ' +
          'aggregates at all.',
        querystring: listBoardQuery,
      },
    },
    async (req, reply) => {
      if (req.query.options === '1' || req.query.options === 'true') {
        return {
          data: await listListOptions(req.tenantId, { q: req.query.q, limit: req.query.limit }),
        };
      }

      const sort = req.query.sort ?? 'updatedAt';
      const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
      const limit = clampLimit(req.query.limit ?? PAGE.default);
      const filters = {
        channel: req.query.channel,
        tags: asArray(req.query.tag),
        q: req.query.q,
        opens: asArray<ListRateBucket>(req.query.opens),
        clicks: asArray<ListRateBucket>(req.query.clicks),
      };

      // Everything that changes which rows come back, and in what order, is
      // bound into the cursor, so a token minted under one filter or sort is
      // refused rather than resuming from a position that means nothing in the
      // new ordering.
      const shape = shapeOf({
        ...filters,
        // Sorted, so ?tag=a&tag=b and ?tag=b&tag=a are one cursor shape.
        tags: filters.tags?.slice().sort().join(','),
        opens: filters.opens?.slice().sort().join(','),
        clicks: filters.clicks?.slice().sort().join(','),
        sort,
        dir,
      });

      // Only `updatedAt` is a timestamp, and a keyset cursor carries a
      // timestamp. The other sorts page by number instead — affordable here in
      // a way it is not on the roster, because `lists` is a small table and
      // OFFSET over it never touches `list_members`.
      if (req.query.cursor && sort !== 'updatedAt') {
        return reply.code(400).send({
          error: 'unsupported_cursor',
          message: `cursor pagination is only available with sort=updatedAt; use ?page= with sort=${sort}`,
        });
      }
      const after =
        req.query.cursor && sort === 'updatedAt'
          ? decodeCursor(config.auth.jwtSecret, req.query.cursor, {
              tenantId: req.tenantId,
              shape,
            })
          : null;

      const rows = await listListsPage(req.tenantId, {
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
      return { ...body, total: await countLists(req.tenantId, { ...filters, sort, dir }) };
    },
  );

  app.get(
    '/v1/lists/facets',
    {
      schema: {
        tags: TAG,
        summary: 'Per-channel list counts and the workspace tag menu',
        description:
          'One grouped read of `lists` — no membership or message data. The board fetches this ' +
          'once per workspace, not per page, so its tab counts and tag menu describe the ' +
          'workspace rather than the rows in hand.',
      },
    },
    async (req) => listBoardFacets(req.tenantId),
  );

  app.get(
    '/v1/lists/:id/stats',
    {
      schema: {
        tags: TAG,
        summary: 'One list with every stat the detail page renders',
        description:
          'The list row plus its membership counts, growth, 7-point trend, engagement counters, ' +
          'per-channel send totals across ALL of its campaigns, the start of its most recent ' +
          'send, and the three rollups over its whole membership the detail page draws from: ' +
          'the status partition behind the health bar, joins per week for the last 12 weeks, and ' +
          'per-custom-field fill counts. Scoped to one list, so it never aggregates the ' +
          'workspace — and one response, so every figure on the page comes from one snapshot of ' +
          'the roster rather than from a sample of it fetched separately.',
        params: idParam,
      },
    },
    async (req, reply) => {
      const row = await getListWithStats(req.tenantId, req.params.id);
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return row;
    },
  );

  app.get(
    '/v1/lists/:id',
    { schema: { tags: TAG, summary: 'Get a list', params: idParam } },
    async (req, reply) => {
      const list = await getList(req.tenantId, req.params.id);
      if (!list) return reply.code(404).send({ error: 'not_found' });
      return list;
    },
  );

  app.patch(
    '/v1/lists/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Update a list',
        params: idParam,
        body: createSchema.partial(),
      },
    },
    async (req, reply) => {
      const list = await updateList(req.tenantId, req.params.id, req.body);
      if (!list) return reply.code(404).send({ error: 'not_found' });
      return list;
    },
  );

  app.delete(
    '/v1/lists/:id',
    { schema: { tags: TAG, summary: 'Delete a list', params: idParam } },
    async (req, reply) => {
      const ok = await deleteList(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    '/v1/lists/:id/members',
    {
      schema: {
        tags: TAG,
        summary: 'Add a subscriber to a list',
        params: idParam,
        body: memberBody,
      },
    },
    async (req, reply) => {
      await addToList(req.tenantId, req.params.id, req.body.subscriberId);
      return reply.code(204).send();
    },
  );

  app.delete(
    '/v1/lists/:id/members/:subscriberId',
    { schema: { tags: TAG, summary: 'Remove a subscriber from a list', params: memberParams } },
    async (req, reply) => {
      await removeFromList(req.params.id, req.params.subscriberId);
      return reply.code(204).send();
    },
  );

  app.get(
    '/v1/lists/:id/members',
    {
      schema: { tags: TAG, summary: 'List list members', params: idParam, querystring: listQuery },
    },
    async (req) => ({
      data: await listMembersOf(req.tenantId, req.params.id, {
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    }),
  );
}
