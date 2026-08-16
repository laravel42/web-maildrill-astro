-- Two index corrections, both measured on the 1M-subscriber perf tenant.

-- 1. The bucket indexes carried a `created_at DESC, subscriber_id DESC` suffix
--    that 0025 justified as letting one index answer the bucket predicate and
--    the roster's keyset order together. It does not, and cannot: the ORDER BY
--    is on `subscribers.created_at`, and Postgres has no way to prove the
--    rollup's denormalised copy equals it, so every rollup-driven plan sorts
--    anyway — `Sort Method: top-N heapsort` shows up in each one.
--
--    Worse, the dead suffix pushed `subscriber_id` to the fourth position,
--    which is exactly where the big-bucket plan needs it: that plan drives from
--    `subscribers` and probes the rollup by id, so with the wide index the
--    planner had to fall back to `subscriber_engagement_pkey` and visit the
--    heap for `opens_bucket`. Leading with (tenant_id, bucket, subscriber_id)
--    turns that probe into an index-only scan.
--
--    Measured, same queries, warm cache, EXPLAIN (ANALYZE, BUFFERS):
--
--      opens=high page 1   wide: NL -> subscriber_engagement_pkey, heap fetch
--                                325 buffers, 7.94ms
--                          narrow: NL -> Index Only Scan, Heap Fetches: 1
--                                263 buffers, 3.10ms
--      opens=mid page 1    wide: 143 buffers, top-N heapsort
--                          narrow: 137 buffers, top-N heapsort  (same shape —
--                                which is the proof the suffix bought nothing)
--
--    Size: 91MB + 94MB -> 56MB + 56MB. 73MB back for a faster plan.
DROP INDEX IF EXISTS "subscriber_engagement_opens_idx";
DROP INDEX IF EXISTS "subscriber_engagement_clicks_idx";
CREATE INDEX IF NOT EXISTS "subscriber_engagement_opens_idx"
  ON "subscriber_engagement" ("tenant_id", "opens_bucket", "subscriber_id");
CREATE INDEX IF NOT EXISTS "subscriber_engagement_clicks_idx"
  ON "subscriber_engagement" ("tenant_id", "clicks_bucket", "subscriber_id");

-- 2. `subscribers_tenant_status_idx` (tenant_id, status) is a strict column
--    prefix of `subscribers_tenant_status_created_id_idx`
--    (tenant_id, status, created_at DESC, id DESC), which migration 0023 added
--    beside it without removing it. Any lookup the narrow one serves, the wide
--    one serves from the same leading columns. 0026 applied precisely this
--    argument to drop `messages_tenant_idx`; 0023 did not apply it to the index
--    it superseded. 13MB, and one more index every subscriber write maintains.
DROP INDEX IF EXISTS "subscribers_tenant_status_idx";

-- PRODUCTION NOTE. Same constraint as 0025: migrations run in a transaction, so
-- CREATE INDEX CONCURRENTLY is not available here. On a large live table build
-- the two replacements out of band first and let the IF NOT EXISTS no-op, then
-- run this migration to drop the old ones:
--
--   CREATE INDEX CONCURRENTLY subscriber_engagement_opens_idx
--     ON subscriber_engagement (tenant_id, opens_bucket, subscriber_id);
--   CREATE INDEX CONCURRENTLY subscriber_engagement_clicks_idx
--     ON subscriber_engagement (tenant_id, clicks_bucket, subscriber_id);
--
-- The DROPs are metadata-only and safe to run online.
