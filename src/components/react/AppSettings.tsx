import { useEffect, useState, type ReactNode } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';

/*
 * Settings — the sectioned-subnav workspace screen (App.dc.html §3).
 * A 200px left subnav drives a single right panel that renders as one of four
 * shapes: a form, a usage view, a table, or a toggles list. Every section is
 * self-contained here (fixtures live in this file); no shared mock-data edits.
 */

/* ----------------------------- channel meta ----------------------------- */
const CHANNEL: Record<ChannelType, { color: string; tint: string; icon: IconName; label: string }> =
  {
    email: { color: 'var(--ch-email)', tint: 'var(--ch-email-tint)', icon: 'mail', label: 'Email' },
    sms: { color: 'var(--ch-sms)', tint: 'var(--ch-sms-tint)', icon: 'sms', label: 'SMS' },
    whatsapp: {
      color: 'var(--ch-whatsapp)',
      tint: 'var(--ch-whatsapp-tint)',
      icon: 'whatsapp',
      label: 'WhatsApp',
    },
    voice: {
      color: 'var(--ch-voice)',
      tint: 'var(--ch-voice-tint)',
      icon: 'voice',
      label: 'Voice',
    },
  };

/* ------------------------------- tones ---------------------------------- */
type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'violet';
const TONE: Record<Tone, { background: string; color: string }> = {
  success: { background: 'var(--success-bg)', color: 'var(--success-strong)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  accent: { background: 'var(--accent-tint)', color: 'var(--accent)' },
  neutral: { background: 'var(--surface2)', color: 'var(--muted)' },
  violet: { background: 'rgba(124,58,237,.14)', color: '#7c3aed' },
};

/* ------------------------------ nav model ------------------------------- */
type SectionKey =
  | 'workspace'
  | 'usage'
  | 'branding'
  | 'domains'
  | 'smtp'
  | 'billing'
  | 'api'
  | 'users'
  | 'integrations'
  | 'ai';

const NAV: { key: SectionKey; label: string; icon: IconName }[] = [
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
type FieldDef = { key: string; label: string; value: string; type?: string; swatch?: boolean };
type TableRow = { title: string; sub: string; badge: string; tone: Tone };
type ToggleDef = { key: ToggleKey; title: string; desc: string };

type FormPanel = { kind: 'form'; title: string; desc: string; fields: FieldDef[] };
type UsagePanel = { kind: 'usage'; title: string; desc: string };
type TablePanel = {
  kind: 'table';
  title: string;
  desc: string;
  cta: string;
  rows?: TableRow[];
  roster?: boolean;
};
type TogglePanel = { kind: 'toggles'; title: string; desc: string; toggles: ToggleDef[] };
type Panel = FormPanel | UsagePanel | TablePanel | TogglePanel;

type ToggleKey = 'summaries' | 'subject' | 'sendtime';

const PANELS: Record<SectionKey, Panel> = {
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
const USAGE: { channel: ChannelType; used: number; total: number }[] = [
  { channel: 'email', used: 8420, total: 20000 },
  { channel: 'sms', used: 2860, total: 4000 },
  { channel: 'whatsapp', used: 940, total: 1000 },
  { channel: 'voice', used: 260, total: 480 },
];
const fmt = (n: number) => n.toLocaleString('en-US');
const totalUsed = USAGE.reduce((s, u) => s + u.used, 0);
const totalCap = USAGE.reduce((s, u) => s + u.total, 0);

/* ----------------------------- team roster ------------------------------ */
type Role = 'Owner' | 'Editor' | 'Viewer';
type Member = {
  email: string;
  name: string;
  role: Role;
  title: string;
  avBg: string;
  avColor: string;
  init: string;
  joined: string;
  lastActive: string;
  campaigns: number;
};
const roleTone: Record<Role, Tone> = { Owner: 'violet', Editor: 'accent', Viewer: 'neutral' };

const ROSTER: Member[] = [
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

const ROLE_PERMS: Record<Role, string[]> = {
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

/* ------------------------------- helpers -------------------------------- */
function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="set__badge" style={TONE[tone]}>
      {children}
    </span>
  );
}

const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
  summaries: true,
  subject: true,
  sendtime: false,
};

export default function AppSettings() {
  const [section, setSection] = useState<SectionKey>('workspace');
  const [form, setForm] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES);
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({});
  const [roleEditEmail, setRoleEditEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const effRole = (m: Member): Role => roleOverrides[m.email] ?? m.role;

  const panel = PANELS[section];
  const baseMember = openEmail ? (ROSTER.find((m) => m.email === openEmail) ?? null) : null;
  const member = baseMember ? { ...baseMember, role: effRole(baseMember) } : null;
  const roleEditMember = roleEditEmail
    ? (ROSTER.find((m) => m.email === roleEditEmail) ?? null)
    : null;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2800);
  };

  const val = (f: FieldDef) => form[f.key] ?? f.value;
  const swatchColor = (v: string) => {
    const m = v.match(/#[0-9a-fA-F]{6}/);
    return m ? m[0] : 'var(--accent)';
  };

  return (
    <div className="screen screen--capped set">
      <h1 className="screen__h1 set__h1">Settings</h1>

      <div className="set__grid">
        {/* left subnav */}
        <nav className="set__nav" aria-label="Settings sections">
          {NAV.map((n) => {
            const active = n.key === section;
            return (
              <button
                key={n.key}
                type="button"
                className={`set__navitem${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setSection(n.key)}
              >
                <Icon name={n.icon} size={15} />
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* right panel */}
        <div className="set__panelwrap">
          <section className="acrd set__panel" aria-labelledby="set-panel-title">
            <header className="set__panelhead">
              <h2 id="set-panel-title" className="set__title">
                {panel.title}
              </h2>
              <p className="set__desc">{panel.desc}</p>
            </header>

            {/* ---- FORM ---- */}
            {panel.kind === 'form' && (
              <form
                className="set__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  showToast('Settings saved');
                }}
              >
                {panel.fields.map((f) => {
                  const id = `set-${f.key}`;
                  return (
                    <div key={f.key} className="set__field">
                      <label htmlFor={id} className="set__label">
                        {f.label}
                      </label>
                      <div className="set__inputwrap">
                        {f.swatch && (
                          <span
                            className="set__swatch"
                            style={{ background: swatchColor(val(f)) }}
                            aria-hidden="true"
                          />
                        )}
                        <input
                          id={id}
                          type={f.type ?? 'text'}
                          className={`set__input${f.swatch ? ' set__input--swatch' : ''}`}
                          value={val(f)}
                          onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="set__formfoot">
                  <button type="submit" className="pbtn">
                    Save changes
                  </button>
                </div>
              </form>
            )}

            {/* ---- USAGE ---- */}
            {panel.kind === 'usage' && (
              <div className="set__usage">
                <div className="set__summary">
                  <div>
                    <div className="set__summary-lbl">Total sends used this period</div>
                    <div className="set__summary-val tnum">
                      {fmt(totalUsed)} <span className="set__summary-cap">/ {fmt(totalCap)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pbtn"
                    onClick={() => showToast('Redirecting to pricing…')}
                  >
                    Upgrade plan
                  </button>
                </div>

                <div className="set__usage-list">
                  {USAGE.map((u) => {
                    const meta = CHANNEL[u.channel];
                    const left = u.total - u.used;
                    const pct = Math.round((u.used / u.total) * 100);
                    return (
                      <div key={u.channel} className="set__usage-row">
                        <div className="set__usage-head">
                          <span
                            className="set__usage-ic"
                            style={{ background: meta.tint, color: meta.color }}
                          >
                            <Icon name={meta.icon} size={14} />
                          </span>
                          <span className="set__usage-name">{meta.label}</span>
                          <span className="set__usage-nums tnum">
                            {fmt(u.used)} / {fmt(u.total)} · {fmt(left)} left
                          </span>
                        </div>
                        <div className="abar set__usage-bar">
                          <div
                            className="abar__fill"
                            style={{
                              width: `${pct}%`,
                              background: meta.color,
                              animation: 'grow .5s ease',
                            }}
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${meta.label} usage ${pct}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- TABLE ---- */}
            {panel.kind === 'table' && (
              <>
                <div className="set__table" role={panel.roster ? undefined : 'list'}>
                  {panel.roster
                    ? ROSTER.map((m) => (
                        <div
                          key={m.email}
                          role="button"
                          className="set__trow set__trow--click"
                          tabIndex={0}
                          aria-label={`${m.name}, ${m.role}. View team member`}
                          onClick={() => setOpenEmail(m.email)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setOpenEmail(m.email);
                            }
                          }}
                        >
                          <span
                            className="set__avatar"
                            style={{ background: m.avBg, color: m.avColor }}
                            aria-hidden="true"
                          >
                            {m.init}
                          </span>
                          <div className="set__trow-main">
                            <div className="set__trow-title">{m.name}</div>
                            <div className="set__trow-sub tnum">{m.email}</div>
                          </div>
                          <Badge tone={roleTone[effRole(m)]}>{effRole(m)}</Badge>
                          <span className="set__chevron" aria-hidden="true">
                            <Icon name="chevron-right" size={16} />
                          </span>
                        </div>
                      ))
                    : (panel.rows ?? []).map((r) => (
                        <div key={r.title} role="listitem" className="set__trow">
                          <div className="set__trow-main">
                            <div className="set__trow-title">{r.title}</div>
                            <div className="set__trow-sub tnum">{r.sub}</div>
                          </div>
                          <Badge tone={r.tone}>{r.badge}</Badge>
                          <button
                            type="button"
                            className="kbtn set__more"
                            aria-label={`Actions for ${r.title}`}
                            onClick={() => showToast(`${r.title} · more actions`)}
                          >
                            <Icon name="more" size={16} />
                          </button>
                        </div>
                      ))}
                </div>
                <div className="set__tablefoot">
                  <button type="button" className="sbtn" onClick={() => showToast(`${panel.cta}…`)}>
                    <Icon name="plus" size={14} stroke={2.2} />
                    {panel.cta}
                  </button>
                </div>
              </>
            )}

            {/* ---- TOGGLES ---- */}
            {panel.kind === 'toggles' && (
              <div className="set__toggles">
                {panel.toggles.map((t) => {
                  const on = toggles[t.key];
                  return (
                    <div key={t.key} className="set__toggle-row">
                      <div className="set__toggle-main">
                        <div className="set__toggle-title">{t.title}</div>
                        <div className="set__toggle-desc">{t.desc}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={t.title}
                        className={`atoggle${on ? ' is-on' : ''}`}
                        onClick={() => setToggles((s) => ({ ...s, [t.key]: !s[t.key] }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* team-member drawer */}
      {member && (
        <TeamDrawer
          member={member}
          onClose={() => setOpenEmail(null)}
          onToast={showToast}
          onEditRole={() => setRoleEditEmail(member.email)}
        />
      )}

      {/* role editor */}
      {roleEditMember && (
        <RoleModal
          member={roleEditMember}
          current={effRole(roleEditMember)}
          onClose={() => setRoleEditEmail(null)}
          onSave={(role) => {
            setRoleOverrides((s) => ({ ...s, [roleEditMember.email]: role }));
            setRoleEditEmail(null);
            showToast(`${roleEditMember.name} is now ${role}`);
          }}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="set__toast" role="status">
          <span className="set__toast-ic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        .set { animation: fade .3s ease; }
        .set__h1 { margin: 0 0 22px; }
        .set__grid { display: grid; grid-template-columns: 200px 1fr; gap: 28px; align-items: start; }

        /* subnav */
        .set__nav { display: flex; flex-direction: column; gap: 1px; position: sticky; top: 20px; }
        .set__navitem {
          display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
          padding: 8px 12px; border-radius: 9px; font-size: 13px; font-weight: 500;
          color: var(--text3); background: transparent;
          transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
        }
        .set__navitem svg { color: var(--muted2); transition: color var(--duration-fast) var(--ease-out); }
        .set__navitem:hover { background: var(--surface2); color: var(--text2); }
        .set__navitem:hover svg { color: var(--text4); }
        .set__navitem.is-active { font-weight: 600; color: var(--accent); background: var(--accent-tint); }
        .set__navitem.is-active svg { color: var(--accent); }

        /* panel */
        .set__panelwrap { min-width: 0; }
        .set__panel { padding: 24px 26px; }
        .set__panelhead { margin-bottom: 22px; }
        .set__title { font-size: 16px; font-weight: 600; letter-spacing: -.3px; margin: 0; }
        .set__desc { font-size: 13px; color: var(--text4); margin: 5px 0 0; }

        /* form */
        .set__form { display: block; }
        .set__field { margin-bottom: 18px; max-width: 520px; }
        .set__label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
        .set__inputwrap { position: relative; display: flex; align-items: center; }
        .set__input {
          width: 100%; border: 1px solid var(--border2); border-radius: 10px;
          padding: 10px 12px; font-size: 13.5px; color: var(--text); background: transparent;
          transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
        }
        .set__input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
        .set__input--swatch { padding-left: 34px; }
        .set__swatch {
          position: absolute; left: 11px; width: 16px; height: 16px; border-radius: 5px;
          border: 1px solid rgba(0,0,0,.12); pointer-events: none;
        }
        .set__formfoot { display: flex; justify-content: flex-end; margin-top: 4px; }

        /* usage */
        .set__summary {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px;
          background: var(--surface2); margin-bottom: 20px; flex-wrap: wrap;
        }
        .set__summary-lbl { font-size: 12px; color: var(--muted); }
        .set__summary-val { font-size: 20px; font-weight: 600; margin-top: 3px; color: var(--text); }
        .set__summary-cap { font-size: 13px; font-weight: 500; color: var(--muted); }
        .set__usage-list { display: block; }
        .set__usage-row { padding: 14px 0; border-bottom: 1px solid var(--surface2); }
        .set__usage-row:last-child { border-bottom: none; }
        .set__usage-head { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
        .set__usage-ic { width: 26px; height: 26px; flex: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .set__usage-name { flex: 1; font-size: 13.5px; font-weight: 600; }
        .set__usage-nums { font-size: 12.5px; color: var(--muted); }
        .set__usage-bar { height: 6px; border-radius: 6px; }

        /* table */
        .set__table { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .set__trow {
          display: flex; align-items: center; gap: 12px; padding: 13px 16px;
          border-bottom: 1px solid var(--surface2);
        }
        .set__trow:last-child { border-bottom: none; }
        .set__trow--click { cursor: pointer; transition: background .12s var(--ease-out); }
        .set__trow--click:hover { background: var(--surface2); }
        .set__trow--click:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .set__avatar {
          width: 34px; height: 34px; flex: none; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600;
        }
        .set__trow-main { flex: 1; min-width: 0; }
        .set__trow-title { font-size: 13px; font-weight: 500; color: var(--text); }
        .set__trow-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .set__more { flex: none; }
        .set__chevron { flex: none; color: var(--muted2); display: flex; }
        .set__tablefoot { display: flex; justify-content: flex-end; margin-top: 16px; }

        .set__badge {
          display: inline-flex; align-items: center; gap: 5px; flex: none;
          padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap;
        }

        /* toggles */
        .set__toggles { display: block; }
        .set__toggle-row {
          display: flex; align-items: center; gap: 14px; padding: 14px 0;
          border-bottom: 1px solid var(--surface2);
        }
        .set__toggle-row:last-child { border-bottom: none; }
        .set__toggle-main { flex: 1; min-width: 0; }
        .set__toggle-title { font-size: 13.5px; font-weight: 600; }
        .set__toggle-desc { font-size: 12px; color: var(--muted); margin-top: 3px; }
        .set__toggle-row .atoggle { cursor: pointer; }

        /* toast */
        .set__toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          z-index: var(--z-toast); display: flex; align-items: center; gap: 11px;
          background: var(--text); color: #fff; padding: 12px 16px 12px 13px; border-radius: 12px;
          box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500;
          animation: toastin .22s cubic-bezier(.2,.8,.2,1);
        }
        .set__toast-ic { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; }

        @media (max-width: 820px) {
          .set__grid { grid-template-columns: 1fr; gap: 16px; }
          .set__nav {
            position: static; flex-direction: row; flex-wrap: wrap; gap: 6px;
            overflow-x: auto; padding-bottom: 2px;
          }
          .set__navitem { width: auto; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------- team-member drawer --------------------------- */
function TeamDrawer({
  member,
  onClose,
  onToast,
  onEditRole,
}: {
  member: Member;
  onClose: () => void;
  onToast: (m: string) => void;
  onEditRole: () => void;
}) {
  const canRemove = member.role !== 'Owner';
  const perms = ROLE_PERMS[member.role];

  const details: { k: string; v: string }[] = [
    { k: 'Email', v: member.email },
    { k: 'Role', v: member.role },
    { k: 'Status', v: 'Active' },
    { k: 'Joined', v: member.joined },
    { k: 'Title', v: member.title },
  ];

  const remove = () => {
    if (
      window.confirm(`Remove this member? "${member.name}" will lose access to this workspace.`)
    ) {
      onToast(`${member.name} removed`);
      onClose();
    }
  };

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div
        className="adrawer setd"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${member.name} — team member`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">Team member</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="adrawer__body">
          {/* identity */}
          <div className="setd__id">
            <span
              className="setd__avatar"
              style={{ background: member.avBg, color: member.avColor }}
              aria-hidden="true"
            >
              {member.init}
            </span>
            <div>
              <div className="setd__name">{member.name}</div>
              <div className="setd__role-title">{member.title}</div>
              <span className="set__badge setd__role" style={TONE[roleTone[member.role]]}>
                {member.role}
              </span>
            </div>
          </div>

          {/* stats */}
          <div className="setd__stats">
            <div className="setd__stat">
              <div className="setd__stat-lbl">Campaigns created</div>
              <div className="setd__stat-val tnum">{member.campaigns}</div>
            </div>
            <div className="setd__stat">
              <div className="setd__stat-lbl">Last active</div>
              <div className="setd__stat-val setd__stat-val--sm">{member.lastActive}</div>
            </div>
          </div>

          {/* details */}
          <p className="adrawer__eyebrow setd__eyebrow">Details</p>
          <div>
            {details.map((d) => (
              <div key={d.k} className="adetail">
                <span className="adetail__k">{d.k}</span>
                <span className="adetail__v setd__dv">{d.v}</span>
              </div>
            ))}
          </div>

          {/* permissions */}
          <p className="adrawer__eyebrow setd__eyebrow">Permissions</p>
          <ul className="setd__perms">
            {perms.map((p) => (
              <li key={p} className="setd__perm">
                <span className="setd__perm-ic" aria-hidden="true">
                  <Icon name="check" size={11} stroke={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 1 }}
            onClick={() => onToast(`Message sent to ${member.name}`)}
          >
            Message
          </button>
          {canRemove && (
            <button type="button" className="sbtn setd__remove" onClick={remove}>
              Remove
            </button>
          )}
          <button type="button" className="pbtn" style={{ flex: 1 }} onClick={onEditRole}>
            Edit role
          </button>
        </div>

        <style>{`
          .setd__id { display: flex; gap: 14px; margin-bottom: 22px; }
          .setd__avatar { width: 56px; height: 56px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; }
          .setd__name { font-size: 17px; font-weight: 600; letter-spacing: -.3px; }
          .setd__role-title { font-size: 12.5px; color: var(--muted); margin: 2px 0 8px; }
          .setd__role { }
          .setd__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 22px; }
          .setd__stat { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
          .setd__stat-lbl { font-size: 11px; color: var(--muted); }
          .setd__stat-val { font-size: 20px; font-weight: 600; margin-top: 6px; letter-spacing: -.3px; }
          .setd__stat-val--sm { font-size: 14px; }
          .setd__eyebrow { margin: 4px 0 10px; }
          .setd__dv { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
          .setd__perms { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 11px; }
          .setd__perm { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text2); }
          .setd__perm-ic { width: 18px; height: 18px; flex: none; border-radius: 50%; background: var(--success-bg); color: var(--success-strong); display: flex; align-items: center; justify-content: center; }
          .setd__remove { flex: none; padding: 9px 14px; color: var(--danger); }
          .setd__remove:hover { background: var(--danger-bg); }
        `}</style>
      </div>
    </div>
  );
}

/* ------------------------------ role editor ----------------------------- */
const ROLE_LIST: Role[] = ['Owner', 'Editor', 'Viewer'];
const ROLE_DESC: Record<Role, string> = {
  Owner: 'Full access, including billing and members.',
  Editor: 'Create and send campaigns, manage content.',
  Viewer: 'Read-only access to campaigns and reports.',
};

function RoleModal({
  member,
  current,
  onClose,
  onSave,
}: {
  member: Member;
  current: Role;
  onClose: () => void;
  onSave: (role: Role) => void;
}) {
  const [role, setRole] = useState<Role>(current);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rolem-overlay" onClick={onClose}>
      <div
        className="rolem"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit role for ${member.name}`}
      >
        <div className="rolem__head">
          <span className="rolem__title">Edit role</span>
          <button type="button" className="rolem__x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="rolem__body">
          <p className="rolem__sub">
            Choose the access level for <strong>{member.name}</strong>.
          </p>
          {ROLE_LIST.map((r) => {
            const on = r === role;
            return (
              <button
                key={r}
                type="button"
                className={`rolem__opt${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => setRole(r)}
              >
                <span className={`rolem__radio${on ? ' is-on' : ''}`} aria-hidden="true" />
                <span className="rolem__optmain">
                  <span className="rolem__optrow">
                    <span className="rolem__optname">{r}</span>
                    <span className="set__badge" style={TONE[roleTone[r]]}>
                      {r}
                    </span>
                  </span>
                  <span className="rolem__optdesc">{ROLE_DESC[r]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="rolem__foot">
          <button type="button" className="rolem__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rolem__save"
            disabled={role === current}
            onClick={() => onSave(role)}
          >
            Save role
          </button>
        </div>

        <style>{`
          .rolem-overlay {
            position: fixed; inset: 0; z-index: var(--z-modal);
            background: rgba(28,25,23,.4); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center; padding: 32px;
            animation: ovfade .18s var(--ease-out);
          }
          .rolem {
            width: 440px; max-width: 100%; background: var(--surface); border-radius: 20px;
            box-shadow: 0 24px 60px rgba(28,25,23,.28); overflow: hidden; animation: pop .18s ease;
          }
          .rolem__head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 22px; border-bottom: 1px solid var(--divider);
          }
          .rolem__title { font-weight: 600; font-size: 15px; }
          .rolem__x {
            width: 30px; height: 30px; border: none; background: var(--surface2); border-radius: 9px;
            cursor: pointer; color: var(--text4); display: flex; align-items: center; justify-content: center;
          }
          .rolem__x:hover { color: var(--text2); background: var(--border2); }
          .rolem__body { padding: 20px 22px; }
          .rolem__sub { margin: 0 0 14px; font-size: 13px; color: var(--text4); }
          .rolem__sub strong { color: var(--text2); font-weight: 600; }
          .rolem__opt {
            display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
            border: 1.5px solid var(--border2); background: var(--surface); border-radius: 12px;
            padding: 13px 15px; margin-bottom: 10px; cursor: pointer;
            transition: border-color .12s var(--ease-out), background .12s var(--ease-out);
          }
          .rolem__opt:hover { border-color: var(--muted2); }
          .rolem__opt.is-on { border-color: var(--accent); background: var(--accent-tint); }
          .rolem__radio {
            width: 18px; height: 18px; flex: none; margin-top: 1px; border-radius: 50%;
            border: 1.6px solid var(--muted2); position: relative;
          }
          .rolem__radio.is-on { border-color: var(--accent); }
          .rolem__radio.is-on::after {
            content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--accent);
          }
          .rolem__optmain { flex: 1; min-width: 0; }
          .rolem__optrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .rolem__optname { font-size: 13.5px; font-weight: 600; color: var(--text); }
          .rolem__optdesc { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; }
          .rolem__foot {
            display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px;
            border-top: 1px solid var(--divider); background: var(--surface2);
          }
          .rolem__cancel, .rolem__save { padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; }
          .rolem__cancel { background: var(--surface); border: 1px solid var(--border2); color: var(--text2); }
          .rolem__cancel:hover { background: var(--surface2); }
          .rolem__save {
            background: var(--accent); color: #fff; border: none; padding: 9px 18px;
            box-shadow: 0 1px 2px rgba(79,70,229,.35), inset 0 1px 0 rgba(255,255,255,.16);
          }
          .rolem__save:disabled { opacity: .55; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
