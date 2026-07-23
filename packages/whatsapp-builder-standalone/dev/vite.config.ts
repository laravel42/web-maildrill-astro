import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * Dev-harness config: serves `dev/` with the package source compiled on
 * the fly (same as the host app's Vite does). No react plugin needed —
 * esbuild's automatic JSX runtime covers a plain dev server.
 */
export default defineConfig({
  root: path.dirname(new URL(import.meta.url).pathname),
  server: {
    port: 4324,
  },
});
