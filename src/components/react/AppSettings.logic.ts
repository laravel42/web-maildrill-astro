import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';
import { EMAIL_RATE, REGION_TIERS } from '@/config/pricing';
import type { ChannelBreakdown } from './AppAnalytics.logic';
import { CHANNEL, CHANNEL_ORDER, type ChannelMeta } from './shared/channels';
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
  { key: 'integrations', label: 'Integrations', icon: 'key' },
  { key: 'users', label: 'Users', icon: 'users' },
];

/** True when `value` is a known Settings section key (including hidden panels). */
export function isSectionKey(value: string | null | undefined): value is SectionKey {
  return typeof value === 'string' && value in PANELS;
}

/** Initial Settings section from `?section=` (defaults to Usage). */
export function sectionFromSearch(search: string = typeof window !== 'undefined' ? window.location.search : ''): SectionKey {
  const raw = new URLSearchParams(search).get('section');
  return isSectionKey(raw) ? raw : 'usage';
}

/** Keep the address bar in sync when the Settings subnav changes. */
export function replaceSettingsSectionUrl(section: SectionKey): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (section === 'usage') url.searchParams.delete('section');
  else url.searchParams.set('section', section);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${url.pathname}${window.location.search}${window.location.hash}`) return;
  window.history.replaceState(null, '', next);
}

/* ------------------------------- panels --------------------------------- */
export const PANELS: Record<SectionKey, Panel> = {
  usage: {
    kind: 'usage',
    title: 'Usage',
    desc: 'Pay-per-use volume to date, by channel. Every send draws from your prepaid balance — no plan caps.',
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
  /* Rendered by `WorkspaceConnections`, not by the generic table: a connection's
     defining property is that its secret is write-only, and a title/sub/badge row has
     nowhere to say that. */
  integrations: {
    kind: 'custom',
    title: 'Integrations',
    desc: 'Credentials your automations use to reach systems outside Maildrill.',
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
 * The panel now says so, on all three axes it used to overclaim on:
 *   - WINDOW. The kicker read "This period" over an all-time count: 1,001,068
 *     ever against 48,468 this calendar month, a 20.7x overstatement of the
 *     word. It reads "All time", and `USAGE_VOLUME_BASIS` states the window in
 *     words beside the number. Relabelled rather than re-queried because this
 *     product has no billing period to query for: `wallets` is a prepaid
 *     balance with no cycle, `usage_records` carries an `occurred_at` and no
 *     period, and `wallet_transactions` is a running ledger. Windowing to an
 *     invented 30 days would put a number under the balance that no boundary
 *     in the schema justifies.
 *   - SCOPE. `sent` is `count(*)`, so it counts states that never left the
 *     building — measured on this tenant today: 70,066 failed, 47,653 expired,
 *     2,352 submitted, 6 queued. `USAGE_VOLUME_BASIS` says that too, as a rule
 *     rather than as four numbers that would drift by tomorrow.
 *   - LEDGER. There is no ledger behind it at all. The tenant has 0 consumption
 *     rows in `wallet_transactions` and 5 in `usage_records`, against 1,001,068
 *     messages. The money column derived from these counts is therefore a
 *     list-price model, and is labelled "Est. cost" carrying its rate
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
/**
 * What the volume figure counts, in words — the window and the scope.
 *
 * Stated rather than computed for the same reason the kicker was relabelled:
 * the number above it is `count(*)` over `messages` with no date predicate and
 * no status filter (stats.ts `workspaceSummary`, "NO DATE WINDOW — this is
 * all-time stock, not a period"), and the schema holds no billing cycle to
 * window it to. A rule survives the data changing under it; the four state
 * counts it replaces would have gone stale the next time the queue moved.
 */
export const USAGE_VOLUME_BASIS =
  `Volume is every message this workspace has ever created — all time, not a ` +
  `billing period — and counts sends that failed, expired or are still queued ` +
  `alongside the ones that arrived.`;

/**
 * Basis note for the credit history: its figures come from a DIFFERENT source
 * than everything above it — the provider's own billing rather than the local
 * rate card.
 *
 * NOT CURRENTLY RENDERED. The visible "How credit is allocated" disclosure was
 * removed by request. Kept because it is the only written statement of why the
 * Charged column can disagree with the Est. cost above it, and whoever next
 * wonders why two money figures on one screen differ should find this rather
 * than re-derive it from the ledger.
 */
export const RECHARGE_BASIS =
  `Charged is what actually left this top-up, allocated oldest-credit-first. ` +
  `Estimated is what the local rate card predicted at send time; Adjusted is ` +
  `the difference the provider's own billing later reported, which is why these ` +
  `figures can differ from the estimate above. Provider billing is provisional ` +
  `for a few days after a send and is re-checked once finalised.`;

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
/**
 * Money, grouped. `toFixed(2)` alone rendered the workspace's estimated spend
 * as `$12246.06` — five significant digits with no thousands separator, on the
 * one screen whose job is money, while the message count beside it was
 * correctly grouped as `1,001,068`. Below a cent shows `< $0.01` rather than
 * `$0.00`, which would read as free.
 */
export const fmtUsd = (n: number) =>
  n > 0 && n < 0.005
    ? '< $0.01'
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Whole-percent shares that sum to exactly 100 (largest-remainder / Hamilton).
 *
 * Rounding each share independently is what made the table read
 * 24 + 24 + 24 + 29 = 101% against true shares of 23.57 / 23.53 / 23.51 /
 * 29.39. Every row was individually correct to the nearest point and the
 * column was still wrong, which is the failure mode a reader notices first
 * because it is the only one they can check by adding up.
 *
 * Floors every share, then hands the leftover points to the rows with the
 * largest discarded fractions — so the total is exact and each row stays
 * within one point of its true value.
 */
export function wholePercentShares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((sum, f) => sum + f, 0);
  // Ties broken by original order, so the result is stable across renders.
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder -= 1;
  }
  return out;
}

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

/**
 * Channel metadata for a value that may not be one of ours.
 *
 * Billing line items carry Infobip's category mapped to a channel, and that
 * mapping can legitimately produce null (an AI or lookup charge is not a
 * messaging channel). Indexing CHANNEL directly with such a value returns
 * undefined and throws on `.color`.
 */
export function channelMeta(channel: string | null): ChannelMeta | null {
  if (!channel) return null;
  return (CHANNEL as Record<string, ChannelMeta | undefined>)[channel] ?? null;
}
