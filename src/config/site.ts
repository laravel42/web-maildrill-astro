export const siteConfig = {
  name: 'Maildrill',
  legalName: 'Maildrill, Inc.',
  tagline: 'The fastest professional workspace to create, deliver and analyze campaigns.',
  description:
    'Create, deliver, and analyze email, SMS, and WhatsApp campaigns from one calm workspace.',
  url: import.meta.env.PUBLIC_SITE_URL || 'https://maildrill.net',
  locale: 'en_US',
  twitterHandle: '@maildrill',
  email: {
    support: 'support@maildrill.net',
    legal: 'legal@maildrill.net',
    sales: 'sales@maildrill.net',
  },
  socialImage: '/images/og-default.png',
  foundingDate: '2022',
} as const;

export const externalUrls = {
  docs: 'https://docs.maildrill.net',
  status: 'https://status.maildrill.net',
  github: 'https://github.com/maildrill',
  twitter: 'https://twitter.com/maildrill',
  linkedin: 'https://www.linkedin.com/company/maildrill',
} as const;
