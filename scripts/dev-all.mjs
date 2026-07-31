#!/usr/bin/env node
/**
 * Start workers/ (unified Fastify + BullMQ) first, wait until PRODUCT_API_PORT
 * accepts connections, then start Astro. Ctrl-C stops both.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PRODUCT_API_PORT ?? process.env.DEV_SERVER_PORT ?? 3001);
const host = process.env.DEV_WAIT_HOST ?? '127.0.0.1';

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
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400).unref();
}

function run(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
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

console.log(`[dev:all] starting workers — waiting for ${host}:${port}…`);
run('workers', 'pnpm', ['--dir', 'workers', 'dev']);

try {
  await waitForPort(port);
} catch (err) {
  console.error(`[dev:all] ${err instanceof Error ? err.message : err}`);
  shutdown(1);
  process.exit(1);
}

console.log('[dev:all] workers ready — starting Astro…');
run('astro', 'pnpm', ['exec', 'astro', 'dev']);
