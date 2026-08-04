# Maildrill — Data & Delivery Architecture

**Status:** Decided · **Owner:** Platform · **Last updated:** 2026-07-19

> **Delivery path update (2026-07):** Infobip delivery/engagement/voice notify targets
> **PostHog Hog** in production. Product message outcomes and campaign completion come
> from the **campaign-delivery** HogQL poller writing back to Postgres — not live
> Infobip→Maildrill webhooks. See [`../HANDOFF.md`](../HANDOFF.md) and
> [`posthog-infobip-hog.md`](./posthog-infobip-hog.md). Diagrams below that show
> webhooks → Worker → `message_events` describe the legacy/mock path still in code.

## Decision

> **Postgres is the system of record for all Maildrill data. Infobip is a stateless
> delivery gateway** — used only to _send_ (email / SMS / WhatsApp / voice), verify
> sending domains, and emit delivery notify payloads (to PostHog). **No domain data
> is stored in the Infobip portal.**

This reverses the earlier "store as much as possible in Infobip" draft. Backend stack **(as
built)**: **Fastify (Node) apps on a dedicated VPS** → **Postgres** (Laravel monolith and
Cloudflare Workers both dropped). The schema below is implemented in
[`packages/database/src/schema.ts`](../packages/database/src/schema.ts) — canonical.

### Why (settled empirically against the live account, 2026-07-18/19)

- **Entity isolation is not a data boundary.** Probing `nmnymj.api.infobip.com`:
  `/people/2/persons` exists (`403`), `/people/default/persons` → **`404` not found**. The
  path segment is an **API version**, not an app/entity slot. An entity rides on the
  **token**, never the URL.
- **Per-entity contact isolation ("People with X") is Early Access** and _cannot_ insert
  profiles via the public People API (account-manager + Embeddable iFrame only).
- **Sub-account creation is not a public API** (only list/update), so "workspace = Infobip
  sub-account" can't be self-serve.
- **Campaigns can't be authored via API** — Moments only adds _participants_ to a
  portal-created flow.
- On top of all that, the account's key returns `403 Unauthorized` on `/account`,
  `/provisioning`, and `/people` regardless — so even the emulated approach was blocked.

Net: Infobip-as-datastore is partly EA-gated, fights multi-tenancy, and adds provisioning
that isn't public API. Postgres removes every one of those problems.

---

## Architecture

```
Fastify apps on a VPS (messaging :3002 · product :3001 · workers)
        │
        ├──────────────► Postgres  ── SYSTEM OF RECORD (shared schema, tenant_id)
        │                            tenants, users, memberships, subscribers, lists,
        │                            segments, templates, campaigns, message_events, …
        │
        ├── at send time ─► Infobip  ── DELIVERY GATEWAY (stateless w.r.t. our data)
        │                            POST /email/3/send · /sms/* · Messages API
        │
        └── R2 ──────────► media assets (blobs); Postgres holds the metadata index
Infobip ── delivery/open/click webhook ──► Worker ──► writes message_events to Postgres
```

- **Tenancy** is a Postgres concern: every row carries `tenant_id` (== a _workspace_;
  implemented as the `tenants` table), isolated at the query/API layer. **Postgres RLS is
  optional** defense-in-depth; **schema-per-tenant was considered and rejected.** No Infobip
  sub-accounts or entities are required for isolation.
- **Infobip stays a single account.** A per-workspace **Entity** (`entityId`) is _optional_
  and only worth it for per-workspace **billing-usage / metrics** tagging on sends — never
  for data. If used, pass `platform:{applicationId:"default", entityId:"<workspace>"}` on
  send calls; it does not change where data lives.
- **Postgres host:** a **dedicated VPS** (self-managed), co-located with the Fastify apps
  and Redis/Valkey.

---

## Postgres schema (system of record)

Tables map to the domain entities; **canonical schema: [`packages/database/src/schema.ts`](../packages/database/src/schema.ts).**
This sketch is the design rationale — minor deltas in the build: the workspace table is
`tenants`, `campaign_recipients` is derived from `message_events`, and `infobip_binding` /
`usage` are minimal. Sketch:

| Table                 | Key columns                                                                                                    | Notes                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `workspaces`          | id, name, slug, timezone, plan, quota_json, branding_json, feature_flags_json                                  | the tenant                                      |
| `users`               | id, email, name                                                                                                | platform identity                               |
| `memberships`         | tenant_id, user_id, role (`owner\|editor\|viewer`)                                                             | RBAC + `role_perms`                             |
| `subscribers`         | id, tenant_id, email, name, status (`active\|unsubscribed\|bounced`), custom_json, created_at, updated_at      | the CDP — **in Postgres**                       |
| `custom_field_defs`   | tenant_id, name, type                                                                                          | drives `subscribers.custom_json`                |
| `lists`               | id, tenant_id, name, description, color                                                                        | first-class here (Infobip has no "list")        |
| `list_members`        | list_id, subscriber_id                                                                                         | membership                                      |
| `segments`            | id, tenant_id, name, match_type (`all\|any`), rules_json                                                       | evaluated in SQL                                |
| `templates`           | id, tenant_id, name, channel, subject, preheader, html, builder_doc_json, category, favorite                   | builder doc lives here; `html` compiled on save |
| `campaigns`           | id, tenant_id, name, channel, status, audience_json, scheduled_at, content_json, infobip_bulk_id, metrics_json | full lifecycle in Postgres                      |
| `campaign_recipients` | campaign_id, subscriber_id, status, delivered_at, opened_at, clicked_at                                        | or derive from `message_events`                 |
| `message_events`      | id, tenant_id, campaign_id, subscriber_id, type, ts, meta_json                                                 | **written from Infobip webhooks**               |
| `media_assets`        | id, tenant_id, r2_key, name, folder, tags, size_kb, type                                                       | blob in R2, row here                            |
| `suppressions`        | tenant_id, address, channel, reason                                                                            | unsubscribe/GDPR/bounce                         |
| `sending_domains`     | tenant_id, domain, dkim_status, infobip_domain_ref                                                             | mirrors Infobip domain state                    |
| `infobip_binding`     | tenant_id, application_id, entity_id (nullable), api_key_ref                                                   | only if using Entity tagging                    |
| `usage` / `billing`   | tenant_id, period, channel, used, stripe_*                                                                     | plan quotas, Stripe/Cashier-free                |

---

## Infobip binding (delivery only)

The **only** Infobip calls Maildrill makes. All are stateless w.r.t. our data — recipients
and content are passed in per request; the source of truth is Postgres.

| Maildrill action               | Infobip endpoint (as built)                         | Correlation                                                  |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------------------------ |
| Send email                     | `POST /email/4/messages` (see `packages/providers`) | `callbackData = {tenantId}\|{channel}\|{maildrillMessageId}` |
| Send SMS / WhatsApp / Voice    | channel Messages APIs                               | same `callbackData`                                          |
| Verify sending domain / DKIM   | Email Domain / Resource Management API              | write status → `sending_domains`                             |
| Delivery / seen / voice (prod) | Infobip notify → **PostHog Hog** (`?kind=…`)        | HogQL poller → Postgres messages + campaign `sent`           |
| Template status (analytics)    | Infobip notify → PostHog `?kind=template`           | —                                                            |
| WA template approval (product) | Worker polls Infobip template list                  | updates Postgres template rows                               |

Recipients for a send come straight from a Postgres query (`list_members` / `segments`);
Infobip never persists them. Suppression is enforced **in Postgres** before the send call.

> **As built:** the messaging engine sends **one message per recipient** (each with its own
> state / retry / idempotency), not a single bulk `to[]` call — see ARCHITECTURE.md /
> [`../HANDOFF.md`](../HANDOFF.md). A batched multi-destination path is deferred.
> Legacy Maildrill `/webhooks/infobip/*` routes remain for mock/tests only.

---

## End-to-end — send an email campaign

```
1. Author campaign + audience              → Postgres (campaigns, lists/segments)
2. Compile template builder_doc → html     → Postgres (templates)
3. Resolve recipients (minus suppressions) → SQL query
4. Provider send per recipient + callbackData → Infobip
5. Campaign stays `sending`                → Postgres
6. Infobip DLR → PostHog Hog               → events
7. campaign-delivery HogQL poller          → message outcomes + campaign `sent`
8. Analytics (`/v1/stats/activity`)        → PostHog HogQL (Postgres fallback)
```

---

## Open questions

1. ~~**Postgres host**~~ — **Resolved: dedicated VPS** (self-managed).
2. ~~**Tenant isolation**~~ — **Resolved: shared schema + `tenant_id`** (RLS optional;
   schema-per-tenant rejected).
3. **Entity tagging** — per-workspace `entityId` on sends for billing/metrics attribution,
   or skip it and attribute cost in Postgres from send logs? _(Open.)_
4. **Infobip Journeys/Moments?** Only if we need automated multi-step flows — the one case
   that would pull contacts into Infobip People. Revisit if required. _(Open.)_

---

## Appendix — verified Infobip endpoints still in use

```
Email     POST /email/3/send
SMS       POST /sms/2/text/advanced   (or /sms/3/messages)
Messages  single-endpoint send (platform{applicationId,entityId}, failover, scheduling)
Domains   Email Domain / Resource Management API
Reports   delivery/seen reports via notifyUrl webhook or pull
Billing   Billing Usage API (query-billing-usage) · Metrics API (query-aggregate-data)  — optional
```

Canonical schema: `packages/database/src/schema.ts`. Product entity types and the
`infobip-entity-isolation-test.mjs` probe live in the **web-maildrill-astro** repo.
