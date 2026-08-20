-- Channels a segment is meant to be used on. Defaults to email so existing
-- segments keep working alongside the email channel tab.
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL;
