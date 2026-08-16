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
  /* KNOWN DEFECT (audit #3): `rows: []` is not "no data yet", it is "this panel
     has no data source". `liveRows` in AppSettings.tsx only ever populates
     domains, users and api — billing has no branch — so this `empty` string is
     unconditional. It renders "No balance or payment method yet" for a tenant
     whose `wallets.balance_micro` is 500000000, with one `purchase` transaction
     and a `payment_customers` Stripe row on file, while the Usage tab two
     clicks away prints "Balance left $500.00" from that same wallet. */
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

/**
 * One row per channel in stable order; missing channels default to zero.
 *
 * Source: `summary.byChannel` from /v1/stats/summary — `count(*)` on `messages`
 * grouped by channel, ALL TIME, with no date window and no status filter.
 *
 * KNOWN DEFECT (audit #2), and it compounds three ways in the panel above:
 *   - The panel's kicker says "This period". This is every message the tenant
 *     has ever sent: 1,001,068 all-time against 48,468 this calendar month.
 *   - `sent` is `count(*)`, so it bills states that never left: 70,066 failed,
 *     47,653 expired, 2,352 submitted, 6 queued.
 *   - There is no ledger behind it at all. The tenant has 0 consumption rows in
 *     `wallet_transactions` and 5 in `usage_records`, against 1,001,068
 *     messages. The money column derived from these counts is therefore a
 *     list-price model, and is now labelled "Est. cost" and carries its rate
 *     assumption on screen (`EST_RATE_BASIS`) rather than reading as a charge.
 *
 * KNOWN DEFECT (audit #1): which source produced these counts is decided
 * per-request. `workspaceSummary` replaces the Postgres breakdown with PostHog's
 * whenever HogQL answers, unguarded — 48 events vs 1,001,068 rows on this
 * tenant, i.e. a ~20,850x swing in the number this function formats, and the
 * same swing in the dollar figure beside it.
 */
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
 *
 * This is a LIST-PRICE MODEL, not the ledger, and the screen says so — see
 * `EST_RATE_BASIS` below and the "Est. cost" labels in AppSettings.tsx. It is
 * modelled rather than read because the ledger cannot answer the question yet:
 * on the seeded workspace `wallet_transactions` holds one `purchase` row and
 * zero `consumption` rows, and `usage_records` holds 5 rows against 1,001,068
 * messages. A figure sourced from those would read $0.00 next to a million
 * sends, which is not more honest — it is a different wrong number. The moment
 * the metering path writes `consumption` entries, this whole block should be
 * replaced by a sum over them, and the "estimate" wording removed with it.
 *
 * The rates themselves are correct — the total reproduces to the cent against
 * REGION_TIERS — so every remaining error is in what they multiply, and each is
 * named in `EST_RATE_BASIS` so the reader can judge the gap:
 *
 *   region  — NA_TIER is hardcoded. EU SMS is 0.055 against this 0.0079 (7.0x);
 *             EU WhatsApp 0.085 against 0.028 (3.0x). A workspace sending to
 *             Europe would be shown a figure several times under its real cost.
 *   voice   — one minute assumed per call. `voice_seconds` is populated on 0 of
 *             the tenant's 294,204 voice messages, so there is nothing to
 *             assume from (same missing column as the Analytics talk-time card).
 *   tier    — no `wallet.tier.discountBps` is applied. A tenant on the 50%-off
 *             `scale-promo` tier — the top row of this same page's pricing
 *             modal — would read exactly 2x its real rate.
 */
const NA_TIER = REGION_TIERS[0];
export const EST_RATE_USD: Record<ChannelType, number> = {
  email: EMAIL_RATE,
  sms: NA_TIER.sms,
  whatsapp: NA_TIER.whatsapp,
  voice: NA_TIER.voice,
};

/** Per-send rate as printed in the basis note: `$0.028`, not `$0.03`. */
const fmtRate = (n: number) => `$${n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;

/**
 * The assumption behind every "Est." figure on the usage panel, in words.
 *
 * Built from the same constants `estCost` multiplies by, so the sentence on
 * screen cannot drift from the arithmetic behind the number above it — which
 * is the whole reason a money figure is allowed to be an estimate at all.
 */
export const EST_RATE_BASIS =
  `Estimate, not a charge — no ledger entry exists for these sends. ` +
  `Priced at ${NA_TIER.name} list rates ` +
  `(email ${fmtRate(EMAIL_RATE)}, SMS ${fmtRate(NA_TIER.sms)}, ` +
  `WhatsApp ${fmtRate(NA_TIER.whatsapp)}, voice ${fmtRate(NA_TIER.voice)}/min ` +
  `at one minute per call), before any volume-tier discount. ` +
  `Sends to other regions cost more, and real charges draw your balance at each ` +
  `destination's actual rate.`;

export function estCost(row: ChannelUsageRow): number {
  return row.sent * EST_RATE_USD[row.channel];
}

export function totalEstCost(rows: ChannelUsageRow[]): number {
  return rows.reduce((s, r) => s + estCost(r), 0);
}

/**
 * Fallback prepaid balance for when the wallet endpoint returns nothing.
 *
 * KNOWN DEFECT (audit #4): zero is the wrong fallback for "unknown". The hero
 * stat renders `wallet ? wallet.lowBalance : PREPAID_BALANCE_USD < LOW_BALANCE_USD`,
 * so a null wallet evaluates `0 < 10` — true — and a funded $500 workspace
 * renders an alert-red "$0.00" on any blip of the wallet request, visually
 * identical to a genuinely empty account. An unknown balance should render "—".
 */
export const PREPAID_BALANCE_USD = 0;

/** Below this remaining credit the balance reads as an alert. */
export const LOW_BALANCE_USD = 10;

/**
 * "$4.10"; sub-cent but nonzero renders as "< $0.01".
 *
 * KNOWN DEFECT (audit #37, cosmetic): no thousands separator, so the largest
 * money figure on the product renders "$12246.06" while the pricing modal's
 * `usd()` on the same page groups its digits.
 */
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
