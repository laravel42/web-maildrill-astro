# Infobip → PostHog (Hog) + campaign delivery poller

> Companion to [`../HANDOFF.md`](../HANDOFF.md) (repo/ops overview). This file is
> the detailed Infobip notify + HogQL + poller reference.

Analytics ingest is **Infobip → PostHog** via an incoming webhook source. Hog maps
the raw payload. Maildrill no longer fans out to PostHog.

**Delivery / seen / voice:** Infobip notify → **PostHog only**. Product message
state and campaign completion come from the **campaign-delivery** worker that
HogQL-polls PostHog every ~5s. Do **not** point Infobip DLRs at Maildrill.

**WhatsApp template approval (product):** worker cron polls Infobip (not Maildrill
template webhooks). Template-status analytics still go Infobip → PostHog.

In-app Analytics (`GET /v1/stats/activity`, `summary.byChannel`) reads delivery
series from **PostHog HogQL** when `POSTHOG_PERSONAL_API_KEY` is set, and falls
back to Postgres otherwise. The stats queries match both
`message_delivery_report` and `message_voice_report` (same as the poller), so
voice volume is not dropped when PostHog takes over.

The dev seeder (`pnpm db:seed`) mirrors its six months of provider events into
PostHog through the same event taxonomy (`/batch/` + `historical_migration`),
so the HogQL paths return realistic data without any real Infobip traffic.

## Infobip URL split

| Infobip notify | Target |
| --- | --- |
| Delivery / seen / voice | PostHog webhook `?kind=delivery\|engagement\|voice` |
| Template status | PostHog webhook `?kind=template` |

Maildrill `/webhooks/infobip/{delivery|engagement|voice}` routes remain in code
but must **not** be configured in Infobip (unused).

## Campaign lifecycle

1. `sendCampaign` queues messages and leaves the campaign in **`sending`**
   (empty audience → immediate `sent`).
2. Worker role `campaign-delivery` (also under `all`) every
   `CAMPAIGN_DELIVERY_POLL_INTERVAL_MS` (default 5s):
   - Loads open messages (`queued|processing|submitted|sent`), including one-offs.
   - HogQL: latest `status_group` per `properties.maildrill_message_id`
     (`message_delivery_report` / `message_voice_report`).
   - Applies outcomes via the same transition rules as Infobip DLRs.
   - Separately loads recent `submitted|sent|delivered` rows and HogQL-polls
     `message_seen_report` → outcome `read` (opens). Delivered rows are outside
     the open-DLR set on purpose — campaign completion does not wait for opens.
   - When every campaign message has left the send queue → campaign `sent` +
     `completedAt`.

## callbackData (tenancy on DLR events)

Outbound Infobip sends stamp `callbackData` as:

```
{tenantId}|{channel}|{maildrillMessageId}
```

Hog parses that into event properties `tenant_id`, `channel`, and
`maildrill_message_id` so HogQL can filter charts and the delivery poller can
match Maildrill rows. Without callbackData (legacy sends), events still ingest
but tenant-scoped charts / poller updates miss them.

Canonical Hog source: [`posthog-infobip.hog`](./posthog-infobip.hog) (keep the
live CDP function in sync when editing).

## PostHog source

- Project: [Maildrill](https://us.posthog.com/project/526344)
- Function: **Infobip webhooks** (`source_webhook`)
- Hog source (canonical copy): [`posthog-infobip.hog`](./posthog-infobip.hog)

Hog VM constraints baked into the source (learned the hard way — keep them):

- `splitByChar`, `arrayPushBack`, `arrayConcat` are HogQL-only; the CDP VM has
  `splitByString`, `concat`, `jsonStringify`. Unsupported calls compile fine and
  only crash at runtime.
- Only ONE `postHogCapture` per invocation. Multi-result DLR batches are sent as
  a single `fetch` to `https://us.i.posthog.com/batch/` using the function's
  `project_api_key` input (the project's public `phc_` token). Batched requests
  return `{"status":"queued"}` 201 (async) instead of the sync body — fine for
  Infobip (any 2xx stops retries).

Voice: `/tts/3/single` silently drops `notifyUrl`/`callbackData` — voice sends
use `POST /tts/3/advanced`, and the pull fallback reads `/tts/3/reports` (voice
is absent from `/messages-api/1/reports`). The delivery poller matches both
`message_delivery_report` and `message_voice_report`.

Webhook URL (Maildrill project):

```
https://webhooks.us.posthog.com/public/webhooks/019f9251-bee2-0000-231d-064eff754e26?kind=delivery
```

(Use `?kind=template` for template-status notify.)

Manage in PostHog → Data pipelines → Sources → **Infobip webhooks**.

Kinds:

- `?kind=delivery` → `message_delivery_report`
- `?kind=engagement` → `message_seen_report`
- `?kind=tracking` → `message_tracking_report` (email/SMS/WA open·click·unsub·complaint; also auto-detected via `notificationType`)
- `?kind=voice` → `message_voice_report`
- `?kind=template` (or omit; auto-detected via `messageTemplateId`) → `whatsapp_template_status`

Outbound sends stamp `options.tracking` / `urlOptions` with `INFOBIP_TRACKING_URL`
(or `INFOBIP_NOTIFY_URL` rewritten to `kind=tracking`) so Infobip pushes engagement
to PostHog. The campaign-delivery poller syncs those into message status /
`message_events` for the channel-adapted campaign report.

Idempotency: `$insert_id` = `infobip:{messageId|templateId}:{status}:{timestamp|name}`.

Enable the CDP Hog sources feature preview if the source UI is hidden.

## Env (product-api + workers)

| Variable | Purpose |
| --- | --- |
| `POSTHOG_PERSONAL_API_KEY` | Personal key with **Query Read** (Bearer). Not `phc_`. Required for Analytics + delivery poller. |
| `POSTHOG_PROJECT_ID` | Default `526344` (Maildrill). |
| `POSTHOG_APP_HOST` | Default `https://us.posthog.com`. |
| `POSTHOG_STATS_ENABLED` | Empty = on when key set; `0`/`false` forces Postgres for Analytics (poller also skips HogQL). |
| `CAMPAIGN_DELIVERY_POLL_INTERVAL_MS` | Default `5000`. |

Restart product-api and workers after setting the personal key.

Chart mapping from `message_delivery_report`:

- **sent** — distinct `message_id` per day (any DLR)
- **delivered** — `status_group = 'DELIVERED'`
- **failed** — `status_group IN ('UNDELIVERABLE','EXPIRED','REJECTED')`

Filtered by `properties.tenant_id` (and optional channel).

## Template approval cron (product)

Worker role `template-approval` (also started with `all`) calls
`pollPendingWhatsAppTemplates()` on an interval
(`TEMPLATE_APPROVAL_POLL_INTERVAL_MS`, default 60s):

1. Load WhatsApp templates with `approvalStatus = pending` and a `providerTemplateId`.
2. `GET /whatsapp/2/senders/{sender}/templates` once per configured sender.
3. Match by provider id (then name+language) and update `approvalStatus` / `rejectionReason`.

Manual refresh still works via `refreshTemplateStatus`.

## Events in PostHog

| Event | Source |
| --- | --- |
| `message_delivery_report` | Infobip DLR → PostHog Hog |
| `message_seen_report` | Infobip seen → PostHog Hog |
| `message_voice_report` | Infobip voice → PostHog Hog |
| `whatsapp_template_status` | Infobip template notify → PostHog Hog |

`message_submitted` is **not** captured anymore (was Maildrill dispatch fan-out).

## SQL views

See [`posthog-views.sql`](./posthog-views.sql) / [`posthog-views.json`](./posthog-views.json).

## Verify

1. Point Infobip delivery/engagement/voice notify → PostHog only (`?kind=delivery` etc.). Remove Maildrill DLR URLs from Infobip.
2. Point template-status → PostHog `?kind=template`.
3. Set `POSTHOG_PERSONAL_API_KEY` on product-api + workers; restart.
4. Send a campaign → stays `sending` with progress; Live events show `message_delivery_report` with `tenant_id` / `maildrill_message_id`.
5. Within a few poll intervals messages update and campaign flips to `sent`.
6. `/app/analytics` series moves from HogQL.
7. Leave a template `pending` → Infobip poller flips Maildrill DB without a Maildrill template webhook.
