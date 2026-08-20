# scripts

Repo maintenance scripts. These run **offline** (locally or in CI) — never as part
of the site build served to visitors.

## Inventory

| Script                                                                                                                    | Purpose                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev-all.mjs`                                                                                                             | `pnpm dev:all` — start product (:3001), messaging (:3002), email-builder (:3003), BullMQ workers; wait for all three ports; then Astro with matching `*_API_BASE_URL`. Ctrl-C stops everything. Unified single-process: `pnpm dev:workers`. |
| `start-all.mjs`                                                                                                           | `pnpm start:all` — production twin still uses the unified workers `start` on :3001, then the built Astro server (`pnpm build` first). Prefer `docker compose up` for the real split stack. |
| `local-tunnel.sh`                                                                                                         | `pnpm tunnel` — named Cloudflare tunnel: fixed https://local.maildrill.net → localhost:4321 (reuses the `local-maildrill-app` tunnel; DNS record persists between runs)                                        |
| `typecheck.mjs`                                                                                                           | Part of `pnpm typecheck` — root `tsc --noEmit` minus errors from dependency TS sources (`packages/`, `node_modules/`) pulled in via imports                                                                    |
| `apca-audit.mjs`                                                                                                          | `pnpm audit:apca` — APCA contrast audit over the design tokens (`src/styles/tokens.css`)                                                                                                                       |
| `sync-infobip-rates.mjs`                                                                                                  | Internal Infobip rate-card dump (detailed section below)                                                                                                                                                       |
| `infobip-entity-isolation-test.mjs`                                                                                       | One-off probe behind the Infobip-as-datastore rejection (`workers/docs/infobip-api-scheme.md`)                                                                                                                 |
| `import-maildrill-templates.mjs`                                                                                          | Convert send-ready HTML emails → email-builder documents                                                                                                                                                       |
| `compare-templates.mjs`                                                                                                   | Screenshot converted documents (real Reader render) next to their source HTML                                                                                                                                  |
| `diff-template-layout.mjs` · `measure-template.mjs` · `measure-text.mjs` · `probe-element.mjs` · `dump-template-tree.mjs` | Template-conversion debugging: per-block layout diffs, canvas/text metrics, element probes, doc-tree dumps                                                                                                     |
| `present-dashboard.mjs`                                                                                                   | Record a narrated (TTS) Playwright video tour of the signed-in dashboard                                                                                                                                       |

## `sync-infobip-rates.mjs` — internal Infobip cost reference

Dumps your Infobip **account rate card** (real per-country costs) to a gitignored
file for internal reference.

> ⚠️ **This does not feed the public pricing estimator.** The public estimator
> keeps the curated indicative rates in
> [`src/config/pricing-rates.json`](../src/config/pricing-rates.json). The account
> card is **account-specific negotiated pricing** with **partial coverage** (e.g.
> US / Germany SMS aren't provisioned on it), so it's unsuitable as public "list"
> pricing — and the rates are confidential, hence the gitignored output.

### Why a scrape (and not an API call)

Infobip exposes **no API-key-callable rate-card endpoint**. A key only reaches your
balance, the per-message `price` on delivery reports (after sending), and the async
Billing Usage API (historical spend). The actual rate card lives in the portal
dashboard (`portal.infobip.com`), rendered from internal **session-authenticated**
APIs. So this drives a headless browser with your own logged-in session and calls
those APIs directly.

### Prerequisites

```bash
pnpm install
pnpm exec playwright install chromium   # once, if the browser isn't already installed
```

### Usage

```bash
# 1. One-time (and whenever the session expires): a real browser opens — log in by
#    hand (email/password, MFA, SSO, CAPTCHA all handled by you). The authenticated
#    session is then saved for reuse.
pnpm sync:rates:login

# 2. Write the internal rate reference (scripts/.infobip-rates.internal.json).
pnpm sync:rates

# (debug) Dump every portal JSON response to scripts/.captures/ for re-inspection
# if the portal APIs ever change.
pnpm sync:rates discover
```

### Output

`scripts/.infobip-rates.internal.json` (gitignored):

```jsonc
{
  "_warning": "INTERNAL cost reference — NOT used by the public estimator …",
  "currency": "USD",
  "source": "https://portal.infobip.com (taquin route API, perAccount)",
  "countries": [
    {
      "code": "MX",
      "name": "Mexico",
      "sms": 16.9286,
      "whatsapp": 2.1771,
      "voice": 0.0216,
      "email": null,
    },
  ],
}
```

Values are the **network-average `purchasePrice`** in the portal's **native unit**
(USD). Do **not** assume a fixed per-message divisor — the scale differs by channel
(messaging looks like per-1000; voice is different). Verify against the portal
before using a number for anything real. `null` means that channel isn't priced for
that country on your account.

### How it works

| Endpoint                                                           | Purpose                     |
| ------------------------------------------------------------------ | --------------------------- |
| `/api/public/cup/taquin/1/default-routes`                          | channel → `routeId`         |
| `/api/public/self-service/1/countries`                             | country **name** → ISO code |
| `/api/public/cup/taquin/2/route/{id}?currencyId=9&perAccount=true` | per-network `purchasePrice` |

`currencyId 9` = USD. Rows are matched to countries **by name** — the route's
`countryId` is a different id space than the self-service ids (matching on id
silently mislabels countries).

### Configuration (optional, via `.env`)

| Var                    | Default                      | Purpose                       |
| ---------------------- | ---------------------------- | ----------------------------- |
| `INFOBIP_PORTAL_URL`   | `https://portal.infobip.com` | Portal origin                 |
| `INFOBIP_PRICING_PATH` | `/pricing`                   | Route used only by `discover` |

### Security & caveats

- **No password is stored.** You type credentials into the real login page; only the
  resulting session (`scripts/.infobip-session.json`) is saved. That file, the
  captures, and the internal rate file are all **gitignored** — the rates are
  confidential commercial terms, keep them out of version control.
- **Login stays manual** on purpose. Portal MFA / SSO / bot protection break
  fully-automated logins; reusing a real session sidesteps that (normal auth, no
  evasion). If headless reuse gets challenged, run it headed.
- **Brittle by nature.** Portal markup/endpoints change; expect occasional upkeep.
- **Terms of service.** It's your own account data, but automating the portal may
  bump against Infobip's terms — worth a glance before relying on it.
