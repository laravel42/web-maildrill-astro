#!/usr/bin/env node
/**
 * Start the production-style workers split, wait until each HTTP port accepts
 * connections, then start Astro with matching BFF base URLs.
 *
 *   product-api       → PRODUCT_API_PORT (default 3001)
 *   messaging-api     → API_PORT         (default 3002)
 *   email-builder-api → EB_PORT          (default 3003)
 *   workers            → BullMQ roles (no port)
 *   astro              → :4321 (Astro auto-increments this itself if busy)
 *
 * Reads the repo-root `.env` (shell env wins) so PRODUCT_API_PORT / API_PORT /
 * EB_PORT are honoured the same way workers/ loads them.
 *
 * Port collisions with OTHER projects are common when several repos share
 * default ports (3001/3002/3003), so by default this script probes each
 * default port and, if busy, walks forward to the next free one — the
 * chosen ports are then passed into the workers children and baked into
 * API_BASE_URL / MESSAGING_API_BASE_URL / EB_API_BASE_URL for Astro. Set
 * DEV_PORT_STRICT=1 to restore the old fail-fast behaviour instead (useful
 * to catch a stale instance of THIS repo still holding a port). Ctrl-C stops
 * every child. For a single unified process use `pnpm dev:workers`.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Merge root `.env` into process.env without overriding real shell variables.
 * Same idea as start-all.mjs — this script used to read PRODUCT_API_PORT before
 * any dotenv load, so a .env of 4001 was ignored and the port check still
 * failed on the default :3001.
 */
function loadDotenv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, m[1])) continue;
    let value = m[2].trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }
    process.env[m[1]] = value;
  }
}

loadDotenv(resolve(root, '.env'));

const host = process.env.DEV_WAIT_HOST ?? '127.0.0.1';

// Dev-only convenience: when another project already owns one of our default
// ports, don't fail — hop to the next free one instead. Opt out with
// DEV_PORT_STRICT=1 to get the old fail-fast behaviour (e.g. CI, or when you
// want a hard signal that a stale instance of THIS repo is still running).
const strictPorts = process.env.DEV_PORT_STRICT === '1';

const requestedProductPort = Number(process.env.PRODUCT_API_PORT ?? 3001);
const requestedMessagingPort = Number(process.env.API_PORT ?? 3002);
const requestedEbPort = Number(process.env.EB_PORT ?? process.env.PORT_EB ?? 3003);

function portInUse(p) {
  return new Promise((resolvePort) => {
    const socket = net.connect({ port: p, host }, () => {
      socket.end();
      resolvePort(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

/**
 * Find the first free port at or after `start`, skipping any port already
 * claimed by a sibling service in this same run (`taken`).
 */
async function findFreePort(start, taken, { maxTries = 50 } = {}) {
  for (let p = start; p < start + maxTries; p += 1) {
    if (taken.has(p)) continue;
    if (!(await portInUse(p))) return p;
  }
  throw new Error(`No free port found in range ${start}-${start + maxTries - 1}`);
}

const taken = new Set();

async function resolvePortFor(label, requested) {
  if (!(await portInUse(requested)) && !taken.has(requested)) {
    taken.add(requested);
    return requested;
  }
  if (strictPorts) {
    console.error(
      `[dev:all] ${host}:${requested} is already in use (${label}).\n` +
        `  Find it with: netstat -ano | findstr :${requested}   (or lsof -i :${requested} on macOS/Linux)\n` +
        `  Stop the stale process, or unset DEV_PORT_STRICT to auto-pick a free port instead.`,
    );
    process.exit(1);
  }
  const free = await findFreePort(requested + 1, taken);
  taken.add(free);
  console.warn(`[dev:all] :${requested} busy (${label}) — using :${free} instead.`);
  return free;
}

const productPort = await resolvePortFor('product-api', requestedProductPort);
const messagingPort = await resolvePortFor('messaging-api', requestedMessagingPort);
const ebPort = await resolvePortFor('email-builder-api', requestedEbPort);

// Astro dev has its own PID-lockfile guard (`.astro/`) and refuses to start a
// second instance on the same port even if the port is free — it does NOT
// auto-increment like plain Vite. So probe :4321 the same way as the backend
// ports and pass the resolved port explicitly via --port. --ignore-lock also
// skips the lockfile check entirely, so a stale lock from a previous session
// that didn't shut down cleanly can't block this run either.
const requestedAstroPort = Number(process.env.PORT ?? 4321);
const astroPort = await resolvePortFor('astro', requestedAstroPort);

// Pin BFF URLs to the ports this script actually starts. A stale
// API_BASE_URL=http://localhost:3001 in .env must not override PRODUCT_API_PORT.
const productUrl = `http://${host}:${productPort}`;
const messagingUrl = `http://${host}:${messagingPort}`;
const ebUrl = `http://${host}:${ebPort}`;

const httpServices = [
  { label: 'product-api', port: productPort },
  { label: 'messaging-api', port: messagingPort },
  { label: 'email-builder-api', port: ebPort },
];

function waitForPort(p, label, { timeoutMs = 90_000, intervalMs = 400 } = {}) {
  const started = Date.now();
  return new Promise((resolveWait, reject) => {
    const attempt = () => {
      const socket = net.connect({ port: p, host }, () => {
        socket.end();
        resolveWait();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${label} on ${host}:${p}`));
          return;
        }
        setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

const children = [];
let shuttingDown = false;

/** Kill the child's process group so pnpm → tsx trees don't orphan on ports. */
function killTree(child, signal) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child, 'SIGTERM');
  setTimeout(() => {
    for (const child of children) killTree(child, 'SIGKILL');
    process.exit(code);
  }, 400).unref();
}

function run(label, command, args, env = process.env) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev:all] ${label} exited (code=${code} signal=${signal ?? 'none'})`);
    shutdown(code ?? 1);
  });
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const ports = httpServices.map((s) => `:${s.port}`).join(' · ');
console.log(`[dev:all] starting split backends — waiting for ${ports}…`);

run('product-api', 'pnpm', ['--dir', 'workers', 'dev:product-api'], {
  ...process.env,
  PRODUCT_API_PORT: String(productPort),
});
run('messaging-api', 'pnpm', ['--dir', 'workers', 'dev:api'], {
  ...process.env,
  API_PORT: String(messagingPort),
});
run('email-builder-api', 'pnpm', ['--dir', 'workers', 'dev:email-builder-api'], {
  ...process.env,
  EB_PORT: String(ebPort),
  // email-builder falls back to PORT; pin it so a stray PORT≠3003 cannot win.
  PORT: String(ebPort),
});
run('workers', 'pnpm', ['--dir', 'workers', 'worker', 'all']);

try {
  await Promise.all(httpServices.map((s) => waitForPort(s.port, s.label)));
} catch (err) {
  console.error(`[dev:all] ${err instanceof Error ? err.message : err}`);
  shutdown(1);
  process.exit(1);
}

if (shuttingDown) process.exit(1);

console.log(
  `[dev:all] backends ready — starting Astro on http://localhost:${astroPort}…\n` +
    `  API_BASE_URL=${productUrl}\n` +
    `  MESSAGING_API_BASE_URL=${messagingUrl}\n` +
    `  EB_API_BASE_URL=${ebUrl}`,
);
run(
  'astro',
  'pnpm',
  ['exec', 'astro', 'dev', '--port', String(astroPort), '--ignore-lock'],
  {
    ...process.env,
    API_BASE_URL: productUrl,
    MESSAGING_API_BASE_URL: messagingUrl,
    EB_API_BASE_URL: ebUrl,
  },
);
