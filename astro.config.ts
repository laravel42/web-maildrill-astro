import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import auth from 'auth-astro';

import { siteConfig } from './src/config/site';

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
        !page.includes('/login') &&
        !page.includes('/signup') &&
        !page.includes('/forgot-password'),
    }),
  ],
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
  redirects: {
    '/privacy-policy': '/legal/privacy',
    '/terms-of-service': '/legal/terms',
  },
});
