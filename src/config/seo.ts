import { siteConfig } from './site';

export const defaultSeo = {
  titleTemplate: `%s · ${siteConfig.name}`,
  defaultTitle: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  robots: 'index,follow',
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    image: siteConfig.socialImage,
  },
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.twitterHandle,
  },
} as const;

export type PageSeo = {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  noindex?: boolean;
};
