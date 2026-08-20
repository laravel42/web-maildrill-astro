# Billing runbook — operations & disaster recovery

Quick reference for operating the wallet/Stripe subsystem. Design:
[`billing-architecture.md`](billing-architecture.md) · setup:
[`billing-stripe.md`](billing-stripe.md).

## Dashboards / signals

- Metrics (`GET /metrics`): `billing_webhook_total{outcome}` (watch `failed`),
  `billing_reserve_total{channel}`, `billing_consume_total{channel}`.
- Logs (pino components): `billing-webhooks`, `billing-checkout`,
  `billing-wallet` (**`wallet drift detected` is a page-worthy error**),
  `billing-reservations`, `billing-consumption`.
- Stripe Dashboard → Webhooks shows delivery failures/retries per endpoint.

## Common incidents

**"Customer paid but has no credits"**

1. Stripe Dashboard → the payment → check the webhook delivery status.
2. `SELECT * FROM stripe_events WHERE event_id = 'evt_…'` — absent = delivery
   never arrived (check endpoint URL/secret; _Resend_ from Stripe is safe —
   everything is idempotent). Present with `status='skipped'` = no matching
   `payment_attempts` row (see error column).
3. `SELECT * FROM payment_attempts WHERE provider_session_id = 'cs_…'`.
4. Last resort — manual grant, in one transaction, via a ledger `adjustment`
   with `idempotency_key = 'manual:<ticket>'` and a description referencing the
   Stripe payment. Never `UPDATE wallets` directly.

**Webhook endpoint returning 400** — signature mismatch: wrong
`STRIPE_WEBHOOK_SECRET` (each endpoint has its own), or a proxy rewriting the
body. The BFF forwarder passes raw bytes; anything else in front must too.

**`insufficient_credits` on sends after enabling enforcement** — expected for
unfunded wallets. Check `GET /v1/billing/wallet`; a stuck non-zero `reserved`
with no open campaign means a hold leaked — the maintenance sweep returns it
after `BILLING_RESERVATION_TTL_MINUTES`, or release manually by updating the
reservation to `released` **through** `releaseReservation` (never SQL).

**Wallet drift (`reconciliation.consistent = false`)** — the projection
diverged from the ledger (crash between delivery commit and charge, manual SQL,
a bug). The ledger is truth. Fix = one `correction` entry that brings
`balance + reserved` back to `SUM(ledger)`; investigate the cause from
`wallet_transactions` + `stripe_events` + message timelines.

## Invariants to trust (and never "fix" around)

1. `wallets.balance_micro + reserved_micro = SUM(wallet_transactions.amount_micro)`.
2. Ledger rows are never updated or deleted.
3. Only webhooks credit wallets; only `appendLedgerEntry` writes balances.
4. Every financial effect has an idempotency key; retrying anything is safe.

## Disaster recovery

- **Postgres is the only stateful store.** Wallets, ledger, reservations,
  catalog, and event log all restore with the normal DB backup. After a
  point-in-time restore, replay the gap from Stripe: Dashboard → Webhooks →
  resend events since the restore point (idempotency makes over-replay safe),
  then run reconciliation per tenant.
- **Stripe outage:** checkout/portal return 5xx (wallet reads unaffected);
  sends keep working while credits last. Webhooks queue on Stripe's side and
  redeliver for ~3 days — no local queue to drain.
- **Redis loss:** billing is unaffected (no billing state in Redis); delivery
  charges resume with the messaging pipeline.
- **Key compromise:** roll the Stripe secret key + webhook secret in the
  Dashboard, update `.env`, restart. `payment_customers` maps tenants to
  Stripe customers if account-level reconstruction is ever needed.

## Scale notes

- The per-wallet `FOR UPDATE` serializes one workspace's financial ops —
  correct and sufficient; cross-tenant throughput scales horizontally.
- The checkout/portal rate limiter is in-process (`RATE_LIMITS`); move it to
  Redis alongside the auth limiter when product-api runs multi-instance.
- Ledger growth is append-only and index-covered; archive/report from a
  replica reading `wallet_transactions` — never mutate the primary's history.
