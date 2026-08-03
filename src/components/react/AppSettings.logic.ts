import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';
import { EMAIL_RATE, REGION_TIERS } from '@/config/pricing';
import type { ChannelBreakdown } from './AppAnalytics.logic';
import { CHANNEL_ORDER } from './shared/channels';
import type { Tone } from './shared/tones';
import type { Member, Panel, Role, SectionKey, ToggleKey } from './AppSettings.types';

/* ------------------------------ nav model ------------------------------- */
// Branding, AI features, and Integrations stay out of the nav (unreachable)
// for the first release. Branding and AI already persist through
// GET/PATCH /v1/workspace, but nothing consumes those values yet — no send
// path reads the footer, no editor reads the subject toggle, no scheduler
// reads send-time — so showing them would promise behavior that does not
// exist. Re-add a row here once the feature behind it ships.
export const NAV: { key: SectionKey; label: string; icon: IconName }[] = [
  { key: 'usage', label: 'Usage', icon: 'chart' },
  { key: 'domains', label: 'Domains', icon: 'globe' },
  { key: 'billing', label: 'Billing', icon: 'target' },
  { key: 'api', label: 'API keys', icon: 'code' },
  { key: 'users', label: 'Users', icon: 'users' },
];

/* ------------------------------- panels --------------------------------- */
export const PANELS: Record<SectionKey, Panel> = {
  usage: {
    kind: 'usage',
    title: 'Usage',
    desc: 'Pay-per-use volume this period, by channel. Every send draws from your prepaid balance — no plan caps.',
  },
  branding: {
    kind: 'form',
    title: 'Branding',
    desc: 'How your emails and dashboard look.',
    fields: [
      { key: 'br_name', label: 'Brand name', value: '', ph: 'Acme Inc.' },
      { key: 'br_logo', label: 'Logo', value: '', ph: 'https://cdn.acme.com/logo.svg' },
      { key: 'br_accent', label: 'Accent color', value: '', swatch: true, ph: '#4F46E5' },
      { key: 'br_footer', label: 'Email footer', value: '', ph: '© Acme Inc. · Unsubscribe' },
    ],
  },
  domains: {
    kind: 'table',
    title: 'Sending domains',
    desc: 'Authenticate domains to improve deliverability.',
    cta: 'Add domain',
    empty:
      'No domains authenticated yet. Add one to send from your own address with SPF and DKIM aligned.',
    rows: [],
  },
  billing: {
    kind: 'table',
    title: 'Billing',
    desc: 'Prepaid balance, auto-recharge, and payment method.',
    cta: 'Add balance',
    empty:
      'No balance or payment method yet. Add prepaid credit and every send draws it down at per-message rates — auto-recharge keeps you topped up.',
    rows: [],
  },
  api: {
    kind: 'table',
    title: 'API keys',
    desc: 'Keys for programmatic access to Maildrill.',
    cta: 'Create key',
    empty: 'No API keys yet. Create one to send from your own code — keys are revocable any time.',
    rows: [],
  },
  users: {
    kind: 'table',
    title: 'Users & permissions',
    desc: 'People with access to this workspace.',
    cta: 'Invite user',
    empty: 'Just you here so far. Invite a teammate to plan, build, and send together.',
    roster: true,
  },
  integrations: {
    kind: 'table',
    title: 'Integrations',
    desc: 'Connect Maildrill to your other tools.',
    cta: 'Browse all',
    empty: 'Nothing connected yet. Browse the gallery to plug Maildrill into your stack.',
    rows: [],
  },
  ai: {
    kind: 'toggles',
    title: 'AI features',
    desc: 'Let Maildrill assist with copy and timing.',
    toggles: [
      {
        key: 'summaries',
        title: 'Campaign summaries',
        desc: 'Auto-generate a plain-language recap after each send.',
      },
      {
        key: 'subject',
        title: 'Subject line suggestions',
        desc: 'Get AI subject lines while composing.',
      },
      {
        key: 'sendtime',
        title: 'Smart send-time',
        desc: 'Deliver to each subscriber at their most active hour.',
      },
    ],
  },
};

/* ----------------------------- usage helpers ---------------------------- */
export type ChannelUsageRow = {
  channel: ChannelType;
  sent: number;
};

export const fmt = (n: number) => n.toLocaleString('en-US');

/** One row per channel in stable order; missing channels default to zero. */
export function buildChannelUsageRows(byChannel: ChannelBreakdown[]): ChannelUsageRow[] {
  const map = new Map(byChannel.map((c) => [c.channel, c]));
  return CHANNEL_ORDER.map((channel) => ({ channel, sent: map.get(channel)?.sent ?? 0 }));
}

export function totalSent(rows: ChannelUsageRow[]): number {
  return rows.reduce((s, r) => s + r.sent, 0);
}

/**
 * Estimated per-send USD rate by channel. Email is the flat worldwide rate;
 * SMS/WhatsApp/voice are regional and the workspace has no destination mix yet,
 * so the North America tier stands in (voice assumes one minute per call).
 * Real billing draws the prepaid balance at the destination's actual rate.
 */
const NA_TIER = REGION_TIERS[0];
export const EST_RATE_USD: Record<ChannelType, number> = {
  email: EMAIL_RATE,
  sms: NA_TIER.sms,
  whatsapp: NA_TIER.whatsapp,
  voice: NA_TIER.voice,
};

export function estCost(row: ChannelUsageRow): number {
  return row.sent * EST_RATE_USD[row.channel];
}

export function totalEstCost(rows: ChannelUsageRow[]): number {
  return rows.reduce((s, r) => s + estCost(r), 0);
}

/** Prepaid balance on file — zero until the billing service is wired. */
export const PREPAID_BALANCE_USD = 0;

/** Below this remaining credit the balance reads as an alert. */
export const LOW_BALANCE_USD = 10;

/** "$4.10"; sub-cent but nonzero renders as "< $0.01". */
export const fmtUsd = (n: number) => (n > 0 && n < 0.005 ? '< $0.01' : `$${n.toFixed(2)}`);

/* ----------------------------- action modals ---------------------------- */
/** Quick-pick amounts for the Add balance modal (USD). */
export const BALANCE_PRESETS = [25, 50, 100, 250];

export type KeyScope = {
  key: string;
  name: string;
  desc: string;
};
export const KEY_SCOPES: KeyScope[] = [
  { key: 'full', name: 'Full access', desc: 'Send, read, and manage the workspace.' },
  { key: 'send', name: 'Send only', desc: 'Send messages through the API; nothing else.' },
  { key: 'read', name: 'Read only', desc: 'Read stats, lists, and templates.' },
];

/** True for a plausible sending domain, e.g. "mail.acme.com". */
export const isDomain = (v: string) =>
  /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(v.trim());

/** Loose email shape check for the invite modal. */
export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

/* ----------------------------- team roster ------------------------------ */
export const roleTone: Record<Role, Tone> = {
  Owner: 'violet',
  Admin: 'accent',
  Editor: 'accent',
  Viewer: 'neutral',
};

// No seed team members — the roster loads from the service once wired.
export const ROSTER: Member[] = [];

export const ROLE_PERMS: Record<Role, string[]> = {
  Admin: [
    'Invite & remove users',
    'Create & send campaigns',
    'Manage integrations & domains',
    'Manage API keys',
  ],
  Owner: [
    'Full account access',
    'Manage billing & balance',
    'Invite & remove users',
    'Create & send campaigns',
    'Manage integrations & domains',
  ],
  Editor: [
    'Create & send campaigns',
    'Manage lists & subscribers',
    'Create & edit templates',
    'View reports & analytics',
  ],
  Viewer: ['View campaigns & reports', 'View lists & subscribers'],
};

export const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
  summaries: true,
  subject: true,
  sendtime: false,
};

/* ------------------------------ role editor ----------------------------- */
export const ROLE_LIST: Role[] = ['Owner', 'Admin', 'Editor', 'Viewer'];
export const ROLE_DESC: Record<Role, string> = {
  Owner: 'Full access, including billing and members.',
  Admin: 'Manage members, domains, and keys — no billing.',
  Editor: 'Create and send campaigns, manage content.',
  Viewer: 'Read-only access to campaigns and reports.',
};

/* ------------------------------- helpers -------------------------------- */
export const swatchColor = (v: string) => {
  const m = v.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : 'var(--accent)';
};
