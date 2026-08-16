-- Per-subscriber engagement rollup, so open/click rate is a filter the server
-- can answer instead of a string the browser re-parses out of ten fetched rows.
--
-- Why a separate table rather than columns on `subscribers`: that table carries
-- seven indexes (two of them trigram GINs) and was bulk-loaded with no page
-- free space, so a counter update there never goes HOT and rewrites all seven
-- index entries. Measured on the 1M-row tenant, 5,000 pipeline-shaped
-- increments: 1,667ms / 0 HOT updates against `subscribers`, versus 33ms /
-- 45% HOT against a narrow table at fillfactor 70. Columns would also move
-- `subscribers.updated_at` on every open, quietly turning the roster's
-- "Updated" column into "last opened an email".
--
-- A generated column is not an option at all: the value depends on `messages`,
-- and Postgres refuses a subquery in a generation expression.

-- One definition of the bucket boundaries, called by the incremental update in
-- the delivery pipeline, by the backfill and by the nightly reconcile. Three
-- hand-copied CASE expressions is three chances for them to drift, and a drift
-- here is a row that shows one rate and filters as another.
--
-- `round(...)` not integer division, because the roster prints
-- `Math.round(hits / tracked * 100)` and the filter has to agree with the
-- number on screen: truncation would file a row displaying "20%" under
-- "Under 20%".
--
-- SQL-language + immutable so the planner inlines it; a plpgsql function here
-- would be an opaque call per row in the backfill's 1M-row aggregate.
CREATE OR REPLACE FUNCTION engagement_bucket(hits integer, tracked integer)
RETURNS smallint
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    -- Never mailed on a channel that can report engagement is not the same
    -- fact as mailed and never engaged. The roster's "—" has always collapsed
    -- the two (586,477 people versus 272,986 on the perf tenant), which made
    -- the "None" bucket 68% padding.
    WHEN tracked <= 0 THEN (-1)::smallint
    WHEN hits <= 0 THEN 0::smallint
    WHEN round(hits::numeric * 100 / tracked) < 20 THEN 1::smallint
    WHEN round(hits::numeric * 100 / tracked) < 40 THEN 2::smallint
    ELSE 3::smallint
  END
$$;

CREATE TABLE IF NOT EXISTS "subscriber_engagement" (
  "subscriber_id"     uuid PRIMARY KEY REFERENCES "subscribers"("id") ON DELETE CASCADE,
  "tenant_id"         uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  -- `tenant_id` and `created_at` are denormalised copies of columns that never
  -- change for a subscriber. Carrying them is what lets ONE index answer both
  -- the bucket predicate and the roster's (created_at desc, id desc) keyset
  -- order. Without them the bucket filter degrades to walking `subscribers`
  -- until enough rows survive — 150,817 probes and 1.1s for a bucket holding
  -- 34 people, measured on the perf tenant.
  "created_at"        timestamptz NOT NULL,
  "delivered"         integer NOT NULL DEFAULT 0,
  "tracked_delivered" integer NOT NULL DEFAULT 0,
  "opened"            integer NOT NULL DEFAULT 0,
  "clicked"           integer NOT NULL DEFAULT 0,
  -- Bucket ordinals, not rates: the filter offers five discrete choices, and an
  -- equality predicate is what keeps `created_at` usable as the ordering suffix
  -- of the index. A stored rate would make every bucket a range scan and force
  -- a sort of the whole match set on every page.
  -- -1 = never mailed, 0 = none, 1 = under 20%, 2 = 20-40%, 3 = 40%+
  "opens_bucket"      smallint NOT NULL DEFAULT -1,
  "clicks_bucket"     smallint NOT NULL DEFAULT -1,
  "updated_at"        timestamptz NOT NULL DEFAULT now()
) WITH (fillfactor = 70);
-- fillfactor 70 leaves in-page room for the increment. At the default 100 not
-- one of 5,000 increments went HOT; at 70, 45% did.

-- Two indexes, each justified by a measured plan. They satisfy the bucket
-- equality AND the roster's keyset order in a single scan: page 1 of the
-- rarest bucket is 0.85ms / 61 buffers, against 1,122ms / 618,794 buffers for
-- the same page computed on the fly from `messages`.
CREATE INDEX IF NOT EXISTS "subscriber_engagement_opens_idx"
  ON "subscriber_engagement" ("tenant_id", "opens_bucket", "created_at" DESC, "subscriber_id" DESC);
CREATE INDEX IF NOT EXISTS "subscriber_engagement_clicks_idx"
  ON "subscriber_engagement" ("tenant_id", "clicks_bucket", "created_at" DESC, "subscriber_id" DESC);

-- Not part of the filter, and owed regardless of it: `messages.recipient_id`
-- had no index at all, so the backfill, the nightly reconcile and the
-- subscriber drawer's activity query each seq-scanned the whole table
-- (66ms / 250MB on the perf tenant, per drawer open).
CREATE INDEX IF NOT EXISTS "messages_recipient_idx" ON "messages" ("recipient_id");

-- PRODUCTION NOTE. Drizzle runs each migration inside a transaction, which
-- forbids CREATE INDEX CONCURRENTLY, so on a large live table build these three
-- out of band first and let the IF NOT EXISTS above no-op:
--
--   CREATE INDEX CONCURRENTLY subscriber_engagement_opens_idx  ON ...;
--   CREATE INDEX CONCURRENTLY subscriber_engagement_clicks_idx ON ...;
--   CREATE INDEX CONCURRENTLY messages_recipient_idx ON messages (recipient_id);
--
-- The rows themselves are NOT loaded here. A 1M-subscriber backfill inside the
-- migration transaction holds it open for the whole load and cannot resume from
-- a crash; `pnpm db:backfill:engagement` does it in bounded, restartable
-- batches instead. Until it runs, a subscriber with no rollup row simply
-- reports no engagement — the roster still pages, and the bucket filter returns
-- nothing rather than something wrong.
