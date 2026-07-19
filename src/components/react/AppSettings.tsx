import { useState, type ReactNode } from 'react';
import Icon from './Icon';
import { CHANNEL } from './shared/channels';
import { TONE, type Tone } from './shared/tones';
import { useEscapeClose } from './shared/useEscapeClose';
import { useToast } from './shared/useToast';
import type { FieldDef, Member, Role, SectionKey, ToggleKey } from './AppSettings.types';
import {
  DEFAULT_TOGGLES,
  NAV,
  PANELS,
  ROLE_DESC,
  ROLE_LIST,
  ROLE_PERMS,
  ROSTER,
  USAGE,
  fmt,
  roleTone,
  swatchColor,
  totalCap,
  totalUsed,
} from './AppSettings.logic';
import styles from './AppSettings.module.css';

/*
 * Settings — the sectioned-subnav workspace screen (App.dc.html §3).
 * A 200px left subnav drives a single right panel that renders as one of four
 * shapes: a form, a usage view, a table, or a toggles list. Every section is
 * self-contained here (fixtures live in AppSettings.logic); no shared mock-data edits.
 */

/* ------------------------------- helpers -------------------------------- */
function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={styles.badge} style={TONE[tone]}>
      {children}
    </span>
  );
}

export default function AppSettings() {
  const [section, setSection] = useState<SectionKey>('workspace');
  const [form, setForm] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES);
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({});
  const [roleEditEmail, setRoleEditEmail] = useState<string | null>(null);
  const { toast, show: showToast } = useToast();

  const effRole = (m: Member): Role => roleOverrides[m.email] ?? m.role;

  const panel = PANELS[section];
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
                    <div key={f.key} className={styles.field}>
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

            {/* ---- USAGE ---- */}
            {panel.kind === 'usage' && (
              <div className="set__usage">
                <div className={styles.summary}>
                  <div>
                    <div className={styles.summaryLbl}>Total sends used this period</div>
                    <div className={`${styles.summaryVal} tnum`}>
                      {fmt(totalUsed)} <span className={styles.summaryCap}>/ {fmt(totalCap)}</span>
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

                <div className={styles.usageList}>
                  {USAGE.map((u) => {
                    const meta = CHANNEL[u.channel];
                    const left = u.total - u.used;
                    const pct = Math.round((u.used / u.total) * 100);
                    return (
                      <div key={u.channel} className={styles.usageRow}>
                        <div className={styles.usageHead}>
                          <span
                            className={styles.usageIc}
                            style={{ background: meta.tint, color: meta.color }}
                          >
                            <Icon name={meta.icon} size={14} />
                          </span>
                          <span className={styles.usageName}>{meta.label}</span>
                          <span className={`${styles.usageNums} tnum`}>
                            {fmt(u.used)} / {fmt(u.total)} · {fmt(left)} left
                          </span>
                        </div>
                        <div className={`abar ${styles.usageBar}`}>
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
                          <button
                            type="button"
                            className={`kbtn ${styles.more}`}
                            aria-label={`Actions for ${r.title}`}
                            onClick={() => showToast(`${r.title} · more actions`)}
                          >
                            <Icon name="more" size={16} />
                          </button>
                        </div>
                      ))}
                </div>
                <div className={styles.tablefoot}>
                  <button type="button" className="sbtn" onClick={() => showToast(`${panel.cta}…`)}>
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
              <span className={`${styles.badge} ${styles.setdRole}`} style={TONE[roleTone[member.role]]}>
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

  useEscapeClose(onClose);

  return (
    <div
      className={styles.rolemOverlay}
      onClick={onClose}
      style={{ animation: 'ovfade .18s var(--ease-out)' }}
    >
      <div
        className={styles.rolem}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit role for ${member.name}`}
        style={{ animation: 'pop .18s ease' }}
      >
        <div className={styles.rolemHead}>
          <span className={styles.rolemTitle}>Edit role</span>
          <button type="button" className={styles.rolemX} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className={styles.rolemBody}>
          <p className={styles.rolemSub}>
            Choose the access level for <strong>{member.name}</strong>.
          </p>
          {ROLE_LIST.map((r) => {
            const on = r === role;
            return (
              <button
                key={r}
                type="button"
                className={`${styles.rolemOpt}${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => setRole(r)}
              >
                <span className={`${styles.rolemRadio}${on ? ' is-on' : ''}`} aria-hidden="true" />
                <span className={styles.rolemOptmain}>
                  <span className={styles.rolemOptrow}>
                    <span className={styles.rolemOptname}>{r}</span>
                    <span className={styles.badge} style={TONE[roleTone[r]]}>
                      {r}
                    </span>
                  </span>
                  <span className={styles.rolemOptdesc}>{ROLE_DESC[r]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.rolemFoot}>
          <button type="button" className={styles.rolemCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.rolemSave}
            disabled={role === current}
            onClick={() => onSave(role)}
          >
            Save role
          </button>
        </div>
      </div>
    </div>
  );
}
