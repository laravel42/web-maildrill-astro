-- Media library moves from the dropped Cloudflare R2 design to S3 + CloudFront.
-- The column is renamed rather than dropped so any existing keys survive; the
-- table is empty today, but a rename is the correct shape either way.
ALTER TABLE "media_assets" RENAME COLUMN "r2_key" TO "storage_key";
--> statement-breakpoint
-- Bytes rather than kilobytes: sizes are validated against an exact byte cap on
-- upload, and rounding to KB loses that precision.
ALTER TABLE "media_assets" RENAME COLUMN "size_kb" TO "size_bytes";
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "width" integer;
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "height" integer;
--> statement-breakpoint
-- One row per stored object, so a retried upload-confirm cannot double-register.
CREATE UNIQUE INDEX IF NOT EXISTS "media_assets_storage_key_uq" ON "media_assets" USING btree ("storage_key");
