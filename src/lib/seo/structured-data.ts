import { siteConfig, externalUrls } from '@/config/site';
import { absoluteUrl } from './metadata';

type JsonLd = Record<string, unknown>;

function withContext(data: JsonLd): JsonLd {
  return { '@context': 'https://schema.org', ...data };
}

export function organizationJsonLd(): JsonLd {
  return withContext({
    '@type': 'Organization',
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.url,
    logo: absoluteUrl('/images/maildrill-logo.png'),
    foundingDate: siteConfig.foundingDate,
    email: siteConfig.email.support,
    sameAs: [externalUrls.twitter, externalUrls.linkedin, externalUrls.github],
  });
}

export function websiteJsonLd(): JsonLd {
  return withContext({
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    publisher: { '@type': 'Organization', name: siteConfig.name },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/support')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });
}

export function softwareApplicationJsonLd(): JsonLd {
  return withContext({
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: siteConfig.description,
    url: siteConfig.url,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Pay-per-use messaging with a free trial',
    },
  });
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return withContext({
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  });
}

export function faqPageJsonLd(faqs: { question: string; answer: string }[]): JsonLd {
  return withContext({
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  publishedTime: string;
  modifiedTime?: string;
  author: string;
  image?: string;
}): JsonLd {
  return withContext({
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    datePublished: input.publishedTime,
    dateModified: input.modifiedTime || input.publishedTime,
    author: { '@type': 'Person', name: input.author },
    image: absoluteUrl(input.image || siteConfig.socialImage),
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/images/maildrill-logo.png') },
    },
    mainEntityOfPage: absoluteUrl(input.path),
  });
}

export function serviceJsonLd(input: { name: string; description: string; path: string }): JsonLd {
  return withContext({
    '@type': 'Service',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    provider: { '@type': 'Organization', name: siteConfig.name },
    areaServed: 'Worldwide',
  });
}

export function productJsonLd(input: { name: string; description: string; path: string }): JsonLd {
  return withContext({
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    brand: { '@type': 'Brand', name: siteConfig.name },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      // Lowest per-message rate shown on the pricing page (email, flat worldwide).
      lowPrice: '0.0005',
      offerCount: 4,
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(input.path),
      description: 'Pay-per-use pricing with no monthly minimum',
    },
  });
}

export function personJsonLd(name: string, jobTitle?: string): JsonLd {
  return withContext({
    '@type': 'Person',
    name,
    ...(jobTitle ? { jobTitle } : {}),
    worksFor: { '@type': 'Organization', name: siteConfig.name },
  });
}
