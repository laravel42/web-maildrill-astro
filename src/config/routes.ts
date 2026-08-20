import type { ChannelType } from '@/types/app';

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
    campaignReport: (id: string) => `/dashboard/campaigns/${id}/report`,
    templates: '/dashboard/templates',
    // Each channel's template builder is its own page; `?id=<templateId>`
    // reopens a saved template for editing.
    templateBuilder: (channel: ChannelType) => `/dashboard/templates/${channel}`,
    lists: '/dashboard/lists',
    list: (id: string) => `/dashboard/lists/${id}`,
    subscribers: '/dashboard/subscribers',
    subscriber: (id: string) => `/dashboard/subscribers/${id}`,
    media: '/dashboard/media',
    analytics: '/dashboard/analytics',
    settings: '/dashboard/settings',
  },
} as const;

export type AppRouteKey = keyof typeof routes.app;
