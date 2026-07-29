import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import auth from 'auth-astro';

import { siteConfig } from './src/config/site';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const appSrc = path.resolve(rootDir, 'src');
const waStudioSrc = path.resolve(rootDir, 'packages/wa-template-studio/src');

const RESOLVE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

function resolveWithExtensions(base: string): string | undefined {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of RESOLVE_EXTS) {
    const file = base + ext;
    if (fs.existsSync(file)) return file;
  }
  for (const ext of RESOLVE_EXTS) {
    const file = path.join(base, `index${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

/** `@/` means app `src/` here, but wa-template-studio's own `src/` inside the package. */
function resolveAtImport(source: string, importer?: string): string | undefined {
  if (!source.startsWith('@/')) return undefined;
  const subpath = source.slice(2);
  const root = importer?.includes('wa-template-studio') ? waStudioSrc : appSrc;
  return resolveWithExtensions(path.join(root, subpath));
}

/** Resolve wa-template-studio's internal `@/` imports when bundled by Astro/Vite. */
function waTemplateStudioAlias() {
  return {
    name: 'wa-template-studio-alias',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      return resolveAtImport(source, importer) ?? null;
    },
  };
}

// `import.meta.env` isn't populated at config-load time, so read the raw env
// (set at build, e.g. on Cloudflare Pages) with the config default as fallback.
const siteUrl = process.env.PUBLIC_SITE_URL || siteConfig.url;

export default defineConfig({
  site: siteUrl,
  trailingSlash: 'never',
  // Astro 7 changed the `compressHTML` default from `true` to `'jsx'`, which
  // strips whitespace-only text nodes even between inline elements (e.g.
  // `<a>x</a> <a>y</a>` would collapse the gap). Pin the HTML-aware behavior to
  // keep rendered output identical to the pre-upgrade site.
  compressHTML: true,
  // Flat file output (`/pricing.html`) so hosts serve no-trailing-slash URLs
  // with a 200 (matching the canonicals) instead of 308-redirecting to a slash.
  build: { format: 'file' },
  // Marketing pages stay static; the app/auth/api routes opt into on-demand
  // rendering with `export const prerender = false`.
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    auth(),
    sitemap({
      filter: (page) =>
        !page.includes('/app/') &&
        !page.includes('/dashboard') &&
        !page.includes('/login') &&
        !page.includes('/signup') &&
        !page.includes('/forgot-password') &&
        // API docs are hidden for now — keep them out of the sitemap too.
        !page.includes('/developers'),
    }),
  ],
  vite: {
    plugins: [waTemplateStudioAlias(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: /^@\/(.*)$/,
          replacement: '$1',
          customResolver(source, importer) {
            return resolveAtImport(source, importer);
          },
        },
      ],
    },
    // nodemailer is a Node-only CJS dep (used by the SMTP welcome sender) —
    // keep it out of Vite's SSR transform/optimizer so it's required at runtime
    // (avoids a transient 500 on the first request that imports it in dev).
    ssr: {
      external: ['nodemailer'],
    },
  },
  redirects: {
    '/privacy-policy': '/legal/privacy',
    '/terms-of-service': '/legal/terms',
    // The workspace moved from /app/* to /dashboard/*; keep old URLs working.
    // Enumerated because Astro dynamic redirects need a matching dynamic
    // destination route, and /dashboard/* are plain file routes.
    '/app': '/dashboard',
    '/app/campaigns': '/dashboard/campaigns',
    '/app/templates': '/dashboard/templates',
    '/app/lists': '/dashboard/lists',
    '/app/subscribers': '/dashboard/subscribers',
    '/app/media': '/dashboard/media',
    '/app/analytics': '/dashboard/analytics',
    '/app/settings': '/dashboard/settings',
  },
});
