-- 250×250 cover twin stored alongside the original for Grid/List previews.
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "thumb_storage_key" text;
