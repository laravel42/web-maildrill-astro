import type { IconName } from '@/lib/icons';

export type ChannelKey = 'email' | 'sms' | 'whatsapp' | 'voice';

export type Currency = { code: string; sym: string; fx: number };

/** Display currencies. `fx` is a flat multiplier applied to USD base amounts. */
export const CURRENCIES: Currency[] = [
  { code: 'USD', sym: '$', fx: 1 },
  { code: 'EUR', sym: '€', fx: 0.92 },
  { code: 'GBP', sym: '£', fx: 0.79 },
  { code: 'CAD', sym: 'C$', fx: 1.37 },
];

export type Tier = {
  id: number;
  name: string; // full name (prepay card)
  short: string; // tab label
  label: string; // discount label
  disc: number; // fraction off usage
  commit: number; // USD/yr prepaid commitment
  tagline: string;
  note: string;
  hi?: boolean; // highlighted card
};

export const TIERS: Tier[] = [
  {
    id: 0,
    name: 'Pay as you go',
    short: 'Monthly',
    label: '0% off',
    disc: 0,
    commit: 0,
    tagline: 'Monthly billing, cancel anytime',
    note: 'Standard per-message rates. Pay only for what you send each month.',
  },
  {
    id: 1,
    name: 'Starter',
    short: 'Starter',
    label: '−10%',
    disc: 0.1,
    commit: 3000,
    tagline: 'For steady monthly senders',
    note: 'Best for teams sending regularly who want a predictable, lower rate.',
  },
  {
    id: 2,
    name: 'Growth',
    short: 'Growth',
    label: '−20%',
    disc: 0.2,
    commit: 12000,
    tagline: 'For scaling lifecycle programs',
    note: 'Our most popular commitment — balances savings and flexibility.',
    hi: true,
  },
  {
    id: 3,
    name: 'Scale',
    short: 'Scale',
    label: '−30%',
    disc: 0.3,
    commit: 36000,
    tagline: 'For high-volume senders',
    note: 'Maximum savings, priority support, and a dedicated success manager.',
  },
];

/** One-time per-channel activation fee (USD). */
export const SETUP: Record<ChannelKey, number> = {
  email: 0,
  sms: 49,
  whatsapp: 99,
  voice: 149,
};

/** Flat worldwide email rate (USD per email). */
export const EMAIL_RATE = 0.0004;

export type ChannelMeta = {
  key: ChannelKey;
  label: string;
  icon: IconName;
  color: string; // CSS var
  tint: string; // CSS var
  noun: string; // plural unit noun
  unit: string; // rate-card unit line ({country} substituted where present)
  max: number;
  step: number;
  default: number;
};

export const CHANNEL_META: ChannelMeta[] = [
  {
    key: 'email',
    label: 'Email',
    icon: 'mail',
    color: 'var(--ch-email)',
    tint: 'var(--ch-email-tint)',
    noun: 'emails',
    unit: 'per email, one flat rate worldwide',
    max: 2_000_000,
    step: 10_000,
    default: 250_000,
  },
  {
    key: 'sms',
    label: 'SMS',
    icon: 'sms',
    color: 'var(--ch-sms)',
    tint: 'var(--ch-sms-tint)',
    noun: 'texts',
    unit: 'per SMS · {country}',
    max: 200_000,
    step: 1_000,
    default: 20_000,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    color: 'var(--ch-whatsapp)',
    tint: 'var(--ch-whatsapp-tint)',
    noun: 'conversations',
    unit: 'per marketing conversation · {country}',
    max: 100_000,
    step: 500,
    default: 8_000,
  },
  {
    key: 'voice',
    label: 'Voice',
    icon: 'voice',
    color: 'var(--ch-voice)',
    tint: 'var(--ch-voice-tint)',
    noun: 'minutes',
    unit: 'per minute · {country}',
    max: 60_000,
    step: 500,
    default: 4_000,
  },
];

/** Everything every account gets, regardless of volume. */
export const includedItems: string[] = [
  'Campaign wizard & drag-and-drop builder',
  'One shared audience across all channels',
  'Live segments & subscriber CRM',
  'Deep analytics, funnels & comparisons',
  'AI copilot for copy & subject lines',
  'Deliverability & reputation monitoring',
  'Template gallery & media library',
  'Team roles, permissions & audit log',
  'API access, webhooks & integrations',
];

export const pricingFaqs = [
  {
    question: 'How does pay-per-use billing work?',
    answer:
      "You're billed monthly for exactly what you sent — emails delivered, SMS messages, WhatsApp conversations, and voice minutes — at the per-message rate for each channel. Email is a single flat rate worldwide; SMS and voice are priced per destination country and network, so the figures above are average rates. No plans, no seat charges.",
  },
  {
    question: 'How is WhatsApp priced?',
    answer:
      'WhatsApp is charged per 24-hour conversation, grouped into categories that reflect the use case — Marketing, Utility, Authentication, and Service (free-form replies). Each category has its own rate; the estimator above uses the Marketing conversation rate. Utility and authentication conversations are cheaper.',
  },
  {
    question: 'How do annual prepay discounts work?',
    answer:
      'Commit to an annual usage balance up front (Starter, Growth, or Scale) and every per-message rate drops by 10–30%. Your prepaid credit is drawn down as you send and unused balance rolls over through the year. Setup fees are separate and not discounted.',
  },
  {
    question: 'Which currencies can I be billed in?',
    answer:
      'USD, EUR, GBP, and CAD. Pick your currency with the switcher at the top of this page; conversions shown are indicative and your invoice uses the live rate at billing time.',
  },
  {
    question: 'Can I go beyond the Scale tier?',
    answer:
      'Yes. For committed volume above the Scale tier, dedicated infrastructure, or custom contracts, get in touch with sales for bespoke rates.',
  },
] as const;
