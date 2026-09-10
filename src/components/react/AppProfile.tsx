import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';
import { api, ApiError } from '@/lib/app/api';
import { uploadAvatarPhoto } from '@/lib/app/media-upload';
import {
  browserTimeZone,
  normalizeTimeZone,
  timeZoneOptions,
  zoneOffsetLabel,
} from '@/lib/app/timezones';
import SearchableSelect from './shared/SearchableSelect';
import PhoneField from './PhoneField';
import { useToast } from './shared/useToast';
import ToastHost from './shared/ToastHost';
import AppProfileSecurity from './profile/AppProfileSecurity';
import AppProfileSessions from './profile/AppProfileSessions';
import styles from './AppProfile.module.css';

type TabKey = 'profile' | 'security' | 'notifications' | 'sessions';
type FieldKey = 'name' | 'display' | 'title' | 'tz' | 'lang';
type Fields = Record<FieldKey, string>;

const FIELD_KEYS: FieldKey[] = ['name', 'display', 'title', 'tz', 'lang'];

// Language is intentionally absent: the field is hidden until the app is
// actually localized, so nothing offers a choice it cannot honor.

const HEADS: Record<TabKey, { title: string; sub: string }> = {
  profile: {
    title: 'Your profile',
    sub: 'How you appear to teammates and in campaign audit logs.',
  },
  security: {
    title: 'Sign-in & security',
    sub: 'Passkeys, two-factor authentication, and how you sign in — all passwordless.',
  },
  notifications: {
    title: 'Notifications',
    sub: 'Pick the events worth interrupting you for, and where they land.',
  },
  sessions: {
    title: 'Sessions & devices',
    sub: 'Where you’re signed in, which devices you trust, and recent security activity.',
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

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'profile', label: 'Profile', icon: 'user' },
  { key: 'security', label: 'Sign-in & security', icon: 'shield' },
  { key: 'notifications', label: 'Notifications', icon: 'inbox' },
  { key: 'sessions', label: 'Sessions & devices', icon: 'clock' },
];

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    createdAt: string;
    preferences: Record<string, unknown>;
  };
  role?: string | null;
  recentSignIns?: Array<{ at: string; method: string }>;
};

function prefString(prefs: Record<string, unknown>, key: string, fallback = ''): string {
  const v = prefs[key];
  return typeof v === 'string' ? v : fallback;
}

function notifFromPrefs(prefs: Record<string, unknown>): Record<string, boolean> {
  const raw = prefs.notifications;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...INITIAL_SWITCHES };
  const out = { ...INITIAL_SWITCHES };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean' && k in out) out[k] = v;
  }
  return out;
}

function formatJoined(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

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

function fieldsFromPrefs(name: string | null | undefined, prefs: Record<string, unknown>): Fields {
  const bootstrapName = name?.trim() ?? '';
  const next: Fields = {
    name: bootstrapName,
    display: prefString(prefs, 'displayName') || bootstrapName.split(/\s+/)[0] || '',
    title: prefString(prefs, 'title'),
    // Stored values were once display strings ("Europe/Rome (GMT+2)");
    // normalize so those profiles keep their zone.
    tz: normalizeTimeZone(prefString(prefs, 'timezone')) || browserTimeZone(),
    lang: prefString(prefs, 'language'),
  };
  return next;
}

export default function AppProfile({
  name = null,
  email = null,
  phone = null,
  role = null,
  createdAt: createdAtProp = null,
  preferences: preferencesProp = {},
  recentSignIns: recentSignInsProp = [],
}: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  createdAt?: string | null;
  preferences?: Record<string, unknown>;
  recentSignIns?: Array<{ at: string; method: string }>;
} = {}) {
  // SSR bootstrap only (empty deps) — the client refetch updates state
  // imperatively, so prop changes after mount are deliberately ignored.
  const initialFields = useMemo(() => fieldsFromPrefs(name, preferencesProp ?? {}), []);
  const initialSwitches = useMemo(() => notifFromPrefs(preferencesProp ?? {}), []);

  const [tab, setTab] = useState<TabKey>('profile');
  const [fields, setFields] = useState<Fields>(initialFields);
  const [committed, setCommitted] = useState<Fields>(initialFields);
  const [phoneValue, setPhoneValue] = useState(phone ?? '');
  const [committedPhone, setCommittedPhone] = useState(phone ?? '');
  const [liveEmail, setLiveEmail] = useState(email);
  const [liveName, setLiveName] = useState(name);
  const [createdAt, setCreatedAt] = useState<string | null>(createdAtProp);
  const [recentSignIns, setRecentSignIns] =
    useState<Array<{ at: string; method: string }>>(recentSignInsProp);
  const [switches, setSwitches] = useState(initialSwitches);
  const [committedSwitches, setCommittedSwitches] = useState(initialSwitches);
  const [phoneKey, setPhoneKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // Profile photo — stored under its own avatars/ S3 prefix via /me/avatar.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => prefString(preferencesProp ?? {}, 'avatarUrl') || null,
  );
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // ~400 zones with live offsets — built once, not per render.
  const tzOptions = useMemo(() => timeZoneOptions(), []);
  const tzOffset = fields.tz ? zoneOffsetLabel(fields.tz) : '';
  const { toast, tone, show } = useToast();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const me = await api.get<MeResponse>('me');
        if (!alive) return;
        const prefs = me.user.preferences ?? {};
        const nextFields = fieldsFromPrefs(me.user.name, prefs);
        const nextSwitches = notifFromPrefs(prefs);
        const nextPhone = me.user.phone ?? '';
        setFields(nextFields);
        setCommitted(nextFields);
        setSwitches(nextSwitches);
        setCommittedSwitches(nextSwitches);
        setPhoneValue(nextPhone);
        setCommittedPhone(nextPhone);
        setPhoneKey((k) => k + 1);
        setLiveEmail(me.user.email);
        setLiveName(me.user.name);
        setCreatedAt(me.user.createdAt);
        setRecentSignIns(me.recentSignIns ?? []);
        setAvatarUrl(prefString(prefs, 'avatarUrl') || null);
      } catch {
        /* SSR props remain; API may be offline in fixture mode */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const displayName =
    liveName?.trim() ||
    fields.name.trim() ||
    (liveEmail ? liveEmail.split('@')[0] : 'Your account');
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '—';

  const dirtyFields = FIELD_KEYS.some((k) => fields[k] !== committed[k]);
  const dirtyPhone = phoneValue !== committedPhone;
  const dirtyNotifs = Object.keys(switches).some((k) => switches[k] !== committedSwitches[k]);
  const isDirty = dirtyFields || dirtyPhone || dirtyNotifs;

  const savebarNote =
    (dirtyFields || dirtyPhone) && dirtyNotifs
      ? 'Unsaved changes to your details and notifications'
      : dirtyFields || dirtyPhone
        ? 'Unsaved changes to your personal details'
        : 'Unsaved changes to your notification preferences';

  const setField = (key: FieldKey, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (saving) return;
    if (phoneValue && !/^\+\d{7,16}$/.test(phoneValue)) {
      show('Enter a valid phone number');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: fields.name.trim() || null,
        phone: phoneValue || null,
        preferences: {
          displayName: fields.display.trim(),
          title: fields.title.trim(),
          timezone: fields.tz,
          // The language picker is hidden, so only carry an existing value
          // through — never write an empty one over what a profile already has.
          ...(fields.lang ? { language: fields.lang } : {}),
          notifications: switches,
        },
      };
      const res = await api.patch<{ user: MeResponse['user'] }>('me', body);
      const prefs = res.user.preferences ?? {};
      const nextFields: Fields = {
        name: res.user.name?.trim() ?? '',
        display:
          prefString(prefs, 'displayName') || (res.user.name?.trim() ?? '').split(/\s+/)[0] || '',
        title: prefString(prefs, 'title'),
        tz: prefString(prefs, 'timezone', fields.tz),
        lang: prefString(prefs, 'language', fields.lang),
      };
      const nextSwitches = notifFromPrefs(prefs);
      const nextPhone = res.user.phone ?? '';
      setFields(nextFields);
      setCommitted(nextFields);
      setSwitches(nextSwitches);
      setCommittedSwitches(nextSwitches);
      setPhoneValue(nextPhone);
      setCommittedPhone(nextPhone);
      setLiveName(res.user.name);
      setLiveEmail(res.user.email);
      window.dispatchEvent(
        new CustomEvent('maildrill:profile', {
          detail: { displayName: nextFields.display },
        }),
      );
      show('Profile saved');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message === 'invalid_phone'
            ? 'Enter a valid phone number'
            : err.message
          : 'Couldn’t save your profile';
      show(msg);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setFields(committed);
    setSwitches(committedSwitches);
    setPhoneValue(committedPhone);
    setPhoneKey((k) => k + 1);
  };

  /* Photo upload: ticket → S3 PUT → confirm (avatars/ prefix, never a media
     asset). The shell listens on maildrill:profile, same as display-name saves. */
  const broadcastAvatar = (url: string | null) => {
    window.dispatchEvent(new CustomEvent('maildrill:profile', { detail: { avatarUrl: url } }));
  };

  const onAvatarFile = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      show('Use a PNG, JPG, or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      show('Photo must be 5MB or smaller');
      return;
    }
    setAvatarBusy(true);
    void (async () => {
      try {
        const url = await uploadAvatarPhoto(file);
        setAvatarUrl(url);
        broadcastAvatar(url);
        show('Profile photo updated');
      } catch (err) {
        show(err instanceof ApiError ? err.message : 'Could not upload the photo');
      } finally {
        setAvatarBusy(false);
      }
    })();
  };

  const removeAvatar = () => {
    setAvatarBusy(true);
    void (async () => {
      try {
        await api.del('me/avatar');
        setAvatarUrl(null);
        broadcastAvatar(null);
        show('Profile photo removed');
      } catch (err) {
        show(err instanceof ApiError ? err.message : 'Could not remove the photo');
      } finally {
        setAvatarBusy(false);
      }
    })();
  };

  const head = HEADS[tab];

  return (
    <div
      className={`screen screen--capped ${styles.wrap}${isDirty ? ` ${styles.wrapSavebar}` : ''}`}
      style={{ animation: 'fade .3s ease' }}
    >
      <div className={styles.body}>
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
                        {avatarUrl ? (
                          <img className={styles.avatarImg} src={avatarUrl} alt="" />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className={styles.stackBody}>
                        <p className={styles.avatarName}>{displayName}</p>
                        <p className={styles.avatarMeta}>
                          {roleLabel} · Joined {formatJoined(createdAt)}
                        </p>
                        <p className={styles.avatarHint}>
                          PNG or JPG, at least 256×256px. Used in the app, never in outgoing email.
                        </p>
                      </div>
                      <div className={styles.avatarActions}>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          onChange={(e) => {
                            onAvatarFile(e.target.files?.[0] ?? null);
                            e.target.value = '';
                          }}
                        />
                        <button
                          className={`${styles.btn} ${styles.btnSm}`}
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarBusy}
                        >
                          {avatarBusy ? 'Uploading…' : 'Upload photo'}
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnSm} ${styles.btnQuiet}`}
                          type="button"
                          onClick={removeAvatar}
                          disabled={avatarBusy || !avatarUrl}
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
                            value={liveEmail ?? '—'}
                            readOnly
                          />
                          <p className={styles.fieldHint}>Verified · used for sign-in and alerts</p>
                        </div>
                        <div>
                          <label className={styles.fieldLabel} htmlFor="field-phone">
                            Phone number
                          </label>
                          <PhoneField
                            key={`phone-${committedPhone || 'empty'}-${phoneKey}`}
                            name="phone"
                            defaultValue={committedPhone || null}
                            onValueChange={setPhoneValue}
                            compact
                          />
                          <p className={styles.fieldHint}>
                            International format · used for account recovery later
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
                          <SearchableSelect
                            id="field-tz"
                            value={fields.tz}
                            options={tzOptions}
                            placeholder="Search timezones…"
                            emptyMessage="No timezone matches that search"
                            onChange={(v) => setField('tz', v)}
                          />
                          <p className={styles.fieldHint}>
                            Campaign schedules and reports follow this
                            {tzOffset ? ` · currently ${tzOffset}` : ''}
                          </p>
                        </div>
                        {/* Language is hidden until the app is localized —
                            offering a picker that changes nothing is a promise
                            the product cannot keep. */}
                      </div>
                    </div>

                    {/* Danger zone (transfer ownership, close account) is hidden:
                        neither action is wired to a service, and a destructive
                        button that silently does nothing is worse than none. */}
                  </>
                )}

                {tab === 'security' && <AppProfileSecurity email={liveEmail} show={show} />}

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
                  <AppProfileSessions email={liveEmail} recentSignIns={recentSignIns} show={show} />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {isDirty && (
        <div className={styles.savebar} role="status">
          <span className={styles.savebarDot} />
          <span className={styles.savebarNote}>{savebarNote}</span>
          <div className={styles.savebarActions}>
            <button className={styles.btn} type="button" onClick={discard} disabled={saving}>
              Discard
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      <ToastHost toast={toast} tone={tone} />
    </div>
  );
}
