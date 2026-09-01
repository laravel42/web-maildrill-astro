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
    landings: '/dashboard/landings',
    // Landing pages are whole Builder42 sites, so there is a single editor
    // route rather than one per channel; `?id=<landingId>` reopens a saved one.
    landingBuilder: (id?: string) =>
      id ? `/dashboard/landings/editor?id=${encodeURIComponent(id)}` : '/dashboard/landings/editor',
    lists: '/dashboard/lists',
    list: (id: string) => `/dashboard/lists/${id}`,
    subscribers: '/dashboard/subscribers',
    subscriber: (id: string) => `/dashboard/subscribers/${id}`,
    automations: '/dashboard/automations',
    automation: (id: string) => `/dashboard/automations/${id}`,
    automationRuns: (id: string) => `/dashboard/automations/${id}/runs`,
    media: '/dashboard/media',
    analytics: '/dashboard/analytics',
    settings: '/dashboard/settings',
    /** Deep-link into a Settings subnav section (e.g. `domains`). */
    settingsSection: (section: string) =>
      `/dashboard/settings?section=${encodeURIComponent(section)}`,
  },
} as const;

export type AppRouteKey = keyof typeof routes.app;
