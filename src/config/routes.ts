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
  app: {
    root: '/app',
    dashboard: '/dashboard',
    campaigns: '/app/campaigns',
    templates: '/app/templates',
    lists: '/app/lists',
    subscribers: '/app/subscribers',
    media: '/app/media',
    analytics: '/app/analytics',
    settings: '/app/settings',
  },
} as const;

export type AppRouteKey = keyof typeof routes.app;
