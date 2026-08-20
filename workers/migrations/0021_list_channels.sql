-- Channels a list is meant to be used on. Defaults to email so existing lists
-- keep working: every subscriber has an email address, and email is the only
-- channel that needs no extra field on the subscriber.
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL;
