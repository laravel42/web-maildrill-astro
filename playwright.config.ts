import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const STORAGE_STATE = path.resolve('tests/e2e/.auth/user.json');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  // Reuses running dev servers locally; boots both stacks otherwise. The
  // authenticated specs also need Postgres (login-code mint + live data).
  webServer: [
    {
      command: 'pnpm --filter workers dev',
      // The workers server exposes /health/live and /health/ready; a bare
      // /health is a 404, so waiting on it never becomes ready.
      url: 'http://localhost:3001/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npm run preview -- --host localhost --port 4321',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    // Signs in once (dev-DB minted login code) and saves storage state.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
