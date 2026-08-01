#!/usr/bin/env node
/**
 * Production twin of dev-all.mjs: start the unified workers server
 * (`pnpm --dir workers start`) first, wait until PRODUCT_API_PORT accepts
 * connections, then start the built Astro server (dist/server/entry.mjs —
 * requires a prior `pnpm build`).
 *
 * Meant to run as ONE supervised process (e.g. a Ploi daemon:
 * `bash -lc 'exec node scripts/start-all.mjs'`). Unlike dev-all's fire-and-exit
 * teardown, SIGTERM/SIGINT here keeps the parent alive until both children
 * have actually exited, so supervisor's stopwaitsecs governs the real drain
 * (the workers child finishes in-flight sends before exiting).
 *
 * VPS testing stopgap — the go-live plan is a Docker architecture.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const astroEntry = resolve(root, 'dist/server/entry.mjs');
const port = Number(process.env.PRODUCT_API_PORT ?? process.env.DEV_SERVER_PORT ?? 3001);
const host = process.env.DEV_WAIT_HOST ?? '127.0.0.1';

if (!fs.existsSync(astroEntry)) {
  console.error('[start:all] dist/server/entry.mjs not found — run `pnpm build` first.');
  process.exit(1);
}

/**
 * The built Astro entry does not load .env (astro dev does; the workers child
 * uses dotenv itself), and a supervisor shell has a bare environment — so read
 * the root .env here for runtime lookups like process.env.API_BASE_URL.
 * Real environment variables win over the file.
 */
function parseDotenv(file) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
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
    out[m[1]] = value;
  }
  return out;
}

const childEnv = { ...parseDotenv(resolve(root, '.env')), ...process.env };

function waitForPort(p, { timeoutMs = 90_000, intervalMs = 400 } = {}) {
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
          reject(new Error(`Timed out waiting for workers on ${host}:${p}`));
          return;
        }
        setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

const children = [];
let alive = 0;
let shuttingDown = false;
let exitCode = 0;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;
  if (alive === 0) process.exit(exitCode);
  for (const child of children) {
    if (!child.killed && child.exitCode === null) child.kill('SIGTERM');
  }
  // Last resort for a hung child; keep below supervisor's stopwaitsecs so the
  // parent still exits cleanly instead of being SIGKILLed with children leaked.
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }, 30_000).unref();
}

function run(label, command, args, env = childEnv) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  children.push(child);
  alive += 1;
  child.on('exit', (code, signal) => {
    alive -= 1;
    if (shuttingDown) {
      if (alive === 0) process.exit(exitCode);
      return;
    }
    console.error(`[start:all] ${label} exited (code=${code} signal=${signal ?? 'none'})`);
    shutdown(code ?? 1);
  });
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[start:all] starting workers — waiting for ${host}:${port}…`);
run('workers', 'pnpm', ['--dir', 'workers', 'start']);

try {
  await waitForPort(port);
} catch (err) {
  console.error(`[start:all] ${err instanceof Error ? err.message : err}`);
  shutdown(1);
}

if (!shuttingDown) {
  const astroHost = childEnv.HOST ?? '127.0.0.1';
  const astroPort = childEnv.PORT ?? '4321';
  console.log(`[start:all] workers ready — starting Astro on ${astroHost}:${astroPort}…`);
  run('astro', process.execPath, [astroEntry], {
    ...childEnv,
    HOST: astroHost,
    PORT: astroPort,
  });
}
