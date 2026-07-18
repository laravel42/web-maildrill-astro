export const siteConfig = {
  name: 'Maildrill',
  legalName: 'Maildrill, Inc.',
  tagline: 'The fastest professional workspace to create, deliver and analyze campaigns.',
  description:
    'Create, deliver, and analyze email, SMS, and WhatsApp campaigns from one calm workspace.',
  url: import.meta.env.PUBLIC_SITE_URL || 'https://maildrill.com',
  locale: 'en_US',
  twitterHandle: '@maildrill',
  email: {
    support: 'support@maildrill.com',
    legal: 'legal@maildrill.com',
    sales: 'sales@maildrill.com',
  },
  socialImage: '/images/og-default.png',
  foundingDate: '2022',
} as const;

export const externalUrls = {
  docs: 'https://docs.maildrill.com',
  status: 'https://status.maildrill.com',
  github: 'https://github.com/maildrill',
  twitter: 'https://twitter.com/maildrill',
  linkedin: 'https://www.linkedin.com/company/maildrill',
} as const;
