import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';
import type { Tone } from './shared/tones';
import type { Member, Panel, Role, SectionKey, ToggleKey } from './AppSettings.types';

/* ------------------------------ nav model ------------------------------- */
export const NAV: { key: SectionKey; label: string; icon: IconName }[] = [
  { key: 'workspace', label: 'Workspace', icon: 'settings' },
  { key: 'usage', label: 'Usage', icon: 'chart' },
  { key: 'branding', label: 'Branding', icon: 'sparkle' },
  { key: 'domains', label: 'Domains', icon: 'globe' },
  { key: 'smtp', label: 'SMTP', icon: 'send' },
  { key: 'billing', label: 'Billing', icon: 'target' },
  { key: 'api', label: 'API keys', icon: 'code' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'integrations', label: 'Integrations', icon: 'layers' },
  { key: 'ai', label: 'AI', icon: 'sparkle' },
];

/* ------------------------------- panels --------------------------------- */
export const PANELS: Record<SectionKey, Panel> = {
  workspace: {
    kind: 'form',
    title: 'Workspace',
    desc: 'General information about your workspace.',
    fields: [
      { key: 'ws_name', label: 'Workspace name', value: 'Maildrill' },
      { key: 'ws_url', label: 'Workspace URL', value: 'maildrill.app/andrea' },
      { key: 'ws_tz', label: 'Default timezone', value: 'Europe/Rome (GMT+1)' },
      { key: 'ws_sender', label: 'Default sender', value: 'Maildrill Team <hello@maildrill.app>' },
    ],
  },
  usage: {
    kind: 'usage',
    title: 'Usage',
    desc: 'Sends remaining this billing period, by channel.',
  },
  branding: {
    kind: 'form',
    title: 'Branding',
    desc: 'How your emails and dashboard look.',
    fields: [
      { key: 'br_name', label: 'Brand name', value: 'Maildrill' },
      { key: 'br_logo', label: 'Logo', value: 'logo-maildrill.png' },
      { key: 'br_accent', label: 'Accent color', value: '#4F46E5 · Purple', swatch: true },
      { key: 'br_footer', label: 'Email footer', value: '© 2026 Maildrill. Unsubscribe anytime.' },
    ],
  },
  domains: {
    kind: 'table',
    title: 'Sending domains',
    desc: 'Authenticate domains to improve deliverability.',
    cta: 'Add domain',
    rows: [
      {
        title: 'maildrill.app',
        sub: 'SPF, DKIM & DMARC verified',
        badge: 'Verified',
        tone: 'success',
      },
      {
        title: 'mail.maildrill.app',
        sub: 'Awaiting DNS propagation',
        badge: 'Pending',
        tone: 'warning',
      },
      {
        title: 'promo.maildrill.app',
        sub: 'DKIM record missing',
        badge: 'Action needed',
        tone: 'danger',
      },
    ],
  },
  smtp: {
    kind: 'form',
    title: 'SMTP relay',
    desc: 'Connect an external mail relay.',
    fields: [
      { key: 'smtp_host', label: 'Host', value: 'smtp.maildrill.app' },
      { key: 'smtp_port', label: 'Port', value: '587' },
      { key: 'smtp_user', label: 'Username', value: 'relay@maildrill.app' },
      { key: 'smtp_pass', label: 'Password', value: 'maildrill-relay-2026', type: 'password' },
    ],
  },
  billing: {
    kind: 'table',
    title: 'Billing',
    desc: 'Manage your plan and payment method.',
    cta: 'Change plan',
    rows: [
      { title: 'Growth plan', sub: '$49 / month · renews Aug 1', badge: 'Active', tone: 'success' },
      { title: 'Email credits', sub: '8,420 of 25,000 used', badge: '43% left', tone: 'accent' },
      { title: 'Payment method', sub: 'Visa ending 4242', badge: 'Default', tone: 'neutral' },
    ],
  },
  api: {
    kind: 'table',
    title: 'API keys',
    desc: 'Keys for programmatic access to Maildrill.',
    cta: 'Create key',
    rows: [
      {
        title: 'Production',
        sub: 'md_live_••••7f2a · created Jan 2025',
        badge: 'Live',
        tone: 'success',
      },
      {
        title: 'Development',
        sub: 'md_test_••••1c9d · created Feb 2025',
        badge: 'Test',
        tone: 'accent',
      },
      {
        title: 'CI pipeline',
        sub: 'md_live_••••44be · last used 3d ago',
        badge: 'Live',
        tone: 'success',
      },
    ],
  },
  users: {
    kind: 'table',
    title: 'Users & permissions',
    desc: 'People with access to this workspace.',
    cta: 'Invite user',
    roster: true,
  },
  integrations: {
    kind: 'table',
    title: 'Integrations',
    desc: 'Connect Maildrill to your other tools.',
    cta: 'Browse all',
    rows: [
      { title: 'Shopify', sub: 'Sync customers & orders', badge: 'Connected', tone: 'success' },
      { title: 'Stripe', sub: 'Import paying customers', badge: 'Connected', tone: 'success' },
      { title: 'Zapier', sub: '5,000+ app automations', badge: 'Connect', tone: 'neutral' },
      { title: 'Slack', sub: 'Campaign notifications', badge: 'Connect', tone: 'neutral' },
    ],
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

/* ---------------------------- usage fixtures ---------------------------- */
export const USAGE: { channel: ChannelType; used: number; total: number }[] = [
  { channel: 'email', used: 8420, total: 20000 },
  { channel: 'sms', used: 2860, total: 4000 },
  { channel: 'whatsapp', used: 940, total: 1000 },
  { channel: 'voice', used: 260, total: 480 },
];
export const fmt = (n: number) => n.toLocaleString('en-US');
export const totalUsed = USAGE.reduce((s, u) => s + u.used, 0);
export const totalCap = USAGE.reduce((s, u) => s + u.total, 0);

/* ----------------------------- team roster ------------------------------ */
export const roleTone: Record<Role, Tone> = {
  Owner: 'violet',
  Editor: 'accent',
  Viewer: 'neutral',
};

export const ROSTER: Member[] = [
  {
    email: 'andrea@example.com',
    name: 'Andrea Rossi',
    role: 'Owner',
    title: 'Founder & CEO',
    avBg: '#ede9fe',
    avColor: '#5b21b6',
    init: 'AR',
    joined: 'Jan 3, 2025',
    lastActive: 'Active now',
    campaigns: 42,
  },
  {
    email: 'james@example.com',
    name: 'James Carter',
    role: 'Editor',
    title: 'Marketing Lead',
    avBg: 'var(--accent-tint)',
    avColor: 'var(--accent)',
    init: 'JC',
    joined: 'Mar 15, 2025',
    lastActive: '2 hours ago',
    campaigns: 18,
  },
  {
    email: 'mei@example.com',
    name: 'Mei Tanaka',
    role: 'Viewer',
    title: 'Data Analyst',
    avBg: '#f1f0eb',
    avColor: '#78756c',
    init: 'MT',
    joined: 'Jun 2, 2025',
    lastActive: 'Yesterday',
    campaigns: 0,
  },
];

export const ROLE_PERMS: Record<Role, string[]> = {
  Owner: [
    'Full account access',
    'Manage billing & plan',
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
export const ROLE_LIST: Role[] = ['Owner', 'Editor', 'Viewer'];
export const ROLE_DESC: Record<Role, string> = {
  Owner: 'Full access, including billing and members.',
  Editor: 'Create and send campaigns, manage content.',
  Viewer: 'Read-only access to campaigns and reports.',
};

/* ------------------------------- helpers -------------------------------- */
export const swatchColor = (v: string) => {
  const m = v.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : 'var(--accent)';
};
