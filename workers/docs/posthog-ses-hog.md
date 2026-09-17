# SES → PostHog (Hog) + campaign delivery poller

> Companion to [`../HANDOFF.md`](../HANDOFF.md) and
> [`posthog-infobip-hog.md`](./posthog-infobip-hog.md) — this file is the SES
> equivalent of that one. Read that file first for the campaign-lifecycle and
> poller mechanics, which are **identical** here; this file only covers what's
> SES-specific.

Delivery/engagement events for the SES email driver go
**SES → SNS → SQS → EventBridge Pipe → PostHog**, landing in the same
`message_delivery_report`/`message_tracking_report` event shape Infobip's Hog
function already produces. This means `campaign-delivery.ts` needs **zero
SES-specific code** — the existing poller picks up SES reports transparently.

This is deployed and verified working end-to-end (`aws sns publish` a test
Bounce → confirmed landing in PostHog with the right `status_group`) as of
2026-09-10. Everything below reflects the actual live configuration, not a
plan.

## Why not a direct HTTPS subscription

**A raw SNS → HTTPS-to-PostHog subscription cannot work, at all**, confirmed
live: SNS always posts HTTP(S) notifications as `Content-Type: text/plain`
(not configurable on AWS's side, including for the `SubscriptionConfirmation`
handshake itself — so such a subscription sits `PendingConfirmation` forever),
and PostHog's `source_webhook` function type genuinely cannot parse a
`text/plain` body — `request.body` **and** `request.stringBody` both come back
empty for it, even though the identical bytes parse correctly the moment
`Content-Type` says `application/json`. This isn't a Hog-script problem; no
amount of script logic fixes it.

## The actual live architecture

```
SES Configuration Set (amzn-ses-maildrill-config-set)
  → SNS topic (sns-email-events)
      → SQS subscription (sqs-email-events)  [already existed; confirmed at subscribe time, no handshake]
          → EventBridge Pipe (sqs-email-events-pipe)
              → EventBridge Connection (posthog-ses-webhook-connection)
                  - Auth: API_KEY, header name "Authorization", value "Bearer <secret>"
                  - InvocationHttpParameters: Content-Type: application/json
              → API Destination (posthog-ses-webhook)
                  - POST https://webhooks.us.posthog.com/public/webhooks/01a08a59-6ca1-0000-72e3-c6301a811252
                  → PostHog "SES webhooks" source_webhook function (posthog-ses.hog)
```

Routing through SQS sidesteps the text/plain problem entirely, because the
final hop (EventBridge → API Destination) is under our control and can force
`Content-Type: application/json` — something a raw SNS HTTPS subscription can
never do.

### Why an EventBridge Pipe and not a Lambda

An earlier iteration of this used a small relay Lambda
(`lambda/ses-sns-relay.mjs`, still in the repo for reference) subscribed
directly to SNS with protocol `lambda`. That works too, but once the SQS
subscription turned out to already exist, an EventBridge Pipe does the same
job — read from SQS, reshape, invoke an HTTPS target — with no code to
deploy or maintain, just declarative AWS configuration.

### The InputTemplate — three real bugs found building this, in order

The Pipe's `TargetParameters.InputTemplate` went through three iterations
before landing on the correct one, each diagnosed from the Pipe's own
`TRACE`-level execution logs (`aws logs filter-log-events
--log-group-name /aws/vendedlogs/pipes/sqs-email-events-pipe`) or from the
PostHog function's own request logs (`debug: true` input) — both are the
right first place to look if this ever breaks again:

1. **`<$.body>` alone** — a single placeholder referencing a STRING field
   (the SQS message body, itself the SNS envelope as JSON text) gets inserted
   **unescaped** by EventBridge's template engine, corrupting the surrounding
   JSON (embedded quote characters broke the structure). Fixed by wrapping it
   in an explicit static JSON template instead of a bare placeholder:
   `{"sqsBody": <$.body>}` — this forces proper JSON-string escaping.
2. **`<$[0].body>` / `<$.Records[0].body>`** — both rejected or resolved to
   nothing; neither is valid syntax for a Pipe's InputTemplate against an SQS
   source (despite superficially resembling the classic SQS-Lambda event
   shape). `<$.body>` (no indexing) is actually correct for addressing the
   field — Pipes implicitly maps it over the batch.
3. **Assuming the final HTTP body stays array-wrapped** — Pipes' target
   *transformation* stage always produces a batch-shaped array (even at
   `BatchSize: 1`), visible in the `TargetTransformationSucceeded` trace log
   as `[{"sqsBody": {...}}]`. But for a non-batch target like an API
   Destination, Pipes **unwraps the single element before the actual HTTP
   call** — confirmed by looking at what the PostHog function itself actually
   received (`debug: true`, checked via the function's own request logs):
   a bare `{"sqsBody": {...}}`, not an array. The Hog script reads
   `request.body.sqsBody` accordingly (no array indexing).

The working final `InputTemplate`:
```
{"sqsBody": <$.body>}
```

`sqsBody` arrives already JSON-parsed into a real nested object (Pipes'
"implicit SQS body parsing"), but `sqsBody.Message` is still a JSON-encoded
*string* — SNS's own double-encoding, untouched — so the Hog script still
does one `jsonParse(toString(envelope.Message))` to get the actual SES event.

## Setup (what's actually configured — for rebuilding if ever needed)

1. **SES Configuration Set** (`amzn-ses-maildrill-config-set`) → Event
   destination → Amazon SNS → topic `sns-email-events`. Event types selected:
   Send, Delivery, Bounce, Complaint, Reject, Open, Click, DeliveryDelay,
   Rendering Failure, Subscription (all of them).
2. **SNS → SQS subscription**: topic `sns-email-events` subscribed to queue
   `sqs-email-events` (protocol `sqs`) — this already existed before this work
   started and needed no changes.
3. **PostHog function**: Data pipelines → Sources → `source_webhook` named
   **SES webhooks**, id `01a08a59-6ca1-0000-72e3-c6301a811252`. Body is
   [`posthog-ses.hog`](./posthog-ses.hog). Inputs: `method=POST`,
   `debug=false`, `auth_header=Bearer <secret>` (the secret lives in the
   EventBridge Connection below — not committed anywhere in this repo).
4. **EventBridge Connection** `posthog-ses-webhook-connection` — auth type
   `API_KEY`, key name `Authorization`, value `Bearer <secret>` (matches the
   Hog function's `auth_header` input exactly); `InvocationHttpParameters`
   also sets `Content-Type: application/json` on every invocation.
5. **EventBridge API Destination** `posthog-ses-webhook` — POST to the
   PostHog webhook URL above, using the connection.
6. **IAM**: the Pipe's execution role
   (`Amazon_EventBridge_Pipe_Execution_ddad9a3c`) has an inline policy
   `InvokePostHogApiDestination` granting `events:InvokeApiDestination` on
   the API Destination's ARN, alongside its pre-existing SQS-read policy.
7. **EventBridge Pipe** `sqs-email-events-pipe` — source: SQS queue
   `sqs-email-events` (`BatchSize: 1`); target: the API Destination above;
   `TargetParameters.InputTemplate`: `{"sqsBody": <$.body>}`.

The direct `/webhooks/ses/sns` route in `apps/api/src/routes/ses-webhook.ts`
still exists in the codebase as a fallback/manual-testing path (same
relationship Infobip's `/webhooks/infobip/*` routes have to its own PostHog
pipeline) — it is **not** part of the live path and never will be, since a
direct HTTPS subscription can't work regardless (see above). A leftover
`PendingConfirmation` HTTPS subscription pointing at the PostHog webhook URl
may still be visible on the SNS topic from before this was understood; it's
harmless and AWS auto-expires unconfirmed HTTPS subscriptions after 3 days.

## Payload differences from Infobip (why the Hog script isn't shared as-is)

- **Transport envelope.** What actually reaches the Hog function is
  `{"sqsBody": <SNS envelope>}` (see above) rather than a raw provider
  webhook body — the SNS envelope inside still carries `Type`, `Message`
  (the SES event, JSON-encoded as a string), etc., same shape a working
  direct HTTPS subscription would have delivered if PostHog could parse
  `text/plain`. The Hog script still checks `envelope.Type` and handles a
  `SubscriptionConfirmation`/`UnsubscribeConfirmation` no-op branch (dead code
  on this SQS-sourced path specifically, since SQS subscriptions confirm at
  `sns subscribe` time, not per-message — kept for robustness / in case this
  URL is ever reused for a direct HTTPS subscription from a provider whose
  content-type PostHog can actually parse).
- **Correlation.** SES carries Maildrill's ids as structured message tags
  (`mail.tags.maildrill_message_id`, `.maildrill_tenant_id`,
  `.maildrill_campaign_id` — each an array of strings, one value here) rather
  than Infobip's colon/pipe-joined `callbackData` string. No `splitByString`
  parsing needed on the Maildrill side of it.
- **Event vocabulary.** SES's `eventType` (Send/Delivery/Bounce/Complaint/
  Reject/Open/Click/DeliveryDelay/`Rendering Failure`/Subscription) is
  translated into the *same* `status_group` (DELIVERED/PENDING/UNDELIVERABLE/
  REJECTED/EXPIRED — see `outcomeFromInfobipStatusGroup` in
  `@maildrill/domain`) and `notification_type` (OPENED/CLICKED/COMPLAINED/
  UNSUBSCRIBED) vocabulary Infobip's Hog function already produces, so nothing
  downstream needs to know which provider an event came from. Mapping used by
  `posthog-ses.hog`:

  | SES `eventType`   | PostHog event               | `status_group` / `notification_type` |
  | ------------------ | ---------------------------- | -------------------------------------- |
  | `Send`              | `message_delivery_report`    | `SENT` (falls to the poller's default → outcome `sent`) |
  | `Delivery`          | `message_delivery_report`    | `DELIVERED`                            |
  | `Bounce`            | `message_delivery_report`    | `UNDELIVERABLE`                        |
  | `Reject`            | `message_delivery_report`    | `REJECTED`                             |
  | `DeliveryDelay`     | `message_delivery_report`    | `PENDING`                              |
  | `Rendering Failure` | `message_delivery_report`    | `UNDELIVERABLE`                        |
  | `Open`              | `message_tracking_report`    | `OPENED`                               |
  | `Click`             | `message_tracking_report`    | `CLICKED`                              |
  | `Complaint`         | `message_tracking_report`    | `COMPLAINED`                           |
  | `Subscription`      | `message_tracking_report`    | `UNSUBSCRIBED`                         |

## Hog VM gotchas hit building this (keep these — they'll bite again)

- **`and`/`or` do NOT short-circuit.** `not empty(x) and length(x) >= 1`
  crashes with `TypeError: Cannot read properties of null (reading 'length')`
  the instant `x` is null (e.g. a missing `maildrill_campaign_id` tag on a
  transactional send) — Hog evaluates both sides unconditionally. Use nested
  `if`s instead, matching `posthog-infobip.hog`'s own
  `if (not empty(cb)) { ... if (length(parts) >= 3) ... }` pattern. Found via
  the function's own error logs (`hog_functions/{id}/logs/` API), not by
  inspection — this class of bug produces no compile-time warning.
- Same ones `posthog-infobip-hog.md` documents (`splitByString` not
  `splitByChar`, one `postHogCapture` per invocation) — this script only ever
  captures one event per notification (SES/SNS deliver one event per
  message), so the `/batch/` fallback isn't needed here.
- **Debugging tool of choice**: `hog_functions/{id}/logs/` (via the PostHog
  API with a key scoped `hog_function:read`) shows the exact `request.body`
  PostHog received, plus any runtime errors — this is what actually
  diagnosed every issue above, faster than guessing from documentation.

## Verify

Already done once (2026-09-10) via `aws sns publish` with a synthetic Bounce
event; to redo:

1. `aws sns publish --topic-arn arn:aws:sns:eu-central-1:333976512094:sns-email-events --message file://test-event.json` with a body like:
   ```json
   {"eventType":"Bounce","mail":{"messageId":"test-1","timestamp":"...","tags":{"maildrill_message_id":["m-1"],"maildrill_tenant_id":["t-1"]}},"bounce":{"bounceType":"Permanent","bounceSubType":"General","timestamp":"..."}}
   ```
2. Check the Pipe didn't fail: `aws logs filter-log-events --log-group-name /aws/vendedlogs/pipes/sqs-email-events-pipe --start-time <recent>`.
3. Check PostHog got it: `hog_functions/{id}/logs/` should show `Responded with response status - 200`.
4. Query PostHog: `SELECT event, properties.provider, properties.status_group, properties.maildrill_message_id FROM events WHERE event = 'message_delivery_report' AND properties.provider = 'ses' ORDER BY timestamp DESC LIMIT 5` via `/api/projects/{id}/query/`.
5. For a real send: within one `CAMPAIGN_DELIVERY_POLL_INTERVAL_MS` tick, the message's status in Postgres should advance past `submitted`.
