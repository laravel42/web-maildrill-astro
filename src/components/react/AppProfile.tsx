import { useMemo, useState } from 'react';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';
import { useToast } from './shared/useToast';
import styles from './AppProfile.module.css';

/*
 * Profile — pixel port of design/profile.html (+ profile.ts behavior as React
 * state). /v1/me is read-only, so Save commits every field locally exactly like
 * the comp's TS; sections the backend doesn't record (joined date, timezone,
 * sign-in history, other sessions, 2FA) render "—" or honest empty states
 * rather than the comp's invented values.
 */

type TabKey = 'profile' | 'security' | 'notifications' | 'sessions';
type FieldKey = 'name' | 'display' | 'title' | 'tz' | 'lang';
type Fields = Record<FieldKey, string>;

const FIELD_KEYS: FieldKey[] = ['name', 'display', 'title', 'tz', 'lang'];

const TZ_OPTIONS = [
  'Europe/Rome (GMT+2)',
  'Europe/London (GMT+1)',
  'Europe/Berlin (GMT+2)',
  'America/New_York (GMT-4)',
  'Asia/Singapore (GMT+8)',
];
const LANG_OPTIONS = ['English (UK)', 'English (US)', 'Italiano', 'Deutsch', 'Français'];

const HEADS: Record<TabKey, { title: string; sub: string }> = {
  profile: {
    title: 'Your profile',
    sub: 'How you appear to teammates and in campaign audit logs.',
  },
  security: {
    title: 'Password & security',
    sub: 'Keep your account and everything your workspace sends protected.',
  },
  notifications: {
    title: 'Notifications',
    sub: 'Pick the events worth interrupting you for, and where they land.',
  },
  sessions: {
    title: 'Sessions',
    sub: 'Devices signed in to your account, and recent sign-in attempts.',
  },
};

type NotifRow = { key: string; title: string; desc: string };
const NOTIF_GROUPS: { label: string; rows: NotifRow[] }[] = [
  {
    label: 'Campaigns & sending',
    rows: [
      {
        key: 'finished',
        title: 'Campaign finishes sending',
        desc: 'A recap with opens, clicks and bounces once delivery completes.',
      },
      {
        key: 'deliver',
        title: 'Deliverability drops',
        desc: 'Bounce rate above 2% or a spam-complaint spike on any domain.',
      },
      {
        key: 'quota',
        title: 'Sending quota reaches 80%',
        desc: 'So a launch never stalls mid-send.',
      },
    ],
  },
];

const INITIAL_SWITCHES: Record<string, boolean> = {
  'finished-email': true,
  'finished-app': true,
  'deliver-email': true,
  'deliver-app': true,
  'quota-email': true,
  'quota-app': false,
};

/* Comp's strength meter palette (profile.ts). */
const STRENGTH_TONES = ['#dedcd4', '#dc2626', '#b45309', '#0891b2', '#16a34a'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function strengthScore(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'profile', label: 'Profile', icon: 'user' },
  { key: 'security', label: 'Password & security', icon: 'shield' },
  { key: 'notifications', label: 'Notifications', icon: 'inbox' },
  { key: 'sessions', label: 'Sessions', icon: 'clock' },
];

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      className={`${styles.switch} ${on ? styles.isOn : ''}`}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    >
      <span className={styles.switchKnob} />
    </button>
  );
}

export default function AppProfile({
  name = null,
  email = null,
  phone = null,
  role = null,
}: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
} = {}) {
  const displayName = name?.trim() || (email ? email.split('@')[0] : 'Your account');
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '—';

  const initialFields = useMemo<Fields>(
    () => ({
      name: name?.trim() ?? '',
      display: (name?.trim() ?? '').split(/\s+/)[0] ?? '',
      title: '',
      tz: TZ_OPTIONS[0],
      lang: LANG_OPTIONS[0],
    }),
    [name],
  );

  const [tab, setTab] = useState<TabKey>('profile');
  const [fields, setFields] = useState<Fields>(initialFields);
  const [committed, setCommitted] = useState<Fields>(initialFields);
  const [switches, setSwitches] = useState(INITIAL_SWITCHES);
  const [committedSwitches, setCommittedSwitches] = useState(INITIAL_SWITCHES);
  const [pw, setPw] = useState('');
  const { toast, show } = useToast();

  const dirtyFields = FIELD_KEYS.some((k) => fields[k] !== committed[k]);
  const dirtyNotifs = Object.keys(switches).some((k) => switches[k] !== committedSwitches[k]);
  const isDirty = dirtyFields || dirtyNotifs;

  const savebarNote =
    dirtyFields && dirtyNotifs
      ? 'Unsaved changes to your details and notifications'
      : dirtyFields
        ? 'Unsaved changes to your personal details'
        : 'Unsaved changes to your notification preferences';

  const setField = (key: FieldKey, value: string) => setFields((f) => ({ ...f, [key]: value }));

  /* /v1/me has no PATCH — commit locally like the comp's TS. */
  const save = () => {
    setCommitted(fields);
    setCommittedSwitches(switches);
  };
  const discard = () => {
    setFields(committed);
    setSwitches(committedSwitches);
  };

  const notAvailable = () => show('Not available yet');

  const pwScore = strengthScore(pw);

  const head = HEADS[tab];

  return (
    <div className={`screen screen--capped ${styles.wrap}`} style={{ animation: 'fade .3s ease' }}>
      <h1 className={`screen__h1 ${styles.h1}`}>Profile</h1>

      <div className={styles.grid}>
        <nav className={styles.nav} role="tablist" aria-label="Account settings">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                className={`${styles.navitem}${active ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="profile-panel"
                onClick={() => setTab(item.key)}
              >
                <Icon name={item.icon} size={15} />
                {item.label}
              </button>
            );
          })}
          <p className={styles.navNote}>
            You are the workspace <strong>{roleLabel}</strong>.
            {role === 'owner' && ' Only you can transfer ownership or close the workspace.'}
          </p>
        </nav>

        <div className={styles.panelwrap}>
          <section
            className={`acrd ${styles.panel}`}
            role="tabpanel"
            id="profile-panel"
            aria-labelledby="profile-panel-title"
          >
            <header className={styles.panelhead}>
              <div className={styles.panelheadText}>
                <h2 id="profile-panel-title" className={styles.title}>
                  {head.title}
                </h2>
                <p className={styles.desc}>{head.sub}</p>
              </div>
              {!isDirty && (
                <span className={styles.savedChip}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                  All changes saved
                </span>
              )}
            </header>

            <div className={styles.panelBody}>
              {tab === 'profile' && (
                <>
                  <div className={`${styles.section} ${styles.avatarCard}`}>
                    <div className={styles.avatar} aria-hidden="true">
                      {initial}
                    </div>
                    <div className={styles.stackBody}>
                      <p className={styles.avatarName}>{displayName}</p>
                      <p className={styles.avatarMeta}>{roleLabel} · — · —</p>
                      <p className={styles.avatarHint}>
                        PNG or JPG, at least 256×256px. Used in the app, never in outgoing email.
                      </p>
                    </div>
                    <div className={styles.avatarActions}>
                      <button
                        className={`${styles.btn} ${styles.btnSm}`}
                        type="button"
                        onClick={notAvailable}
                      >
                        Upload photo
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnQuiet}`}
                        type="button"
                        onClick={notAvailable}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionHead}>
                      Personal details{' '}
                      <span className={styles.note}>Visible to teammates in this workspace</span>
                    </div>
                    <div className={styles.fieldGrid}>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-name">
                          Full name
                        </label>
                        <input
                          className={styles.input}
                          id="field-name"
                          name="name"
                          type="text"
                          value={fields.name}
                          onChange={(e) => setField('name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-display">
                          Display name
                        </label>
                        <input
                          className={styles.input}
                          id="field-display"
                          name="display"
                          type="text"
                          value={fields.display}
                          onChange={(e) => setField('display', e.target.value)}
                        />
                        <p className={styles.fieldHint}>Shown on comments and audit entries</p>
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-email">
                          Email
                        </label>
                        <input
                          className={`${styles.input} ${styles.inputLocked}`}
                          id="field-email"
                          name="email"
                          type="text"
                          value={email ?? '—'}
                          readOnly
                        />
                        <p className={styles.fieldHint}>
                          Verified · used for sign-in and alerts{' '}
                          <button className={styles.linkBtn} type="button" onClick={notAvailable}>
                            Change email
                          </button>
                        </p>
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-phone">
                          Phone number
                        </label>
                        <input
                          className={`${styles.input} ${styles.inputLocked}`}
                          id="field-phone"
                          name="phone"
                          type="tel"
                          value={phone ?? '—'}
                          readOnly
                        />
                        <p className={styles.fieldHint}>
                          Captured at sign-up{' '}
                          <button className={styles.linkBtn} type="button" onClick={notAvailable}>
                            Change phone
                          </button>
                        </p>
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-title">
                          Job title
                        </label>
                        <input
                          className={styles.input}
                          id="field-title"
                          name="title"
                          type="text"
                          value={fields.title}
                          onChange={(e) => setField('title', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-tz">
                          Timezone
                        </label>
                        <select
                          className={styles.input}
                          id="field-tz"
                          name="tz"
                          value={fields.tz}
                          onChange={(e) => setField('tz', e.target.value)}
                        >
                          {TZ_OPTIONS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                        <p className={styles.fieldHint}>
                          Campaign schedules and reports follow this
                        </p>
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="field-lang">
                          Language
                        </label>
                        <select
                          className={styles.input}
                          id="field-lang"
                          name="lang"
                          value={fields.lang}
                          onChange={(e) => setField('lang', e.target.value)}
                        >
                          {LANG_OPTIONS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.section} ${styles.sectionDanger}`}>
                    <div className={styles.sectionHead}>Danger zone</div>
                    <ul className={styles.stack}>
                      <li className={styles.stackRow}>
                        <div className={styles.stackBody}>
                          <p className={styles.stackTitle}>Transfer ownership</p>
                          <p className={styles.stackDesc}>
                            Hand billing and workspace control to another Admin.
                          </p>
                        </div>
                        <button
                          className={`${styles.btn} ${styles.btnSm}`}
                          type="button"
                          onClick={notAvailable}
                        >
                          Choose person
                        </button>
                      </li>
                      <li className={styles.stackRow}>
                        <div className={styles.stackBody}>
                          <p className={styles.stackTitle}>Close my account</p>
                          <p className={styles.stackDesc}>
                            Removes your access. Campaign history stays with the workspace.
                          </p>
                        </div>
                        <button
                          className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                          type="button"
                          onClick={notAvailable}
                        >
                          Close account
                        </button>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {tab === 'security' && (
                <>
                  <div className={styles.section}>
                    <div className={styles.sectionHead}>Password</div>
                    <form
                      className={styles.passwordForm}
                      onSubmit={(e) => {
                        e.preventDefault();
                        show("Password sign-in isn't enabled yet");
                      }}
                    >
                      <div>
                        <label className={styles.fieldLabel} htmlFor="pw-current">
                          Current password
                        </label>
                        <input
                          className={styles.input}
                          id="pw-current"
                          type="password"
                          defaultValue="••••••••••"
                          autoComplete="current-password"
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="pw-new">
                          New password
                        </label>
                        <input
                          className={styles.input}
                          id="pw-new"
                          type="password"
                          placeholder="At least 12 characters"
                          autoComplete="new-password"
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                        />
                        <div className={styles.strength}>
                          <div className={styles.strengthBars}>
                            {[0, 1, 2, 3].map((i) => (
                              <span
                                key={i}
                                style={
                                  pw && i < pwScore
                                    ? { background: STRENGTH_TONES[pwScore] }
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                          <span
                            className={styles.strengthLabel}
                            style={pwScore ? { color: STRENGTH_TONES[pwScore] } : undefined}
                          >
                            {STRENGTH_LABELS[pwScore]}
                          </span>
                        </div>
                        <p className={styles.fieldHint}>
                          Mix upper and lower case, a number and a symbol. Changing it signs out
                          every other device.
                        </p>
                      </div>
                      <div>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          type="submit"
                          disabled={pwScore < 3}
                        >
                          Update password
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionHead}>
                      Two-factor authentication{' '}
                      <span className={styles.note}>Required for Owners and Admins</span>
                    </div>
                    <ul className={styles.stack}>
                      <li className={styles.stackRow}>
                        <span className={styles.stackIcon}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="8" cy="15" r="4.2" />
                            <path d="m11 12 8-8M17.5 5.5l2 2M15 8l2 2" />
                          </svg>
                        </span>
                        <div className={styles.stackBody}>
                          <p className={styles.stackTitle}>Authenticator app</p>
                          <p className={styles.stackDesc}>Not configured</p>
                        </div>
                        <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>
                        <button
                          className={`${styles.btn} ${styles.btnSm}`}
                          type="button"
                          onClick={notAvailable}
                        >
                          Reconfigure
                        </button>
                      </li>
                      <li className={styles.stackRow}>
                        <span className={styles.stackIcon}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="4.5" width="18" height="15" rx="2.2" />
                            <path d="M7.5 10h4M7.5 14h9" />
                          </svg>
                        </span>
                        <div className={styles.stackBody}>
                          <p className={styles.stackTitle}>Recovery codes</p>
                          <p className={styles.stackDesc}>Not configured</p>
                        </div>
                        <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>
                        <button
                          className={`${styles.btn} ${styles.btnSm}`}
                          type="button"
                          onClick={notAvailable}
                        >
                          Regenerate
                        </button>
                      </li>
                      <li className={styles.stackRow}>
                        <span className={styles.stackIcon}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6Z" />
                            <path d="m9 12 2.2 2.2L15.4 10" />
                          </svg>
                        </span>
                        <div className={styles.stackBody}>
                          <p className={styles.stackTitle}>Passkeys</p>
                          <p className={styles.stackDesc}>No passkey registered on this account</p>
                        </div>
                        <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>
                        <button
                          className={`${styles.btn} ${styles.btnSm}`}
                          type="button"
                          onClick={notAvailable}
                        >
                          Add passkey
                        </button>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {tab === 'notifications' && (
                <>
                  <div className={styles.section}>
                    <div className={styles.notifHead}>
                      <span>EVENT</span>
                      <span>EMAIL</span>
                      <span>IN-APP</span>
                    </div>
                    {NOTIF_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className={styles.notifGroupLabel}>{group.label}</p>
                        {group.rows.map((row) => (
                          <div key={row.key} className={styles.notifRow}>
                            <div>
                              <p className={styles.stackTitle}>{row.title}</p>
                              <p className={styles.stackDesc}>{row.desc}</p>
                            </div>
                            {(['email', 'app'] as const).map((channel) => {
                              const id = `${row.key}-${channel}`;
                              return (
                                <div key={channel} className={styles.notifCell}>
                                  <Switch
                                    on={switches[id]}
                                    label={`${row.title} — ${channel === 'email' ? 'email' : 'in-app'}`}
                                    onToggle={() => setSwitches((s) => ({ ...s, [id]: !s[id] }))}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                    <p className={styles.sectionNote}>
                      Deliverability and quota alerts also reach the workspace Owner regardless of
                      these settings.
                    </p>
                  </div>
                </>
              )}

              {tab === 'sessions' && (
                <>
                  <div className={styles.section}>
                    <div className={`${styles.sectionHead} ${styles.sectionHeadSplit}`}>
                      <div>
                        <p>Active sessions</p>
                        <p className={styles.note}>1 device · this browser</p>
                      </div>
                      <button
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                        type="button"
                        onClick={notAvailable}
                      >
                        Sign out everywhere
                      </button>
                    </div>
                    <ul>
                      <li className={styles.sessionRow}>
                        <span className={`${styles.sessionIcon} ${styles.sessionIconCurrent}`}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="4.5" width="18" height="12" rx="2" />
                            <path d="M2 19.5h20" />
                          </svg>
                        </span>
                        <div className={styles.stackBody}>
                          <p className={styles.sessionDevice}>
                            This browser{' '}
                            <span className={`${styles.chip} ${styles.chipOn}`}>This device</span>
                          </p>
                          <p className={styles.stackDesc}>— · active now</p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionHead}>Recent sign-ins</div>
                    <table className={styles.table}>
                      <tbody>
                        <tr>
                          <td>No sign-in history recorded yet.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {isDirty && (
        <div className={styles.savebar}>
          <span className={styles.savebarDot} />
          <span className={styles.savebarNote}>{savebarNote}</span>
          <div className={styles.savebarActions}>
            <button className={styles.btn} type="button" onClick={discard}>
              Discard
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={save}>
              Save changes
            </button>
          </div>
        </div>
      )}

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
