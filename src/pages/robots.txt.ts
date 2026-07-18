import type { APIRoute } from 'astro';
import { siteConfig } from '@/config/site';

/**
 * robots.txt generated from the resolved site URL so the Sitemap line always
 * matches the deploy origin (PUBLIC_SITE_URL). App + auth routes are noindex.
 */
export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

Disallow: /app/
Disallow: /login
Disallow: /signup
Disallow: /forgot-password

Sitemap: ${siteConfig.url}/sitemap-index.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
