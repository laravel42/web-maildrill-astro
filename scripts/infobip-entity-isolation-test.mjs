#!/usr/bin/env node
/**
 * Infobip entity-isolation probe
 * See docs/integrations/infobip-api-scheme.md §1.3
 *
 * Question: does an API key scoped to a CPaaS X *entity* isolate the People/CDP store?
 * i.e. if we mint one token per entity and create a Person with each, can token-A read
 * token-B's Person? If yes → NOT isolated (shared account pool). If no → isolated.
 *
 * The script creates real objects in your LIVE Infobip account:
 *   1 application (reused), 2 entities, 2 entity-scoped API keys, 2 persons.
 * It cleans them up at the end unless KEEP=1.
 *
 * Required (shell env or .env):
 *   INFOBIP_BASE_URL   personalized base, e.g. nmnymj.api.infobip.com  (or full https URL)
 *   INFOBIP_API_KEY    an ADMIN key on the MAIN account with scopes to create entities + API keys
 *                      (account-management:manage; provisioning). Header form: "App <secret>".
 * Optional:
 *   INFOBIP_APP_ID     application to bind the entities to (default "xtest-app"; created if missing).
 *                      Set to your real app (e.g. Maildrill) only if you want to bind to it.
 *   INFOBIP_ACCOUNT_ID account id for key creation (default: the admin key's own account)
 *   KEEP=1             skip cleanup, leave objects for portal inspection
 *
 * Run:  node scripts/infobip-entity-isolation-test.mjs
 */

import { readFileSync } from 'node:fs';

// --- tiny .env loader (no dependency; does not override real env) ---
try {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const raw of txt.split('\n')) {
    const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env — rely on shell env */
}

const rawBase = process.env.INFOBIP_BASE_URL || process.env.API_BASE_URL; // INFOBIP_BASE_URL wins
const ADMIN = process.env.INFOBIP_API_KEY;
if (!rawBase || !ADMIN) {
  console.error(
    '✗ Need INFOBIP_BASE_URL (or API_BASE_URL) and INFOBIP_API_KEY in .env or shell. Aborting.',
  );
  process.exit(2);
}
const BASE = 'https://' + rawBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
// Safety: never send the Infobip key to a host that isn't Infobip.
const host = new URL(BASE).host;
if (!/\.infobip\.com$/i.test(host) && process.env.ALLOW_NONINFOBIP !== '1') {
  console.error(
    `✗ Resolved base host "${host}" is not *.infobip.com — refusing to send the Infobip key there.`,
  );
  console.error('  Set INFOBIP_BASE_URL to your personalized base (e.g. xxxxx.api.infobip.com),');
  console.error('  or pass ALLOW_NONINFOBIP=1 if you are certain this host is correct.');
  process.exit(3);
}
const APP_ID = process.env.INFOBIP_APP_ID || 'default';
const ACCOUNT_ID = process.env.INFOBIP_ACCOUNT_ID || null;
const KEEP = process.env.KEEP === '1';
const RUN = String(Date.now()).slice(-9);

const log = (...a) => console.log(...a);
const brief = (r) =>
  `${r.status}${r.ok ? '' : ' · ' + (r.text || '').replace(/\s+/g, ' ').slice(0, 180)}`;

async function api(method, path, { token = ADMIN, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `App ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    /* non-json */
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function main() {
  log(`\n=== Infobip entity-isolation probe (run ${RUN}) ===`);
  log(`base: ${BASE}   app: ${APP_ID}\n`);

  // 0) ensure the binding application exists ("default" always exists → don't create it)
  if (APP_ID === 'default') {
    log(`[app ] using pre-existing "default" application (no create)`);
  } else {
    const r = await api('POST', '/provisioning/1/applications', {
      body: { applicationId: APP_ID, applicationName: 'Maildrill isolation test' },
    });
    log(`[app ] ensure "${APP_ID}": ${r.status === 409 ? '409 already exists (ok)' : brief(r)}`);
  }

  // 1) two entities
  const E = [`xtest-a-${RUN}`, `xtest-b-${RUN}`];
  for (const id of E) {
    const rr = await api('POST', '/provisioning/1/entities', {
      body: { entityId: id, entityName: `Isolation test ${id}` },
    });
    log(`[ent ] create ${id}: ${rr.status === 409 ? '409 exists (ok)' : brief(rr)}`);
  }

  // 2) one entity-scoped ("with X") API key per entity
  const keys = [];
  for (const id of E) {
    const body = { name: `xtest-key-${id}`, platform: [{ applicationId: APP_ID, entityId: id }] };
    if (ACCOUNT_ID) body.accountId = ACCOUNT_ID;
    const rr = await api('POST', '/settings/2/api-keys', { body });
    keys.push({ entity: id, id: rr.json?.id, secret: rr.json?.apiKeySecret });
    log(`[key ] scoped key for ${id}: ${rr.ok ? 'ok id=' + rr.json?.id : brief(rr)}`);
  }
  if (!keys[0].secret || !keys[1].secret) {
    log('\n⚠️  Could not mint entity-scoped keys — cannot run the People test.');
    log(
      '    Check that INFOBIP_API_KEY is a MAIN-account key with account-management:manage scope.',
    );
    return cleanup(keys, E, []);
  }

  // 3) create a Person with each scoped key
  const persons = E.map((id, i) => ({
    entity: id,
    email: `xtest.${RUN}.${i ? 'b' : 'a'}@maildrill-isolation.test`,
    name: i ? 'Bob' : 'Alice',
  }));
  let writable = true;
  for (let i = 0; i < 2; i++) {
    const p = persons[i];
    const rr = await api('POST', '/people/2/persons', {
      token: keys[i].secret,
      body: {
        firstName: p.name,
        tags: [`xtest-${RUN}`],
        contactInformation: { email: [{ address: p.email }] },
      },
    });
    p.created = rr.ok;
    p.id = rr.json?.id;
    log(
      `[ppl ] create ${p.name} <${p.email}> via "${p.entity}" key: ${rr.ok ? 'ok id=' + rr.json?.id : brief(rr)}`,
    );
    if (!rr.ok) writable = false;
  }

  if (!writable) {
    log('\n🔎 RESULT: entity-scoped keys could NOT write People profiles.');
    log('   → Per-entity CDP writes are not available on the public People API with a scoped key.');
    log(
      '   → Consistent with "People with X = Early Access, not via People API". Sub-account needed for CDP isolation.',
    );
    return cleanup(keys, E, persons);
  }

  // 4) cross-visibility: can each token read the OTHER entity's person? (200 = leak)
  log('\n--- cross-visibility probe (identifier lookup) ---');
  const leaks = [];
  for (let i = 0; i < 2; i++) {
    const self = persons[i],
      other = persons[1 - i],
      token = keys[i].secret;
    const rSelf = await api(
      'GET',
      `/people/2/persons?identifier=${encodeURIComponent(self.email)}&type=EMAIL`,
      { token },
    );
    const rOther = await api(
      'GET',
      `/people/2/persons?identifier=${encodeURIComponent(other.email)}&type=EMAIL`,
      { token },
    );
    const leak = rOther.ok; // 200 ⇒ can see the other tenant's person
    leaks.push(leak);
    log(
      `[${self.entity}] own(${self.name})→${rSelf.status}   other(${other.name})→${rOther.status}  ${leak ? '❌ VISIBLE' : '✅ hidden'}`,
    );
  }

  // 5) list count per token (color only)
  for (let i = 0; i < 2; i++) {
    const rr = await api('GET', '/people/2/persons?limit=1000&includeTotalCount=true', {
      token: keys[i].secret,
    });
    const total = rr.json?.count ?? rr.json?.paging?.totalCount ?? rr.json?.persons?.length ?? '?';
    log(`[${E[i]}] list → ${rr.status}, total≈${total}`);
  }

  log('\n=== VERDICT ===');
  if (!leaks[0] && !leaks[1]) {
    log('✅ ISOLATED — each entity-scoped token sees ONLY its own person.');
    log('   On this account, entities DO isolate the People/CDP store via token scoping.');
    log('   → §1.3 fallback ("shared account + entity") becomes viable; sub-accounts optional.');
  } else {
    log("❌ NOT ISOLATED — a scoped token could read the other entity's person.");
    log('   Entities do NOT partition People/CDP on the public API — it is one shared pool.');
    log('   → Confirms §1.3: use sub-account for hard CDP isolation, or People-with-X (EA).');
  }

  return cleanup(keys, E, persons);
}

async function cleanup(keys, entities, persons) {
  if (KEEP) {
    log('\n(KEEP=1 → leaving all test objects in place)');
    return;
  }
  log('\n--- cleanup (best effort) ---');
  for (const p of persons || [])
    if (p.email) {
      const rr = await api(
        'DELETE',
        `/people/2/persons?identifier=${encodeURIComponent(p.email)}&type=EMAIL`,
      );
      log(`[ppl ] delete ${p.email}: ${rr.status}`);
    }
  for (const k of keys || [])
    if (k.id) {
      const rr = await api('PUT', `/settings/2/api-keys/${k.id}`, { body: { enabled: false } });
      log(`[key ] revoke ${k.id}: ${rr.status}`);
    }
  for (const id of entities || []) {
    const rr = await api('DELETE', `/provisioning/1/entities/${encodeURIComponent(id)}`);
    log(`[ent ] delete ${id}: ${rr.status}`);
  }
  log('(application left in place — reusable)');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
