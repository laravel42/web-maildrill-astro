-- Make the campaigns board's outcome rollup an index-only read, and give
-- `message_events` a route from a campaign to its events that does not go
-- through `messages`.
--
-- The board previously derived every counter from ONE whole-tenant aggregate
-- over `messages`, recomputed on every request — a parallel seq scan of all
-- 32,094 heap blocks (251 MB) to reduce 1,001,068 rows to 878 groups, of which
-- ten were rendered. `shared_buffers` is 128 MB, so it re-read ~29,000 blocks
-- from disk every single time. 97-118 ms today; ~1 s and ~2.5 GB of I/O per
-- call at 10M messages.

-- ---------------------------------------------------------------------------
-- 1. messages: the rollup's exact key, in the rollup's exact order
-- ---------------------------------------------------------------------------
-- Every counter is `count(*) filter (where status in (...))` grouped by
-- campaign within one tenant, so (tenant_id, campaign_id, status) IS the query.
-- With it Postgres never touches the heap, and the same index serves three
-- separate plans:
--
--   whole-tenant rollup      32,094 buffers / 97ms  ->    975 buffers / 85ms
--   page of 10 campaigns      9,035 buffers / 19ms  ->     23 buffers / 2.0ms
--   one campaign (drawer)     see getCampaign below ->      3 buffers / 0.01ms
--
-- Weighing the write cost, since `messages` is the largest table and takes
-- constant writes: `tenant_id` and `campaign_id` never change after insert, so
-- the only churn is `status`, which moves 5-7 times over a message's life.
-- That churn is not new — `messages_status_scheduled_idx (status, ...)` and
-- `messages_tenant_voice_idx (tenant_id, channel, status)` already carry
-- status, so every status update is already a non-HOT update rewriting every
-- index entry on the row. This adds one more 7.6 MB entry to a write that is
-- already touching eight indexes, and the DROP below removes one of them.
CREATE INDEX IF NOT EXISTS "messages_tenant_campaign_status_idx"
  ON "messages" ("tenant_id", "campaign_id", "status");

-- `messages_tenant_idx (tenant_id)` is now a strict prefix of the index above:
-- anything it could answer, the wider one answers from the same leading column.
-- Dropping it keeps the index count on this table unchanged, so the net cost of
-- this migration to the write path is zero — one 14 MB index out, one 7.6 MB
-- index in.
DROP INDEX IF EXISTS "messages_tenant_idx";

-- ---------------------------------------------------------------------------
-- 2. message_events: reach a campaign's events without joining `messages`
-- ---------------------------------------------------------------------------
-- Click, unsubscribe and complaint counts do not live in message status; they
-- are rows in `message_events`, which has no campaign_id and no tenant index.
-- The only path from a campaign to its events is `join messages`, and that join
-- can never be narrowed to the campaigns on screen — it is O(all tenant
-- events) whichever side drives it. Measured on a 2M-event table (2 events per
-- message, which is what this workspace's 1M messages will produce):
--
--   join messages, whole tenant   923 ms, 120,220 buffers, 94 MB spilled to temp
--   join messages, page-scoped     61 ms  -- WORSE than today: still scans all
--                                         -- events, then 1,065 pkey probes
--   this column + index below     6.7 ms, 254 buffers, 0 heap fetches
--
-- This is the one denormalisation on this path that is safe. A counter cached
-- on `campaigns` would be updated 5-7 times per recipient from a dozen call
-- sites, all onto a single tuple — 25,000+ serialised updates and a row lock
-- held against every concurrent delivery report for a 5,000-recipient send.
-- An event row is written once and never updated, so this column is set at
-- insert and is then immutable, exactly like the `message_id` beside it.
ALTER TABLE "message_events"
  ADD COLUMN IF NOT EXISTS "campaign_id" uuid
  REFERENCES "campaigns"("id") ON DELETE SET NULL;

-- Backfill from the message each event already points at. Cheap here (2,552
-- rows); on a large table this wants batching, but the column is nullable and
-- the readers treat NULL as "no campaign", so a partial backfill under-counts
-- rather than breaking.
UPDATE "message_events" e
   SET "campaign_id" = m."campaign_id"
  FROM "messages" m
 WHERE m."id" = e."message_id"
   AND e."campaign_id" IS DISTINCT FROM m."campaign_id";

-- `message_id` trails deliberately: these counters are
-- `count(distinct message_id)`, and with it in the index the scan already
-- emits (campaign, type, message) in order — the DISTINCT collapses in a
-- Unique node and the rollup runs with no sort at all.
CREATE INDEX IF NOT EXISTS "message_events_tenant_campaign_type_idx"
  ON "message_events" ("tenant_id", "campaign_id", "event_type", "message_id");
