import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      // Pure logic layers — React islands and Astro pages are exercised by the
      // Playwright e2e suite instead of jsdom rendering.
      include: [
        'src/lib/**/*.ts',
        'src/config/**/*.ts',
        'src/components/react/**/*.logic.ts',
        'src/components/react/shared/*.ts',
      ],
      exclude: [
        'src/lib/server/api.*.ts', // generated OpenAPI types
        'src/lib/icons.ts', // data-only path table
        '**/*.types.ts',
        '**/*.d.ts',
      ],
    },
  },
});
