import { routes } from './routes';

export type ChannelKey = 'email' | 'sms' | 'whatsapp' | 'voice';

export type Channel = {
  key: ChannelKey;
  label: string;
  href: string;
  colorVar: string;
  tagline: string;
  description: string;
  capabilities: string[];
  useCases: string[];
  steps: string[];
};

export const channels: Channel[] = [
  {
    key: 'email',
    label: 'Email',
    href: routes.channels.email,
    colorVar: 'var(--ch-email)',
    tagline: 'Marketing and transactional email that lands.',
    description:
      'Design, send, and measure email campaigns with authentication, spam scoring, and deep open/click analytics built in.',
    capabilities: [
      'Visual block builder with HTML export',
      'Domain authentication and spam-score checks',
      'Open, click, and click-to-open metrics',
      'Attachments, preheaders, and plain-text fallbacks',
    ],
    useCases: ['Product launches', 'Lifecycle nurture', 'Transactional receipts', 'Newsletters'],
    steps: ['Authenticate your domain', 'Pick a template', 'Target lists & segments', 'Schedule or send'],
  },
  {
    key: 'sms',
    label: 'SMS',
    href: routes.channels.sms,
    colorVar: 'var(--ch-sms)',
    tagline: 'Concise messages with segment-aware pricing.',
    description:
      'Compose SMS with live character and segment counts, then deliver worldwide with destination-based rates.',
    capabilities: [
      'Live segment & character counters',
      'Sender ID management',
      'Delivery receipts and retries',
      'Shared audience with email & WhatsApp',
    ],
    useCases: ['Order updates', 'Appointment reminders', 'OTP / alerts', 'Flash promotions'],
    steps: ['Choose a sender', 'Draft with segment count', 'Select audience', 'Review & send'],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: routes.channels.whatsapp,
    colorVar: 'var(--ch-whatsapp)',
    tagline: 'Conversations that convert across the funnel.',
    description:
      'Send WhatsApp template and session messages with conversation-category pricing and a live phone preview.',
    capabilities: [
      'Template & session messaging',
      'Conversation category pricing',
      'Rich media support',
      'Phone-frame live preview',
    ],
    useCases: ['Support follow-ups', 'Abandoned cart', 'Appointment confirmations', 'Customer care'],
    steps: ['Connect WhatsApp Business', 'Approve templates', 'Target audience', 'Launch conversation'],
  },
  {
    key: 'voice',
    label: 'Voice',
    href: routes.channels.voice,
    colorVar: 'var(--ch-voice)',
    tagline: 'Automated calls when a message needs a voice.',
    description:
      'Reach contacts with automated voice campaigns for high-urgency moments — explored in the product design and available as a channel surface.',
    capabilities: [
      'Text-to-speech scripts',
      'Retry & schedule windows',
      'Per-minute destination rates',
      'Campaign analytics alongside other channels',
    ],
    useCases: ['Urgent alerts', 'Appointment confirmations', 'Collections reminders', 'Event day outreach'],
    steps: ['Write the script', 'Pick destination markets', 'Select audience', 'Schedule the call window'],
  },
];

export function getChannel(key: ChannelKey): Channel {
  const channel = channels.find((item) => item.key === key);
  if (!channel) throw new Error(`Unknown channel: ${key}`);
  return channel;
}
