import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Publish the sitemap under its conventional name, `/sitemap.xml`.
 *
 * `@astrojs/sitemap` names its output `${filenameBase}-index.xml` — the
 * `-index` suffix is hardcoded, so no option produces `sitemap.xml`. Crawlers
 * do not care what it is called (robots.txt declares the location, and Search
 * Console takes any URL), but `sitemap.xml` is what people and tools try
 * first, so it is worth having.
 *
 * This copies rather than renames, deliberately: `sitemap-index.xml` keeps
 * working for anything already pointing at it — a Search Console submission,
 * an external monitor, a cached robots.txt.
 *
 * It copies the INDEX, not the single `sitemap-0.xml` chunk. Today there are
 * 22 URLs and exactly one chunk, so copying the chunk would look equivalent —
 * but it would quietly publish a partial sitemap the day the site crosses the
 * entry limit and a second chunk appears. A `<sitemapindex>` document served
 * as sitemap.xml is valid and stays correct at any size.
 */
const dist = join(process.cwd(), 'dist', 'client');
const source = join(dist, 'sitemap-index.xml');
const target = join(dist, 'sitemap.xml');

if (!existsSync(source)) {
  // Not fatal: `astro build` skips the sitemap when `site` is unset, and a
  // failed copy should not fail a build that otherwise produced a good site.
  console.warn('[sitemap] no sitemap-index.xml — nothing to publish as sitemap.xml');
  process.exit(0);
}

copyFileSync(source, target);
const chunks = (readFileSync(source, 'utf8').match(/<loc>/g) ?? []).length;
console.log(`[sitemap] sitemap.xml published (index of ${chunks} sitemap file(s))`);
