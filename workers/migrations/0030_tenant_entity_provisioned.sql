-- Records that Infobip actually acknowledged this workspace's entity.
--
-- `infobip_entity_id` alone cannot say so: it is written unconditionally at
-- workspace creation, before the remote call, so a row looks provisioned even
-- when `POST /provisioning/1/entities` was refused. Null here means "id
-- assigned locally, never confirmed by the provider" — the state that made a
-- scope-less API key look like a successful signup.
--
-- Idempotent so a hand-applied dev DB stays consistent.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "infobip_entity_provisioned_at" timestamptz;
