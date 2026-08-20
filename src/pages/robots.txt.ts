import type { APIRoute } from 'astro';
import { siteConfig } from '@/config/site';

/**
 * robots.txt generated from the resolved site URL so the Sitemap line always
 * matches the deploy origin (PUBLIC_SITE_URL).
 *
 * The disallow list mirrors the sitemap `filter` in astro.config.ts — the two
 * answer the same question and drifting apart means one of them is lying. It
 * had already drifted: the workspace moved from /app/* to /dashboard/* (see
 * the redirects in that config) and this file still blocked only the old path,
 * so the entire dashboard was crawlable. /app/ stays because the redirects
 * keep those URLs alive.
 */
export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

Disallow: /app/
Disallow: /dashboard
Disallow: /login
Disallow: /signup
Disallow: /forgot-password
Disallow: /developers

# Per-recipient, token-addressed pages. Nothing to index, and crawling
# /unsubscribe is actively unwanted.
Disallow: /unsubscribe
Disallow: /view
Disallow: /auth/

Sitemap: ${siteConfig.url}/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
