import type { ChannelType } from '@/types/app';
import { channelLabel } from './shared/channels';
import type {
  AudienceChoice,
  Schedule,
  Template,
  TemplateChoice,
} from './CampaignWizard.types';

export const SENDER: Record<ChannelType, { label: string; value: string }> = {
  email: { label: 'Sender', value: 'Maildrill Team <hello@maildrill.app>' },
  sms: { label: 'Sender ID', value: 'MAILDRILL' },
  whatsapp: { label: 'Business number', value: '+1 555 010 0142' },
  voice: { label: 'Caller ID', value: '+1 555 010 0199' },
};

export const CONTENT_SUB: Record<ChannelType, string> = {
  email: 'Design your email',
  sms: 'Write your text message',
  whatsapp: 'Compose your WhatsApp message',
  voice: 'Write your voice script',
};

/** "Newsletter (856)" — the audience as shown in the review step and toasts. */
export function audienceLabelOf(a: AudienceChoice | null): string {
  if (!a) return 'No audience selected';
  return a.count == null ? a.name : `${a.name} (${a.count.toLocaleString()})`;
}

/* Card gradients for real templates, which carry no styling of their own.
   Indexing by position keeps a given list of templates visually stable. */
const TEMPLATE_THUMBS = [
  'linear-gradient(150deg,#4f46e5,#6d28d9)',
  'linear-gradient(150deg,#34d399,#059669)',
  'linear-gradient(150deg,#06b6d4,#0891b2)',
  'linear-gradient(150deg,#f59e0b,#d97706)',
  'linear-gradient(150deg,#ec4899,#be185d)',
];

/**
 * Present a saved template as a wizard card. Real templates only have a name and
 * category, so the decorative fields the preview needs are derived rather than
 * stored — the selection is what matters, not the thumbnail.
 */
export function templateCard(t: TemplateChoice, index: number): Template {
  return {
    id: t.id,
    name: t.name,
    thumb: TEMPLATE_THUMBS[index % TEMPLATE_THUMBS.length]!,
    fg: '#fff',
    title: t.name.toUpperCase(),
    kicker: t.category ?? '',
    cat: t.category ?? 'Uncategorized',
  };
}

export const TEMPLATES: Record<ChannelType, Template[]> = {
  email: [
    {
      name: 'Summer Sale',
      thumb: 'linear-gradient(150deg,#4f46e5,#6d28d9)',
      fg: '#fff',
      title: 'SUMMER SALE',
      kicker: 'LIMITED TIME',
      cta: 'Shop the sale',
      cat: 'Promotional',
    },
    {
      name: 'Welcome Series',
      thumb: '#f6b8a0',
      fg: '#7c2d12',
      title: 'WELCOME',
      kicker: 'GLAD YOU’RE HERE',
      cta: 'Get started',
      cat: 'Transactional',
    },
    {
      name: 'Spring Preview',
      thumb: 'linear-gradient(150deg,#34d399,#059669)',
      fg: '#fff',
      title: 'SPRING PREVIEW',
      kicker: 'THE EDIT',
      cta: 'See the collection',
      cat: 'Newsletter',
    },
  ],
  sms: [
    {
      name: 'Flash Sale Text',
      thumb: 'linear-gradient(150deg,#06b6d4,#0891b2)',
      cta: 'Shop now',
      cat: 'Promotional',
    },
    {
      name: 'Appointment Reminder',
      thumb: 'linear-gradient(150deg,#06b6d4,#0e7490)',
      cta: 'Confirm',
      cat: 'Transactional',
    },
  ],
  whatsapp: [
    {
      name: 'Order Update',
      thumb: 'linear-gradient(150deg,#22c55e,#16a34a)',
      cta: 'Track order',
      cat: 'Transactional',
    },
    {
      name: 'Delivery Notice',
      thumb: 'linear-gradient(150deg,#34d399,#059669)',
      cta: 'View status',
      cat: 'Transactional',
    },
  ],
  voice: [
    {
      name: 'Payment Reminder',
      thumb: 'linear-gradient(150deg,#f59e0b,#d97706)',
      cta: 'Pay now',
      cat: 'Transactional',
    },
    {
      name: 'Appointment Call',
      thumb: 'linear-gradient(150deg,#fbbf24,#d97706)',
      cta: 'Confirm',
      cat: 'Reminder',
    },
  ],
};

/** Left-rail step definitions: `[title, subtitle]`. Step 3's subtitle is channel-specific. */
export function buildStepDefs(contentSub: string): [string, string][] {
  return [
    ['Sender', 'Basics'],
    ['Audience', 'Choose recipients'],
    ['Content', contentSub],
    ['Schedule', 'Set delivery'],
    ['Review', 'Check everything'],
  ];
}

/** Review-step summary rows: `[label, value]`. */
export function buildReviewRows(
  name: string,
  channel: ChannelType,
  audienceLabel: string,
  selectedTemplate: string | null,
  schedule: Schedule,
): [string, string][] {
  const isEmail = channel === 'email';
  return [
    ['Campaign', name || 'Untitled'],
    ['Channel', channelLabel(channel)],
    [
      'Sender',
      isEmail
        ? 'Maildrill Team <hello@maildrill.app>'
        : channel === 'sms'
          ? 'MAILDRILL (sender ID)'
          : channel === 'whatsapp'
            ? '+1 555 010 0142'
            : '+1 555 010 0199 (caller ID)',
    ],
    ['Audience', audienceLabel],
    ['Template', selectedTemplate ?? 'Summer Sale'],
    ['Delivery', schedule === 'now' ? 'Send immediately' : 'Jul 15, 2026 · 09:00 AM'],
  ];
}
