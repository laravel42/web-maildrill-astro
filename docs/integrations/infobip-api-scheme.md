# Maildrill — Data & Delivery Architecture

**Status:** Decided · **Owner:** Platform · **Last updated:** 2026-07-19

## Decision

> **Postgres is the system of record for all Maildrill data. Infobip is a stateless
> delivery gateway** — used only to *send* (email / SMS / WhatsApp), verify sending
> domains, and receive delivery/engagement webhooks. **No domain data is stored in the
> Infobip portal.**

This reverses the earlier "store as much as possible in Infobip" draft. Backend stack:
Astro endpoints / **Cloudflare Workers** → **Postgres** (Laravel monolith dropped).

### Why (settled empirically against the live account, 2026-07-18/19)

- **Entity isolation is not a data boundary.** Probing `nmnymj.api.infobip.com`:
  `/people/2/persons` exists (`403`), `/people/default/persons` → **`404` not found**. The
  path segment is an **API version**, not an app/entity slot. An entity rides on the
  **token**, never the URL.
- **Per-entity contact isolation ("People with X") is Early Access** and *cannot* insert
  profiles via the public People API (account-manager + Embeddable iFrame only).
- **Sub-account creation is not a public API** (only list/update), so "workspace = Infobip
  sub-account" can't be self-serve.
- **Campaigns can't be authored via API** — Moments only adds *participants* to a
  portal-created flow.
- On top of all that, the account's key returns `403 Unauthorized` on `/account`,
  `/provisioning`, and `/people` regardless — so even the emulated approach was blocked.

Net: Infobip-as-datastore is partly EA-gated, fights multi-tenancy, and adds provisioning
that isn't public API. Postgres removes every one of those problems.

---

## Architecture

```
Cloudflare Workers (API /api/v1/*)
        │
        ├──────────────► Postgres  ── SYSTEM OF RECORD (tenanted by workspace_id, RLS)
        │                            workspaces, users, subscribers, lists, segments,
        │                            templates, campaigns, events, billing, …
        │
        ├── at send time ─► Infobip  ── DELIVERY GATEWAY (stateless w.r.t. our data)
        │                            POST /email/3/send · /sms/* · Messages API
        │
        └── R2 ──────────► media assets (blobs); Postgres holds the metadata index
Infobip ── delivery/open/click webhook ──► Worker ──► writes message_events to Postgres
```

- **Tenancy** is a Postgres concern: every row carries `workspace_id`; enforce with
  **row-level security** (or schema-per-tenant if you prefer hard separation). No Infobip
  sub-accounts or entities are required for isolation.
- **Infobip stays a single account.** A per-workspace **Entity** (`entityId`) is *optional*
  and only worth it for per-workspace **billing-usage / metrics** tagging on sends — never
  for data. If used, pass `platform:{applicationId:"default", entityId:"<workspace>"}` on
  send calls; it does not change where data lives.
- **Postgres host:** open choice — Cloudflare **Hyperdrive** in front of Neon / Supabase /
  RDS. (See open questions.)

---

## Postgres schema (system of record)

Tables map 1:1 to the domain entities in `src/types/app.ts` + `PRODUCT.md`. Sketch:

| Table | Key columns | Notes |
|---|---|---|
| `workspaces` | id, name, slug, timezone, plan, quota_json, branding_json, feature_flags_json | the tenant |
| `users` | id, email, name | platform identity |
| `memberships` | workspace_id, user_id, role (`owner\|editor\|viewer`) | RBAC + `role_perms` |
| `subscribers` | id, workspace_id, email, name, status (`active\|unsubscribed\|bounced`), custom_json, created_at, updated_at | the CDP — **in Postgres** |
| `custom_field_defs` | workspace_id, name, type | drives `subscribers.custom_json` |
| `lists` | id, workspace_id, name, description, color | first-class here (Infobip has no "list") |
| `list_members` | list_id, subscriber_id | membership |
| `segments` | id, workspace_id, name, match_type (`all\|any`), rules_json | evaluated in SQL |
| `templates` | id, workspace_id, name, channel, subject, preheader, html, builder_doc_json, category, favorite | builder doc lives here; `html` compiled on save |
| `campaigns` | id, workspace_id, name, channel, status, audience_json, scheduled_at, content_json, infobip_bulk_id, metrics_json | full lifecycle in Postgres |
| `campaign_recipients` | campaign_id, subscriber_id, status, delivered_at, opened_at, clicked_at | or derive from `message_events` |
| `message_events` | id, workspace_id, campaign_id, subscriber_id, type, ts, meta_json | **written from Infobip webhooks** |
| `media_assets` | id, workspace_id, r2_key, name, folder, tags, size_kb, type | blob in R2, row here |
| `suppressions` | workspace_id, address, channel, reason | unsubscribe/GDPR/bounce |
| `sending_domains` | workspace_id, domain, dkim_status, infobip_domain_ref | mirrors Infobip domain state |
| `infobip_binding` | workspace_id, application_id, entity_id (nullable), api_key_ref | only if using Entity tagging |
| `usage` / `billing` | workspace_id, period, channel, used, stripe_* | plan quotas, Stripe/Cashier-free |

---

## Infobip binding (delivery only)

The **only** Infobip calls Maildrill makes. All are stateless w.r.t. our data — recipients
and content are passed in per request; the source of truth is Postgres.

| Maildrill action | Infobip endpoint (verified) | Correlation |
|---|---|---|
| Send email campaign | `POST /email/3/send` — `to[]`, `subject`, `html`/`templateId`, `trackOpens`, `trackClicks`, `notifyUrl` | `bulkId = campaign.id` |
| Send SMS campaign | `POST /sms/2/text/advanced` (or `/sms/3/messages`) | `callbackData = campaign.id` |
| Send WhatsApp | Messages API single-endpoint send | `campaignReferenceId` |
| Omnichannel + failover | Messages API `byChannel[]` | — |
| Verify sending domain / DKIM | Email Domain / Resource Management API | write status → `sending_domains` |
| Delivery / open / click | inbound **webhook** at `notifyUrl` (or pull delivery reports) | → `message_events` |
| (Optional) per-workspace cost split | `platform:{applicationId,entityId}` on sends → Billing Usage / Metrics API | tag only |

Recipients for a send come straight from a Postgres query (`list_members` / `segments`);
Infobip never persists them. Suppression is enforced **in Postgres** before the send call.

---

## End-to-end — send an email campaign

```
1. Author campaign + audience              → Postgres (campaigns, lists/segments)
2. Compile template builder_doc → html     → Postgres (templates)
3. Resolve recipients (minus suppressions) → SQL query
4. POST /email/3/send { bulkId=campaign.id, to[], html/templateId, notifyUrl, trackOpens/Clicks }   → Infobip
5. Mark campaign 'sending', store bulkId    → Postgres
6. Infobip webhook (delivered/opened/clicked) → Worker → INSERT message_events → Postgres
7. Dashboard rollups computed from message_events (cached)                                          → Postgres
```

---

## Open questions

1. **Postgres host** — Neon vs Supabase vs RDS, fronted by Cloudflare Hyperdrive? (Affects
   connection pooling from Workers.)
2. **Tenant isolation** — RLS by `workspace_id` (recommended, one schema) vs schema-per-tenant.
3. **Entity tagging** — do we want per-workspace `entityId` on sends purely for billing/
   metrics attribution, or skip it and attribute cost in Postgres from send logs?
4. **Do we ever need Infobip Journeys/Moments?** If yes (automated multi-step flows), that's
   the one case that would pull contacts into Infobip People — revisit only if required.

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

Source of truth for entities: `src/types/app.ts`, `.handoff/maildrill/project/PRODUCT.md`.
Probe script (kept for the record): `scripts/infobip-entity-isolation-test.mjs`.
