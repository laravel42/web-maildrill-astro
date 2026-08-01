import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'apps/product-api/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/seed*.ts',
        'packages/database/src/migrate.ts',
        'packages/product/src/backfill-media-thumbs.ts',
        'packages/product/src/rename-media-descriptive.ts',
        'packages/product/src/tag-media-descriptive.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@maildrill/config': r('./packages/config/src/index.ts'),
      '@maildrill/observability': r('./packages/observability/src/index.ts'),
      '@maildrill/domain': r('./packages/domain/src/index.ts'),
      '@maildrill/database': r('./packages/database/src/index.ts'),
      '@maildrill/queues': r('./packages/queues/src/index.ts'),
      '@maildrill/providers': r('./packages/providers/src/index.ts'),
      '@maildrill/services': r('./packages/services/src/index.ts'),
      '@maildrill/authz': r('./packages/authz/src/index.ts'),
      '@maildrill/product': r('./packages/product/src/index.ts'),
      '@maildrill/identity': r('./packages/identity/src/index.ts'),
      '@maildrill/httpkit': r('./packages/httpkit/src/index.ts'),
    },
  },
});
