import type { IconName } from '@/lib/icons';
import { routes } from './routes';

/**
 * Rich per-channel content for the marketing channel pages
 * (`/channels/[channel]`). Mirrors the `ALL` data bundle in the design
 * prototype `ChannelTemplate.dc.html`. Imported only by
 * `src/pages/channels/[channel].astro`.
 *
 * NOTE: `src/config/channels.ts` keeps its own leaner `Channel` shape used by
 * the product page — this module is intentionally separate so that page is
 * unaffected.
 */

export type ChannelPageKey = 'email' | 'sms' | 'whatsapp' | 'voice';

/** `wizard` has no entry in the shared icon set — the page inlines an SVG. */
export type ChannelFeatureIcon = IconName | 'wizard';

export type ChannelStat = {
  to: number;
  suffix: string;
  prefix: string;
  decimals: number;
  label: string;
  delay: number;
};

export type ChannelFeature = {
  icon: ChannelFeatureIcon;
  title: string;
  desc: string;
  delay: number;
};

export type ChannelUseCase = {
  num: string;
  title: string;
  desc: string;
  delay: number;
};

export type ChannelVisual = 'email' | 'sms' | 'whatsapp' | 'voice';

export type ChannelPage = {
  key: ChannelPageKey;
  label: string;
  /** Nav / eyebrow-pill icon. */
  icon: IconName;
  /** Channel accent color (CSS var, theme-aware). */
  color: string;
  /** Channel tint background (CSS var, theme-aware). */
  tint: string;
  /** Hero radial-glow color (rgba literal). */
  glow: string;
  /** Which hero device mock to render. */
  visual: ChannelVisual;
  /** Route to this page. */
  href: string;
  /** Short tag shown on the "other channels" cards. */
  tag: string;
  h1: string;
  sub: string;
  featuresTitle: string;
  useTitle: string;
  features: ChannelFeature[];
  useCases: ChannelUseCase[];
  stats: ChannelStat[];
  seo: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    keywords: string;
  };
};

export type ChannelStep = { n: string; title: string; desc: string; delay: number };

/** Shared "How it works" steps — identical for every channel. */
export const channelSteps: ChannelStep[] = [
  { n: '01', title: 'Connect', desc: 'Verify your sender and authenticate in minutes.', delay: 0 },
  { n: '02', title: 'Build', desc: 'Compose in the editor with a live preview.', delay: 80 },
  { n: '03', title: 'Target', desc: 'Pick a live segment from your shared audience.', delay: 160 },
  {
    n: '04',
    title: 'Send & learn',
    desc: 'Ship it, then read the analytics that follow.',
    delay: 240,
  },
];

/** Fixed channel order used for `getStaticPaths` and the "other channels" grid. */
export const channelOrder: ChannelPageKey[] = ['email', 'sms', 'whatsapp', 'voice'];

export const channelPages: Record<ChannelPageKey, ChannelPage> = {
  email: {
    key: 'email',
    label: 'Email',
    icon: 'mail',
    color: 'var(--ch-email)',
    tint: 'var(--ch-email-tint)',
    glow: 'rgba(79, 70, 229, 0.12)',
    visual: 'email',
    href: routes.channels.email,
    tag: 'Inbox-ready campaigns',
    h1: 'Email that lands in the inbox.',
    sub: 'Design on-brand emails with a drag-and-drop builder and send them with deliverability tooling that keeps you out of the spam folder — at any volume.',
    featuresTitle: 'A builder and an engine, in one.',
    useTitle: 'What teams send with email.',
    features: [
      {
        icon: 'edit',
        title: 'Drag-and-drop builder',
        desc: 'Compose with a block library, property inspector, and a live responsive preview.',
        delay: 0,
      },
      {
        icon: 'layers',
        title: 'Reusable templates',
        desc: 'A categorized template gallery keeps every send on-brand.',
        delay: 80,
      },
      {
        icon: 'shield',
        title: 'Authentication',
        desc: 'Guided SPF, DKIM, and DMARC setup so mailbox providers trust you.',
        delay: 160,
      },
      {
        icon: 'chart',
        title: 'Open & click analytics',
        desc: 'Heatmaps, top links, and device breakdowns for every campaign.',
        delay: 0,
      },
      {
        icon: 'filter',
        title: 'Live segments',
        desc: 'Target dynamic audiences that update as subscriber behavior changes.',
        delay: 80,
      },
      {
        icon: 'sparkle',
        title: 'AI subject lines',
        desc: 'Generate and A/B test subject-line variants without leaving the editor.',
        delay: 160,
      },
    ],
    useCases: [
      {
        num: '01',
        title: 'Newsletters',
        desc: 'Recurring editorial sends with reusable layouts and one-click scheduling.',
        delay: 0,
      },
      {
        num: '02',
        title: 'Product launches',
        desc: 'High-impact announcements with imagery, countdowns, and clear CTAs.',
        delay: 80,
      },
      {
        num: '03',
        title: 'Lifecycle flows',
        desc: 'Welcome, win-back, and post-purchase series driven by live segments.',
        delay: 160,
      },
    ],
    stats: [
      {
        to: 99.2,
        decimals: 1,
        suffix: '%',
        prefix: '',
        label: 'Average inbox placement',
        delay: 0,
      },
      { to: 54, decimals: 0, suffix: '%', prefix: '', label: 'Median open rate uplift', delay: 80 },
      // Design intent is "<0.1%": encode as 0.1 with a "<" prefix so the count-up
      // formatter (prefix + value + suffix) renders "<0.1%" rather than "<00.1%".
      { to: 0.1, decimals: 1, suffix: '%', prefix: '<', label: 'Spam-complaint rate', delay: 160 },
    ],
    seo: {
      title: 'Email Marketing — Maildrill inbox-ready email campaigns',
      description:
        'Maildrill email marketing: a drag-and-drop builder, reusable templates, live segments, and deliverability tooling for 99.2% inbox placement across newsletters, launches, and lifecycle flows.',
      ogTitle: 'Maildrill Email — that lands in the inbox',
      ogDescription:
        'A drag-and-drop builder plus deliverability tooling that keeps you out of the spam folder.',
      keywords:
        'email marketing platform, drag-and-drop email builder, email deliverability, email templates, newsletter software, lifecycle email',
    },
  },
  sms: {
    key: 'sms',
    label: 'SMS',
    icon: 'sms',
    color: 'var(--ch-sms)',
    tint: 'var(--ch-sms-tint)',
    glow: 'rgba(8, 145, 178, 0.14)',
    visual: 'sms',
    href: routes.channels.sms,
    tag: 'Instant two-way texting',
    h1: 'SMS people actually read.',
    sub: 'Reach customers in seconds with two-way texting, link tracking, and carrier-grade routing — plus automatic opt-out handling to keep you compliant everywhere you send.',
    featuresTitle: 'Conversational, compliant, fast.',
    useTitle: 'What teams send with SMS.',
    features: [
      {
        icon: 'sms',
        title: 'Two-way messaging',
        desc: 'Real conversations with inbound replies routed to your team.',
        delay: 0,
      },
      {
        icon: 'globe',
        title: 'Carrier-grade routing',
        desc: 'Global delivery with local numbers and smart failover.',
        delay: 80,
      },
      {
        icon: 'shield',
        title: 'Opt-out handling',
        desc: 'Automatic STOP/HELP compliance and quiet-hours enforcement.',
        delay: 160,
      },
      {
        icon: 'chart',
        title: 'Link tracking',
        desc: 'Shortened, branded links with per-recipient click attribution.',
        delay: 0,
      },
      {
        icon: 'clock',
        title: 'Send-time control',
        desc: 'Timezone-aware scheduling so texts land at the right moment.',
        delay: 80,
      },
      {
        icon: 'filter',
        title: 'Shared segments',
        desc: 'Use the same live segments you built for email — no re-import.',
        delay: 160,
      },
    ],
    useCases: [
      {
        num: '01',
        title: 'Cart recovery',
        desc: 'Timely nudges with a discount link that convert abandoned carts.',
        delay: 0,
      },
      {
        num: '02',
        title: 'Order & shipping alerts',
        desc: 'Transactional updates people open within minutes.',
        delay: 80,
      },
      {
        num: '03',
        title: 'Flash promotions',
        desc: 'Time-boxed offers that reach the whole list instantly.',
        delay: 160,
      },
    ],
    stats: [
      {
        to: 98,
        decimals: 0,
        suffix: '%',
        prefix: '',
        label: 'Messages read within 3 min',
        delay: 0,
      },
      { to: 45, decimals: 0, suffix: '%', prefix: '', label: 'Avg. click-through rate', delay: 80 },
      { to: 8, decimals: 0, suffix: 's', prefix: '', label: 'Median delivery time', delay: 160 },
    ],
    seo: {
      title: 'SMS Marketing — Maildrill two-way texting & carrier-grade routing',
      description:
        'Maildrill SMS marketing: two-way texting, branded link tracking, carrier-grade global routing, and automatic opt-out handling — for cart recovery, order alerts, and flash promotions.',
      ogTitle: 'Maildrill SMS — texts people actually read',
      ogDescription:
        'Two-way texting with link tracking, carrier-grade routing, and automatic opt-out handling.',
      keywords:
        'SMS marketing platform, two-way texting, bulk SMS, SMS link tracking, SMS compliance, text message marketing',
    },
  },
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    color: 'var(--ch-whatsapp)',
    tint: 'var(--ch-whatsapp-tint)',
    glow: 'rgba(22, 163, 74, 0.14)',
    visual: 'whatsapp',
    href: routes.channels.whatsapp,
    tag: 'Rich Business API',
    h1: 'Rich WhatsApp conversations.',
    sub: 'Send approved templates with rich media and buttons on the official WhatsApp Business API, then keep the conversation going with interactive flows.',
    featuresTitle: 'The Business API, made simple.',
    useTitle: 'What teams send with WhatsApp.',
    features: [
      {
        icon: 'whatsapp',
        title: 'Official Business API',
        desc: 'A verified sender profile with the green badge your customers trust.',
        delay: 0,
      },
      {
        icon: 'layers',
        title: 'Template management',
        desc: 'Draft, submit, and track template approvals from one place.',
        delay: 80,
      },
      {
        icon: 'edit',
        title: 'Rich media & buttons',
        desc: 'Images, documents, and quick-reply and CTA buttons.',
        delay: 160,
      },
      {
        icon: 'wizard',
        title: 'Conversation flows',
        desc: 'Branching automated replies that qualify and route customers.',
        delay: 0,
      },
      {
        icon: 'chart',
        title: 'Delivery & read insights',
        desc: 'See sent, delivered, and read states per message.',
        delay: 80,
      },
      {
        icon: 'filter',
        title: 'Shared audience',
        desc: 'Reach the same contacts and segments as your other channels.',
        delay: 160,
      },
    ],
    useCases: [
      {
        num: '01',
        title: 'Order confirmations',
        desc: 'Rich receipts with tracking buttons and support shortcuts.',
        delay: 0,
      },
      {
        num: '02',
        title: 'Appointment reminders',
        desc: 'Confirm-or-reschedule flows that cut no-shows.',
        delay: 80,
      },
      {
        num: '03',
        title: 'Conversational support',
        desc: 'Automated first response with a seamless handoff to agents.',
        delay: 160,
      },
    ],
    stats: [
      { to: 75, decimals: 0, suffix: '%', prefix: '', label: 'Template read rate', delay: 0 },
      {
        to: 3,
        decimals: 0,
        suffix: 'x',
        prefix: '',
        label: 'Higher engagement vs. email',
        delay: 80,
      },
      { to: 60, decimals: 0, suffix: '+', prefix: '', label: 'Countries supported', delay: 160 },
    ],
    seo: {
      title: 'WhatsApp Marketing — Maildrill on the official Business API',
      description:
        'Maildrill WhatsApp campaigns on the official Business API: approved templates, rich media and buttons, conversation flows, and delivery insights — for confirmations, reminders, and support.',
      ogTitle: 'Maildrill WhatsApp — rich Business API conversations',
      ogDescription:
        'Approved templates, rich media, and conversation flows on the official WhatsApp Business API.',
      keywords:
        'WhatsApp Business API, WhatsApp marketing, WhatsApp templates, conversational messaging, WhatsApp campaigns',
    },
  },
  voice: {
    key: 'voice',
    label: 'Voice',
    icon: 'voice',
    color: 'var(--ch-voice)',
    tint: 'var(--ch-voice-tint)',
    glow: 'rgba(217, 119, 6, 0.14)',
    visual: 'voice',
    href: routes.channels.voice,
    tag: 'Automated calls',
    h1: 'Voice that closes the loop.',
    sub: "Reach people who don't open messages with automated calls — natural text-to-speech, call tracking, and smart fallbacks when a call goes unanswered.",
    featuresTitle: 'Automated calls, done right.',
    useTitle: 'What teams send with voice.',
    features: [
      {
        icon: 'voice',
        title: 'Text-to-speech',
        desc: 'Natural voices in 30+ languages generated from your script.',
        delay: 0,
      },
      {
        icon: 'wizard',
        title: 'Interactive IVR',
        desc: 'Keypad menus that confirm, reschedule, or route to an agent.',
        delay: 80,
      },
      {
        icon: 'chart',
        title: 'Call tracking',
        desc: 'Answer rates, duration, and recordings for every call.',
        delay: 160,
      },
      {
        icon: 'clock',
        title: 'Retry logic',
        desc: 'Automatic retries and voicemail drops for missed calls.',
        delay: 0,
      },
      {
        icon: 'layers',
        title: 'Channel fallbacks',
        desc: 'No answer? Fall back to SMS or WhatsApp automatically.',
        delay: 80,
      },
      {
        icon: 'filter',
        title: 'Shared segments',
        desc: 'Call the same audiences you message — one contact list.',
        delay: 160,
      },
    ],
    useCases: [
      {
        num: '01',
        title: 'Appointment reminders',
        desc: 'Confirm-or-reschedule IVR calls that reduce no-shows.',
        delay: 0,
      },
      {
        num: '02',
        title: 'Critical alerts',
        desc: 'Time-sensitive notifications that demand attention now.',
        delay: 80,
      },
      {
        num: '03',
        title: 'Payment reminders',
        desc: 'Automated collection calls with self-service options.',
        delay: 160,
      },
    ],
    stats: [
      { to: 82, decimals: 0, suffix: '%', prefix: '', label: 'Call answer rate', delay: 0 },
      { to: 30, decimals: 0, suffix: '+', prefix: '', label: 'Text-to-speech voices', delay: 80 },
      { to: 40, decimals: 0, suffix: '%', prefix: '', label: 'Fewer no-shows', delay: 160 },
    ],
    seo: {
      title: 'Voice Campaigns — Maildrill automated calls & IVR flows',
      description:
        'Maildrill voice campaigns: automated calls with natural text-to-speech, interactive IVR menus, call tracking and recordings, retry logic, and channel fallbacks to SMS or WhatsApp.',
      ogTitle: 'Maildrill Voice — automated calls that close the loop',
      ogDescription:
        'Automated calls and IVR flows with text-to-speech, call tracking, and smart fallbacks.',
      keywords:
        'voice broadcasting, automated calls, IVR platform, text-to-speech calls, voice campaigns, appointment reminder calls',
    },
  },
};

/** The other three channels, in fixed order, for the "Other channels" grid. */
export function otherChannels(current: ChannelPageKey): ChannelPage[] {
  return channelOrder.filter((k) => k !== current).map((k) => channelPages[k]);
}
