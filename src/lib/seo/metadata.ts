import { siteConfig } from '@/config/site';
import { defaultSeo, type PageSeo } from '@/config/seo';

export function absoluteUrl(path = '/'): string {
  const base = siteConfig.url.replace(/\/$/, '');
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function resolveSeo(page: PageSeo, pathname: string) {
  const canonical = page.canonical ?? absoluteUrl(pathname);
  const title = page.title.includes(siteConfig.name)
    ? page.title
    : defaultSeo.titleTemplate.replace('%s', page.title);
  const description = page.description || defaultSeo.description;
  const image = absoluteUrl(page.image || defaultSeo.openGraph.image);
  const robots = page.noindex ? 'noindex,nofollow' : page.robots || defaultSeo.robots;

  return {
    title,
    description,
    canonical,
    robots,
    image,
    type: page.type || 'website',
    publishedTime: page.publishedTime,
    modifiedTime: page.modifiedTime,
    author: page.author,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    twitterCard: defaultSeo.twitter.card,
    twitterSite: defaultSeo.twitter.site,
  };
}
