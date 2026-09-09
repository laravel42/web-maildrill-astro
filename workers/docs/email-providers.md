# Email providers (EmailTransport)

Maildrill's provider abstraction (`packages/providers`, `MessagingProvider` in
`core.ts`) is the same interface for every channel. Three implementations
carry the `email` channel today, all fully interchangeable from the rest of
the app's point of view:

| Driver       | File                              | Notes                                                             |
| ------------ | ---------------------------------- | ------------------------------------------------------------------ |
| `infobip`    | `src/infobip.ts`                   | Default; also carries SMS/WhatsApp/Voice                          |
| `cloudflare` | `src/cloudflare.ts`                | Email-only, Cloudflare Email Sending REST API                     |
| `ses`        | `src/ses.ts`                       | Email-only, Amazon SES v2 `SendEmail`                              |

None of `submitMessage`, `handleDispatch`, `campaigns.ts`, `events.ts`, or the
`messages`/`message_events` schema know or care which of these sent a given
message — they only see `SendInput` → `ProviderSendResult`, and later
`NormalizedProviderEvent[]` → the same `messages.status` state machine
(`@maildrill/domain`'s `resolveEventTransition`). See `HANDOFF.md` §3 for the
full messaging pipeline; this doc covers only what's specific to picking and
configuring an email driver.

## Selecting a driver

One switch does this, already used for Cloudflare before SES existed:

```
PROVIDER_DRIVER=infobip          # account-wide default, every channel
PROVIDER_EMAIL_DRIVER=ses        # optional: email ONLY, everything else stays on PROVIDER_DRIVER
```

`PROVIDER_EMAIL_DRIVER` is Maildrill's "which email transport" switch — an
empty value means email follows `PROVIDER_DRIVER`. Both `cloudflare` and `ses`
reject any non-`email` channel with a permanent validation error, so setting
either as the bare `PROVIDER_DRIVER` (not `PROVIDER_EMAIL_DRIVER`) breaks
SMS/WhatsApp/Voice — only do that on an email-only deployment.

Config validation (`packages/config`) fails fast at startup with an actionable
message if SES is selected (either variable) without `AWS_SES_REGION` /
`AWS_SES_FROM_EMAIL` set. No other deployment needs any SES config at all —
this is opt-in per the existing "only validate what's selected" convention
also used for Cloudflare, Stripe, and the Infobip billing callback.

## AWS SES setup

1. **Verify a sending identity** (domain or single address) in the SES
   console for the region you'll use, and move the account out of the SES
   sandbox for production volume — sandbox accounts can only send to
   verified recipients.
2. Set `AWS_SES_REGION` and `AWS_SES_FROM_EMAIL` (must match the verified
   identity, or a subdomain of a verified domain).
3. **Credentials**: never put access keys in `.env` for a real deployment —
   the client (`SESv2Client`) is constructed with only a region and uses the
   standard AWS SDK v3 credential provider chain, so an ECS task role, EC2
   instance profile, or EKS service account "just works" with zero extra
   config. Local dev can fall back to the `AWS_ACCESS_KEY_ID` /
   `AWS_SECRET_ACCESS_KEY` already in `.env.example` for S3 media, or an AWS
   CLI profile (`AWS_PROFILE`).
4. **Delivery events** (bounce/complaint/delivery/open/click/etc.) — set up
   once per SES account/region:
   - SES console → **Configuration sets** → create one, note its name for
     `AWS_SES_CONFIGURATION_SET`.
   - That configuration set → **Event destinations** → add destination →
     **Amazon SNS** → choose or create a topic → select every event type you
     want (Send, Reject, Bounce, Complaint, Delivery, Open, Click,
     Rendering Failure, DeliveryDelay, Subscription).
   - SNS console → that topic → **Create subscription** → protocol **HTTPS**,
     endpoint `https://<api-host>/webhooks/ses/sns?secret=<WEBHOOK_INFOBIP_SECRET>`.
   - Maildrill's endpoint (`apps/api/src/routes/ses-webhook.ts`) auto-confirms
     the subscription handshake on first delivery — no manual "click to
     confirm" step, but check the API logs for `ses sns SubscriptionConfirmation
     confirmed` to be sure it landed.
   - A send with no configuration set attached (`AWS_SES_CONFIGURATION_SET`
     empty) is fire-and-forget: SES accepts it, but nothing ever calls back,
     so the message stays `submitted` forever (until `DELIVERY_STALE_EXPIRE_MS`
     terminates it). Set the configuration set before relying on SES delivery
     status.

Every SES send also carries `EmailTags`: `maildrill_message_id`,
`maildrill_tenant_id`, and (when the send belongs to a campaign)
`maildrill_campaign_id`. These ride back on every SES event (`mail.tags`) and
are the correlation Maildrill actually uses (`mail.tags.maildrill_message_id`)
— `mail.messageId` (the SES-assigned message id) is also stored as
`messages.provider_message_id` and used as the primary lookup key, the same
`(provider, provider_message_id)` mechanism every other provider uses (no
`ses_message_id` column was added).

## Capabilities

SES v2's `SendEmail` "Simple" content (not the older SES v1 `SendRawEmail`)
natively supports everything Maildrill's `content` carries today without
falling back to hand-built raw MIME:

- HTML and/or plain-text body
- From name + address (`Display Name <user@domain>` or a bare address)
- Reply-To
- Arbitrary custom headers, including `List-Unsubscribe` /
  `List-Unsubscribe-Post` for one-click unsubscribe — pass them in
  `content.headers`
- Attachments (`Message.Attachments`) — not wired up yet because no Maildrill
  campaign content carries attachments today (see `HANDOFF.md`); the SES
  adapter is ready for a `content.attachments` field the moment campaign
  content grows one, with no raw-MIME fallback needed even then.

## Event mapping

`SesProvider.normalizeWebhook` maps the SES Configuration-Set event-publishing
shape (keyed by `eventType`, with `notificationType` as a fallback for the
older Bounce/Complaint/Delivery-only subscription shape) onto the same
`ProviderOutcome` used everywhere else:

| SES `eventType`     | Outcome     | Notes                                                        |
| -------------------- | ----------- | ------------------------------------------------------------- |
| `Send`                | `sent`      |                                                                |
| `Delivery`            | `delivered` |                                                                |
| `Bounce`              | `failed`    | Bounce type/subtype kept in `providerStatus` + raw payload    |
| `Complaint`           | `delivered` | Complaint only happens after delivery — same reasoning Cloudflare uses for spam complaints |
| `Reject`              | `failed`    | SES refused to send at all (e.g. virus scan)                 |
| `Open`                | `read`      | Matches how Infobip/PostHog opens map to `read`                |
| `Click`               | `read`      | Matches how Infobip/PostHog clicks map to `read`                |
| `DeliveryDelay`       | `submitted` | Retries still pending — mirrors Cloudflare's `deferred`        |
| `Rendering Failure`   | `failed`    | Template rendering failed before send                          |
| `Subscription`        | `delivered` | One-click list-unsubscribe action; delivery already happened   |

`resolveEventTransition` (the same state machine every provider goes through)
still guards against duplicate/out-of-order/regressive events, so none of the
above can move a message backwards or resurrect a terminal state.

**Not yet unified across all three email providers:** `messageEvents.eventType`
strings themselves (`email.delivered` for SES vs. Cloudflare's pre-existing
`message.delivered` vs. Infobip's coarse `delivery`/`engagement`) — each
provider kept its own established convention rather than a forced rename that
risks anything downstream matching the old strings. What every provider does
agree on, and what drives `messages.status`/campaign counters/analytics, is
the `outcome` field above. Unifying `eventType` naming retroactively across
Infobip and Cloudflare is a separate, purely-cosmetic follow-up, not required
for correct behavior.

## Adding a fourth provider

The pattern is intentionally the same three touch points every time (proven
twice now — Cloudflare, then SES):

1. `packages/providers/src/<name>.ts` — implement `MessagingProvider`
   (`send`, `normalizeWebhook`; reject non-email channels if it's email-only).
2. `packages/providers/src/registry.ts` — one more `driver === '<name>'` branch.
3. `packages/providers/src/index.ts` — export it.
4. `packages/config/src/index.ts` — add `'<name>'` to the `PROVIDER_DRIVER`
   and `PROVIDER_EMAIL_DRIVER` enums, add a config block, add startup
   validation gated on that driver actually being selected.
5. If it delivers events asynchronously via something other than a plain
   HTTPS POST of the normalized-ready shape, add a small ingestion adapter
   (see `cloudflare-events.ts` for a poll-based one, `ses-webhook.ts` for a
   push/SNS-based one) that unwraps the transport envelope and calls the
   existing `ingestWebhook` — never a new persistence path.

No changes to `submit.ts`, `dispatch.ts`, `events.ts`, `campaign-delivery.ts`,
`campaigns.ts`, or the database schema are ever required.
