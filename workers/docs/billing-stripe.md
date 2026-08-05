# Stripe integration guide

How to wire a Stripe account to Maildrill billing. Architecture background:
[`billing-architecture.md`](billing-architecture.md).

## 1. Env (root `.env`)

```bash
BILLING_PROVIDER=stripe          # or `mock` for local dev without network
STRIPE_SECRET_KEY=sk_live_…      # Developers → API keys (sk_test_… for test mode)
STRIPE_WEBHOOK_SECRET=whsec_…    # from the webhook endpoint created in step 2
BILLING_ENFORCEMENT=0            # flip to 1 only after seeding + a test purchase
BILLING_RESERVATION_TTL_MINUTES=120
```

Production boot **fails** if `STRIPE_SECRET_KEY` is set without
`STRIPE_WEBHOOK_SECRET` — accepting unverifiable payment webhooks is worse
than accepting none. Keys are server-only; nothing Stripe-related is `PUBLIC_*`.

## 2. Webhook endpoint

Dashboard → Developers → Webhooks → *Add endpoint*:

- URL: `https://maildrill.net/api/stripe-webhook` (the Astro route forwards the
  raw body + `Stripe-Signature` verbatim to product-api
  `/v1/billing/webhooks/stripe`; point Stripe straight at product-api if it is
  publicly reachable).
- Events: `checkout.session.completed`, `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `charge.refunded`,
  `invoice.payment_succeeded`, `invoice.payment_failed`.
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, restart workers.

Semantics: 2xx = consumed (duplicates/skips included), 400 = bad signature
(check the secret), 5xx = transient — Stripe retries with backoff for ~3 days.
Every delivery lands in `stripe_events`; the unique event id is the idempotency
gate, and ledger keys are a second independent layer (see architecture doc).

## 3. Catalog

```bash
pnpm --dir workers db:migrate          # applies 0013_billing_wallet
pnpm --dir workers db:seed:billing     # tiers + packages + channel rate card
```

Packages/prices/rates are rows, not code — edit `credit_packages`,
`pricing_tiers`, `channel_pricing` (or the seed) to reprice. The frontend only
ever sends a package **code**; amounts are always read server-side.

## 4. Local development

- `BILLING_PROVIDER=mock` exercises the whole flow with no network: checkout
  returns a fake redirect and tests drive `parseWebhook` directly.
- Real Stripe test mode locally:
  ```bash
  stripe listen --forward-to localhost:4321/api/stripe-webhook
  # prints a whsec_… → STRIPE_WEBHOOK_SECRET, then:
  stripe trigger checkout.session.completed
  ```
- Full e2e suite: `docker compose up -d && pnpm db:migrate && RUN_E2E=1 pnpm test`
  (from `workers/`).

## 5. Go-live checklist

1. Live keys in prod `.env`; restart product-api + workers.
2. Webhook endpoint live and `stripe_events` filling on a test purchase.
3. `db:seed:billing` applied; `GET /v1/billing/packages` non-empty.
4. Test purchase with a real card → wallet credited exactly once; refund it →
   clawback entry appears.
5. `GET /v1/billing/reconciliation` → `consistent: true`.
6. Flip `BILLING_ENFORCEMENT=1` when wallets are funded — from then on, sends
   without credits are rejected with `insufficient_credits`.

## 6. What we deliberately do NOT use

- **No Stripe SDK** — four REST endpoints over `fetch` (repo provider style),
  testable with `vi.stubGlobal('fetch', …)`.
- **No Stripe Prices/Products catalog** — checkout uses `price_data` from our
  `credit_packages` rows so the catalog has one home (Postgres).
- **No subscriptions / Billing Meters / customer balance** — Maildrill owns
  credits, quotas, and consumption; Stripe never becomes the source of truth.
- **No trust in redirects or client amounts** — only signed webhooks move
  credits; the browser only ever names a package code.
