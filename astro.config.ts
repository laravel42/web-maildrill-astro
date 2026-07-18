import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import { siteConfig } from './src/config/site';

export default defineConfig({
  site: siteConfig.url,
  trailingSlash: 'never',
  integrations: [
    react(),
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
