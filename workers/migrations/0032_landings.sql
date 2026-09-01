-- Landing pages (Builder42 sites). One row = one whole site document, not one
-- page: the editor's model is a site (`pages`, `pageOrder`, `homePageId`).
-- Integration notes: docs/landing-pages-builder-integration.md
--
-- Idempotent throughout so a hand-applied dev DB stays consistent.

CREATE TABLE IF NOT EXISTS "landings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  -- The BuilderSite JSON. Opaque here; the editor owns its shape and versions it
  -- through "schema_version" (mirrored from document.meta.version).
  "document" jsonb,
  "schema_version" integer,
  -- Publish identity: the slug the editor writes to document.meta.siteId on its
  -- first successful publish, mirrored here so it can be queried and kept unique.
  -- Deliberately NOT the row id: it becomes a public hostname label, so it must
  -- be readable, unique across tenants, and stable once links exist. Null until
  -- the landing is published.
  "site_id" text,
  "published_url" text,
  "published_at" timestamptz,
  -- Denormalised on every write so listing landings never has to read
  -- "document": Builder42 inlines images as data URLs, which puts a single row
  -- in the megabytes. "document_bytes" is also what the list uses to warn that a
  -- site has grown past the editor's own publish-size threshold.
  "page_count" integer NOT NULL DEFAULT 1,
  "document_bytes" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "landings_tenant_idx"
  ON "landings" ("tenant_id");
-- The list page reads one workspace most-recently-edited-first.
CREATE INDEX IF NOT EXISTS "landings_tenant_updated_idx"
  ON "landings" ("tenant_id", "updated_at");
-- A publish slug is a hostname label: unique across the whole install, not per
-- tenant. Partial so the many unpublished rows (site_id IS NULL) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS "landings_site_id_idx"
  ON "landings" ("site_id") WHERE "site_id" IS NOT NULL;
