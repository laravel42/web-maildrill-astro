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

/**
 * Signal a child's whole process GROUP, not just the direct child. The workers
 * child is a pnpm wrapper around tsx — killing only pnpm can orphan tsx, which
 * then squats on :3001 and EADDRINUSEs every later start.
 */
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
  exitCode = code;
  if (alive === 0) process.exit(exitCode);
  for (const child of children) killTree(child, 'SIGTERM');
  // Last resort for a hung child; keep below supervisor's stopwaitsecs so the
  // parent still exits cleanly instead of being SIGKILLed with children leaked.
  setTimeout(() => {
    for (const child of children) killTree(child, 'SIGKILL');
  }, 30_000).unref();
}

function run(label, command, args, env = childEnv) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
    // Own process group per child so killTree can take out the whole
    // pnpm → tsx / node tree in one signal.
    detached: process.platform !== 'win32',
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

/**
 * Fail fast if the workers port is already owned. Without this check a stale
 * instance answers the readiness probe, Astro boots against the OLD backend,
 * and the new workers child dies with a confusing EADDRINUSE seconds later.
 */
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

if (await portInUse(port)) {
  console.error(
    `[start:all] ${host}:${port} is already in use — a previous instance is still running.\n` +
      `  Find it with: ss -tlnp | grep ${port}   (or: lsof -i :${port})\n` +
      `  Kill that pid, make sure only one supervisor daemon runs this script, then retry.`,
  );
  process.exit(1);
}

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
