#!/usr/bin/env node
/**
 * INTERNAL cost reference: dump your Infobip account's real rate card.
 *
 * ⚠️  This does NOT feed the public pricing estimator. The account rate card is
 * account-specific negotiated pricing and has partial coverage (e.g. US/Germany
 * SMS may not be provisioned), so it is unsuitable as public "list" pricing. The
 * public estimator stays on the curated rates in src/config/pricing-rates.json.
 *
 * This drives Chromium with YOUR saved portal session, calls the portal's own
 * pricing APIs, and writes a per-country cost reference to a gitignored file.
 * Offline only — never in the browser, never on hydration.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *   1. One-time (and whenever the session expires): manual login (MFA/SSO/CAPTCHA
 *      handled by you); the session is saved for reuse:
 *          pnpm sync:rates:login
 *   2. Write the internal rate reference:
 *          pnpm sync:rates
 *   discover — dump every portal JSON response to scripts/.captures/ for
 *   re-inspection if the portal APIs change:
 *          pnpm sync:rates discover
 *
 * ── Data source (reverse-engineered from the portal) ─────────────────────
 *   /api/public/cup/taquin/1/default-routes   → channel → routeId
 *   /api/public/self-service/1/countries      → country name → ISO code
 *   /api/public/cup/taquin/2/route/{id}?currencyId=9&perAccount=true
 *                                             → per-network `purchasePrice`
 *   currencyId 9 = USD. Rows are matched to countries by NAME (the route's
 *   `countryId` is a different id space than self-service ids). Output is the
 *   network-average purchasePrice in the portal's native unit (do not assume a
 *   per-message divisor — it differs by channel; verify against the portal).
 *
 * ── Security ─────────────────────────────────────────────────────────────
 *   • Credentials are typed into the real login page — never seen/stored here.
 *   • Session, captures, and the internal rate file are gitignored. The rates
 *     are confidential commercial terms — keep them out of version control.
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SESSION_FILE = join(ROOT, 'scripts', '.infobip-session.json');
const CAPTURE_DIR = join(ROOT, 'scripts', '.captures');
const OUTPUT_FILE = join(ROOT, 'scripts', '.infobip-rates.internal.json'); // gitignored

loadDotenv();
const PORTAL = (process.env.INFOBIP_PORTAL_URL || 'https://portal.infobip.com').replace(/\/+$/, '');
const PRICING_URL = new URL(process.env.INFOBIP_PRICING_PATH || '/pricing', PORTAL + '/').href;

// pnpm forwards a literal `--` separator into argv, so ignore it.
const mode = process.argv.slice(2).filter((a) => a !== '--')[0] || 'sync';

const CURRENCY_ID = 9; // USD — from portal /graphql me.finance.currency = { code: 'USD' }
// Portal route names (from default-routes) → our column keys.
const CHANNELS = [
  { key: 'sms', route: 'Sms' },
  { key: 'whatsapp', route: 'WhatsApp' },
  { key: 'voice', route: 'Voice Outbound' },
  { key: 'email', route: 'Email' },
];

async function main() {
  if (mode === 'login') return login();
  if (mode === 'discover') return discover();
  if (mode === 'sync') return sync();
  console.error(`Unknown mode "${mode}". Use: login | discover | sync`);
  process.exit(1);
}

/** Headed manual login → save the authenticated session for reuse. */
async function login() {
  console.log(
    `\nOpening ${PORTAL} — log in (incl. MFA/SSO), reach your dashboard, then\n` +
      'return here and press Enter to save the session.\n',
  );
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await context
    .newPage()
    .then((p) => p.goto(PORTAL, { waitUntil: 'domcontentloaded' }).catch(() => {}));
  await prompt('Press Enter once you are logged in… ');
  await context.storageState({ path: SESSION_FILE });
  await browser.close();
  console.log(`\n✓ Session saved to ${rel(SESSION_FILE)} (gitignored). Now run: pnpm sync:rates\n`);
}

/** Fetch the live rate card via the portal's APIs → internal cost reference. */
async function sync() {
  const { page, browser } = await session();

  const routes = await api(page, '/api/public/cup/taquin/1/default-routes');
  const routeId = (name) => {
    const hit = routes.find((r) => r.routeName?.toLowerCase() === name.toLowerCase());
    if (!hit) throw new Error(`Route "${name}" not found in default-routes`);
    return hit.routeId;
  };
  // Match by name — the route's countryId is a different id space than these ids.
  const countries = await api(page, '/api/public/self-service/1/countries');
  const codeByName = new Map(countries.map((c) => [norm(c.name), c.code]));

  console.log('Fetching rate cards…');
  const byChannel = {};
  for (const { key, route } of CHANNELS)
    byChannel[key] = await perCountryRates(page, routeId(route));
  await browser.close();

  // Union of all country names seen across channels.
  const names = new Set();
  for (const key of Object.keys(byChannel)) for (const n of byChannel[key].keys()) names.add(n);

  const rows = [];
  for (const name of names) {
    const row = { code: codeByName.get(name) ?? null, name: titleCase(name) };
    for (const { key } of CHANNELS) row[key] = byChannel[key].get(name) ?? null;
    rows.push(row);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const out = {
    _warning:
      'INTERNAL cost reference — NOT used by the public estimator. Account-specific negotiated ' +
      'rates with partial coverage. Values are network-averaged Infobip `purchasePrice` in the ' +
      "portal's native unit (USD; the per-message divisor differs by channel — verify in the portal).",
    currency: 'USD',
    source: `${PORTAL} (taquin route API, perAccount)`,
    countries: rows,
  };
  validate(out);
  writeFileSync(OUTPUT_FILE, JSON.stringify(out, null, 2) + '\n');

  const covered = (key) => rows.filter((r) => r[key] != null).length;
  console.log(`\n✓ Wrote ${rows.length} countries → ${rel(OUTPUT_FILE)} (gitignored)`);
  console.log(`  coverage: ${CHANNELS.map((c) => `${c.key} ${covered(c.key)}`).join('  ')}`);
  const mx = rows.find((r) => r.code === 'MX');
  if (mx) console.log(`  e.g. Mexico (raw purchasePrice): ${JSON.stringify(mx)}`);
  console.log('');
}

/** countryName(normalized) → network-average raw purchasePrice for one route. */
async function perCountryRates(page, id) {
  const res = await api(
    page,
    `/api/public/cup/taquin/2/route/${id}?limit=100000&page=0&orderBy=country%3AASC&currencyId=${CURRENCY_ID}&perAccount=true`,
  );
  const agg = new Map();
  for (const row of res.routePriceList || []) {
    if (typeof row.purchasePrice !== 'number' || !row.countryName) continue;
    const k = norm(row.countryName);
    const g = agg.get(k) || { sum: 0, n: 0 };
    g.sum += row.purchasePrice;
    g.n += 1;
    agg.set(k, g);
  }
  const out = new Map();
  for (const [k, g] of agg) out.set(k, round(g.sum / g.n));
  return out;
}

/** Dump every portal JSON response to scripts/.captures/ for re-inspection. */
async function discover() {
  const { page, browser } = await session();
  const captures = [];
  page.on('response', async (res) => {
    if (!(res.headers()['content-type'] || '').includes('application/json')) return;
    try {
      captures.push({ url: res.url(), body: await res.json() });
    } catch {
      /* non-JSON / streamed — skip */
    }
  });
  console.log(`Loading ${PRICING_URL} …`);
  await page.goto(PRICING_URL, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  mkdirSync(CAPTURE_DIR, { recursive: true });
  for (const f of readdirSync(CAPTURE_DIR))
    if (f.endsWith('.json')) writeFileSync(join(CAPTURE_DIR, f), '');
  captures.forEach((c, i) => {
    const name = `${String(i).padStart(2, '0')}-${c.url.replace(/[^a-z0-9]+/gi, '_').slice(-80)}.json`;
    writeFileSync(join(CAPTURE_DIR, name), JSON.stringify(c, null, 2));
  });
  await page.screenshot({ path: join(CAPTURE_DIR, '_page.png'), fullPage: true }).catch(() => {});
  await browser.close();
  console.log(`\n✓ Captured ${captures.length} JSON response(s) → ${rel(CAPTURE_DIR)}\n`);
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Open an authenticated portal page from the saved session (or exit clearly). */
async function session() {
  if (!existsSync(SESSION_FILE)) {
    console.error(`No saved session at ${rel(SESSION_FILE)}. Run "pnpm sync:rates:login" first.`);
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  await page.goto(PORTAL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (/login|signin|auth/i.test(page.url())) {
    await browser.close();
    console.error('Session expired (redirected to login). Re-run: pnpm sync:rates:login');
    process.exit(1);
  }
  return { page, browser };
}

/** Same-origin authenticated GET returning JSON, run inside the portal page. */
function api(page, path) {
  return page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
    return r.json();
  }, PORTAL + path);
}

/** Guard against writing an empty/malformed reference. */
function validate(out) {
  const ok =
    out &&
    Array.isArray(out.countries) &&
    out.countries.length > 0 &&
    out.countries.every((c) => c.name);
  if (!ok) throw new Error('Refusing to write: rate reference failed validation.');
}

const norm = (s) => s.trim().toLowerCase();
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const round = (n) => Math.round(n * 1e4) / 1e4;
const rel = (p) => p.replace(ROOT + '/', '');

function prompt(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => (rl.close(), resolve(a))));
}

function loadDotenv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

main().catch((err) => {
  console.error('\n✗', err.message, '\n');
  process.exit(1);
});
