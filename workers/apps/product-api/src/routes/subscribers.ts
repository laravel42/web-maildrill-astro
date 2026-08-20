import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
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
  ENGAGEMENT_BUCKETS,
  assignTag,
  countSubscribers,
  subscriberChannelCounts,
  deleteSubscriber,
  getList,
  getSegments,
  getSubscriberWithRelations,
  importSubscribers,
  listSubscribersKeysetWithRelations,
  listSubscribersWithRelations,
  segmentRuleError,
  subscriberActivity,
  subscriberLists,
  setSubscriberStatus,
  unassignTag,
  updateSubscriber,
  upsertSubscriber,
  type EngagementBucket,
  type SegmentFilter,
} from '@maildrill/product';

const statusEnum = z.enum(['active', 'unsubscribed', 'bounced', 'complained', 'invalid']);

/**
 * Open/click rate buckets, as five named slugs.
 *
 * Slugs rather than a `minRate`/`maxRate` pair because the stored value IS a
 * bucket — an equality predicate is what keeps the rollup's index able to serve
 * the roster's keyset order at the same time (see @maildrill/product/engagement).
 * `never` is separate from `none` on purpose: never mailed on a channel that
 * reports opens is a different fact from mailed and never opened, and the
 * roster's "—" has always shown them as the same thing.
 */
const bucketEnum = z.enum(ENGAGEMENT_BUCKETS);
const bucketParam = z.union([bucketEnum, z.array(bucketEnum).max(ENGAGEMENT_BUCKETS.length)]);

/**
 * Normalise a repeatable query param to an array, or undefined when absent.
 *
 * Deduped, because every one of these is an OR/IN list where a repeat means
 * nothing to the query but everything to the cursor: `?opens=high&opens=high`
 * fingerprints as `high,high`, so a cursor minted under it was refused against
 * plain `?opens=high` even though the two return byte-identical rows. Canonical
 * here means one shape per selection, everywhere downstream.
 */
function asArray<T>(v: T | T[] | undefined): T[] | undefined {
  if (v === undefined) return undefined;
  return [...new Set(Array.isArray(v) ? v : [v])];
}

const upsertSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(1).optional(),
  name: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
  status: statusEnum.optional(),
});

const importSchema = z.object({
  rows: z.array(upsertSchema).min(1).max(5000),
  /** Every imported subscriber joins these lists. */
  listIds: z.array(z.string().uuid()).max(50).optional(),
});

const patchSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: statusEnum.optional(),
  attributes: z.record(z.unknown()).optional(),
});

/**
 * Repeatable: `?status=active&status=bounced`, unioned.
 *
 * Scalar-only here while `/counts` took an array meant the roster's own island
 * — which appends `status` repeatably to both — got a 400 from the page and a
 * 200 from the counts the moment a second status was selected. The island
 * swallows page errors to avoid blanking the table, so multi-status silently
 * showed the previous single-status page under two lit-up chips.
 */
const statusParam = z.union([statusEnum, z.array(statusEnum).max(5)]);

const listQuery = z.object({
  status: statusParam.optional(),
  // Bounded, but not at PAGE.max: the deprecated offset path still serves
  // callers asking for 200, while the cursor path clamps rather than rejects
  // (see clampLimit) so an over-large request degrades to a page instead of a
  // 400 in the middle of someone's migration.
  limit: z.coerce.number().int().positive().max(200).optional(),
  /** @deprecated Selects the pre-keyset `{ data, total }` contract. */
  offset: z.coerce.number().int().nonnegative().optional(),
  /** Opaque keyset token from a previous page's `next_cursor`. */
  cursor: z.string().min(1).max(1024).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  channel: z.enum(['email', 'sms', 'whatsapp', 'voice']).optional(),
  // Repeatable: ?listId=a&listId=b. Bounded so a caller cannot build an
  // arbitrarily large IN list.
  listId: z.union([z.string().uuid(), z.array(z.string().uuid()).max(25)]).optional(),
  /** Repeatable: ?tag=vip&tag=trial. */
  tag: z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).max(25)]).optional(),
  /** Repeatable: ?segmentId=a&segmentId=b — the union of the saved segments. */
  segmentId: z.union([z.string().uuid(), z.array(z.string().uuid()).max(10)]).optional(),
  /** Repeatable: ?opens=high&opens=mid — the union of the open-rate buckets. */
  opens: bucketParam.optional(),
  /** Repeatable: ?clicks=none — the union of the click-rate buckets. */
  clicks: bucketParam.optional(),
  sort: z.enum(['name', 'email', 'status', 'created']).optional(),
  /** Numbered jump to a page never walked to. Sequential paging uses `cursor`. */
  page: z.coerce.number().int().positive().max(1_000_000).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  // A string, not z.coerce.boolean(): Boolean('0') is true, so coercion would
  // read `withTotal=0` as a request for the count.
  withTotal: z.string().optional(),
});

const idParam = z.object({ id: z.string().uuid() });
const tagParams = z.object({ id: z.string().uuid(), tagId: z.string().uuid() });

const TAG = ['Subscribers'];

/**
 * Turn `?segmentId=` into the rules the data layer filters on, or into the
 * error the caller gets instead of a page.
 *
 * A segment id that names nothing in this workspace answers 404, never an
 * unfiltered page: dropping the filter would hand back the whole roster under
 * a chip that says otherwise, which is the one outcome worse than an error.
 * "Not yours" and "not there" are the same 404 for the same reason
 * `GET /v1/segments/:id` gives — a distinguishable response would be an
 * existence oracle for other tenants' segments. It is 404 rather than 400
 * because the parameter is well-formed (zod already rejects a non-uuid); what
 * is missing is the thing it refers to.
 *
 * The rules are compiled-checked here too. `segments.rules` is loosely
 * validated jsonb, so a stored rule can name an op its field has no SQL for;
 * asking `segmentRuleError` first turns that into a 400 the caller can read
 * instead of a 500 thrown from inside the page query. Nothing is silently
 * dropped — a segment this endpoint cannot express in SQL is refused whole,
 * because a partially applied segment is a wrong answer wearing a right one.
 */
type SegmentResolution =
  | { error: { code: number; body: { error: string; message?: string } } }
  | {
      segments: SegmentFilter[];
      /** Sorted, so the same selection always fingerprints the same way. */
      ids: string[];
      /** Newest `updated_at` across them, for the cursor shape. */
      updatedAt: string | undefined;
    };

async function resolveSegments(
  tenantId: string,
  raw: string | string[] | undefined,
): Promise<SegmentResolution> {
  const ids = [...new Set(raw === undefined ? [] : Array.isArray(raw) ? raw : [raw])];
  if (ids.length === 0) return { segments: [], ids: [], updatedAt: undefined };

  const rows = await getSegments(tenantId, ids);
  if (rows.length !== ids.length) {
    const missing = ids.filter((id) => !rows.some((r) => r.id === id));
    return {
      error: { code: 404, body: { error: 'segment_not_found', message: missing.join(',') } },
    };
  }
  for (const row of rows) {
    for (const rule of row.rules ?? []) {
      const why = segmentRuleError(rule);
      if (why) {
        return {
          error: {
            code: 400,
            body: { error: 'unsupported_segment_rule', message: `segment ${row.id}: ${why}` },
          },
        };
      }
    }
  }
  return {
    segments: rows.map((r) => ({ rules: r.rules ?? [], matchType: r.matchType })),
    ids: [...ids].sort(),
    // Editing a segment mid-pagination changes which rows exist without
    // changing its id, so the id alone is not enough to invalidate a cursor.
    updatedAt: rows
      .map((r) => r.updatedAt?.toISOString() ?? '')
      .sort()
      .at(-1),
  };
}

export async function subscriberRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/subscribers',
    {
      schema: {
        tags: TAG,
        summary: 'Create or update a subscriber (upsert by email)',
        body: upsertSchema,
      },
    },
    async (req, reply) => {
      const sub = await upsertSubscriber({ tenantId: req.tenantId, ...req.body });
      return reply.code(201).send(sub);
    },
  );

  app.post(
    '/v1/subscribers/import',
    {
      schema: {
        tags: TAG,
        summary: 'Bulk import subscribers (upsert by email, optional list membership)',
        body: importSchema,
      },
    },
    async (req, reply) => {
      // Validate membership targets up front: a stray id would otherwise fail
      // silently per row, after some of the batch had already landed.
      const listIds = req.body.listIds ?? [];
      for (const listId of listIds) {
        if (!(await getList(req.tenantId, listId))) {
          return reply.code(400).send({ error: `list ${listId} not found` });
        }
      }
      return importSubscribers(req.tenantId, req.body.rows, listIds);
    },
  );

  app.get(
    '/v1/subscribers',
    {
      schema: {
        tags: TAG,
        summary: 'List subscribers (keyset-paginated)',
        description:
          'Returns { items, next_cursor, has_more }; pass next_cursor back as ?cursor= for the ' +
          'following page. `total` is included only with ?withTotal=1, because counting the ' +
          'filtered set is a full scan. Passing ?offset= without ?cursor= selects the ' +
          'deprecated { data, total } contract. ?segmentId= filters by a saved segment ' +
          '(repeatable, unioned); an id this workspace does not own is 404, never an ' +
          'unfiltered page. ?opens= / ?clicks= filter on the engagement rollup ' +
          '(never|none|low|mid|high, repeatable, unioned) — `never` means no delivery on a ' +
          'channel that reports engagement, which `none` (delivered, never engaged) does not.',
        querystring: listQuery,
      },
    },
    async (req, reply) => {
      const seg = await resolveSegments(req.tenantId, req.query.segmentId);
      if ('error' in seg) return reply.code(seg.error.code).send(seg.error.body);
      const filters = {
        statuses: asArray(req.query.status),
        q: req.query.q,
        channel: req.query.channel,
        listIds: asArray(req.query.listId),
        tagNames: asArray(req.query.tag),
        segments: seg.segments.length ? seg.segments : undefined,
        opensBuckets: asArray<EngagementBucket>(req.query.opens),
        clicksBuckets: asArray<EngagementBucket>(req.query.clicks),
      };

      // DEPRECATED: offset paging. Kept only so consumers that have not moved
      // to cursors keep working mid-migration — it re-counts the whole filtered
      // set on every request and its cost grows with depth (OFFSET 900000 reads
      // 900k rows). New callers must use `cursor`; this branch goes away once
      // the roster island and the CSV export are on it.
      if (req.query.cursor === undefined && req.query.offset !== undefined) {
        const opts = {
          ...filters,
          limit: req.query.limit,
          offset: req.query.offset,
          sort: req.query.sort,
          dir: req.query.dir,
        };
        const [data, total] = await Promise.all([
          listSubscribersWithRelations(req.tenantId, opts),
          countSubscribers(req.tenantId, opts),
        ]);
        return { data, total };
      }

      // Only `created` is a keyset-able order: it is the one covered by
      // subscribers_tenant_created_id_idx (and the status-filtered twin), in
      // both directions — a btree scans backwards for `asc`. Ordering by
      // name/email/status has no index under a tenant, so honouring it would
      // sort up to a million rows per page; rejecting it is louder than
      // quietly returning creation order under a different label. Clients that
      // want those orders sort the page they hold, which is what the roster
      // already does.
      const sort = req.query.sort ?? 'created';
      if (sort !== 'created') {
        return reply.code(400).send({
          error: 'unsupported_sort',
          message: `sort=${sort} is not available with cursor pagination; only sort=created is indexed`,
        });
      }
      const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
      const limit = clampLimit(req.query.limit ?? PAGE.default);

      // Everything that changes which rows come back, and in what order, is
      // bound into the cursor. A token from another filter or direction is then
      // rejected instead of resuming from a position that means nothing in the
      // new ordering.
      const shape = shapeOf({
        ...filters,
        // Sorted, so ?status=active&status=bounced and the reverse are one
        // cursor shape rather than two — the same rule the bucket sets follow.
        statuses: filters.statuses ? [...filters.statuses].sort().join(',') : undefined,
        listIds: filters.listIds?.join(',') ?? undefined,
        tagNames: filters.tagNames?.join(',') ?? undefined,
        // The ids say which segments; `segmentsAt` says which version of them.
        // Without the timestamp, editing a segment's rules mid-pagination would
        // leave outstanding cursors resuming from a row that no longer matches
        // — exactly the leak the shape exists to prevent.
        segments: undefined,
        segmentIds: seg.ids.length ? seg.ids.join(',') : undefined,
        segmentsAt: seg.updatedAt,
        // Sorted, so ?opens=high&opens=mid and ?opens=mid&opens=high are the
        // same cursor shape rather than two — and so a cursor minted under one
        // bucket selection is refused under another instead of resuming from a
        // row that is no longer in the set.
        opensBuckets: filters.opensBuckets ? [...filters.opensBuckets].sort().join(',') : undefined,
        clicksBuckets: filters.clicksBuckets
          ? [...filters.clicksBuckets].sort().join(',')
          : undefined,
        sort,
        dir,
      });
      const secret = config.auth.jwtSecret;
      // Throws CursorError (400 via the app error handler) on a malformed,
      // forged, cross-tenant or stale-shape token.
      const after = req.query.cursor
        ? decodeCursor(secret, req.query.cursor, { tenantId: req.tenantId, shape })
        : null;

      const rows = await listSubscribersKeysetWithRelations(req.tenantId, {
        ...filters,
        dir,
        limit: overFetch(limit),
        ...(after ? { after: { at: after.at, id: after.id } } : {}),
        // A jump pays the OFFSET cost once; the cursors it returns put the
        // user back on the O(1) path for Next/Previous.
        ...(!after && req.query.page && req.query.page > 1
          ? { offset: (req.query.page - 1) * limit }
          : {}),
      });
      const page = toCursorPage(rows, limit, (row) =>
        // row.cursorAt, not createdAt: the key has to survive the round trip at
        // the precision Postgres stores it (see the data layer's cursorAt).
        encodeCursor(secret, { at: row.cursorAt, id: row.id, t: req.tenantId, s: shape }),
      );
      // The resume key travels in the cursor, not on the row.
      const body = { ...page, items: page.items.map(({ cursorAt, ...row }) => row) };

      const wantsTotal = req.query.withTotal === '1' || req.query.withTotal === 'true';
      if (!wantsTotal) return body;
      return { ...body, total: await countSubscribers(req.tenantId, filters) };
    },
  );

  app.get(
    '/v1/subscribers/counts',
    {
      schema: {
        tags: TAG,
        summary: 'Per-channel reach counts for the current filters',
        description:
          'One scan for all four channels. The table fetches this once per filter set, ' +
          'not per page — the tab counts describe the workspace, not the page in hand. ' +
          'Honours ?segmentId=, ?opens=/?clicks=, ?status= and the rest, so a tab count ' +
          "and the list endpoint's ?withTotal=1 for the same channel are the same number. " +
          '`byStatus` deliberately ignores ?status= (a menu that counted only the selected ' +
          'status would report every other option as zero) but honours ?channel=, so the ' +
          'menu describes the tab it is on rather than the whole workspace.',
        querystring: z.object({
          status: statusParam.optional(),
          q: z.string().trim().min(1).max(200).optional(),
          /**
           * Which tab's status menu this is for. It scopes `byStatus` only —
           * the four channel totals stay channel-agnostic, because they ARE
           * the tabs and each one needs its own number from the same scan.
           */
          channel: z.enum(['email', 'sms', 'whatsapp', 'voice']).optional(),
          listId: z.union([z.string().uuid(), z.array(z.string().uuid()).max(25)]).optional(),
          tag: z
            .union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).max(25)])
            .optional(),
          segmentId: z.union([z.string().uuid(), z.array(z.string().uuid()).max(10)]).optional(),
          opens: bucketParam.optional(),
          clicks: bucketParam.optional(),
        }),
      },
    },
    async (req, reply) => {
      const seg = await resolveSegments(req.tenantId, req.query.segmentId);
      if ('error' in seg) return reply.code(seg.error.code).send(seg.error.body);
      return subscriberChannelCounts(req.tenantId, {
        statuses: asArray(req.query.status),
        q: req.query.q,
        channel: req.query.channel,
        listIds: asArray(req.query.listId),
        tagNames: asArray(req.query.tag),
        segments: seg.segments.length ? seg.segments : undefined,
        // Kept, like the segment and unlike the status filter: "don't zero your
        // own options" protects the status menu from the status filter, and a
        // rate bucket is an audience the user chose, so the tabs and the status
        // counts should describe it.
        opensBuckets: asArray<EngagementBucket>(req.query.opens),
        clicksBuckets: asArray<EngagementBucket>(req.query.clicks),
      });
    },
  );

  app.get(
    '/v1/subscribers/:id',
    { schema: { tags: TAG, summary: 'Get a subscriber', params: idParam } },
    async (req, reply) => {
      const sub = await getSubscriberWithRelations(req.tenantId, req.params.id);
      if (!sub) return reply.code(404).send({ error: 'not_found' });
      return sub;
    },
  );

  app.get(
    '/v1/subscribers/:id/lists',
    { schema: { tags: TAG, summary: 'Lists this subscriber belongs to', params: idParam } },
    async (req) => ({ data: await subscriberLists(req.tenantId, req.params.id) }),
  );

  app.get(
    '/v1/subscribers/:id/activity',
    { schema: { tags: TAG, summary: 'Subscriber engagement + recent activity', params: idParam } },
    async (req) => await subscriberActivity(req.tenantId, req.params.id),
  );

  app.patch(
    '/v1/subscribers/:id',
    { schema: { tags: TAG, summary: 'Update a subscriber', params: idParam, body: patchSchema } },
    async (req, reply) => {
      const sub = await updateSubscriber(req.tenantId, req.params.id, req.body);
      if (!sub) return reply.code(404).send({ error: 'not_found' });
      return sub;
    },
  );

  app.delete(
    '/v1/subscribers/:id',
    { schema: { tags: TAG, summary: 'Delete a subscriber', params: idParam } },
    async (req, reply) => {
      const ok = await deleteSubscriber(req.tenantId, req.params.id);
      return reply.code(ok ? 204 : 404).send();
    },
  );

  app.post(
    '/v1/subscribers/:id/unsubscribe',
    { schema: { tags: TAG, summary: 'Unsubscribe a subscriber', params: idParam } },
    async (req, reply) => {
      const sub = await setSubscriberStatus(req.tenantId, req.params.id, 'unsubscribed');
      if (!sub) return reply.code(404).send({ error: 'not_found' });
      return sub;
    },
  );

  app.post(
    '/v1/subscribers/:id/tags/:tagId',
    { schema: { tags: TAG, summary: 'Assign a tag to a subscriber', params: tagParams } },
    async (req, reply) => {
      await assignTag(req.tenantId, req.params.tagId, req.params.id);
      return reply.code(204).send();
    },
  );

  app.delete(
    '/v1/subscribers/:id/tags/:tagId',
    { schema: { tags: TAG, summary: 'Remove a tag from a subscriber', params: tagParams } },
    async (req, reply) => {
      await unassignTag(req.params.tagId, req.params.id);
      return reply.code(204).send();
    },
  );
}
