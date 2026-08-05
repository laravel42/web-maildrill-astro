/**
 * Platform-admin (superadmin) console data — implements the AdminDashboard.dc.html
 * design handoff. This is a static/mock dataset that drives the AppAdmin island;
 * it mirrors the shape a real product-admin API would return so the screens can
 * be wired to `productClient` later without reshaping the UI.
 *
 * Colours track the design tokens (warm-cream neutrals + indigo accent + the
 * shared channel palette). Pills pair colour with a label so nothing is
 * communicated by colour alone (DESIGN.md §8).
 */
import type { IconName } from '@/lib/icons';

export type Tone = 'up' | 'down' | 'flat';

export interface Kpi {
  icon: IconName;
  label: string;
  value: string;
  delta: string;
  tone: Tone;
}

export interface Pill {
  label: string;
  fg: string;
  bg: string;
  dot?: string;
}

export interface AdminNavItem {
  id: ScreenId;
  label: string;
  icon: IconName;
  badge?: string;
}

export interface AdminNavSection {
  id: string;
  label: string;
  items: AdminNavItem[];
  defaultOpen?: boolean;
}

export type ScreenId =
  | 'overview'
  | 'workspaces'
  | 'users'
  | 'tokens'
  | 'billing'
  | 'invoices'
  | 'domains'
  | 'campaigns'
  | 'deliver'
  | 'events'
  | 'queues'
  | 'cache'
  | 'logs'
  | 'audit'
  | 'flags'
  | 'support'
  | 'blogCms'
  | 'guidesCms'
  | 'pricingCms'
  | 'legalCms'
  | 'seoCms'
  | 'faqCms'
  | 'llm'
  | 'skills'
  | 'mcp';

export const SCREEN_TITLES: Record<ScreenId, { section: string; page: string }> = {
  overview: { section: 'Overview', page: 'Platform overview' },
  workspaces: { section: 'Accounts', page: 'Workspaces' },
  users: { section: 'Accounts', page: 'Users directory' },
  tokens: { section: 'Accounts', page: 'API tokens' },
  billing: { section: 'Revenue', page: 'Billing & revenue' },
  invoices: { section: 'Revenue', page: 'Invoices' },
  domains: { section: 'Delivery', page: 'Sending domains' },
  campaigns: { section: 'Delivery', page: 'Campaigns monitor' },
  deliver: { section: 'Delivery', page: 'Deliverability' },
  events: { section: 'Operations', page: 'Events' },
  queues: { section: 'Operations', page: 'Queue manager' },
  cache: { section: 'Operations', page: 'Sessions & cache' },
  logs: { section: 'Operations', page: 'Logs' },
  audit: { section: 'Operations', page: 'Audit log' },
  flags: { section: 'Trust & safety', page: 'Feature flags' },
  support: { section: 'Trust & safety', page: 'Support tickets' },
  blogCms: { section: 'Content', page: 'Blog posts' },
  guidesCms: { section: 'Content', page: 'Guides' },
  pricingCms: { section: 'Content', page: 'Pricing & plans' },
  legalCms: { section: 'Content', page: 'Legal pages' },
  seoCms: { section: 'Content', page: 'SEO metadata' },
  faqCms: { section: 'Content', page: 'FAQ entries' },
  llm: { section: 'AI', page: 'LLM providers' },
  skills: { section: 'AI', page: 'Skills' },
  mcp: { section: 'AI', page: 'MCP servers' },
};

export const NAV_SECTIONS: AdminNavSection[] = [
  {
    id: 'main',
    label: 'Platform',
    defaultOpen: true,
    items: [{ id: 'overview', label: 'Overview', icon: 'dashboard' }],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    defaultOpen: true,
    items: [
      { id: 'workspaces', label: 'Workspaces', icon: 'layers' },
      { id: 'users', label: 'Users', icon: 'users' },
      { id: 'tokens', label: 'API tokens', icon: 'lock' },
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue',
    defaultOpen: true,
    items: [
      { id: 'billing', label: 'Billing & revenue', icon: 'chart' },
      { id: 'invoices', label: 'Invoices', icon: 'blog' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    defaultOpen: true,
    items: [
      { id: 'domains', label: 'Sending domains', icon: 'globe' },
      { id: 'campaigns', label: 'Campaigns', icon: 'campaigns' },
      { id: 'deliver', label: 'Deliverability', icon: 'shield' },
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
    items: [
      { id: 'events', label: 'Events', icon: 'bolt' },
      { id: 'queues', label: 'Queue manager', icon: 'layers' },
      { id: 'cache', label: 'Sessions & cache', icon: 'target' },
      { id: 'logs', label: 'Logs', icon: 'code' },
      { id: 'audit', label: 'Audit log', icon: 'eye' },
    ],
  },
  {
    id: 'trust',
    label: 'Trust & safety',
    items: [
      { id: 'flags', label: 'Feature flags', icon: 'zap' },
      { id: 'support', label: 'Support tickets', icon: 'help', badge: '7' },
    ],
  },
  {
    id: 'cms',
    label: 'Content',
    items: [
      { id: 'blogCms', label: 'Blog posts', icon: 'blog' },
      { id: 'guidesCms', label: 'Guides', icon: 'guides' },
      { id: 'pricingCms', label: 'Pricing & plans', icon: 'chart' },
      { id: 'legalCms', label: 'Legal pages', icon: 'shield' },
      { id: 'seoCms', label: 'SEO metadata', icon: 'search' },
      { id: 'faqCms', label: 'FAQ entries', icon: 'help' },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    items: [
      { id: 'llm', label: 'LLM providers', icon: 'sparkle' },
      { id: 'skills', label: 'Skills', icon: 'star' },
      { id: 'mcp', label: 'MCP servers', icon: 'command' },
    ],
  },
];

/* ------------------------------------------------------------------ palette */

export const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#0d9488',
  '#ea580c',
  '#2563eb',
  '#dc2626',
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* -------------------------------------------------------------- formatters */

export const fmtInt = (n: number) => n.toLocaleString('en-US');
export const fmtUsd = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
    : `$${n.toLocaleString('en-US')}`;
export const fmtUsdExact = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
};

/* ------------------------------------------------------------------- plans */

export type PlanKey = 'free' | 'starter' | 'growth' | 'scale' | 'enterprise';

export const PLAN: Record<PlanKey, Pill> = {
  free: { label: 'Free', fg: 'var(--text3)', bg: 'var(--surface2)' },
  starter: { label: 'Starter', fg: '#0891b2', bg: 'rgba(8,145,178,.1)' },
  growth: { label: 'Growth', fg: '#4f46e5', bg: 'var(--accent-tint)' },
  scale: { label: 'Scale', fg: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
  enterprise: { label: 'Enterprise', fg: 'var(--text)', bg: 'var(--surface2)' },
};

export type WsStatusKey = 'active' | 'trial' | 'past_due' | 'suspended';
export const WS_STATUS: Record<WsStatusKey, Pill> = {
  active: { label: 'Active', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  trial: { label: 'Trial', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5' },
  past_due: { label: 'Past due', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  suspended: { label: 'Suspended', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
};

/* -------------------------------------------------------------- workspaces */

export interface AdminWorkspace {
  id: string;
  name: string;
  domain: string;
  owner: string;
  email: string;
  region: string;
  created: string;
  card: string;
  nextInvoice: string;
  plan: PlanKey;
  users: number;
  email30: number;
  sms30: number;
  wa30: number;
  mrr: number;
  ltv: number;
  deliv: number;
  quota: number;
  quotaCap: number;
  status: WsStatusKey;
  active: string;
  flags: string[];
  risk?: string;
}

const mkWs = (w: AdminWorkspace) => w;

export const WORKSPACES: AdminWorkspace[] = [
  mkWs({
    id: 'ws_9f2a',
    name: 'Northwind Retail',
    domain: 'mail.northwind.io',
    owner: 'Elena Marsh',
    email: 'elena@northwind.io',
    region: 'EU (Frankfurt)',
    created: 'Mar 2024',
    card: 'Visa ···4291',
    nextInvoice: 'Aug 1, 2026',
    plan: 'scale',
    users: 34,
    email30: 1_820_000,
    sms30: 240_000,
    wa30: 96_000,
    mrr: 2400,
    ltv: 58_600,
    deliv: 99.4,
    quota: 71,
    quotaCap: 3_000_000,
    status: 'active',
    active: '4m ago',
    flags: ['AI subject lines', 'Advanced segments', 'WhatsApp'],
  }),
  mkWs({
    id: 'ws_71c4',
    name: 'Brightside Media',
    domain: 'send.brightside.co',
    owner: 'Theo Nguyen',
    email: 'theo@brightside.co',
    region: 'US (Virginia)',
    created: 'Jan 2024',
    card: 'Mastercard ···8810',
    nextInvoice: 'Aug 3, 2026',
    plan: 'growth',
    users: 18,
    email30: 940_000,
    sms30: 62_000,
    wa30: 0,
    mrr: 890,
    ltv: 21_300,
    deliv: 98.9,
    quota: 54,
    quotaCap: 1_500_000,
    status: 'active',
    active: '22m ago',
    flags: ['AI subject lines', 'Advanced segments'],
  }),
  mkWs({
    id: 'ws_44de',
    name: 'Cove Financial',
    domain: 'notify.covefin.com',
    owner: 'Priya Raman',
    email: 'priya@covefin.com',
    region: 'US (Oregon)',
    created: 'Nov 2023',
    card: 'Amex ···2007',
    nextInvoice: 'Aug 1, 2026',
    plan: 'enterprise',
    users: 62,
    email30: 3_400_000,
    sms30: 510_000,
    wa30: 180_000,
    mrr: 5800,
    ltv: 149_000,
    deliv: 99.6,
    quota: 88,
    quotaCap: 5_000_000,
    status: 'active',
    active: '2m ago',
    flags: ['AI subject lines', 'Advanced segments', 'WhatsApp', 'Dedicated IP'],
  }),
  mkWs({
    id: 'ws_1b90',
    name: 'Pinecrest Labs',
    domain: 'mailer.pinecrest.dev',
    owner: 'Marcus Bell',
    email: 'marcus@pinecrest.dev',
    region: 'EU (Ireland)',
    created: 'Jun 2025',
    card: '—',
    nextInvoice: '—',
    plan: 'trial' as unknown as PlanKey,
    users: 4,
    email30: 32_000,
    sms30: 1200,
    wa30: 0,
    mrr: 0,
    ltv: 0,
    deliv: 97.1,
    quota: 12,
    quotaCap: 100_000,
    status: 'trial',
    active: '1h ago',
    flags: [],
    risk: 'Trial ends in 3 days',
  }),
  mkWs({
    id: 'ws_2c55',
    name: 'Harbor & Co',
    domain: 'hello.harborco.com',
    owner: 'Sofia Alvarez',
    email: 'sofia@harborco.com',
    region: 'US (Virginia)',
    created: 'Sep 2024',
    card: 'Visa ···1123',
    nextInvoice: 'past due',
    plan: 'growth',
    users: 11,
    email30: 610_000,
    sms30: 0,
    wa30: 0,
    mrr: 890,
    ltv: 14_200,
    deliv: 96.2,
    quota: 63,
    quotaCap: 1_500_000,
    status: 'past_due',
    active: '3h ago',
    flags: ['Advanced segments'],
    risk: 'Invoice 6 days overdue',
  }),
  mkWs({
    id: 'ws_88a1',
    name: 'Vertex Health',
    domain: 'care.vertexhealth.org',
    owner: 'Dr. Amelia Frost',
    email: 'amelia@vertexhealth.org',
    region: 'EU (Frankfurt)',
    created: 'Feb 2025',
    card: 'Visa ···7742',
    nextInvoice: 'Aug 5, 2026',
    plan: 'scale',
    users: 27,
    email30: 1_240_000,
    sms30: 320_000,
    wa30: 88_000,
    mrr: 2400,
    ltv: 34_800,
    deliv: 94.8,
    quota: 92,
    quotaCap: 2_000_000,
    status: 'active',
    active: '11m ago',
    flags: ['WhatsApp', 'Advanced segments'],
    risk: 'Deliverability below 95%',
  }),
  mkWs({
    id: 'ws_5f30',
    name: 'Loop Commerce',
    domain: 'go.loopcommerce.shop',
    owner: 'Danielle Cho',
    email: 'dani@loopcommerce.shop',
    region: 'US (Oregon)',
    created: 'Apr 2025',
    card: 'Mastercard ···3390',
    nextInvoice: 'Aug 9, 2026',
    plan: 'starter',
    users: 6,
    email30: 148_000,
    sms30: 9000,
    wa30: 0,
    mrr: 190,
    ltv: 2100,
    deliv: 98.3,
    quota: 41,
    quotaCap: 250_000,
    status: 'active',
    active: '1d ago',
    flags: [],
  }),
  mkWs({
    id: 'ws_6ab2',
    name: 'Atlas Freight',
    domain: 'ops.atlasfreight.com',
    owner: 'Reuben Okafor',
    email: 'reuben@atlasfreight.com',
    region: 'US (Virginia)',
    created: 'Aug 2023',
    card: 'Amex ···5561',
    nextInvoice: 'Aug 1, 2026',
    plan: 'enterprise',
    users: 48,
    email30: 2_100_000,
    sms30: 640_000,
    wa30: 210_000,
    mrr: 5800,
    ltv: 168_000,
    deliv: 99.1,
    quota: 76,
    quotaCap: 5_000_000,
    status: 'active',
    active: '7m ago',
    flags: ['AI subject lines', 'WhatsApp', 'Dedicated IP'],
  }),
  mkWs({
    id: 'ws_0d17',
    name: 'Quill Books',
    domain: 'news.quillbooks.com',
    owner: 'Hana Sato',
    email: 'hana@quillbooks.com',
    region: 'EU (Ireland)',
    created: 'Dec 2024',
    card: 'Visa ···9004',
    nextInvoice: 'suspended',
    plan: 'starter',
    users: 3,
    email30: 4000,
    sms30: 0,
    wa30: 0,
    mrr: 0,
    ltv: 760,
    deliv: 88.4,
    quota: 4,
    quotaCap: 250_000,
    status: 'suspended',
    active: '18d ago',
    flags: [],
    risk: 'Suspended — spam complaints',
  }),
  mkWs({
    id: 'ws_3e6b',
    name: 'Fern & Field',
    domain: 'grow.fernfield.co',
    owner: 'Oliver Grant',
    email: 'oliver@fernfield.co',
    region: 'US (Oregon)',
    created: 'May 2025',
    card: 'Visa ···2288',
    nextInvoice: 'Aug 12, 2026',
    plan: 'growth',
    users: 9,
    email30: 420_000,
    sms30: 18_000,
    wa30: 0,
    mrr: 890,
    ltv: 6400,
    deliv: 98.7,
    quota: 33,
    quotaCap: 1_500_000,
    status: 'active',
    active: '46m ago',
    flags: ['Advanced segments'],
  }),
];

export const AT_RISK = WORKSPACES.filter((w) => w.risk).slice(0, 4);

export interface Signup {
  name: string;
  email: string;
  when: string;
}
export const NEW_SIGNUPS: Signup[] = [
  { name: 'Priya Raman', email: 'priya@covefin.com', when: '2h ago' },
  { name: 'Marcus Bell', email: 'marcus@pinecrest.dev', when: '5h ago' },
  { name: 'Danielle Cho', email: 'dani@loopcommerce.shop', when: 'yesterday' },
  { name: 'Oliver Grant', email: 'oliver@fernfield.co', when: '2d ago' },
];

export interface ActivityItem {
  color: string;
  text: string;
  when: string;
}
export const PLATFORM_ACTIVITY: ActivityItem[] = [
  { color: '#16a34a', text: '<b>Cove Financial</b> upgraded to Enterprise', when: '12m ago' },
  { color: '#4f46e5', text: '<b>Northwind Retail</b> added a dedicated IP', when: '38m ago' },
  { color: '#d97706', text: '<b>Harbor & Co</b> invoice went past due', when: '1h ago' },
  { color: '#dc2626', text: '<b>Quill Books</b> suspended for complaints', when: '3h ago' },
  { color: '#0891b2', text: '<b>Atlas Freight</b> sent 2.1M messages this month', when: '5h ago' },
];

/* KPI strips ------------------------------------------------------------- */

export const OVERVIEW_KPIS: Kpi[] = [
  { icon: 'layers', label: 'Workspaces', value: '1,284', delta: '+38 this month', tone: 'up' },
  { icon: 'users', label: 'Active users', value: '9,410', delta: '+312', tone: 'up' },
  { icon: 'send', label: 'Sends · 30d', value: '48.6M', delta: '+7.2%', tone: 'up' },
  { icon: 'chart', label: 'MRR', value: '$318k', delta: '+4.1%', tone: 'up' },
  { icon: 'shield', label: 'Avg. deliverability', value: '98.7%', delta: '-0.2%', tone: 'down' },
  { icon: 'help', label: 'Open tickets', value: '7', delta: '2 breaching SLA', tone: 'flat' },
];

export interface SendsDay {
  day: string;
  email: number;
  sms: number;
  wa: number;
}
export const PLATFORM_SENDS: SendsDay[] = [
  { day: 'Jul 12', email: 1.32, sms: 0.28, wa: 0.11 },
  { day: '13', email: 1.28, sms: 0.31, wa: 0.12 },
  { day: '14', email: 1.55, sms: 0.34, wa: 0.14 },
  { day: '15', email: 1.61, sms: 0.29, wa: 0.13 },
  { day: '16', email: 1.44, sms: 0.33, wa: 0.15 },
  { day: '17', email: 1.12, sms: 0.22, wa: 0.09 },
  { day: '18', email: 0.98, sms: 0.19, wa: 0.08 },
  { day: '19', email: 1.38, sms: 0.3, wa: 0.12 },
  { day: '20', email: 1.72, sms: 0.36, wa: 0.16 },
  { day: '21', email: 1.81, sms: 0.4, wa: 0.18 },
  { day: '22', email: 1.66, sms: 0.35, wa: 0.15 },
  { day: '23', email: 1.49, sms: 0.31, wa: 0.13 },
  { day: '24', email: 1.58, sms: 0.34, wa: 0.14 },
  { day: 'Today', email: 1.09, sms: 0.24, wa: 0.1 },
];

/* -------------------------------------------------------------------- users */

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';
export const ROLE: Record<UserRole, Pill> = {
  owner: { label: 'Owner', fg: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
  admin: { label: 'Admin', fg: '#4f46e5', bg: 'var(--accent-tint)' },
  editor: { label: 'Editor', fg: '#0891b2', bg: 'rgba(8,145,178,.1)' },
  viewer: { label: 'Viewer', fg: 'var(--text3)', bg: 'var(--surface2)' },
};

export interface AdminUser {
  name: string;
  email: string;
  ws: string;
  plan: PlanKey;
  role: UserRole;
  mfa: boolean;
  active: boolean;
  last: string;
}

export const USERS: AdminUser[] = [
  { name: 'Elena Marsh', email: 'elena@northwind.io', ws: 'Northwind Retail', plan: 'scale', role: 'owner', mfa: true, active: true, last: '4m ago' },
  { name: 'Priya Raman', email: 'priya@covefin.com', ws: 'Cove Financial', plan: 'enterprise', role: 'owner', mfa: true, active: true, last: '2m ago' },
  { name: 'Theo Nguyen', email: 'theo@brightside.co', ws: 'Brightside Media', plan: 'growth', role: 'owner', mfa: false, active: true, last: '22m ago' },
  { name: 'Sam Patel', email: 'sam@northwind.io', ws: 'Northwind Retail', plan: 'scale', role: 'admin', mfa: true, active: true, last: '1h ago' },
  { name: 'Reuben Okafor', email: 'reuben@atlasfreight.com', ws: 'Atlas Freight', plan: 'enterprise', role: 'owner', mfa: true, active: true, last: '7m ago' },
  { name: 'Amelia Frost', email: 'amelia@vertexhealth.org', ws: 'Vertex Health', plan: 'scale', role: 'owner', mfa: true, active: true, last: '11m ago' },
  { name: 'Jordan Lee', email: 'jordan@brightside.co', ws: 'Brightside Media', plan: 'growth', role: 'editor', mfa: false, active: true, last: '3h ago' },
  { name: 'Hana Sato', email: 'hana@quillbooks.com', ws: 'Quill Books', plan: 'starter', role: 'owner', mfa: false, active: false, last: '18d ago' },
  { name: 'Marcus Bell', email: 'marcus@pinecrest.dev', ws: 'Pinecrest Labs', plan: 'free', role: 'owner', mfa: false, active: true, last: '1h ago' },
  { name: 'Sofia Alvarez', email: 'sofia@harborco.com', ws: 'Harbor & Co', plan: 'growth', role: 'owner', mfa: true, active: true, last: '3h ago' },
  { name: 'Danielle Cho', email: 'dani@loopcommerce.shop', ws: 'Loop Commerce', plan: 'starter', role: 'owner', mfa: false, active: true, last: '1d ago' },
  { name: 'Oliver Grant', email: 'oliver@fernfield.co', ws: 'Fern & Field', plan: 'growth', role: 'owner', mfa: true, active: true, last: '46m ago' },
];

export const USER_KPIS: Kpi[] = [
  { icon: 'users', label: 'Total members', value: '9,410', delta: '+312 this month', tone: 'up' },
  { icon: 'shield', label: '2FA enabled', value: '64%', delta: '+3pt', tone: 'up' },
  { icon: 'star', label: 'Owners', value: '1,284', delta: '1 per workspace', tone: 'flat' },
  { icon: 'clock', label: 'Active this week', value: '7,120', delta: '76% of members', tone: 'up' },
];

/* ------------------------------------------------------------------ tokens */

export interface AdminToken {
  name: string;
  prefix: string;
  ws: string;
  scope: 'read' | 'write' | 'admin';
  status: 'active' | 'expiring' | 'revoked';
  used: string;
  expires: string;
}
export const TOKEN_SCOPE: Record<AdminToken['scope'], Pill> = {
  read: { label: 'read', fg: 'var(--text3)', bg: 'var(--surface2)' },
  write: { label: 'write', fg: '#0891b2', bg: 'rgba(8,145,178,.1)' },
  admin: { label: 'admin', fg: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
};
export const TOKEN_STATUS: Record<AdminToken['status'], Pill> = {
  active: { label: 'Active', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  expiring: { label: 'Expiring', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  revoked: { label: 'Revoked', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' },
};
export const TOKENS: AdminToken[] = [
  { name: 'Production API', prefix: 'md_live_a1b2', ws: 'Cove Financial', scope: 'admin', status: 'active', used: '2m ago', expires: 'never' },
  { name: 'Zapier integration', prefix: 'md_live_9f0e', ws: 'Northwind Retail', scope: 'write', status: 'active', used: '1h ago', expires: 'Dec 2026' },
  { name: 'Analytics export', prefix: 'md_live_3c7d', ws: 'Atlas Freight', scope: 'read', status: 'active', used: '4h ago', expires: 'never' },
  { name: 'CI pipeline', prefix: 'md_live_6b21', ws: 'Brightside Media', scope: 'write', status: 'expiring', used: '1d ago', expires: 'in 9 days' },
  { name: 'Legacy webhook', prefix: 'md_live_0aa4', ws: 'Harbor & Co', scope: 'read', status: 'revoked', used: '32d ago', expires: '—' },
  { name: 'Segment sync', prefix: 'md_live_77ce', ws: 'Vertex Health', scope: 'write', status: 'active', used: '9m ago', expires: 'Mar 2027' },
  { name: 'Mobile app', prefix: 'md_live_be15', ws: 'Loop Commerce', scope: 'read', status: 'active', used: '2d ago', expires: 'never' },
  { name: 'Data warehouse', prefix: 'md_live_4d92', ws: 'Cove Financial', scope: 'read', status: 'active', used: '15m ago', expires: 'never' },
];
export const TOKEN_KPIS: Kpi[] = [
  { icon: 'lock', label: 'Active tokens', value: '842', delta: '+14', tone: 'up' },
  { icon: 'clock', label: 'Expiring soon', value: '11', delta: 'within 30 days', tone: 'flat' },
  { icon: 'shield', label: 'Admin scope', value: '58', delta: 'high privilege', tone: 'flat' },
  { icon: 'x', label: 'Revoked · 30d', value: '23', delta: '+5', tone: 'down' },
];

/* ----------------------------------------------------------------- billing */

export const BILLING_KPIS: Kpi[] = [
  { icon: 'chart', label: 'MRR', value: '$318k', delta: '+4.1%', tone: 'up' },
  { icon: 'arrow-up-right', label: 'ARR', value: '$3.8M', delta: '+4.1%', tone: 'up' },
  { icon: 'users', label: 'Paying', value: '946', delta: '+22', tone: 'up' },
  { icon: 'target', label: 'ARPA', value: '$336', delta: '+$6', tone: 'up' },
  { icon: 'download', label: 'Collected · 30d', value: '$301k', delta: '95% of billed', tone: 'flat' },
  { icon: 'clock', label: 'Outstanding', value: '$17k', delta: '9 invoices', tone: 'down' },
];
export const MRR_TREND = [172, 181, 190, 205, 214, 228, 241, 258, 270, 289, 305, 318];
export interface MrrByPlanRow {
  plan: PlanKey;
  count: string;
  revenue: number;
}
export const MRR_BY_PLAN: MrrByPlanRow[] = [
  { plan: 'enterprise', count: '38 accounts', revenue: 128_000 },
  { plan: 'scale', count: '112 accounts', revenue: 98_000 },
  { plan: 'growth', count: '341 accounts', revenue: 72_000 },
  { plan: 'starter', count: '455 accounts', revenue: 20_000 },
];

/* ---------------------------------------------------------------- invoices */

export type InvStatus = 'paid' | 'open' | 'past_due' | 'void';
export const INV_STATUS: Record<InvStatus, Pill> = {
  paid: { label: 'Paid', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  open: { label: 'Open', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5' },
  past_due: { label: 'Past due', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  void: { label: 'Void', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' },
};
export interface Invoice {
  num: string;
  ws: string;
  plan: PlanKey;
  period: string;
  due: string;
  status: InvStatus;
  amount: number;
}
export const INVOICES: Invoice[] = [
  { num: 'INV-24817', ws: 'Cove Financial', plan: 'enterprise', period: 'Jul 2026', due: 'Aug 1', status: 'paid', amount: 5800 },
  { num: 'INV-24816', ws: 'Atlas Freight', plan: 'enterprise', period: 'Jul 2026', due: 'Aug 1', status: 'paid', amount: 5800 },
  { num: 'INV-24815', ws: 'Northwind Retail', plan: 'scale', period: 'Jul 2026', due: 'Aug 1', status: 'paid', amount: 2400 },
  { num: 'INV-24814', ws: 'Vertex Health', plan: 'scale', period: 'Jul 2026', due: 'Aug 5', status: 'open', amount: 2400 },
  { num: 'INV-24813', ws: 'Harbor & Co', plan: 'growth', period: 'Jul 2026', due: 'Jul 19', status: 'past_due', amount: 890 },
  { num: 'INV-24812', ws: 'Brightside Media', plan: 'growth', period: 'Jul 2026', due: 'Aug 3', status: 'paid', amount: 890 },
  { num: 'INV-24811', ws: 'Fern & Field', plan: 'growth', period: 'Jul 2026', due: 'Aug 12', status: 'open', amount: 890 },
  { num: 'INV-24810', ws: 'Loop Commerce', plan: 'starter', period: 'Jul 2026', due: 'Aug 9', status: 'paid', amount: 190 },
  { num: 'INV-24809', ws: 'Quill Books', plan: 'starter', period: 'Jun 2026', due: 'Jul 2', status: 'void', amount: 190 },
  { num: 'INV-24808', ws: 'Cove Financial', plan: 'enterprise', period: 'Jun 2026', due: 'Jul 1', status: 'paid', amount: 5800 },
];

/* ----------------------------------------------------------------- domains */

export type DnsState = 'pass' | 'warn' | 'fail';
export const DNS: Record<DnsState, Pill> = {
  pass: { label: 'Pass', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  warn: { label: 'Warn', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  fail: { label: 'Fail', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
};
export interface Domain {
  domain: string;
  ws: string;
  spf: DnsState;
  dkim: DnsState;
  dmarc: DnsState;
  bounce: number;
  complaint: number;
  status: 'verified' | 'pending' | 'issues';
}
export const DOMAIN_STATUS: Record<Domain['status'], Pill> = {
  verified: { label: 'Verified', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  pending: { label: 'Pending', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  issues: { label: 'Issues', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
};
export const DOMAINS: Domain[] = [
  { domain: 'mail.northwind.io', ws: 'Northwind Retail', spf: 'pass', dkim: 'pass', dmarc: 'pass', bounce: 0.4, complaint: 0.02, status: 'verified' },
  { domain: 'notify.covefin.com', ws: 'Cove Financial', spf: 'pass', dkim: 'pass', dmarc: 'pass', bounce: 0.3, complaint: 0.01, status: 'verified' },
  { domain: 'ops.atlasfreight.com', ws: 'Atlas Freight', spf: 'pass', dkim: 'pass', dmarc: 'warn', bounce: 0.6, complaint: 0.03, status: 'verified' },
  { domain: 'send.brightside.co', ws: 'Brightside Media', spf: 'pass', dkim: 'warn', dmarc: 'fail', bounce: 1.1, complaint: 0.06, status: 'issues' },
  { domain: 'care.vertexhealth.org', ws: 'Vertex Health', spf: 'pass', dkim: 'pass', dmarc: 'warn', bounce: 2.3, complaint: 0.12, status: 'issues' },
  { domain: 'hello.harborco.com', ws: 'Harbor & Co', spf: 'warn', dkim: 'pass', dmarc: 'fail', bounce: 1.8, complaint: 0.09, status: 'issues' },
  { domain: 'mailer.pinecrest.dev', ws: 'Pinecrest Labs', spf: 'pending' as unknown as DnsState, dkim: 'pending' as unknown as DnsState, dmarc: 'pending' as unknown as DnsState, bounce: 0, complaint: 0, status: 'pending' },
  { domain: 'go.loopcommerce.shop', ws: 'Loop Commerce', spf: 'pass', dkim: 'pass', dmarc: 'pass', bounce: 0.5, complaint: 0.02, status: 'verified' },
];
export const DOMAIN_KPIS: Kpi[] = [
  { icon: 'globe', label: 'Domains', value: '1,902', delta: '+41', tone: 'up' },
  { icon: 'check-circle', label: 'Fully authenticated', value: '87%', delta: '+2pt', tone: 'up' },
  { icon: 'shield', label: 'DMARC enforced', value: '61%', delta: '+5pt', tone: 'up' },
  { icon: 'target', label: 'Avg. bounce', value: '0.7%', delta: '-0.1%', tone: 'up' },
];

/* --------------------------------------------------------------- campaigns */

export type Channel = 'email' | 'sms' | 'whatsapp';
export const CHANNEL_META: Record<Channel, Pill & { icon: IconName }> = {
  email: { label: 'Email', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5', icon: 'mail' },
  sms: { label: 'SMS', fg: '#0891b2', bg: 'rgba(8,145,178,.1)', dot: '#0891b2', icon: 'sms' },
  whatsapp: { label: 'WhatsApp', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a', icon: 'whatsapp' },
};
export type CampStatus = 'sending' | 'scheduled' | 'sent' | 'paused';
export const CAMP_STATUS: Record<CampStatus, Pill & { live?: boolean }> = {
  sending: { label: 'Sending', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706', live: true },
  scheduled: { label: 'Scheduled', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5' },
  sent: { label: 'Sent', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  paused: { label: 'Paused', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' },
};
export interface AdminCampaign {
  name: string;
  ws: string;
  channel: Channel;
  recipients: number;
  progress: number;
  openRate: number;
  status: CampStatus;
  when: string;
}
export const CAMPAIGNS: AdminCampaign[] = [
  { name: 'Summer clearance', ws: 'Northwind Retail', channel: 'email', recipients: 482_000, progress: 62, openRate: 41.2, status: 'sending', when: 'now' },
  { name: 'Payment reminder', ws: 'Cove Financial', channel: 'sms', recipients: 96_000, progress: 88, openRate: 0, status: 'sending', when: 'now' },
  { name: 'Shipment update', ws: 'Atlas Freight', channel: 'whatsapp', recipients: 54_000, progress: 100, openRate: 78.4, status: 'sent', when: '2h ago' },
  { name: 'Weekly digest', ws: 'Brightside Media', channel: 'email', recipients: 210_000, progress: 0, openRate: 0, status: 'scheduled', when: 'in 4h' },
  { name: 'Appointment nudge', ws: 'Vertex Health', channel: 'sms', recipients: 38_000, progress: 100, openRate: 0, status: 'sent', when: '5h ago' },
  { name: 'New arrivals', ws: 'Loop Commerce', channel: 'email', recipients: 44_000, progress: 100, openRate: 33.1, status: 'sent', when: '1d ago' },
  { name: 'Cart recovery', ws: 'Harbor & Co', channel: 'email', recipients: 12_000, progress: 40, openRate: 0, status: 'paused', when: 'paused' },
  { name: 'Feedback request', ws: 'Fern & Field', channel: 'whatsapp', recipients: 8000, progress: 0, openRate: 0, status: 'scheduled', when: 'tomorrow' },
];
export const CAMPAIGN_KPIS: Kpi[] = [
  { icon: 'campaigns', label: 'In flight', value: '38', delta: 'across 24 workspaces', tone: 'flat' },
  { icon: 'send', label: 'Sent · 24h', value: '11.4M', delta: '+9%', tone: 'up' },
  { icon: 'clock', label: 'Scheduled', value: '206', delta: 'next 7 days', tone: 'flat' },
  { icon: 'target', label: 'Avg. open rate', value: '38.9%', delta: '+1.2pt', tone: 'up' },
];

/* ----------------------------------------------------------- deliverability */

export const DELIV_KPIS: Kpi[] = [
  { icon: 'inbox', label: 'Inbox placement', value: '96.4%', delta: '+0.3%', tone: 'up' },
  { icon: 'send', label: 'Delivered', value: '98.7%', delta: '-0.2%', tone: 'down' },
  { icon: 'arrow-up-right', label: 'Bounce rate', value: '0.8%', delta: '+0.1%', tone: 'down' },
  { icon: 'x', label: 'Complaint rate', value: '0.04%', delta: 'flat', tone: 'flat' },
  { icon: 'shield', label: 'At-risk domains', value: '14', delta: '+3', tone: 'down' },
];
export const DELIV_TREND = [98.9, 99.1, 98.7, 99.2, 99.0, 98.6, 98.9, 99.3, 99.1, 98.8, 98.7, 98.7];
export interface RateMonth {
  m: string;
  bounce: number;
  complaint: number;
}
export const DELIV_RATES: RateMonth[] = [
  { m: 'Aug', bounce: 0.6, complaint: 0.03 },
  { m: 'Sep', bounce: 0.7, complaint: 0.04 },
  { m: 'Oct', bounce: 0.5, complaint: 0.03 },
  { m: 'Nov', bounce: 0.9, complaint: 0.05 },
  { m: 'Dec', bounce: 1.1, complaint: 0.06 },
  { m: 'Jan', bounce: 0.8, complaint: 0.04 },
  { m: 'Feb', bounce: 0.7, complaint: 0.04 },
  { m: 'Mar', bounce: 0.6, complaint: 0.03 },
  { m: 'Apr', bounce: 0.7, complaint: 0.04 },
  { m: 'May', bounce: 0.8, complaint: 0.05 },
  { m: 'Jun', bounce: 0.9, complaint: 0.04 },
  { m: 'Jul', bounce: 0.8, complaint: 0.04 },
];
export interface ProviderRow {
  label: string;
  value: number;
  color: string;
}
export const DELIV_PROVIDERS: ProviderRow[] = [
  { label: 'Gmail', value: 97.8, color: '#16a34a' },
  { label: 'Outlook / Microsoft', value: 95.1, color: '#16a34a' },
  { label: 'Yahoo / AOL', value: 94.4, color: '#d97706' },
  { label: 'Apple Mail', value: 98.2, color: '#16a34a' },
  { label: 'Other', value: 92.6, color: '#d97706' },
];
export interface ReasonRow {
  label: string;
  pct: number;
  color: string;
}
export const DELIV_REASONS: ReasonRow[] = [
  { label: 'Mailbox full', pct: 34, color: '#4f46e5' },
  { label: 'Invalid address', pct: 28, color: '#0891b2' },
  { label: 'Blocked / spam', pct: 19, color: '#dc2626' },
  { label: 'Content rejected', pct: 12, color: '#d97706' },
  { label: 'Other', pct: 7, color: 'var(--muted2)' },
];
export const DELIV_WORST = WORKSPACES.slice()
  .sort((a, b) => a.deliv - b.deliv)
  .slice(0, 5);

/* ------------------------------------------------------------------ events */

export const EVENT_KPIS: Kpi[] = [
  { icon: 'bolt', label: 'Events · 24h', value: '2.4M', delta: '+6%', tone: 'up' },
  { icon: 'check-circle', label: 'Processed', value: '99.98%', delta: 'healthy', tone: 'up' },
  { icon: 'clock', label: 'Avg. latency', value: '42ms', delta: '-4ms', tone: 'up' },
  { icon: 'x', label: 'Failed · 24h', value: '318', delta: '+12', tone: 'down' },
];
export type EventStatus = 'ok' | 'retried' | 'failed';
export const EVENT_STATUS: Record<EventStatus, Pill> = {
  ok: { label: 'Processed', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  retried: { label: 'Retried', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  failed: { label: 'Failed', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
};
export interface WebhookEvent {
  type: string;
  msgId: string;
  channel: Channel;
  endpoint: string;
  status: EventStatus;
  when: string;
}
export const EVENTS: WebhookEvent[] = [
  { type: 'DELIVERY_REPORT', msgId: 'msg_8f1a2c', channel: 'email', endpoint: '/webhooks/infobip', status: 'ok', when: '2s ago' },
  { type: 'INBOUND_MESSAGE', msgId: 'msg_3d9e11', channel: 'whatsapp', endpoint: '/webhooks/infobip', status: 'ok', when: '5s ago' },
  { type: 'DELIVERY_REPORT', msgId: 'msg_77bc0a', channel: 'sms', endpoint: '/webhooks/infobip', status: 'retried', when: '11s ago' },
  { type: 'SEEN_REPORT', msgId: 'msg_10ff9d', channel: 'whatsapp', endpoint: '/webhooks/infobip', status: 'ok', when: '18s ago' },
  { type: 'DELIVERY_REPORT', msgId: 'msg_ba4402', channel: 'email', endpoint: '/webhooks/infobip', status: 'failed', when: '34s ago' },
  { type: 'INBOUND_MESSAGE', msgId: 'msg_2e7712', channel: 'sms', endpoint: '/webhooks/infobip', status: 'ok', when: '48s ago' },
  { type: 'DELIVERY_REPORT', msgId: 'msg_9a01cd', channel: 'email', endpoint: '/webhooks/infobip', status: 'ok', when: '1m ago' },
  { type: 'STATUS_CALLBACK', msgId: 'msg_5c33ab', channel: 'sms', endpoint: '/webhooks/infobip', status: 'ok', when: '1m ago' },
];

/* ------------------------------------------------------------------ queues */

export interface Queue {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  rate: string;
  status: 'healthy' | 'busy' | 'degraded';
}
export const QUEUE_STATUS: Record<Queue['status'], Pill> = {
  healthy: { label: 'Healthy', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  busy: { label: 'Busy', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  degraded: { label: 'Degraded', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
};
export const QUEUES: Queue[] = [
  { name: 'email:send', active: 128, waiting: 4210, completed: 1_820_400, failed: 42, rate: '2.1k/s', status: 'busy' },
  { name: 'sms:send', active: 44, waiting: 890, completed: 512_300, failed: 8, rate: '640/s', status: 'healthy' },
  { name: 'wa:send', active: 22, waiting: 210, completed: 188_900, failed: 3, rate: '210/s', status: 'healthy' },
  { name: 'webhooks:ingest', active: 61, waiting: 1200, completed: 2_410_000, failed: 318, rate: '3.4k/s', status: 'degraded' },
  { name: 'stats:rollup', active: 4, waiting: 0, completed: 44_200, failed: 0, rate: '12/s', status: 'healthy' },
  { name: 'media:process', active: 9, waiting: 34, completed: 91_100, failed: 1, rate: '30/s', status: 'healthy' },
  { name: 'exports:build', active: 2, waiting: 6, completed: 12_400, failed: 0, rate: '3/s', status: 'healthy' },
  { name: 'ai:generate', active: 17, waiting: 88, completed: 63_700, failed: 12, rate: '48/s', status: 'busy' },
];
export const QUEUE_KPIS: Kpi[] = [
  { icon: 'zap', label: 'Jobs · 24h', value: '5.2M', delta: '+8%', tone: 'up' },
  { icon: 'layers', label: 'Waiting', value: '6,638', delta: 'backlog', tone: 'flat' },
  { icon: 'x', label: 'Failed · 24h', value: '384', delta: '+22', tone: 'down' },
  { icon: 'clock', label: 'Avg. wait', value: '1.8s', delta: '-0.3s', tone: 'up' },
];

/* ------------------------------------------------------------------- cache */

export interface CacheKey {
  key: string;
  type: 'string' | 'hash' | 'set' | 'zset' | 'list';
  ttl: string;
  size: string;
  hot?: boolean;
}
export const CACHE: CacheKey[] = [
  { key: 'session:u_9410', type: 'hash', ttl: '13m', size: '2.1 KB' },
  { key: 'ratelimit:api:ws_44de', type: 'string', ttl: '48s', size: '24 B', hot: true },
  { key: 'stats:summary:ws_9f2a', type: 'hash', ttl: '4m', size: '8.4 KB' },
  { key: 'segment:count:seg_882', type: 'string', ttl: '2m', size: '16 B' },
  { key: 'flags:global', type: 'hash', ttl: 'no expiry', size: '1.2 KB' },
  { key: 'queue:email:send', type: 'zset', ttl: 'no expiry', size: '4.9 MB', hot: true },
  { key: 'template:render:tpl_41', type: 'string', ttl: '58m', size: '34 KB' },
  { key: 'presence:ws_88a1', type: 'set', ttl: '30s', size: '480 B' },
];
export const CACHE_KPIS: Kpi[] = [
  { icon: 'target', label: 'Keys', value: '1.9M', delta: 'in Redis', tone: 'flat' },
  { icon: 'zap', label: 'Hit rate', value: '99.2%', delta: '+0.1%', tone: 'up' },
  { icon: 'layers', label: 'Memory used', value: '6.4 GB', delta: 'of 16 GB', tone: 'flat' },
  { icon: 'users', label: 'Active sessions', value: '7,120', delta: 'live now', tone: 'flat' },
];

/* -------------------------------------------------------------------- logs */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export const LOG_LEVEL: Record<LogLevel, Pill> = {
  info: { label: 'info', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5' },
  warn: { label: 'warn', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  error: { label: 'error', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
  debug: { label: 'debug', fg: 'var(--text3)', bg: 'var(--surface2)', dot: 'var(--muted)' },
};
export interface LogLine {
  time: string;
  level: LogLevel;
  svc: string;
  msg: string;
}
export const LOGS: LogLine[] = [
  { time: '07:44:12.301', level: 'info', svc: 'product-api', msg: 'GET /v1/stats/summary 200 in 41ms' },
  { time: '07:44:12.118', level: 'warn', svc: 'webhooks', msg: 'Retry 1/3 for msg_ba4402 (timeout)' },
  { time: '07:44:11.940', level: 'error', svc: 'webhooks', msg: 'Failed to persist DLR after 3 retries: msg_ba4402' },
  { time: '07:44:11.512', level: 'info', svc: 'messaging', msg: 'Dispatched 2,140 email jobs to Infobip' },
  { time: '07:44:10.998', level: 'debug', svc: 'product-api', msg: 'Cache miss stats:summary:ws_88a1' },
  { time: '07:44:10.774', level: 'info', svc: 'workers', msg: 'stats:rollup completed for 2026-07-24' },
  { time: '07:44:10.201', level: 'warn', svc: 'messaging', msg: 'SMS gateway latency elevated (>800ms)' },
  { time: '07:44:09.883', level: 'info', svc: 'product-api', msg: 'POST /v1/campaigns 201 in 88ms' },
];
export const LOG_KPIS: Kpi[] = [
  { icon: 'code', label: 'Lines · 1h', value: '842k', delta: 'streaming', tone: 'flat' },
  { icon: 'help', label: 'Warnings · 1h', value: '1,204', delta: '+3%', tone: 'down' },
  { icon: 'x', label: 'Errors · 1h', value: '96', delta: '+8', tone: 'down' },
  { icon: 'clock', label: 'p95 request', value: '112ms', delta: '-6ms', tone: 'up' },
];

/* ------------------------------------------------------------------- audit */

export type AuditCat = 'auth' | 'billing' | 'account' | 'security' | 'data';
export const AUDIT_CAT: Record<AuditCat, Pill & { icon: IconName }> = {
  auth: { label: 'Auth', fg: '#4f46e5', bg: 'var(--accent-tint)', icon: 'lock' },
  billing: { label: 'Billing', fg: '#16a34a', bg: 'var(--success-bg)', icon: 'chart' },
  account: { label: 'Account', fg: '#0891b2', bg: 'rgba(8,145,178,.1)', icon: 'users' },
  security: { label: 'Security', fg: '#dc2626', bg: 'var(--danger-bg)', icon: 'shield' },
  data: { label: 'Data', fg: '#7c3aed', bg: 'rgba(124,58,237,.12)', icon: 'layers' },
};
export interface AuditEvent {
  actor: string;
  action: string;
  target: string;
  cat: AuditCat;
  ip: string;
  when: string;
  danger?: boolean;
}
export const AUDIT: AuditEvent[] = [
  { actor: 'Sam Underwood', action: 'Suspended workspace', target: 'ws_0d17 · Quill Books', cat: 'security', ip: '10.4.2.11', when: '3h ago', danger: true },
  { actor: 'Sam Underwood', action: 'Adjusted send quota', target: 'ws_88a1 → 2,000,000/mo', cat: 'account', ip: '10.4.2.11', when: '4h ago' },
  { actor: 'Priya Raman', action: 'Rotated API token', target: 'md_live_a1b2···', cat: 'security', ip: '81.2.44.9', when: '5h ago' },
  { actor: 'System', action: 'Marked invoice past due', target: 'INV-24813', cat: 'billing', ip: '—', when: '6h ago' },
  { actor: 'Elena Marsh', action: 'Added dedicated IP', target: '198.51.100.24', cat: 'account', ip: '5.6.7.8', when: '8h ago' },
  { actor: 'Sam Underwood', action: 'Impersonated owner', target: 'ws_44de · Cove Financial', cat: 'security', ip: '10.4.2.11', when: '9h ago', danger: true },
  { actor: 'Theo Nguyen', action: 'Exported subscriber list', target: '84,120 contacts', cat: 'data', ip: '72.1.9.42', when: '11h ago' },
  { actor: 'System', action: 'Password reset requested', target: 'hana@quillbooks.com', cat: 'auth', ip: '—', when: '1d ago' },
];
export const AUDIT_KPIS: Kpi[] = [
  { icon: 'eye', label: 'Events · 30d', value: '48,210', delta: '+6%', tone: 'up' },
  { icon: 'shield', label: 'Security events', value: '312', delta: '+18', tone: 'down' },
  { icon: 'lock', label: 'Failed logins', value: '1,044', delta: '-4%', tone: 'up' },
  { icon: 'users', label: 'Impersonations', value: '9', delta: 'this month', tone: 'flat' },
];

/* ------------------------------------------------------------------- flags */

export interface FeatureFlag {
  name: string;
  key: string;
  desc: string;
  stage: 'ga' | 'beta' | 'alpha' | 'internal';
  rollout: number;
  ofCount: string;
  on: boolean;
}
export const FLAG_STAGE: Record<FeatureFlag['stage'], Pill> = {
  ga: { label: 'GA', fg: '#16a34a', bg: 'var(--success-bg)' },
  beta: { label: 'Beta', fg: '#4f46e5', bg: 'var(--accent-tint)' },
  alpha: { label: 'Alpha', fg: '#d97706', bg: 'var(--warning-bg)' },
  internal: { label: 'Internal', fg: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
};
export const FLAGS: FeatureFlag[] = [
  { name: 'AI subject lines', key: 'ai_subject_lines', desc: 'Generate subject line variants with the configured LLM.', stage: 'ga', rollout: 100, ofCount: '1,284 of 1,284 workspaces', on: true },
  { name: 'Advanced segments', key: 'advanced_segments', desc: 'Boolean segment builder with live counts.', stage: 'ga', rollout: 100, ofCount: '1,284 of 1,284 workspaces', on: true },
  { name: 'Visual email builder v2', key: 'builder_v2', desc: 'New block library and property inspector.', stage: 'beta', rollout: 45, ofCount: '578 of 1,284 workspaces', on: true },
  { name: 'WhatsApp templates', key: 'wa_templates', desc: 'Submit and manage WA Business templates.', stage: 'beta', rollout: 62, ofCount: '796 of 1,284 workspaces', on: true },
  { name: 'Predictive send-time', key: 'predictive_send', desc: 'Per-recipient optimal send time.', stage: 'alpha', rollout: 8, ofCount: '103 of 1,284 workspaces', on: true },
  { name: 'Warehouse sync', key: 'warehouse_sync', desc: 'Sync events to external data warehouses.', stage: 'alpha', rollout: 3, ofCount: '38 of 1,284 workspaces', on: false },
  { name: 'Agent inbox', key: 'agent_inbox', desc: 'AI agent triage for inbound replies.', stage: 'internal', rollout: 0, ofCount: 'Laravel42 only', on: false },
  { name: 'Usage-based billing', key: 'ubb', desc: 'Meter overages instead of hard quota caps.', stage: 'internal', rollout: 0, ofCount: 'Laravel42 only', on: false },
];
export const FLAG_KPIS: Kpi[] = [
  { icon: 'zap', label: 'Total flags', value: '42', delta: '+3', tone: 'up' },
  { icon: 'check-circle', label: 'Enabled', value: '31', delta: 'live', tone: 'flat' },
  { icon: 'sparkle', label: 'In rollout', value: '6', delta: 'beta / alpha', tone: 'flat' },
  { icon: 'lock', label: 'Internal only', value: '5', delta: 'Laravel42', tone: 'flat' },
];

/* ----------------------------------------------------------------- support */

export type Priority = 'urgent' | 'high' | 'normal' | 'low';
export const PRIORITY: Record<Priority, Pill> = {
  urgent: { label: 'Urgent', fg: '#dc2626', bg: 'var(--danger-bg)' },
  high: { label: 'High', fg: '#d97706', bg: 'var(--warning-bg)' },
  normal: { label: 'Normal', fg: '#4f46e5', bg: 'var(--accent-tint)' },
  low: { label: 'Low', fg: 'var(--text3)', bg: 'var(--surface2)' },
};
export type TicketStatus = 'open' | 'pending' | 'resolved';
export const TICKET_STATUS: Record<TicketStatus, Pill> = {
  open: { label: 'Open', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5' },
  pending: { label: 'Pending', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  resolved: { label: 'Resolved', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
};
export interface Ticket {
  id: string;
  subject: string;
  ws: string;
  category: string;
  priority: Priority;
  agent: string | null;
  status: TicketStatus;
  updated: string;
}
export const TICKETS: Ticket[] = [
  { id: '4821', subject: 'Emails landing in spam for Gmail', ws: 'Vertex Health', category: 'Deliverability', priority: 'urgent', agent: 'Nadia K.', status: 'open', updated: '12m ago' },
  { id: '4820', subject: 'Cannot verify sending domain', ws: 'Pinecrest Labs', category: 'Domains', priority: 'high', agent: null, status: 'open', updated: '40m ago' },
  { id: '4819', subject: 'Billing charged twice in July', ws: 'Harbor & Co', category: 'Billing', priority: 'high', agent: 'Owen M.', status: 'pending', updated: '1h ago' },
  { id: '4818', subject: 'API rate limit too low', ws: 'Cove Financial', category: 'API', priority: 'normal', agent: 'Nadia K.', status: 'open', updated: '2h ago' },
  { id: '4817', subject: 'How to import 2M subscribers', ws: 'Atlas Freight', category: 'Onboarding', priority: 'normal', agent: 'Owen M.', status: 'pending', updated: '3h ago' },
  { id: '4816', subject: 'WhatsApp template rejected', ws: 'Northwind Retail', category: 'WhatsApp', priority: 'high', agent: 'Nadia K.', status: 'open', updated: '4h ago' },
  { id: '4815', subject: 'Feature request: dark mode export', ws: 'Brightside Media', category: 'Feature', priority: 'low', agent: null, status: 'open', updated: '6h ago' },
  { id: '4814', subject: 'Refund for suspended account', ws: 'Quill Books', category: 'Billing', priority: 'normal', agent: 'Owen M.', status: 'resolved', updated: '1d ago' },
];
export const TICKET_KPIS: Kpi[] = [
  { icon: 'inbox', label: 'Open tickets', value: '7', delta: '2 breaching SLA', tone: 'down' },
  { icon: 'clock', label: 'Avg. first reply', value: '38m', delta: '-6m', tone: 'up' },
  { icon: 'check-circle', label: 'Resolved · 7d', value: '214', delta: '+18', tone: 'up' },
  { icon: 'star', label: 'CSAT', value: '94%', delta: '+1pt', tone: 'up' },
];

/* ------------------------------------------------------------------- CMS */

export type PublishStatus = 'published' | 'draft' | 'scheduled';
export const PUBLISH: Record<PublishStatus, Pill> = {
  published: { label: 'Published', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  draft: { label: 'Draft', fg: 'var(--text3)', bg: 'var(--surface2)', dot: 'var(--muted)' },
  scheduled: { label: 'Scheduled', fg: '#4f46e5', bg: 'var(--accent-tint)', dot: '#4f46e5' },
};

export interface BlogPost {
  title: string;
  tag: string;
  tagColor: string;
  author: string;
  updated: string;
  status: PublishStatus;
  live: boolean;
  featured?: boolean;
}
export const BLOG_POSTS: BlogPost[] = [
  { title: 'How we cut bounce rates by 40%', tag: 'Deliverability', tagColor: '#16a34a', author: 'Nadia K.', updated: 'Jul 22', status: 'published', live: true, featured: true },
  { title: 'The anatomy of a great subject line', tag: 'Growth', tagColor: '#4f46e5', author: 'Owen M.', updated: 'Jul 18', status: 'published', live: true },
  { title: 'WhatsApp for transactional messaging', tag: 'Channels', tagColor: '#0891b2', author: 'Priya R.', updated: 'Jul 12', status: 'published', live: true },
  { title: 'Migrating from Mailchimp to Maildrill', tag: 'Product', tagColor: '#7c3aed', author: 'Sam U.', updated: 'Jul 24', status: 'draft', live: false },
  { title: 'Announcing AI subject lines', tag: 'Product', tagColor: '#7c3aed', author: 'Sam U.', updated: 'Aug 1', status: 'scheduled', live: false },
];
export const BLOG_KPIS: Kpi[] = [
  { icon: 'blog', label: 'Posts', value: '48', delta: '+2', tone: 'up' },
  { icon: 'check-circle', label: 'Published', value: '41', delta: 'live on /blog', tone: 'flat' },
  { icon: 'edit', label: 'Drafts', value: '5', delta: 'in progress', tone: 'flat' },
  { icon: 'eye', label: 'Views · 30d', value: '128k', delta: '+11%', tone: 'up' },
];

export interface Guide {
  title: string;
  cat: string;
  catColor: string;
  mins: number;
  updated: string;
  status: PublishStatus;
  live: boolean;
  feat?: boolean;
}
export const GUIDES: Guide[] = [
  { title: 'Set up SPF, DKIM & DMARC', cat: 'Deliverability', catColor: '#16a34a', mins: 8, updated: 'Jul 20', status: 'published', live: true, feat: true },
  { title: 'Build your first campaign', cat: 'Getting started', catColor: '#4f46e5', mins: 6, updated: 'Jul 15', status: 'published', live: true },
  { title: 'Segment subscribers like a pro', cat: 'Segmentation', catColor: '#0891b2', mins: 10, updated: 'Jul 9', status: 'published', live: true },
  { title: 'Warm up a new sending domain', cat: 'Deliverability', catColor: '#16a34a', mins: 12, updated: 'Jul 23', status: 'draft', live: false },
];
export const GUIDE_KPIS: Kpi[] = [
  { icon: 'guides', label: 'Guides', value: '24', delta: '+1', tone: 'up' },
  { icon: 'check-circle', label: 'Published', value: '21', delta: 'live on /guides', tone: 'flat' },
  { icon: 'edit', label: 'Drafts', value: '3', delta: 'in progress', tone: 'flat' },
  { icon: 'clock', label: 'Avg. read', value: '8 min', delta: 'per guide', tone: 'flat' },
];

export const PRICING_KPIS: Kpi[] = [
  { icon: 'chart', label: 'Plans', value: '4', delta: 'Starter → Enterprise', tone: 'flat' },
  { icon: 'sparkle', label: 'Promo', value: 'On', delta: 'launch pricing', tone: 'up' },
  { icon: 'globe', label: 'Regions priced', value: '4', delta: 'US · EU · UK · APAC', tone: 'flat' },
  { icon: 'target', label: 'Setup fee', value: '$25', delta: 'one-time', tone: 'flat' },
];
export interface RateCard {
  label: string;
  color: string;
  value: number;
  step: number;
  sub: string;
}
export const RATE_CARDS: RateCard[] = [
  { label: 'Email · per 1k', color: '#4f46e5', value: 0.4, step: 0.05, sub: 'Above plan allowance' },
  { label: 'SMS · per message', color: '#0891b2', value: 0.012, step: 0.001, sub: 'US & Canada' },
  { label: 'WhatsApp · per convo', color: '#16a34a', value: 0.03, step: 0.005, sub: '24h session' },
  { label: 'Voice · per minute', color: '#d97706', value: 0.018, step: 0.002, sub: 'Outbound' },
];
export interface TierRow {
  name: string;
  std: number;
  promo: number;
}
export const TIER_ROWS: TierRow[] = [
  { name: '1 year', std: 10, promo: 15 },
  { name: '2 years', std: 18, promo: 30 },
  { name: '3 years', std: 25, promo: 50 },
];
export const REGION_TABS = ['US', 'EU', 'UK', 'APAC'];

export interface LegalDoc {
  title: string;
  status: PublishStatus;
  updated: string;
  sections: string[];
  href: string;
}
export const LEGAL_DOCS: LegalDoc[] = [
  {
    title: 'Privacy Policy',
    status: 'published',
    updated: 'July 1, 2026',
    sections: ['Data we collect', 'How we use it', 'Sharing', 'Retention', 'Your rights', 'Cookies', 'Contact'],
    href: '/legal/privacy',
  },
  {
    title: 'Terms of Service',
    status: 'published',
    updated: 'July 1, 2026',
    sections: ['Acceptance', 'Accounts', 'Acceptable use', 'Billing', 'Termination', 'Liability', 'Governing law'],
    href: '/legal/terms',
  },
];

export interface SeoRow {
  page: string;
  path: string;
  title: string;
  titleLen: number;
  descLen: number;
}
export const SEO_ROWS: SeoRow[] = [
  { page: 'Home', path: '/', title: 'Maildrill — Multichannel messaging for modern teams', titleLen: 50, descLen: 148 },
  { page: 'Product', path: '/product', title: 'Product — Email, SMS, WhatsApp & Voice in one workspace', titleLen: 55, descLen: 152 },
  { page: 'Pricing', path: '/pricing', title: 'Pricing — Simple usage-based plans | Maildrill', titleLen: 46, descLen: 138 },
  { page: 'Deliverability', path: '/deliverability', title: 'Deliverability — Land in the inbox, every time', titleLen: 47, descLen: 166 },
  { page: 'Blog', path: '/blog', title: 'Blog — Messaging tactics, product updates & deliverability', titleLen: 58, descLen: 120 },
  { page: 'Guides', path: '/guides', title: 'Guides', titleLen: 6, descLen: 44 },
  { page: 'Contact', path: '/contact', title: 'Contact Maildrill — Talk to sales or support', titleLen: 45, descLen: 132 },
  { page: 'About', path: '/about', title: 'About Maildrill — Built by Laravel42', titleLen: 37, descLen: 118 },
];
export const SEO_KPIS: Kpi[] = [
  { icon: 'search', label: 'Pages tracked', value: '28', delta: 'all public', tone: 'flat' },
  { icon: 'check-circle', label: 'Titles optimal', value: '24', delta: '30–60 chars', tone: 'up' },
  { icon: 'help', label: 'Need attention', value: '4', delta: 'too short/long', tone: 'down' },
  { icon: 'media', label: 'OG images', value: '26', delta: 'of 28 pages', tone: 'flat' },
];

export interface Faq {
  q: string;
  updated: string;
  status: PublishStatus;
  live: boolean;
}
export const FAQS: Faq[] = [
  { q: 'How does usage-based billing work?', updated: 'Jul 21', status: 'published', live: true },
  { q: 'Can I bring my own sending domain?', updated: 'Jul 19', status: 'published', live: true },
  { q: 'Do you support WhatsApp Business?', updated: 'Jul 14', status: 'published', live: true },
  { q: 'Is there a free trial?', updated: 'Jul 10', status: 'published', live: true },
  { q: 'What happens if I exceed my quota?', updated: 'Jul 24', status: 'draft', live: false },
];
export const FAQ_KPIS: Kpi[] = [
  { icon: 'help', label: 'Questions', value: '19', delta: '+1', tone: 'up' },
  { icon: 'check-circle', label: 'Published', value: '17', delta: 'live on /pricing', tone: 'flat' },
  { icon: 'edit', label: 'Drafts', value: '2', delta: 'in progress', tone: 'flat' },
  { icon: 'eye', label: 'Expands · 30d', value: '9.2k', delta: '+7%', tone: 'up' },
];

/* --------------------------------------------------------------------- AI */

export interface LlmProvider {
  name: string;
  vendor: string;
  initial: string;
  color: string;
  modelCount: number;
  defaultModel: string;
  latency: number;
  status: 'connected' | 'degraded' | 'disabled';
  on: boolean;
}
export const LLM_STATUS: Record<LlmProvider['status'], Pill> = {
  connected: { label: 'Connected', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  degraded: { label: 'Degraded', fg: '#d97706', bg: 'var(--warning-bg)', dot: '#d97706' },
  disabled: { label: 'Disabled', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' },
};
export const LLM_PROVIDERS: LlmProvider[] = [
  { name: 'Anthropic', vendor: 'api.anthropic.com', initial: 'A', color: '#d97706', modelCount: 6, defaultModel: 'claude-opus-4', latency: 820, status: 'connected', on: true },
  { name: 'OpenAI', vendor: 'api.openai.com', initial: 'O', color: '#16a34a', modelCount: 9, defaultModel: 'gpt-5', latency: 640, status: 'connected', on: true },
  { name: 'Google', vendor: 'generativelanguage.googleapis.com', initial: 'G', color: '#4f46e5', modelCount: 5, defaultModel: 'gemini-2.5-pro', latency: 710, status: 'degraded', on: true },
  { name: 'Mistral', vendor: 'api.mistral.ai', initial: 'M', color: '#ea580c', modelCount: 4, defaultModel: 'mistral-large', latency: 480, status: 'connected', on: false },
  { name: 'Groq', vendor: 'api.groq.com', initial: 'Q', color: '#0891b2', modelCount: 3, defaultModel: 'llama-3.3-70b', latency: 190, status: 'disabled', on: false },
];
export const LLM_KPIS: Kpi[] = [
  { icon: 'sparkle', label: 'Providers', value: '5', delta: '3 connected', tone: 'flat' },
  { icon: 'zap', label: 'Tokens · 30d', value: '2.4B', delta: '+18%', tone: 'up' },
  { icon: 'chart', label: 'Est. cost · 30d', value: '$4,180', delta: '+$620', tone: 'down' },
  { icon: 'clock', label: 'Avg. latency', value: '690ms', delta: '-40ms', tone: 'up' },
];
export interface AiBar {
  name: string;
  val: string;
  w: number;
  color: string;
}
export const LLM_USAGE: AiBar[] = [
  { name: 'Subject lines', val: '1.1B', w: 100, color: '#4f46e5' },
  { name: 'Content assist', val: '640M', w: 58, color: '#0891b2' },
  { name: 'Segment naming', val: '380M', w: 34, color: '#16a34a' },
  { name: 'Agent inbox', val: '210M', w: 19, color: '#d97706' },
  { name: 'Support triage', val: '70M', w: 6, color: '#7c3aed' },
];
export const LLM_COST: AiBar[] = [
  { name: 'Anthropic', val: '$2,140', w: 100, color: '#d97706' },
  { name: 'OpenAI', val: '$1,380', w: 64, color: '#16a34a' },
  { name: 'Google', val: '$460', w: 21, color: '#4f46e5' },
  { name: 'Mistral', val: '$140', w: 6, color: '#ea580c' },
  { name: 'Groq', val: '$60', w: 3, color: '#0891b2' },
];

export interface Skill {
  name: string;
  desc: string;
  category: string;
  catColor: string;
  trigger: string;
  model: string;
  status: 'active' | 'paused';
  live: boolean;
}
export const SKILLS: Skill[] = [
  { name: 'Subject line writer', desc: 'Generates 5 subject variants tuned for open rate.', category: 'Copy', catColor: '#4f46e5', trigger: 'On compose', model: 'claude-opus-4', status: 'active', live: true },
  { name: 'Segment namer', desc: 'Names a segment from its filter criteria.', category: 'Data', catColor: '#7c3aed', trigger: 'On save', model: 'gpt-5-mini', status: 'active', live: true },
  { name: 'Reply triage', desc: 'Classifies inbound replies and drafts a response.', category: 'Support', catColor: '#16a34a', trigger: 'On inbound', model: 'claude-sonnet-4', status: 'active', live: true },
  { name: 'Send-time optimizer', desc: 'Predicts best send time per recipient.', category: 'Delivery', catColor: '#0891b2', trigger: 'Pre-send', model: 'internal-ml', status: 'paused', live: false },
  { name: 'Spam risk scorer', desc: 'Flags content likely to trip spam filters.', category: 'Deliverability', catColor: '#d97706', trigger: 'On compose', model: 'gpt-5-mini', status: 'active', live: true },
  { name: 'Translation assist', desc: 'Localizes campaign copy into 30 languages.', category: 'Copy', catColor: '#4f46e5', trigger: 'Manual', model: 'gemini-2.5-pro', status: 'paused', live: false },
];
export const SKILL_STATUS: Record<Skill['status'], Pill> = {
  active: { label: 'Active', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  paused: { label: 'Paused', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' },
};
export const SKILL_KPIS: Kpi[] = [
  { icon: 'star', label: 'Skills', value: '12', delta: '+2', tone: 'up' },
  { icon: 'check-circle', label: 'Active', value: '9', delta: 'live', tone: 'flat' },
  { icon: 'zap', label: 'Invocations · 30d', value: '3.1M', delta: '+22%', tone: 'up' },
  { icon: 'clock', label: 'Avg. runtime', value: '1.2s', delta: '-0.2s', tone: 'up' },
];

export interface McpServer {
  name: string;
  endpoint: string;
  transport: 'http' | 'stdio' | 'sse';
  toolCount: number;
  scope: string;
  status: 'online' | 'offline' | 'error';
  live: boolean;
}
export const MCP_STATUS: Record<McpServer['status'], Pill> = {
  online: { label: 'Online', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' },
  offline: { label: 'Offline', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' },
  error: { label: 'Error', fg: '#dc2626', bg: 'var(--danger-bg)', dot: '#dc2626' },
};
export const MCP_TRANSPORT: Record<McpServer['transport'], Pill> = {
  http: { label: 'HTTP', fg: '#4f46e5', bg: 'var(--accent-tint)' },
  stdio: { label: 'stdio', fg: '#0891b2', bg: 'rgba(8,145,178,.1)' },
  sse: { label: 'SSE', fg: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
};
export const MCP_SERVERS: McpServer[] = [
  { name: 'maildrill-tools', endpoint: 'https://mcp.maildrill.com/tools', transport: 'http', toolCount: 18, scope: 'Campaigns, Lists', status: 'online', live: true },
  { name: 'analytics-mcp', endpoint: 'https://mcp.maildrill.com/analytics', transport: 'sse', toolCount: 9, scope: 'Read-only', status: 'online', live: true },
  { name: 'infobip-bridge', endpoint: 'https://mcp.internal/infobip', transport: 'http', toolCount: 6, scope: 'Delivery', status: 'error', live: true },
  { name: 'billing-mcp', endpoint: 'stdio://billing', transport: 'stdio', toolCount: 4, scope: 'Billing', status: 'online', live: true },
  { name: 'sandbox-mcp', endpoint: 'https://mcp.internal/sandbox', transport: 'http', toolCount: 12, scope: 'Internal', status: 'offline', live: false },
];
export const MCP_KPIS: Kpi[] = [
  { icon: 'command', label: 'Servers', value: '5', delta: '3 online', tone: 'flat' },
  { icon: 'layers', label: 'Tools exposed', value: '49', delta: '+6', tone: 'up' },
  { icon: 'zap', label: 'Calls · 30d', value: '842k', delta: '+14%', tone: 'up' },
  { icon: 'x', label: 'Errors · 24h', value: '21', delta: 'infobip-bridge', tone: 'down' },
];
