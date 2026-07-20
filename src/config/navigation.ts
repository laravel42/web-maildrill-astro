import { routes } from './routes';
import type { IconName } from '@/lib/icons';

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  icon?: IconName;
  color?: string;
  tint?: string;
};

export type NavGroup = {
  label: string;
  href?: string;
  children?: NavLink[];
};

/**
 * Marketing primary nav — mirrors MaildrillNav.dc.html: Product and Pricing and
 * Contact are plain links; Channels and Resources open icon-tile dropdowns.
 */
export const marketingNav: NavGroup[] = [
  { label: 'Product', href: routes.product },
  {
    label: 'Channels',
    href: `${routes.product}#channels`,
    children: [
      {
        label: 'Email',
        href: routes.channels.email,
        description: 'Inbox-ready campaigns & builder',
        icon: 'mail',
        color: 'var(--ch-email)',
        tint: 'var(--ch-email-tint)',
      },
      {
        label: 'SMS',
        href: routes.channels.sms,
        description: 'Two-way texting, instant reach',
        icon: 'sms',
        color: 'var(--ch-sms)',
        tint: 'var(--ch-sms-tint)',
      },
      {
        label: 'WhatsApp',
        href: routes.channels.whatsapp,
        description: 'Rich Business API conversations',
        icon: 'whatsapp',
        color: 'var(--ch-whatsapp)',
        tint: 'var(--ch-whatsapp-tint)',
      },
      {
        label: 'Voice',
        href: routes.channels.voice,
        description: 'Automated calls & IVR flows',
        icon: 'voice',
        color: 'var(--ch-voice)',
        tint: 'var(--ch-voice-tint)',
      },
    ],
  },
  {
    label: 'Resources',
    href: routes.blog,
    children: [
      {
        label: 'Blog',
        href: routes.blog,
        description: 'News, product updates & tactics',
        icon: 'blog',
        color: 'var(--accent)',
        tint: 'var(--accent-tint)',
      },
      {
        label: 'Guides',
        href: routes.guides,
        description: 'Step-by-step playbooks',
        icon: 'guides',
        color: 'var(--ch-whatsapp)',
        tint: 'var(--ch-whatsapp-tint)',
      },
      {
        label: 'Deliverability',
        href: routes.deliverability,
        description: 'Inbox placement & authentication',
        icon: 'shield',
        color: 'var(--ch-voice)',
        tint: 'var(--ch-voice-tint)',
      },
      {
        label: 'Support',
        href: routes.support,
        description: 'Help center & contact options',
        icon: 'help',
        color: 'var(--accent)',
        tint: 'var(--accent-tint)',
      },
    ],
  },
  { label: 'Pricing', href: routes.pricing },
  { label: 'Contact', href: routes.contact },
];

export const marketingCtas = {
  primary: { label: 'Start free trial', href: routes.auth.signup },
  secondary: { label: 'Log in', href: routes.auth.login },
} as const;

export const footerNav = {
  Product: [
    { label: 'Features', href: routes.product },
    { label: 'Channels', href: `${routes.product}#channels` },
    { label: 'Pricing', href: routes.pricing },
    { label: 'Deliverability', href: routes.deliverability },
  ],
  Resources: [
    { label: 'Blog', href: routes.blog },
    { label: 'Guides', href: routes.guides },
    { label: 'Support', href: routes.support },
  ],
  Company: [
    { label: 'About', href: routes.about },
    { label: 'Contact', href: routes.contact },
    { label: 'Privacy', href: routes.legal.privacy },
    { label: 'Terms', href: routes.legal.terms },
  ],
} as const;

export type AppNavItem = {
  label: string;
  href: string;
  icon: IconName;
};

export const appNav: AppNavItem[] = [
  { label: 'Dashboard', href: routes.app.dashboard, icon: 'dashboard' },
  { label: 'Campaigns', href: routes.app.campaigns, icon: 'campaigns' },
  { label: 'Templates', href: routes.app.templates, icon: 'templates' },
  { label: 'Lists', href: routes.app.lists, icon: 'lists' },
  { label: 'Subscribers', href: routes.app.subscribers, icon: 'subscribers' },
  { label: 'Media Library', href: routes.app.media, icon: 'media' },
  { label: 'Analytics', href: routes.app.analytics, icon: 'analytics' },
];

export const appSettingsNav: AppNavItem = {
  label: 'Settings',
  href: routes.app.settings,
  icon: 'settings',
};
