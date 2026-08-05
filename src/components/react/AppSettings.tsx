import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/app/api';
import {
  fetchBillingPackages,
  fetchWallet,
  startCheckout,
  type BillingPackage,
  type WalletInfo,
} from '@/lib/app/billing';
import Icon from './Icon';
import type { ChannelBreakdown } from './AppAnalytics.logic';
import { CHANNEL } from './shared/channels';
import { TONE, type Tone } from './shared/tones';
import { useEscapeClose } from './shared/useEscapeClose';
import { useToast } from './shared/useToast';
import type {
  ApiDomain,
  ApiMember,
  ApiWorkspace,
  ApiWorkspaceKey,
  FieldDef,
  Member,
  Role,
  SectionKey,
  ToggleKey,
} from './AppSettings.types';
import {
  BALANCE_PRESETS,
  buildChannelUsageRows,
  DEFAULT_TOGGLES,
  EST_RATE_USD,
  estCost,
  fmt,
  fmtUsd,
  isDomain,
  isEmail,
  KEY_SCOPES,
  LOW_BALANCE_USD,
  NAV,
  PANELS,
  PREPAID_BALANCE_USD,
  ROLE_DESC,
  ROLE_LIST,
  ROLE_PERMS,
  ROSTER,
  roleTone,
  swatchColor,
  totalEstCost,
  totalSent,
} from './AppSettings.logic';
import styles from './AppSettings.module.css';

/*
 * Settings — the sectioned-subnav workspace screen (App.dc.html §3).
 * A 200px left subnav drives a single right panel that renders as one of four
 * shapes: a form, a usage view, a table, or a toggles list. Every section is
 * self-contained here (fixtures live in AppSettings.logic); no shared mock-data edits.
 */

/* ------------------------------- helpers -------------------------------- */
/** The four table sections whose CTA opens an action modal. */
type ActionKey = 'domains' | 'billing' | 'api' | 'users';

/** Minimum gap between DNS re-checks for one domain. */
const DNS_RECHECK_COOLDOWN_MS = 60_000;

/** A destructive action awaiting confirmation in the shared dialog. */
type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Performs the action; rejections surface as an alert toast. */
  run: () => Promise<void>;
  failMessage: string;
};

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={styles.badge} style={TONE[tone]}>
      {children}
    </span>
  );
}

/* Service role ('owner') ↔ display role ('Owner'). */
const toDisplayRole = (r: ApiMember['role']): Role =>
  (r.charAt(0).toUpperCase() + r.slice(1)) as Role;
const toServiceRole = (r: Role): ApiMember['role'] => r.toLowerCase() as ApiMember['role'];

const MEMBER_PALETTE = [
  { avBg: '#eef0ff', avColor: '#4f46e5' },
  { avBg: '#ecfdf5', avColor: '#047857' },
  { avBg: '#fff7ed', avColor: '#c2410c' },
  { avBg: '#fdf2f8', avColor: '#be185d' },
  { avBg: '#f0f9ff', avColor: '#0369a1' },
];

function toMember(m: ApiMember): Member {
  const label = m.name?.trim() || m.email;
  const palette =
    MEMBER_PALETTE[[...m.email].reduce((s, c) => s + c.charCodeAt(0), 0) % MEMBER_PALETTE.length];
  let joined = '—';
  try {
    joined = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(m.joinedAt),
    );
  } catch {
    /* keep placeholder */
  }
  return {
    userId: m.userId,
    email: m.email,
    name: label,
    role: toDisplayRole(m.role),
    // Access is granted on add, but the account is only real once they use
    // it — until the first sign-in the seat is Pending.
    status: m.lastSignInAt ? 'Active' : 'Pending',
    ...palette,
    init: label.charAt(0).toUpperCase(),
    joined,
    lastActive: formatLastActive(m.lastSignInAt),
  };
}

/** "just now" / "3 hours ago" / "12 Mar 2026" — compact activity stamp. */
function formatLastActive(iso: string | null): string {
  if (!iso) return 'Never signed in';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  const diffMs = Date.now() - at.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    // Past a week a date is more useful than "37 days ago".
    if (days <= 7) return rtf.format(-days, 'day');
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const brandingFromSettings = (settings: Record<string, unknown>): Record<string, string> => {
  const b = (settings.branding ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    br_name: s(b.brandName),
    br_logo: s(b.logoUrl),
    br_accent: s(b.accentColor),
    br_footer: s(b.emailFooter),
  };
};

const aiFromSettings = (settings: Record<string, unknown>): Record<ToggleKey, boolean> => {
  const ai = (settings.ai ?? {}) as Record<string, unknown>;
  const pick = (k: ToggleKey) =>
    typeof ai[k] === 'boolean' ? (ai[k] as boolean) : DEFAULT_TOGGLES[k];
  return { summaries: pick('summaries'), subject: pick('subject'), sendtime: pick('sendtime') };
};

export default function AppSettings({
  initialByChannel = [],
  live = false,
}: {
  initialByChannel?: ChannelBreakdown[];
  live?: boolean;
} = {}) {
  const [section, setSection] = useState<SectionKey>('usage');
  const [byChannel, setByChannel] = useState<ChannelBreakdown[]>(initialByChannel);
  const [form, setForm] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES);
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({});
  const [roleEditEmail, setRoleEditEmail] = useState<string | null>(null);
  const [action, setAction] = useState<ActionKey | null>(null);
  // Service-backed section data (loaded once when live).
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [members, setMembers] = useState<Member[]>(ROSTER);
  const [domains, setDomains] = useState<ApiDomain[]>([]);
  const [domainsConfigured, setDomainsConfigured] = useState(true);
  const [keys, setKeys] = useState<ApiWorkspaceKey[]>([]);
  const [openDomain, setOpenDomain] = useState<ApiDomain | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  /** Prepaid wallet (null until the billing service answers). */
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  /** Per-domain timestamp of the last DNS re-check, for the cooldown below. */
  const [lastCheckedAt, setLastCheckedAt] = useState<Record<string, number>>({});
  /** One in-app dialog serves every destructive action (no window.confirm). */
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { toast, tone: toastTone, show: showToast } = useToast();

  const refreshMembers = useCallback(async () => {
    const res = await api.get<{ data: ApiMember[] }>('workspace/members');
    setMembers(res.data.map(toMember));
    setRoleOverrides({});
  }, []);
  const refreshDomains = useCallback(async () => {
    const res = await api.get<{ data: ApiDomain[]; configured: boolean }>('workspace/domains');
    setDomains(res.data);
    setDomainsConfigured(res.configured);
  }, []);
  const refreshKeys = useCallback(async () => {
    const res = await api.get<{ data: ApiWorkspaceKey[] }>('workspace/api-keys');
    setKeys(res.data);
  }, []);

  // Workspace identity/settings: once per mount is enough (name in the header).
  useEffect(() => {
    if (!live) return;
    void api
      .get<ApiWorkspace>('workspace')
      .then((ws) => {
        setWorkspace(ws);
        setForm((s) => ({ ...brandingFromSettings(ws.settings), ...s }));
        setToggles(aiFromSettings(ws.settings));
      })
      .catch(() => undefined);
  }, [live]);

  // Wallet balance; also greet a return from hosted checkout. Credits are
  // granted by the Stripe webhook (never the redirect), so "success" means
  // "processing" until the wallet refetch shows the new balance.
  useEffect(() => {
    if (!live) return;
    void fetchWallet()
      .then(setWallet)
      .catch(() => undefined);
    const billingReturn = new URLSearchParams(window.location.search).get('billing');
    if (billingReturn === 'success') {
      showToast('Payment received — credits will appear in a moment');
      window.setTimeout(() => {
        void fetchWallet()
          .then(setWallet)
          .catch(() => undefined);
      }, 4000);
    } else if (billingReturn === 'cancelled') {
      showToast('Checkout cancelled — no charge was made', 'alert');
    }
  }, [live, showToast]);

  /*
   * Section data is fetched every time a section is opened — deliberately no
   * client-side cache. Domain state lives at the provider and changes outside
   * this app (DNS propagating, Infobip review), so a remembered list would
   * show verification results that are no longer true.
   */
  useEffect(() => {
    if (!live) return;
    const load =
      section === 'domains'
        ? refreshDomains
        : section === 'users'
          ? refreshMembers
          : section === 'api'
            ? refreshKeys
            : null;
    if (!load) return;
    setSectionLoading(true);
    void load()
      .catch(() => undefined)
      .finally(() => setSectionLoading(false));
  }, [live, section, refreshDomains, refreshMembers, refreshKeys]);

  const saveBranding = async () => {
    if (!live) {
      showToast('Settings saved');
      return;
    }
    try {
      const ws = await api.patch<ApiWorkspace>('workspace', {
        settings: {
          branding: {
            brandName: form.br_name ?? '',
            logoUrl: form.br_logo ?? '',
            accentColor: form.br_accent ?? '',
            emailFooter: form.br_footer ?? '',
          },
        },
      });
      setWorkspace(ws);
      showToast('Branding saved');
    } catch (e) {
      showToast(errMsg(e, 'Could not save branding'));
    }
  };

  const toggleAi = (key: ToggleKey) => {
    const next = !toggles[key];
    setToggles((s) => ({ ...s, [key]: next }));
    if (!live) return;
    void api.patch<ApiWorkspace>('workspace', { settings: { ai: { [key]: next } } }).catch((e) => {
      setToggles((s) => ({ ...s, [key]: !next })); // revert on failure
      showToast(errMsg(e, 'Could not update AI settings'));
    });
  };

  const openPanelAction = () => {
    if (
      section === 'domains' ||
      section === 'billing' ||
      section === 'api' ||
      section === 'users'
    ) {
      setAction(section);
    }
  };
  const finishAction = (msg: string) => {
    setAction(null);
    showToast(msg);
  };

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api
      .get<{ byChannel?: ChannelBreakdown[] }>('stats/summary')
      .then((res) => {
        if (!cancelled) setByChannel(res.byChannel ?? []);
      })
      .catch(() => {
        /* keep SSR seed on failure */
      });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const usageRows = buildChannelUsageRows(byChannel);
  const workspaceSent = totalSent(usageRows);

  const effRole = (m: Member): Role => roleOverrides[m.email] ?? m.role;

  const panel = PANELS[section];
  /* Rows come from the service for the wired sections; billing and
     integrations still render their blank slate. */
  const liveRows =
    section === 'domains'
      ? domains.map((d) => ({
          title: d.domainName,
          sub: d.active
            ? 'Verified · sending enabled'
            : `${d.dnsRecords.filter((r) => r.verified).length}/${d.dnsRecords.length} DNS records verified`,
          badge: d.active ? 'Verified' : 'Pending',
          tone: (d.active ? 'success' : 'warning') as Tone,
        }))
      : section === 'api'
        ? keys
            .filter((k) => !k.revokedAt)
            .map((k) => ({
              title: k.name,
              sub: `${k.keyId} · ${k.scope}`,
              badge: 'Active',
              tone: 'success' as Tone,
            }))
        : ((panel.kind === 'table' ? panel.rows : undefined) ?? []);
  const tableEmpty =
    panel.kind === 'table' && (panel.roster ? members.length === 0 : liveRows.length === 0);
  const baseMember = openEmail ? (members.find((m) => m.email === openEmail) ?? null) : null;
  const member = baseMember ? { ...baseMember, role: effRole(baseMember) } : null;
  const roleEditMember = roleEditEmail
    ? (members.find((m) => m.email === roleEditEmail) ?? null)
    : null;

  const changeRole = async (m: Member, role: Role) => {
    setRoleEditEmail(null);
    if (!live || !m.userId) {
      setRoleOverrides((s) => ({ ...s, [m.email]: role }));
      showToast(`${m.name} is now ${role}`);
      return;
    }
    try {
      await api.patch(`workspace/members/${m.userId}`, { role: toServiceRole(role) });
      await refreshMembers();
      showToast(`${m.name} is now ${role}`);
    } catch (e) {
      showToast(errMsg(e, 'Could not change the role'));
    }
  };

  const removeMember = (m: Member) =>
    setConfirming({
      title: 'Remove member',
      message: `${m.name} loses access to this workspace immediately. Campaigns and content they created stay.`,
      confirmLabel: 'Remove member',
      run: async () => {
        if (!live || !m.userId) {
          showToast(`${m.name} removed`);
          return;
        }
        await api.del(`workspace/members/${m.userId}`);
        await refreshMembers();
        showToast(`${m.name} removed`);
      },
      failMessage: 'Could not remove the member',
    });

  const revokeKey = (id: string, name: string) =>
    setConfirming({
      title: 'Revoke API key',
      message: `Any integration sending with “${name}” stops working immediately. This cannot be undone.`,
      confirmLabel: 'Revoke key',
      run: async () => {
        await api.del(`workspace/api-keys/${id}`);
        await refreshKeys();
        showToast(`${name} revoked`);
      },
      failMessage: 'Could not revoke the key',
    });

  const deleteDomain = (domainName: string) =>
    setConfirming({
      title: 'Remove sending domain',
      message: `${domainName} stops being available as a sender and its DKIM key is destroyed at the provider. Re-adding it later issues new DNS records you must publish again.`,
      confirmLabel: 'Remove domain',
      run: async () => {
        await api.del(`workspace/domains/${encodeURIComponent(domainName)}`);
        setOpenDomain(null);
        await refreshDomains();
        showToast(`${domainName} removed`);
      },
      failMessage: 'Could not remove the domain',
    });

  /** Runs the pending action, keeping the dialog up while it is in flight. */
  const runConfirmed = () => {
    if (!confirming || confirmBusy) return;
    const pending = confirming;
    setConfirmBusy(true);
    void pending
      .run()
      .then(() => setConfirming(null))
      .catch((e: unknown) => {
        setConfirming(null);
        showToast(errMsg(e, pending.failMessage), 'alert');
      })
      .finally(() => setConfirmBusy(false));
  };

  const verifyDomain = async (domainName: string) => {
    // DNS propagation takes minutes at best; re-checking in a tight loop only
    // burns provider quota and tells the user nothing new.
    const readyAt = (lastCheckedAt[domainName] ?? 0) + DNS_RECHECK_COOLDOWN_MS;
    const waitSeconds = Math.ceil((readyAt - Date.now()) / 1000);
    if (waitSeconds > 0) {
      showToast(
        `Just checked — you can re-check ${domainName} in ${waitSeconds}s. DNS changes need a few minutes to propagate.`,
        'alert',
      );
      return;
    }
    setLastCheckedAt((s) => ({ ...s, [domainName]: Date.now() }));
    try {
      const fresh = await api.post<ApiDomain>(
        `workspace/domains/${encodeURIComponent(domainName)}/verify`,
      );
      setOpenDomain(fresh);
      await refreshDomains();
      if (fresh.active) {
        showToast(`${domainName} verified`);
      } else {
        const ok = fresh.dnsRecords.filter((r) => r.verified).length;
        showToast(
          `Not verified yet — ${ok}/${fresh.dnsRecords.length} records found. DNS can take a few hours.`,
          'alert',
        );
      }
    } catch (e) {
      showToast(errMsg(e, 'Could not verify the domain'), 'alert');
    }
  };

  const val = (f: FieldDef) => form[f.key] ?? f.value;

  return (
    <div className="screen screen--capped" style={{ animation: 'fade .3s ease' }}>
      <h1 className={`screen__h1 ${styles.h1}`}>
        Settings
        {workspace && <span className={styles.wsName}>{workspace.name}</span>}
      </h1>

      <div className={styles.grid}>
        {/* left subnav */}
        <nav className={styles.nav} aria-label="Settings sections">
          {NAV.map((n) => {
            const active = n.key === section;
            return (
              <button
                key={n.key}
                type="button"
                className={`${styles.navitem}${active ? ' is-active' : ''}`}
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
        <div className={styles.panelwrap}>
          <section className={`acrd ${styles.panel}`} aria-labelledby="set-panel-title">
            <header className={styles.panelhead}>
              <h2 id="set-panel-title" className={styles.title}>
                {panel.title}
              </h2>
              <p className={styles.desc}>{panel.desc}</p>
            </header>

            {/* ---- FORM ---- */}
            {panel.kind === 'form' && (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveBranding();
                }}
              >
                {panel.fields.map((f) => {
                  const id = `set-${f.key}`;
                  return (
                    <div key={f.key} className={styles.frow}>
                      <label htmlFor={id} className={styles.label}>
                        {f.label}
                      </label>
                      <div className={styles.inputwrap}>
                        {f.swatch && (
                          <span
                            className={styles.swatch}
                            style={{ background: swatchColor(val(f)) }}
                            aria-hidden="true"
                          />
                        )}
                        <input
                          id={id}
                          type={f.type ?? 'text'}
                          className={`${styles.input}${f.swatch ? ` ${styles.inputSwatch}` : ''}`}
                          value={val(f)}
                          placeholder={f.ph}
                          onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className={styles.formfoot}>
                  <button type="submit" className="pbtn">
                    Save changes
                  </button>
                </div>
              </form>
            )}

            {/* ---- USAGE (metered ledger) ---- */}
            {panel.kind === 'usage' && (
              <div>
                <div className={styles.ledgerHead}>
                  <span className={styles.ledgerKicker}>This period</span>
                  <button
                    type="button"
                    className={styles.ledgerLink}
                    onClick={() => setSection('billing')}
                  >
                    Add balance
                  </button>
                </div>

                <div className={styles.ledgerHero}>
                  <div className={styles.heroMain}>
                    <span className={styles.ledgerTotal}>{fmt(workspaceSent)}</span>
                    <span className={styles.ledgerUnit}>messages · pay as you go</span>
                  </div>
                  <div className={styles.heroStats}>
                    <div className={styles.heroStat}>
                      <span className={styles.heroStatLbl}>Cost</span>
                      <span className={styles.heroStatVal}>{fmtUsd(totalEstCost(usageRows))}</span>
                    </div>
                    <div
                      className={`${styles.heroStat}${
                        (wallet ? wallet.lowBalance : PREPAID_BALANCE_USD < LOW_BALANCE_USD)
                          ? ` ${styles.heroStatAlert}`
                          : ''
                      }`}
                    >
                      <span className={styles.heroStatLbl}>Balance left</span>
                      <span className={styles.heroStatVal}>
                        {fmtUsd(wallet?.balanceUsd ?? PREPAID_BALANCE_USD)}
                      </span>
                    </div>
                  </div>
                </div>

                {workspaceSent > 0 ? (
                  <div
                    className={styles.meter}
                    role="img"
                    aria-label={`Channel share of sends: ${usageRows
                      .filter((u) => u.sent > 0)
                      .map(
                        (u) =>
                          `${CHANNEL[u.channel].label} ${Math.round((u.sent / workspaceSent) * 100)}%`,
                      )
                      .join(', ')}`}
                  >
                    {usageRows
                      .filter((u) => u.sent > 0)
                      .map((u, i) => (
                        <span
                          key={u.channel}
                          className={styles.meterSeg}
                          style={{
                            width: `${((u.sent / workspaceSent) * 100).toFixed(2)}%`,
                            background: CHANNEL[u.channel].color,
                            animationDelay: `${i * 70}ms`,
                          }}
                        />
                      ))}
                  </div>
                ) : (
                  <div className={styles.meterEmpty} aria-hidden="true" />
                )}

                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.thName}>
                        Channel
                      </th>
                      <th scope="col" className={styles.thNum}>
                        Sent
                      </th>
                      <th scope="col" className={styles.thNum}>
                        Cost
                      </th>
                      <th scope="col" className={styles.thNum}>
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((u) => {
                      const meta = CHANNEL[u.channel];
                      const share =
                        workspaceSent > 0 ? Math.round((u.sent / workspaceSent) * 100) : 0;
                      return (
                        <tr key={u.channel}>
                          <td className={styles.cellName}>
                            <span className={styles.nameWrap}>
                              <span
                                className={styles.chSwatch}
                                style={{ background: meta.color }}
                                aria-hidden="true"
                              />
                              {meta.label}
                              <span className={styles.leader} aria-hidden="true" />
                            </span>
                          </td>
                          <td className={`${styles.cellNum} ${styles.cellSent}`}>{fmt(u.sent)}</td>
                          <td className={styles.cellNum}>{fmtUsd(estCost(u))}</td>
                          <td className={styles.cellNum}>{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {workspaceSent === 0 && (
                  <p className={styles.ledgerEmpty}>
                    Nothing metered yet — your first send starts the ledger.
                  </p>
                )}
              </div>
            )}

            {/* ---- TABLE ---- */}
            {panel.kind === 'table' && sectionLoading && tableEmpty && (
              <p className={styles.loadingRow}>Loading…</p>
            )}
            {panel.kind === 'table' && tableEmpty && !sectionLoading && (
              <div className={styles.blank}>
                <p className={styles.blankMsg}>
                  {section === 'domains' && !domainsConfigured
                    ? 'Domain management needs the email provider configured on the server (INFOBIP_BASE_URL and INFOBIP_API_KEY).'
                    : panel.empty}
                </p>
                <button
                  type="button"
                  className={`sbtn ${styles.blankCta}`}
                  onClick={openPanelAction}
                >
                  <Icon name="plus" size={14} stroke={2.2} />
                  {panel.cta}
                </button>
              </div>
            )}
            {panel.kind === 'table' && !tableEmpty && (
              <>
                <div className={styles.table} role={panel.roster ? undefined : 'list'}>
                  {panel.roster
                    ? members.map((m) => (
                        <div
                          key={m.email}
                          role="button"
                          className={`${styles.trow} ${styles.trowClick}`}
                          tabIndex={0}
                          aria-label={`${m.name}, ${m.role}${
                            m.status === 'Pending' ? ', pending first sign-in' : ''
                          }. View team member`}
                          onClick={() => setOpenEmail(m.email)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setOpenEmail(m.email);
                            }
                          }}
                        >
                          <span
                            className={styles.avatar}
                            style={{ background: m.avBg, color: m.avColor }}
                            aria-hidden="true"
                          >
                            {m.init}
                          </span>
                          <div className={styles.trowMain}>
                            <div className={styles.trowTitle}>{m.name}</div>
                            <div className={`${styles.trowSub} tnum`}>{m.email}</div>
                          </div>
                          {/* Only the exceptional state is called out; an
                              active member needs no badge to say so. */}
                          {m.status === 'Pending' && <Badge tone="warning">Pending</Badge>}
                          <Badge tone={roleTone[effRole(m)]}>{effRole(m)}</Badge>
                          <span className={styles.chevron} aria-hidden="true">
                            <Icon name="chevron-right" size={16} />
                          </span>
                        </div>
                      ))
                    : liveRows.map((r) => {
                        const domain =
                          section === 'domains'
                            ? (domains.find((d) => d.domainName === r.title) ?? null)
                            : null;
                        const apiKey =
                          section === 'api' ? (keys.find((k) => k.name === r.title) ?? null) : null;
                        return (
                          <div
                            key={r.title}
                            role="listitem"
                            className={`${styles.trow}${domain ? ` ${styles.trowClick}` : ''}`}
                            onClick={domain ? () => setOpenDomain(domain) : undefined}
                          >
                            <div className={styles.trowMain}>
                              <div className={styles.trowTitle}>{r.title}</div>
                              <div className={`${styles.trowSub} tnum`}>{r.sub}</div>
                            </div>
                            <Badge tone={r.tone}>{r.badge}</Badge>
                            {apiKey && (
                              <button
                                type="button"
                                className={styles.rowAction}
                                onClick={() => void revokeKey(apiKey.id, apiKey.name)}
                              >
                                Revoke
                              </button>
                            )}
                            {domain && (
                              <span className={styles.chevron} aria-hidden="true">
                                <Icon name="chevron-right" size={16} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                </div>
                <div className={styles.tablefoot}>
                  <button type="button" className="sbtn" onClick={openPanelAction}>
                    <Icon name="plus" size={14} stroke={2.2} />
                    {panel.cta}
                  </button>
                </div>
              </>
            )}

            {/* ---- TOGGLES ---- */}
            {panel.kind === 'toggles' && (
              <div className={styles.toggles}>
                {panel.toggles.map((t) => {
                  const on = toggles[t.key];
                  return (
                    <div key={t.key} className={styles.toggleRow}>
                      <div className={styles.toggleMain}>
                        <div className={styles.toggleTitle}>{t.title}</div>
                        <div className={styles.toggleDesc}>{t.desc}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={t.title}
                        className={`atoggle${on ? ' is-on' : ''}`}
                        onClick={() => toggleAi(t.key)}
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
          onRemove={() => {
            setOpenEmail(null);
            removeMember(member);
          }}
          onEditRole={() => setRoleEditEmail(member.email)}
        />
      )}

      {/* role editor */}
      {roleEditMember && (
        <RoleModal
          member={roleEditMember}
          current={effRole(roleEditMember)}
          onClose={() => setRoleEditEmail(null)}
          onSave={(role) => void changeRole(roleEditMember, role)}
        />
      )}

      {/* section action modals */}
      {action === 'domains' && (
        <AddDomainModal
          live={live}
          onClose={() => setAction(null)}
          onDone={finishAction}
          onAdded={(d) => {
            void refreshDomains();
            setOpenDomain(d);
          }}
        />
      )}
      {action === 'billing' && (
        <AddBalanceModal onClose={() => setAction(null)} onDone={finishAction} />
      )}
      {action === 'api' && (
        <CreateKeyModal
          live={live}
          onClose={() => setAction(null)}
          onDone={finishAction}
          onCreated={() => void refreshKeys()}
        />
      )}
      {action === 'users' && (
        <InviteUserModal
          live={live}
          onClose={() => setAction(null)}
          onDone={finishAction}
          onAdded={() => void refreshMembers()}
        />
      )}

      {openDomain && (
        <DomainDrawer
          domain={openDomain}
          onClose={() => setOpenDomain(null)}
          onVerify={() => verifyDomain(openDomain.domainName)}
          onCopied={(what) => showToast(`${what} copied`)}
          onDelete={() => deleteDomain(openDomain.domainName)}
          cooldownUntil={
            lastCheckedAt[openDomain.domainName]
              ? lastCheckedAt[openDomain.domainName]! + DNS_RECHECK_COOLDOWN_MS
              : 0
          }
        />
      )}

      {confirming && (
        <ConfirmModal
          pending={confirming}
          busy={confirmBusy}
          onCancel={() => setConfirming(null)}
          onConfirm={runConfirmed}
        />
      )}

      {/* toast */}
      {toast && (
        <div
          className={`${styles.toast}${toastTone === 'alert' ? ` ${styles.toastAlert}` : ''}`}
          role="status"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className={styles.toastIc}>
            <Icon name={toastTone === 'alert' ? 'minus' : 'check'} size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------- team-member drawer --------------------------- */
function TeamDrawer({
  member,
  onClose,
  onRemove,
  onEditRole,
}: {
  member: Member;
  onClose: () => void;
  onRemove: () => void;
  onEditRole: () => void;
}) {
  const canRemove = member.role !== 'Owner';
  const perms = ROLE_PERMS[member.role];

  const details: { k: string; v: string }[] = [
    { k: 'Email', v: member.email },
    { k: 'Role', v: member.role },
    { k: 'Status', v: member.status },
    { k: 'Joined', v: member.joined },
  ];

  // Confirmation lives in the shared dialog the parent owns.
  const remove = () => onRemove();

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
          <div className={styles.setdId}>
            <span
              className={styles.setdAvatar}
              style={{ background: member.avBg, color: member.avColor }}
              aria-hidden="true"
            >
              {member.init}
            </span>
            <div>
              <div className={styles.setdName}>{member.name}</div>
              <div className={styles.setdRoleTitle}>{member.email}</div>
              <span
                className={`${styles.badge} ${styles.setdRole}`}
                style={TONE[roleTone[member.role]]}
              >
                {member.role}
              </span>
            </div>
          </div>

          {/* stats */}
          <div className={`adrawer__kpis ${styles.setdStats}`}>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Last active</div>
              <div className="adrawer__kpi-v adrawer__kpi-v--sm">{member.lastActive}</div>
            </div>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Member since</div>
              <div className="adrawer__kpi-v adrawer__kpi-v--sm">{member.joined}</div>
            </div>
          </div>

          {/* details */}
          <p className={`adrawer__eyebrow ${styles.setdEyebrow}`}>Details</p>
          <div>
            {details.map((d) => (
              <div key={d.k} className="adetail">
                <span className="adetail__k">{d.k}</span>
                <span className={`adetail__v ${styles.setdDv}`}>{d.v}</span>
              </div>
            ))}
          </div>

          {/* permissions */}
          <p className={`adrawer__eyebrow ${styles.setdEyebrow}`}>Permissions</p>
          <ul className={styles.setdPerms}>
            {perms.map((p) => (
              <li key={p} className={styles.setdPerm}>
                <span className={styles.setdPermIc} aria-hidden="true">
                  <Icon name="check" size={11} stroke={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="adrawer__foot">
          {canRemove && (
            <button type="button" className={`sbtn ${styles.setdRemove}`} onClick={remove}>
              Remove
            </button>
          )}
          <button type="button" className="pbtn" style={{ flex: 1 }} onClick={onEditRole}>
            Edit role
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ domain drawer ---------------------------- */
/** DNS records for a sending domain, with a re-check action. */
function DomainDrawer({
  domain,
  onClose,
  onVerify,
  onCopied,
  onDelete,
  cooldownUntil,
}: {
  domain: ApiDomain;
  onClose: () => void;
  /** Awaited so the button can show progress for the whole round trip. */
  onVerify: () => Promise<void>;
  onCopied: (what: string) => void;
  onDelete: () => void;
  /** Epoch ms when the next re-check is allowed; 0 when it is allowed now. */
  cooldownUntil: number;
}) {
  useEscapeClose(onClose);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Which field just got copied, so its icon can confirm briefly. */
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const verifiedCount = domain.dnsRecords.filter((r) => r.verified).length;
  const pending = !domain.active;

  const copyValue = (key: string, label: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
    onCopied(label);
  };

  // Tick only while a cooldown is running, and stop as soon as it lapses.
  useEffect(() => {
    if (!cooldownUntil) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const waitSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const copyRecords = () => {
    const text = domain.dnsRecords
      .map((r) => `${r.recordType}\t${r.name}\t${r.expectedValue}`)
      .join('\n');
    void navigator.clipboard?.writeText(text);
    onCopied(`${domain.dnsRecords.length} DNS records`);
  };

  const recheck = () => {
    if (checking) return;
    setChecking(true);
    void onVerify().finally(() => setChecking(false));
  };

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div
        className="adrawer setd"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${domain.domainName} — sending domain`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">Sending domain</span>
          <span className={styles.drawerActions}>
            <button
              type="button"
              className={`iconbtn ${styles.iconDanger}`}
              onClick={onDelete}
              aria-label={`Remove ${domain.domainName}`}
              title="Remove domain"
            >
              <Icon name="trash" size={16} />
            </button>
            <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </span>
        </div>

        <div className="adrawer__body">
          <div className={styles.setdId}>
            <div>
              <div className={styles.setdName}>{domain.domainName}</div>
              <span
                className={`${styles.badge} ${styles.setdRole}`}
                style={TONE[domain.active ? 'success' : 'warning']}
              >
                {domain.active ? 'Verified' : 'Pending DNS'}
              </span>
            </div>
          </div>

          <p className={`adrawer__eyebrow ${styles.setdEyebrow}`}>
            DNS records ({verifiedCount}/{domain.dnsRecords.length} verified)
          </p>
          {domain.dnsRecords.length === 0 ? (
            <p className={styles.modalHelp}>No records returned by the provider yet.</p>
          ) : (
            <div className={styles.dnsList}>
              {domain.dnsRecords.map((r) => {
                const rowKey = `${r.recordType}-${r.name}`;
                /* Per-field copy while the domain is pending — the values are
                   long and get pasted one at a time into a DNS host's form.
                   Once verified there is nothing left to paste, so they go. */
                const field = (label: 'Name' | 'Value', value: string) => (
                  <div className={styles.dnsField}>
                    <span className={styles.dnsLabel}>{label}</span>
                    <span className={styles.dnsValueRow}>
                      <code className={styles.dnsValue}>{value}</code>
                      {pending && (
                        <button
                          type="button"
                          className={styles.dnsCopy}
                          title={`Copy ${label.toLowerCase()}`}
                          aria-label={`Copy ${r.recordType} record ${label.toLowerCase()}`}
                          onClick={() =>
                            copyValue(
                              `${rowKey}-${label}`,
                              `${r.recordType} ${label.toLowerCase()}`,
                              value,
                            )
                          }
                        >
                          <Icon
                            name={copiedKey === `${rowKey}-${label}` ? 'check' : 'copy'}
                            size={13}
                          />
                        </button>
                      )}
                    </span>
                  </div>
                );
                return (
                  <div key={rowKey} className={styles.dnsRow}>
                    <div className={styles.dnsHead}>
                      <span className={styles.dnsType}>{r.recordType}</span>
                      <Badge tone={r.verified ? 'success' : 'warning'}>
                        {r.verified ? 'Verified' : 'Missing'}
                      </Badge>
                    </div>
                    {field('Name', r.name)}
                    {field('Value', r.expectedValue)}
                  </div>
                );
              })}
            </div>
          )}

          {pending && (
            <p className={styles.modalHelp}>
              Add these DNS records at your DNS provider, then re-check. DNS propagation usually
              takes a few minutes but can take up to a few hours.
            </p>
          )}
        </div>

        {/* Copy and re-check exist to finish setup; a verified domain has
            nothing left to paste or confirm, so the drawer becomes a
            read-only record and removal is the only action left (header). */}
        {pending && (
          <div className="adrawer__foot">
            <button
              type="button"
              className={`sbtn ${styles.copyBtn}`}
              onClick={copyRecords}
              disabled={domain.dnsRecords.length === 0}
            >
              Copy all records
            </button>
            <button
              type="button"
              className="pbtn"
              style={{ flex: 1 }}
              onClick={recheck}
              disabled={checking}
            >
              {checking
                ? 'Checking DNS…'
                : waitSeconds > 0
                  ? `Re-check in ${waitSeconds}s`
                  : 'Re-check DNS'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ modal shell ------------------------------ */
/** Shared dialog chrome: overlay, head with close, body, foot with Cancel +
 *  the caller's primary action. Escape and overlay-click both close. */
function Modal({
  title,
  onClose,
  children,
  foot,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  foot: ReactNode;
}) {
  useEscapeClose(onClose);

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      style={{ animation: 'ovfade .18s var(--ease-out)' }}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ animation: 'pop .18s ease' }}
      >
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>{title}</span>
          <button type="button" className={styles.modalX} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        <div className={styles.modalFoot}>
          <button type="button" className={styles.modalCancel} onClick={onClose}>
            Cancel
          </button>
          {foot}
        </div>
      </div>
    </div>
  );
}

/* Role picker rows, shared by the role editor and the invite modal. */
function RoleOptions({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <>
      {ROLE_LIST.map((r) => {
        const on = r === value;
        return (
          <button
            key={r}
            type="button"
            className={`${styles.modalOpt}${on ? ' is-on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(r)}
          >
            <span className={`${styles.modalRadio}${on ? ' is-on' : ''}`} aria-hidden="true" />
            <span className={styles.modalOptmain}>
              <span className={styles.modalOptrow}>
                <span className={styles.modalOptname}>{r}</span>
                <span className={styles.badge} style={TONE[roleTone[r]]}>
                  {r}
                </span>
              </span>
              <span className={styles.modalOptdesc}>{ROLE_DESC[r]}</span>
            </span>
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------ role editor ----------------------------- */
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

  return (
    <Modal
      title="Edit role"
      onClose={onClose}
      foot={
        <button
          type="button"
          className={styles.modalSave}
          disabled={role === current}
          onClick={() => onSave(role)}
        >
          Save role
        </button>
      }
    >
      <p className={styles.modalSub}>
        Choose the access level for <strong>{member.name}</strong>.
      </p>
      <RoleOptions value={role} onChange={setRole} />
    </Modal>
  );
}

/* --------------------------- confirm dialog ------------------------------ */
/** Shared confirmation for every destructive Settings action. */
function ConfirmModal({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingConfirm;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={pending.title}
      onClose={onCancel}
      foot={
        <button
          type="button"
          className={`${styles.modalSave} ${styles.modalDanger}`}
          onClick={onConfirm}
          disabled={busy}
          autoFocus
        >
          {busy ? 'Working…' : pending.confirmLabel}
        </button>
      }
    >
      <p className={styles.modalSub}>{pending.message}</p>
    </Modal>
  );
}

/* ----------------------------- action modals ----------------------------- */
function AddDomainModal({
  live,
  onClose,
  onDone,
  onAdded,
}: {
  live: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
  onAdded: (domain: ApiDomain) => void;
}) {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = isDomain(domain) && !busy;
  const submit = () => {
    if (!ok) return;
    const name = domain.trim().toLowerCase();
    if (!live) {
      onDone(`${name} added — install the DNS records to verify`);
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const created = await api.post<ApiDomain>('workspace/domains', { domainName: name });
        onAdded(created);
        onDone(`${name} added — add the DNS records, then verify`);
      } catch (e) {
        onDone(errMsg(e, `Could not add ${name}`));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Modal
      title="Add sending domain"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          {busy ? 'Adding…' : 'Add domain'}
        </button>
      }
    >
      <div className={styles.modalField}>
        <label htmlFor="am-domain" className={styles.label}>
          Domain
        </label>
        <input
          id="am-domain"
          autoFocus
          className={styles.input}
          placeholder="mail.acme.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <p className={styles.modalHelp}>
        Use a subdomain you control. We generate SPF and DKIM records to add at your DNS host —
        sending goes live once they verify.
      </p>
    </Modal>
  );
}

function AddBalanceModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  // Packages come from the billing service — prices and credits are decided
  // server-side; this modal only ever sends a package code. When the service
  // isn't reachable (mock/demo mode) the presets stand in, disabled.
  const [packages, setPackages] = useState<BillingPackage[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchBillingPackages()
      .then((data) => {
        const topups = data.filter((p) => !p.grantsTier);
        setPackages(topups);
        if (topups.length > 0) setSelected(topups[Math.min(1, topups.length - 1)].code);
        if (topups.length === 0) setUnavailable(true);
      })
      .catch(() => setUnavailable(true));
  }, []);

  const chosen = packages?.find((p) => p.code === selected) ?? null;
  const submit = () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);
    startCheckout(chosen.code)
      .then((url) => {
        onDone('Redirecting to secure checkout…');
        window.location.assign(url);
      })
      .catch((err: unknown) => {
        setBusy(false);
        setError(
          err instanceof ApiError && err.status === 403
            ? 'Only workspace owners and admins can add balance.'
            : err instanceof ApiError && err.status === 409
              ? 'Billing isn’t configured on this environment yet.'
              : 'Could not start checkout — try again.',
        );
      });
  };

  return (
    <Modal
      title="Add balance"
      onClose={onClose}
      foot={
        <button
          type="button"
          className={styles.modalSave}
          disabled={!chosen || busy || unavailable}
          onClick={submit}
        >
          {busy ? 'Opening checkout…' : chosen ? `Buy ${fmtUsd(chosen.priceUsd)}` : 'Add balance'}
        </button>
      }
    >
      <div className={styles.chips} role="group" aria-label="Credit packages">
        {(packages ?? []).map((p) => (
          <button
            key={p.code}
            type="button"
            className={`${styles.chip}${selected === p.code ? ' is-on' : ''}`}
            aria-pressed={selected === p.code}
            onClick={() => setSelected(p.code)}
          >
            ${p.priceUsd}
            {p.bonusUsd > 0 ? ` +$${p.bonusUsd}` : ''}
          </button>
        ))}
        {packages === null &&
          !unavailable &&
          BALANCE_PRESETS.map((p) => (
            <button key={p} type="button" className={styles.chip} disabled>
              ${p}
            </button>
          ))}
      </div>
      {chosen && (
        <p className={styles.convert}>
          {fmtUsd(chosen.totalCreditsUsd)} credit
          {chosen.bonusUsd > 0 ? ` (includes ${fmtUsd(chosen.bonusUsd)} bonus)` : ''} ≈{' '}
          {fmt(Math.floor(chosen.totalCreditsUsd / EST_RATE_USD.email))} emails ·{' '}
          {fmt(Math.floor(chosen.totalCreditsUsd / EST_RATE_USD.sms))} SMS ·{' '}
          {fmt(Math.floor(chosen.totalCreditsUsd / EST_RATE_USD.whatsapp))} WhatsApp
        </p>
      )}
      {unavailable && (
        <p className={styles.modalHelp}>
          Billing isn’t available in this environment yet — no packages to buy.
        </p>
      )}
      {error && (
        <p className={styles.modalHelp} role="alert">
          {error}
        </p>
      )}
      <p className={styles.modalHelp}>
        You’ll pay on a secure Stripe checkout page. Credit is drawn down at per-message rates and
        never expires.
      </p>
    </Modal>
  );
}

function CreateKeyModal({
  live,
  onClose,
  onDone,
  onCreated,
}: {
  live: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState(KEY_SCOPES[0].key);
  const [busy, setBusy] = useState(false);
  /** Shown once after creation — the service never returns it again. */
  const [secret, setSecret] = useState<string | null>(null);
  const ok = name.trim().length > 0 && !busy;
  const submit = () => {
    if (!ok) return;
    if (!live) {
      onDone(`API key "${name.trim()}" created`);
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const res = await api.post<{ secret: string }>('workspace/api-keys', {
          name: name.trim(),
          scope,
        });
        setSecret(res.secret);
        onCreated();
      } catch (e) {
        onDone(errMsg(e, 'Could not create the key'));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (secret) {
    return (
      <Modal
        title="API key created"
        onClose={onClose}
        foot={
          <button
            type="button"
            className={styles.modalSave}
            onClick={() => {
              void navigator.clipboard?.writeText(secret);
              onDone('Key copied to your clipboard');
            }}
          >
            Copy &amp; close
          </button>
        }
      >
        <p className={styles.modalSub}>
          Copy this secret now — it is shown once and cannot be retrieved later.
        </p>
        <code className={styles.secretBox}>{secret}</code>
        <p className={styles.modalHelp}>
          Send it as <strong>x-api-key</strong> (or a Bearer token) on API requests.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Create API key"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          {busy ? 'Creating…' : 'Create key'}
        </button>
      }
    >
      <div className={styles.modalField}>
        <label htmlFor="am-keyname" className={styles.label}>
          Key name
        </label>
        <input
          id="am-keyname"
          autoFocus
          className={styles.input}
          placeholder="Production server"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {KEY_SCOPES.map((s) => {
        const on = s.key === scope;
        return (
          <button
            key={s.key}
            type="button"
            className={`${styles.modalOpt}${on ? ' is-on' : ''}`}
            aria-pressed={on}
            onClick={() => setScope(s.key)}
          >
            <span className={`${styles.modalRadio}${on ? ' is-on' : ''}`} aria-hidden="true" />
            <span className={styles.modalOptmain}>
              <span className={styles.modalOptrow}>
                <span className={styles.modalOptname}>{s.name}</span>
              </span>
              <span className={styles.modalOptdesc}>{s.desc}</span>
            </span>
          </button>
        );
      })}
      <p className={styles.modalHelp}>
        The secret is shown once, right after creation — store it somewhere safe.
      </p>
    </Modal>
  );
}

function InviteUserModal({
  live,
  onClose,
  onDone,
  onAdded,
}: {
  live: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Editor');
  const [busy, setBusy] = useState(false);
  const ok = isEmail(email) && !busy;
  const submit = () => {
    if (!ok) return;
    const address = email.trim();
    if (!live) {
      onDone(`Invite sent to ${address}`);
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await api.post('workspace/members', { email: address, role: toServiceRole(role) });
        onAdded();
        onDone(`${address} added to the workspace`);
      } catch (e) {
        onDone(errMsg(e, `Could not add ${address}`));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Modal
      title="Invite user"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          {busy ? 'Adding…' : 'Add to workspace'}
        </button>
      }
    >
      <div className={styles.modalField}>
        <label htmlFor="am-email" className={styles.label}>
          Email
        </label>
        <input
          id="am-email"
          autoFocus
          type="email"
          className={styles.input}
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <RoleOptions value={role} onChange={setRole} />
      <p className={styles.modalHelp}>
        They get access immediately and sign in with a magic link — no password, no separate invite
        to accept.
      </p>
    </Modal>
  );
}
