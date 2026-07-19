import type { IconName } from '@/lib/icons';

export type ChannelKey = 'email' | 'sms' | 'whatsapp' | 'voice';

export type Currency = { code: string; sym: string; fx: number };

/**
 * Display currencies. `fx` is a flat multiplier applied to USD base amounts.
 * Indicative mid-market rates as of 2026-07-18; invoices use the live rate at
 * billing time (see pricing FAQ).
 */
export const CURRENCIES: Currency[] = [
  { code: 'USD', sym: '$', fx: 1 },
  { code: 'EUR', sym: '€', fx: 0.8737 },
  { code: 'GBP', sym: '£', fx: 0.7434 },
  { code: 'CAD', sym: 'C$', fx: 1.4018 },
];

export type Tier = {
  id: number;
  name: string; // full name (prepay card)
  short: string; // tab label
  label: string; // regular discount label
  disc: number; // regular fraction off usage
  commit: number; // regular USD/yr prepaid commitment
  promoDisc: number; // launch-promo fraction off usage (see PROMO)
  promoCommit: number; // launch-promo USD/yr prepaid commitment
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
    promoDisc: 0,
    promoCommit: 0,
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
    promoDisc: 0.15,
    promoCommit: 1500,
    tagline: 'For steady monthly senders',
    note: 'Best for teams sending regularly who want a predictable, lower rate.',
  },
  {
    id: 2,
    name: 'Growth',
    short: 'Growth',
    label: '−20%',
    disc: 0.2,
    commit: 6000,
    promoDisc: 0.3,
    promoCommit: 3000,
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
    commit: 12000,
    promoDisc: 0.5,
    promoCommit: 6000,
    tagline: 'For high-volume senders',
    note: 'Maximum savings, priority support, and a dedicated success manager.',
  },
];

/**
 * Launch promo: deeper prepay discounts for a lower commitment, live through the
 * end of 2026-12-31 (UTC). When active a tier uses its `promoDisc`/`promoCommit`;
 * otherwise it falls back to the regular `disc`/`commit`. The active state is
 * evaluated at build time (see pricing.astro) — rebuild after the end date to
 * drop the promo — and the regular values remain the crossed-out reference.
 */
export const PROMO = {
  /** Human label for the last active day. */
  endsAtLabel: 'Dec 31, 2026',
  /** Exclusive upper bound: promo is active while `now < endsAt`. */
  endsAt: Date.UTC(2027, 0, 1),
} as const;

/** Whether the launch promo is live at `now` (defaults to the current time). */
export function isPromoActive(now: Date = new Date()): boolean {
  return now.getTime() < PROMO.endsAt;
}

/** Effective discount fraction for a tier given whether the promo is live. */
export function tierDisc(tier: Tier, promo: boolean): number {
  return promo ? tier.promoDisc : tier.disc;
}

/** Effective annual prepaid commitment for a tier given the promo state. */
export function tierCommit(tier: Tier, promo: boolean): number {
  return promo ? tier.promoCommit : tier.commit;
}

/** True when the promo actually moves this tier (skips Pay-as-you-go). */
export function tierHasPromo(tier: Tier, promo: boolean): boolean {
  return promo && tier.promoDisc !== tier.disc;
}

/**
 * One-time setup fee (USD). A single number covers SMS, WhatsApp, and voice, so
 * setup is one flat fee — charged once, not per channel. Email needs no number.
 */
export const SETUP_FEE = 49;

/** Channels that require the paid number/setup (email is free). */
export const SETUP_CHANNELS: ChannelKey[] = ['sms', 'whatsapp', 'voice'];

/** Flat worldwide email rate (USD per email). */
export const EMAIL_RATE = 0.0005;

/**
 * Destination pricing tiers. Maildrill uses fixed **regional** pricing rather
 * than per-country rates — simple to reason about and priced ~10% under the
 * most-used tools on the markets that matter most, always above our Infobip
 * cost. Rates are USD. `pricing-rates.json` is generated from these tiers (every
 * country carries its tier's rates), so keep the two in sync.
 */
export type RegionTier = {
  id: number;
  name: string;
  blurb: string; // example markets
  sms: number; // per text
  whatsapp: number; // per marketing message — Meta list rate + slim platform margin
  voice: number; // per minute
};

export const REGION_TIERS: RegionTier[] = [
  {
    id: 1,
    name: 'North America',
    blurb: 'United States, Canada',
    sms: 0.0079,
    whatsapp: 0.028,
    voice: 0.0125,
  },
  {
    id: 2,
    name: 'Europe',
    blurb: 'United Kingdom, Germany, France, Spain, Italy…',
    sms: 0.055,
    whatsapp: 0.085,
    voice: 0.022,
  },
  {
    id: 3,
    name: 'Latin America, Middle East & Africa',
    blurb: 'Mexico, Brazil, UAE, South Africa, Nigeria…',
    sms: 0.035,
    whatsapp: 0.05,
    voice: 0.03,
  },
  {
    id: 4,
    name: 'Asia & Pacific',
    blurb: 'India, China, Japan, Australia, Indonesia…',
    sms: 0.02,
    whatsapp: 0.025,
    voice: 0.022,
  },
];

/**
 * Head-to-head with the most-used commercial tools (representative US-market list
 * prices, mid-2026), one column per tool. Maildrill is one platform for all four
 * channels — where a rival doesn't offer a channel it shows "—", so you'd stitch
 * several tools together. No per-number rentals, no carrier surcharges.
 */
// Twilio's email is SendGrid (which it owns), folded into the Twilio column.
export const COMPARISON_TOOLS = [
  'Maildrill',
  'Twilio',
  'Sinch',
  'Vonage',
  'Brevo',
  'Telnyx',
] as const;
export type CompareTool = (typeof COMPARISON_TOOLS)[number];

export type CompareRow = {
  channel: string;
  unit: string;
  prices: Record<CompareTool, string>; // "—" where the tool doesn't offer it
};

export const COMPARISON: CompareRow[] = [
  {
    channel: 'Email',
    unit: 'per email',
    prices: {
      Maildrill: '$0.0005',
      Twilio: '~$0.0007',
      Sinch: '~$0.0008',
      Vonage: '—',
      Brevo: '~$0.0006',
      Telnyx: '—',
    },
  },
  {
    channel: 'SMS',
    unit: 'per text',
    prices: {
      Maildrill: '$0.0079',
      Twilio: '~$0.012*',
      Sinch: '$0.024',
      Vonage: '$0.0086',
      Brevo: '~$0.011',
      Telnyx: '~$0.008*',
    },
  },
  {
    channel: 'WhatsApp',
    unit: 'per marketing message',
    prices: {
      Maildrill: '$0.028',
      Twilio: '~$0.030',
      Sinch: '$0.05',
      Vonage: '~$0.026',
      Brevo: '$0.0346',
      Telnyx: '~$0.029',
    },
  },
  {
    channel: 'Voice',
    unit: 'per minute',
    prices: {
      Maildrill: '$0.0125',
      Twilio: '$0.014',
      Sinch: '—',
      Vonage: '$0.0154',
      Brevo: '—',
      Telnyx: 'Variable',
    },
  },
];

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
      "You pre-load a balance and every send draws it down in real time at that channel's rate — emails, SMS, WhatsApp conversations, and voice minutes. There's no invoice at the end of the month and no way to overspend: you only ever spend credit you've already added. When your balance runs low, auto-recharge tops it up before it runs out (or sending pauses until you do). Email is a single flat rate worldwide; SMS, WhatsApp, and voice are priced by region. No plans, no seat charges.",
  },
  {
    question: 'How is WhatsApp priced?',
    answer:
      'WhatsApp is charged per 24-hour conversation, grouped into categories that reflect the use case — Marketing, Utility, Authentication, and Service (free-form replies). Each category has its own rate; the estimator above uses the Marketing conversation rate. Utility and authentication conversations are cheaper.',
  },
  {
    question: 'How do annual prepay discounts work?',
    answer:
      'Commit to an annual usage balance up front (Starter, Growth, or Scale) and every per-message rate drops. During our launch promo — through December 31, 2026 — prepay discounts run 15–50% for a lower commitment; they return to the standard 10–30% afterward. Your prepaid credit is drawn down as you send and unused balance rolls over through the year. Setup fees are separate and not discounted.',
  },
  {
    question: 'Which currencies can I be billed in?',
    answer:
      "Billing is always in USD — your balance and every charge are in US dollars. The currency switcher on this page is just for display: it converts the shown rates to EUR, GBP, or CAD at an indicative rate so you can gauge local cost, but it doesn't change how you're billed.",
  },
  {
    question: 'Can I go beyond the Scale tier?',
    answer:
      'Yes. For committed volume above the Scale tier, dedicated infrastructure, or custom contracts, get in touch with sales for bespoke rates.',
  },
] as const;
