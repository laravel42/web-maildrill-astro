import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

/**
 * Load the monorepo root `.env` regardless of cwd. The standalone process is
 * spawned with cwd=workers/ (`pnpm --dir workers …`), where a bare
 * `dotenv/config` finds no .env and the Unsplash/AI keys silently vanish —
 * the picker then reports "Unsplash is not configured on the backend".
 * Mirrors @maildrill/config's resolution (root .env, then workers/.env).
 */
const appDir = dirname(fileURLToPath(import.meta.url));
const workersRoot = resolve(appDir, '../../..');
const rootEnv = resolve(workersRoot, '..', '.env');
const workersEnv = resolve(workersRoot, '.env');
loadDotenv({ path: existsSync(rootEnv) ? rootEnv : workersEnv });
