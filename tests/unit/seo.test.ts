import { describe, expect, it } from 'vitest';
import { absoluteUrl, resolveSeo } from '@/lib/seo/metadata';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
} from '@/lib/seo/structured-data';
import { pricingFaqs } from '@/config/pricing';
import { marketingNav, appNav } from '@/config/navigation';
import { routes } from '@/config/routes';

describe('SEO helpers', () => {
  it('builds absolute URLs', () => {
    expect(absoluteUrl('/pricing')).toMatch(/\/pricing$/);
    expect(absoluteUrl('/')).not.toMatch(/\/$/);
  });

  it('resolves page metadata with canonical and robots', () => {
    const meta = resolveSeo(
      {
        title: 'Pricing',
        description: 'Pay per use',
      },
      '/pricing',
    );
    expect(meta.title).toContain('Pricing');
    expect(meta.canonical).toContain('/pricing');
    expect(meta.robots).toBe('index,follow');
  });

  it('marks noindex pages', () => {
    const meta = resolveSeo(
      { title: 'Log in', description: 'Auth', noindex: true },
      '/login',
    );
    expect(meta.robots).toBe('noindex,nofollow');
  });
});

describe('Structured data', () => {
  it('emits Organization JSON-LD', () => {
    const data = organizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data.name).toBe('Maildrill');
  });

  it('emits FAQPage matching visible pricing FAQs', () => {
    const data = faqPageJsonLd([...pricingFaqs]);
    expect(data['@type']).toBe('FAQPage');
    expect((data.mainEntity as unknown[]).length).toBe(pricingFaqs.length);
  });

  it('emits breadcrumbs and articles without fake ratings', () => {
    const crumbs = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]);
    expect(crumbs['@type']).toBe('BreadcrumbList');
    const article = articleJsonLd({
      title: 'Voice is here',
      description: 'Announcement',
      path: '/blog/voice-is-here',
      publishedTime: '2026-06-12T00:00:00.000Z',
      author: 'Ava Chen',
    });
    expect(article['@type']).toBe('BlogPosting');
    expect(JSON.stringify(article)).not.toMatch(/AggregateRating|reviewRating/);
  });
});

describe('Navigation config', () => {
  it('exposes marketing CTAs and app destinations', () => {
    expect(marketingNav.some((item) => item.label === 'Pricing')).toBe(true);
    expect(appNav.map((item) => item.href)).toContain(routes.app.campaigns);
  });
});
