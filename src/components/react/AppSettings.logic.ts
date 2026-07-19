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
      { key: 'ws_name', label: 'Workspace name', value: '' },
      { key: 'ws_url', label: 'Workspace URL', value: '' },
      { key: 'ws_tz', label: 'Default timezone', value: '' },
      { key: 'ws_sender', label: 'Default sender', value: '' },
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
      { key: 'br_name', label: 'Brand name', value: '' },
      { key: 'br_logo', label: 'Logo', value: '' },
      { key: 'br_accent', label: 'Accent color', value: '', swatch: true },
      { key: 'br_footer', label: 'Email footer', value: '' },
    ],
  },
  domains: {
    kind: 'table',
    title: 'Sending domains',
    desc: 'Authenticate domains to improve deliverability.',
    cta: 'Add domain',
    rows: [],
  },
  smtp: {
    kind: 'form',
    title: 'SMTP relay',
    desc: 'Connect an external mail relay.',
    fields: [
      { key: 'smtp_host', label: 'Host', value: '' },
      { key: 'smtp_port', label: 'Port', value: '' },
      { key: 'smtp_user', label: 'Username', value: '' },
      { key: 'smtp_pass', label: 'Password', value: '', type: 'password' },
    ],
  },
  billing: {
    kind: 'table',
    title: 'Billing',
    desc: 'Manage your plan and payment method.',
    cta: 'Change plan',
    rows: [],
  },
  api: {
    kind: 'table',
    title: 'API keys',
    desc: 'Keys for programmatic access to Maildrill.',
    cta: 'Create key',
    rows: [],
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

/* ---------------------------- usage fixtures ---------------------------- */
export const USAGE: { channel: ChannelType; used: number; total: number }[] = [];
export const fmt = (n: number) => n.toLocaleString('en-US');
export const totalUsed = USAGE.reduce((s, u) => s + u.used, 0);
export const totalCap = USAGE.reduce((s, u) => s + u.total, 0);

/* ----------------------------- team roster ------------------------------ */
export const roleTone: Record<Role, Tone> = {
  Owner: 'violet',
  Editor: 'accent',
  Viewer: 'neutral',
};

// No seed team members — the roster loads from the service once wired.
export const ROSTER: Member[] = [];

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
