#!/usr/bin/env node
/**
 * Start the production-style workers split, wait until each HTTP port accepts
 * connections, then start Astro with matching BFF base URLs.
 *
 *   product-api       → PRODUCT_API_PORT (default 3001)
 *   messaging-api     → API_PORT         (default 3002)
 *   email-builder-api → EB_PORT          (default 3003)
 *   workers           → BullMQ roles (no port)
 *   astro             → :4321
 *
 * Ctrl-C stops every child. For a single unified process use `pnpm dev:workers`.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.DEV_WAIT_HOST ?? '127.0.0.1';

const productPort = Number(process.env.PRODUCT_API_PORT ?? 3001);
const messagingPort = Number(process.env.API_PORT ?? 3002);
const ebPort = Number(process.env.EB_PORT ?? process.env.PORT_EB ?? 3003);

const productUrl = process.env.API_BASE_URL ?? `http://${host}:${productPort}`;
const messagingUrl =
  process.env.MESSAGING_API_BASE_URL ?? `http://${host}:${messagingPort}`;
const ebUrl = process.env.EB_API_BASE_URL ?? `http://${host}:${ebPort}`;

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

for (const svc of httpServices) {
  if (await portInUse(svc.port)) {
    console.error(
      `[dev:all] ${host}:${svc.port} is already in use (${svc.label}).\n` +
        `  Find it with: lsof -i :${svc.port}\n` +
        `  Stop the stale process (or use \`pnpm dev:workers\` only if you want the unified :${productPort} server).`,
    );
    process.exit(1);
  }
}

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
  `[dev:all] backends ready — starting Astro…\n` +
    `  API_BASE_URL=${productUrl}\n` +
    `  MESSAGING_API_BASE_URL=${messagingUrl}\n` +
    `  EB_API_BASE_URL=${ebUrl}`,
);
run(
  'astro',
  'pnpm',
  ['exec', 'astro', 'dev'],
  {
    ...process.env,
    API_BASE_URL: productUrl,
    MESSAGING_API_BASE_URL: messagingUrl,
    EB_API_BASE_URL: ebUrl,
  },
);
