/**
 * Local, richer template fixtures for the Templates gallery screen.
 *
 * The shared `mock-data.ts` `templates` array is intentionally thin (name /
 * category / channel / favorite). The App.dc.html Templates design needs a much
 * richer per-template shape — faux-email preview colours, kicker/CTA copy, and
 * open/click metrics — so we ENRICH the four shared fixtures here and extend
 * them with the design's canonical seed templates plus a deterministic set of
 * generated items to make the gallery feel full and exercise pagination.
 *
 * This file is owned by the Templates screen and imported only by AppTemplates.tsx.
 * It never mutates the shared mock-data module.
 */
import { templates as sharedTemplates } from '@/lib/app/mock-data';
import type { ChannelType } from '@/types/app';

export type TplCategory = 'Promotional' | 'Newsletter' | 'Transactional' | 'Announcement';

export type GalleryTemplate = {
  id: string;
  name: string;
  /** Big heading text shown inside the faux-email thumbnail. */
  title: string;
  /** Small all-caps eyebrow inside the thumbnail. */
  kicker: string;
  /** Fake call-to-action pill label. */
  cta: string;
  category: TplCategory;
  channel: ChannelType;
  /** Display string, e.g. "1d ago". */
  updated: string;
  /** Precomputed minutes-ago, for deterministic sorting. */
  updatedMin: number;
  /** CSS background for the thumbnail header band (gradient or solid). */
  thumb: string;
  /** Foreground text colour used on top of `thumb`. */
  fg: string;
  /** CTA pill background colour. */
  accent: string;
  favorite: boolean;
  /** Average open rate, whole percent. */
  avgOpen: number;
  /** Average click rate, whole percent. */
  avgClick: number;
};

// Fixed reference "now" — matches the shared mock-data window so SSR + hydration
// agree and there is no Date.now() nondeterminism.
const NOW = new Date('2026-07-17T18:00:00Z').getTime();

const UNIT: Record<string, number> = { s: 1 / 60, m: 1, h: 60, d: 1440, w: 10080 };

/** Parse an "Nh ago" / "Nd ago" style string to minutes for sorting. */
export function agoMin(s: string): number {
  const mm = s.match(/(\d+)\s*([smhdw])/);
  if (!mm) return 0;
  return parseInt(mm[1], 10) * (UNIT[mm[2]] ?? 1);
}

function ago(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1w ago' : `${weeks}w ago`;
}

/** Category display colour (indigo / green / coral / tan). */
export const CATEGORY_COLOR: Record<TplCategory, string> = {
  Promotional: '#4f46e5',
  Newsletter: '#059669',
  Transactional: '#ea6c3f',
  Announcement: '#a1774a',
};

// Visual triples reused by generated + enriched templates: [thumb, fg, accent].
const TRIPLES: Array<[string, string, string]> = [
  ['linear-gradient(150deg,#4f46e5,#6d28d9)', '#fff', '#4f46e5'],
  ['#c9b79c', '#3f2f1c', '#a1774a'],
  ['#f6b8a0', '#7c2d12', '#ea6c3f'],
  ['#e7e0d2', '#57534e', '#78716c'],
  ['linear-gradient(150deg,#34d399,#059669)', '#fff', '#059669'],
  ['#ede9fe', '#5b21b6', '#7c3aed'],
  ['linear-gradient(150deg,#06b6d4,#0891b2)', '#fff', '#0891b2'],
  ['linear-gradient(150deg,#f59e0b,#d97706)', '#fff', '#d97706'],
];

// ---- 1. The nine canonical hand-authored seeds (App.dc.html). -----------------
type Seed = Omit<GalleryTemplate, 'updatedMin'>;

const SEEDS: Seed[] = [
  { id: 'tpl-summer-sale', name: 'Summer Sale', title: 'SUMMER SALE', kicker: 'LIMITED TIME', cta: 'Shop the sale', updated: '1d ago', thumb: 'linear-gradient(150deg,#4f46e5,#6d28d9)', fg: '#fff', accent: '#4f46e5', favorite: true, category: 'Promotional', channel: 'email', avgOpen: 52, avgClick: 14 },
  { id: 'tpl-meet-teacher', name: 'Meet the teacher', title: 'MEET THE TEACHER!', kicker: 'NEW SCHOOL YEAR', cta: 'Read more', updated: '5h ago', thumb: '#c9b79c', fg: '#3f2f1c', accent: '#a1774a', favorite: false, category: 'Announcement', channel: 'email', avgOpen: 38, avgClick: 7 },
  { id: 'tpl-welcome-series', name: 'Welcome Series', title: 'WELCOME', kicker: "GLAD YOU’RE HERE", cta: 'Get started', updated: '3d ago', thumb: '#f6b8a0', fg: '#7c2d12', accent: '#ea6c3f', favorite: true, category: 'Transactional', channel: 'email', avgOpen: 64, avgClick: 22 },
  { id: 'tpl-product-launch', name: 'Product Launch', title: 'NEW ARRIVAL', kicker: 'JUST DROPPED', cta: 'Explore now', updated: '1w ago', thumb: '#e7e0d2', fg: '#57534e', accent: '#78716c', favorite: false, category: 'Announcement', channel: 'email', avgOpen: 41, avgClick: 9 },
  { id: 'tpl-spring-preview', name: 'Spring Preview', title: 'SPRING PREVIEW', kicker: 'THE EDIT', cta: 'See the collection', updated: '2w ago', thumb: 'linear-gradient(150deg,#34d399,#059669)', fg: '#fff', accent: '#059669', favorite: false, category: 'Newsletter', channel: 'email', avgOpen: 29, avgClick: 5 },
  { id: 'tpl-back-in-stock', name: 'Back in Stock', title: 'BACK IN STOCK', kicker: 'YOU ASKED, WE LISTENED', cta: 'Grab yours', updated: '3w ago', thumb: '#ede9fe', fg: '#5b21b6', accent: '#7c3aed', favorite: false, category: 'Promotional', channel: 'email', avgOpen: 47, avgClick: 18 },
  { id: 'tpl-flash-sale-text', name: 'Flash Sale Text', title: 'FLASH SALE', kicker: 'TEXT', cta: 'Shop now', updated: '2d ago', thumb: 'linear-gradient(150deg,#06b6d4,#0891b2)', fg: '#fff', accent: '#0891b2', favorite: false, category: 'Promotional', channel: 'sms', avgOpen: 71, avgClick: 31 },
  { id: 'tpl-order-update-wa', name: 'Order Update WA', title: 'ORDER UPDATE', kicker: 'WHATSAPP', cta: 'Track order', updated: '4d ago', thumb: 'linear-gradient(150deg,#22c55e,#16a34a)', fg: '#fff', accent: '#16a34a', favorite: false, category: 'Transactional', channel: 'whatsapp', avgOpen: 83, avgClick: 26 },
  { id: 'tpl-payment-call', name: 'Payment Reminder Call', title: 'PAYMENT DUE', kicker: 'VOICE SCRIPT', cta: 'Pay now', updated: '5d ago', thumb: 'linear-gradient(150deg,#f59e0b,#d97706)', fg: '#fff', accent: '#d97706', favorite: false, category: 'Transactional', channel: 'voice', avgOpen: 35, avgClick: 11 },
];

// ---- 2. Enrich the four shared mock-data fixtures into gallery items. ----------
const CATEGORY_MAP: Record<string, TplCategory> = {
  Marketing: 'Promotional',
  Promotional: 'Promotional',
  Transactional: 'Transactional',
  Utility: 'Transactional',
  Onboarding: 'Newsletter',
  Newsletter: 'Newsletter',
  Announcement: 'Announcement',
};

const SHARED_META: Record<string, { kicker: string; cta: string; triple: [string, string, string]; open: number; click: number }> = {
  tpl_1: { kicker: 'JUST LAUNCHED', cta: 'Shop now', triple: TRIPLES[0], open: 58, click: 19 },
  tpl_2: { kicker: 'ON THE WAY', cta: 'Track order', triple: TRIPLES[6], open: 74, click: 22 },
  tpl_3: { kicker: 'CONFIRMED', cta: 'View details', triple: ['linear-gradient(150deg,#22c55e,#16a34a)', '#fff', '#16a34a'], open: 80, click: 18 },
  tpl_4: { kicker: 'HELLO', cta: 'Get started', triple: TRIPLES[2], open: 61, click: 15 },
};

const enrichedShared: Seed[] = sharedTemplates.map((t) => {
  const meta = SHARED_META[t.id] ?? SHARED_META.tpl_1;
  const updated = ago(t.updatedAt);
  return {
    id: t.id,
    name: t.name,
    title: t.name.toUpperCase(),
    kicker: meta.kicker,
    cta: meta.cta,
    category: CATEGORY_MAP[t.category] ?? 'Promotional',
    channel: t.channel,
    updated,
    thumb: meta.triple[0],
    fg: meta.triple[1],
    accent: meta.triple[2],
    favorite: t.favorite,
    avgOpen: meta.open,
    avgClick: meta.click,
  };
});

// ---- 3. Deterministically generated items for a fuller gallery / pagination. ---
const GEN_CATS: TplCategory[] = ['Promotional', 'Newsletter', 'Transactional', 'Announcement'];
const GEN_CHANNELS: ChannelType[] = ['email', 'email', 'email', 'sms', 'whatsapp', 'voice'];
const GEN_BASES = [
  'Weekly Digest', 'Cart Reminder', 'New Feature', 'Holiday Offer', 'Referral Invite',
  'Event Invite', 'Survey Request', 'Restock Alert', 'VIP Preview', 'Birthday Reward',
  'Order Shipped', 'Feedback Ask', 'Membership Renewal', 'Seasonal Sale',
];
const GEN_KICKERS = ['LIMITED TIME', 'THE EDIT', 'JUST DROPPED', 'NEW', 'YOU ASKED', 'THIS WEEK', 'SPECIAL', 'EXCLUSIVE'];
const GEN_CTAS = ['Shop now', 'Read more', 'Get started', 'Explore now', 'See more', 'Grab yours', 'Learn more', 'Track order'];
const GEN_UPDATED = ['2d ago', '4d ago', '6d ago', '1w ago', '2w ago', '3w ago'];

const generated: Seed[] = Array.from({ length: 27 }, (_, i) => {
  const triple = TRIPLES[i % TRIPLES.length];
  const base = GEN_BASES[i % GEN_BASES.length];
  const name = `${base} ${Math.floor(i / GEN_BASES.length) + 1}`;
  return {
    id: `tpl-gen-${i}`,
    name,
    title: base.toUpperCase(),
    kicker: GEN_KICKERS[i % GEN_KICKERS.length],
    cta: GEN_CTAS[i % GEN_CTAS.length],
    category: GEN_CATS[i % GEN_CATS.length],
    channel: GEN_CHANNELS[i % GEN_CHANNELS.length],
    updated: GEN_UPDATED[i % GEN_UPDATED.length],
    thumb: triple[0],
    fg: triple[1],
    accent: triple[2],
    favorite: i % 5 === 4,
    avgOpen: 20 + ((i * 13) % 60),
    avgClick: 3 + ((i * 7) % 30),
  };
});

// ---- 4. Compose: shared fixtures first, then non-colliding seeds, then generated.
const sharedNames = new Set(enrichedShared.map((t) => t.name.toLowerCase()));
const seedsToUse = SEEDS.filter((s) => !sharedNames.has(s.name.toLowerCase()));

export const galleryTemplates: GalleryTemplate[] = [
  ...enrichedShared,
  ...seedsToUse,
  ...generated,
].map((t) => ({ ...t, updatedMin: agoMin(t.updated) }));

export const TEMPLATE_CATEGORIES: TplCategory[] = ['Promotional', 'Newsletter', 'Transactional', 'Announcement'];
export const RATE_BUCKETS = ['None', 'Under 20%', '20 – 40%', '40%+'] as const;
export type RateBucket = (typeof RATE_BUCKETS)[number];

export function rateBucket(v: number): RateBucket {
  if (v === 0) return 'None';
  if (v < 20) return 'Under 20%';
  if (v < 40) return '20 – 40%';
  return '40%+';
}
