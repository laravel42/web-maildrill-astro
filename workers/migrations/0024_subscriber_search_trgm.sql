-- Indexable substring search on subscribers.
--
-- The search predicate is unanchored infix LIKE on two columns, which no btree
-- can serve: the planner fell back to walking the keyset index and discarding
-- rows, reading ~359k buffers and 534ms for a single page on a 1M-row tenant
-- (measured; "Rows Removed by Filter: 356,449").
--
-- Trigram GIN indexes on the same lower() expressions the predicate uses. Two
-- separate indexes rather than one combined expression so the planner can
-- BitmapOr them for the `email OR name` shape, and still use just one when a
-- future caller searches a single column.
--
-- Cost of this choice: GIN is expensive to write compared with btree, and these
-- add two index updates per subscriber insert/update. That is the right trade
-- here — subscriber writes are bulk imports and occasional edits, while search
-- is interactive and currently fires on every keystroke.
--
-- Production note: these should be built with CREATE INDEX CONCURRENTLY to
-- avoid holding a write lock on a large table. Drizzle runs each migration
-- inside a transaction, which forbids CONCURRENTLY, so on a large production
-- table build them out-of-band instead and let this migration no-op via
-- IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "subscribers_email_trgm_idx"
  ON "subscribers" USING gin (lower("email") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "subscribers_name_trgm_idx"
  ON "subscribers" USING gin (lower(coalesce("name", '')) gin_trgm_ops);
