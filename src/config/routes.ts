export const routes = {
  home: '/',
  product: '/product',
  pricing: '/pricing',
  about: '/about',
  contact: '/contact',
  support: '/support',
  deliverability: '/deliverability',
  apiDocs: '/developers',
  blog: '/blog',
  guides: '/guides',
  channels: {
    email: '/channels/email',
    sms: '/channels/sms',
    whatsapp: '/channels/whatsapp',
    voice: '/channels/voice',
  },
  legal: {
    privacy: '/legal/privacy',
    terms: '/legal/terms',
  },
  auth: {
    login: '/login',
    signup: '/signup',
    forgotPassword: '/forgot-password',
  },
  // The workspace lives entirely under /dashboard/*; legacy /app/* URLs
  // 301 there via astro.config redirects.
  app: {
    root: '/dashboard',
    dashboard: '/dashboard',
    campaigns: '/dashboard/campaigns',
    templates: '/dashboard/templates',
    lists: '/dashboard/lists',
    subscribers: '/dashboard/subscribers',
    media: '/dashboard/media',
    analytics: '/dashboard/analytics',
    settings: '/dashboard/settings',
  },
} as const;

export type AppRouteKey = keyof typeof routes.app;
