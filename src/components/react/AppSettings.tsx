import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/app/api';
import Icon from './Icon';
import type { ChannelBreakdown } from './AppAnalytics.logic';
import { CHANNEL } from './shared/channels';
import { TONE, type Tone } from './shared/tones';
import { useEscapeClose } from './shared/useEscapeClose';
import { useToast } from './shared/useToast';
import type { FieldDef, Member, Role, SectionKey, ToggleKey } from './AppSettings.types';
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

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={styles.badge} style={TONE[tone]}>
      {children}
    </span>
  );
}

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
  const { toast, show: showToast } = useToast();

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
  const tableEmpty =
    panel.kind === 'table' &&
    (panel.roster ? ROSTER.length === 0 : (panel.rows ?? []).length === 0);
  const baseMember = openEmail ? (ROSTER.find((m) => m.email === openEmail) ?? null) : null;
  const member = baseMember ? { ...baseMember, role: effRole(baseMember) } : null;
  const roleEditMember = roleEditEmail
    ? (ROSTER.find((m) => m.email === roleEditEmail) ?? null)
    : null;

  const val = (f: FieldDef) => form[f.key] ?? f.value;

  return (
    <div className="screen screen--capped" style={{ animation: 'fade .3s ease' }}>
      <h1 className={`screen__h1 ${styles.h1}`}>Settings</h1>

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
                  showToast('Settings saved');
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
                        PREPAID_BALANCE_USD < LOW_BALANCE_USD ? ` ${styles.heroStatAlert}` : ''
                      }`}
                    >
                      <span className={styles.heroStatLbl}>Balance left</span>
                      <span className={styles.heroStatVal}>{fmtUsd(PREPAID_BALANCE_USD)}</span>
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
            {panel.kind === 'table' && tableEmpty && (
              <div className={styles.blank}>
                <p className={styles.blankMsg}>{panel.empty}</p>
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
                    ? ROSTER.map((m) => (
                        <div
                          key={m.email}
                          role="button"
                          className={`${styles.trow} ${styles.trowClick}`}
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
                          <Badge tone={roleTone[effRole(m)]}>{effRole(m)}</Badge>
                          <span className={styles.chevron} aria-hidden="true">
                            <Icon name="chevron-right" size={16} />
                          </span>
                        </div>
                      ))
                    : (panel.rows ?? []).map((r) => (
                        <div key={r.title} role="listitem" className={styles.trow}>
                          <div className={styles.trowMain}>
                            <div className={styles.trowTitle}>{r.title}</div>
                            <div className={`${styles.trowSub} tnum`}>{r.sub}</div>
                          </div>
                          <Badge tone={r.tone}>{r.badge}</Badge>
                        </div>
                      ))}
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

      {/* section action modals */}
      {action === 'domains' && (
        <AddDomainModal onClose={() => setAction(null)} onDone={finishAction} />
      )}
      {action === 'billing' && (
        <AddBalanceModal onClose={() => setAction(null)} onDone={finishAction} />
      )}
      {action === 'api' && <CreateKeyModal onClose={() => setAction(null)} onDone={finishAction} />}
      {action === 'users' && (
        <InviteUserModal onClose={() => setAction(null)} onDone={finishAction} />
      )}

      {/* toast */}
      {toast && (
        <div
          className={styles.toast}
          role="status"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className={styles.toastIc}>
            <Icon name="check" size={13} stroke={3} />
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
              <div className={styles.setdRoleTitle}>{member.title}</div>
              <span
                className={`${styles.badge} ${styles.setdRole}`}
                style={TONE[roleTone[member.role]]}
              >
                {member.role}
              </span>
            </div>
          </div>

          {/* stats */}
          <div className={styles.setdStats}>
            <div className={styles.setdStat}>
              <div className={styles.setdStatLbl}>Campaigns created</div>
              <div className={`${styles.setdStatVal} tnum`}>{member.campaigns}</div>
            </div>
            <div className={styles.setdStat}>
              <div className={styles.setdStatLbl}>Last active</div>
              <div className={`${styles.setdStatVal} ${styles.setdStatValSm}`}>
                {member.lastActive}
              </div>
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
          <button
            type="button"
            className="sbtn"
            style={{ flex: 1 }}
            onClick={() => onToast(`Message sent to ${member.name}`)}
          >
            Message
          </button>
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

/* ----------------------------- action modals ----------------------------- */
function AddDomainModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [domain, setDomain] = useState('');
  const ok = isDomain(domain);
  const submit = () => {
    if (ok) onDone(`${domain.trim().toLowerCase()} added — install the DNS records to verify`);
  };

  return (
    <Modal
      title="Add sending domain"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          Add domain
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
  const [amount, setAmount] = useState('50');
  const value = Number.parseFloat(amount);
  const ok = Number.isFinite(value) && value > 0;
  const submit = () => {
    if (ok) onDone(`Added ${fmtUsd(value)} to your balance`);
  };

  return (
    <Modal
      title="Add balance"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          {ok ? `Add ${fmtUsd(value)}` : 'Add balance'}
        </button>
      }
    >
      <div className={styles.chips} role="group" aria-label="Quick amounts">
        {BALANCE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.chip}${value === p ? ' is-on' : ''}`}
            aria-pressed={value === p}
            onClick={() => setAmount(String(p))}
          >
            ${p}
          </button>
        ))}
      </div>
      <div className={styles.modalField}>
        <label htmlFor="am-amount" className={styles.label}>
          Amount
        </label>
        <div className={styles.amount}>
          <span className={styles.amountPrefix} aria-hidden="true">
            $
          </span>
          <input
            id="am-amount"
            inputMode="decimal"
            className={`${styles.input} ${styles.inputMoney}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {ok && (
          <p className={styles.convert}>
            ≈ {fmt(Math.floor(value / EST_RATE_USD.email))} emails ·{' '}
            {fmt(Math.floor(value / EST_RATE_USD.sms))} SMS ·{' '}
            {fmt(Math.floor(value / EST_RATE_USD.whatsapp))} WhatsApp
          </p>
        )}
      </div>
      <p className={styles.modalHelp}>
        Credit is drawn down at per-message rates and never expires. Auto-recharge tops you up when
        it runs low.
      </p>
    </Modal>
  );
}

function CreateKeyModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState(KEY_SCOPES[0].key);
  const ok = name.trim().length > 0;
  const submit = () => {
    if (ok) onDone(`API key "${name.trim()}" created`);
  };

  return (
    <Modal
      title="Create API key"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          Create key
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
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Editor');
  const ok = isEmail(email);
  const submit = () => {
    if (ok) onDone(`Invite sent to ${email.trim()}`);
  };

  return (
    <Modal
      title="Invite user"
      onClose={onClose}
      foot={
        <button type="button" className={styles.modalSave} disabled={!ok} onClick={submit}>
          Send invite
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
      <p className={styles.modalHelp}>They&apos;ll get a magic-link invite to this workspace.</p>
    </Modal>
  );
}
