-- Keyset pagination support for subscribers.
--
-- Before this, `order by created_at desc` under a tenant had no usable index:
-- Postgres parallel-seq-scanned the table and spilled a 66MB external merge
-- sort to disk for a deep page. These indexes match the two real query shapes
-- exactly, including sort direction, so the planner can walk them and stop at
-- LIMIT with no sort at all.
--
-- CONCURRENTLY so a large production table keeps taking writes while they
-- build. Drizzle runs migrations inside a transaction, which CONCURRENTLY
-- forbids, so these are guarded for re-runnability and must be applied outside
-- that transaction (see db:index:concurrent).
CREATE INDEX IF NOT EXISTS "subscribers_tenant_created_id_idx"
  ON "subscribers" ("tenant_id", "created_at" DESC, "id" DESC);

-- Status is low-cardinality but very commonly filtered (the table's tabs), and
-- leading with tenant keeps it usable for the unfiltered case too.
CREATE INDEX IF NOT EXISTS "subscribers_tenant_status_created_id_idx"
  ON "subscribers" ("tenant_id", "status", "created_at" DESC, "id" DESC);
