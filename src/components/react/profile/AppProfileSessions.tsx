import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'auth-astro/client';
import Icon from '../Icon';
import { api, ApiError } from '@/lib/app/api';
import type { ToastTone } from '../shared/useToast';
import ConfirmDialog from '../shared/ConfirmDialog';
import styles from '../AppProfile.module.css';
import ReauthDialog from './ReauthDialog';
import {
  amrLabel,
  deviceIcon,
  deviceLine,
  eventIcon,
  eventIsAlert,
  eventLabel,
  formatDateTime,
  formatRelative,
  type SecurityEventInfo,
  type SecurityOverview,
  type SessionInfo,
  type TrustedDeviceInfo,
} from './security.logic';

type Confirming = {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
} | null;

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.message && !/^\d+ /.test(e.message) ? e.message : fallback;

/**
 * Sessions tab: active sessions (individually revocable), trusted devices,
 * and the security activity feed. Revoke-all-others actions require recent
 * authentication via the reauth dialog.
 */
export default function AppProfileSessions({
  email,
  recentSignIns,
  show,
}: {
  email: string | null;
  recentSignIns: Array<{ at: string; method: string }>;
  show: (msg: string, tone?: ToastTone) => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [devices, setDevices] = useState<TrustedDeviceInfo[]>([]);
  const [events, setEvents] = useState<SecurityEventInfo[]>([]);
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reauthRun, setReauthRun] = useState<(() => Promise<void>) | null>(null);

  const refresh = useCallback(async () => {
    const [s, d, e] = await Promise.all([
      api.get<{ sessions: SessionInfo[] }>('me/security/sessions'),
      api.get<{ devices: TrustedDeviceInfo[] }>('me/security/trusted-devices'),
      api.get<{ events: SecurityEventInfo[] }>('me/security/events?limit=30'),
    ]);
    setSessions(s.sessions);
    setDevices(d.devices);
    setEvents(e.events);
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      refresh(),
      api.get<SecurityOverview>('me/security/overview').then(setOverview),
    ]).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [refresh]);

  const sensitive = useCallback(async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === 'reauth_required') {
        setReauthRun(() => run);
        return;
      }
      throw err;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------

  const signOutHere = () => {
    // auth-astro runtime accepts callbackUrl; published SignOutParams types omit it.
    void signOut({ callbackUrl: '/login' } as Parameters<typeof signOut>[0]);
  };

  const signOutEverywhere = () => {
    setConfirming({
      title: 'Sign out everywhere?',
      message:
        'Every session — including this one — is revoked, and pending sign-in codes are invalidated. You’ll be taken to the login page.',
      confirmLabel: 'Sign out everywhere',
      run: async () => {
        try {
          await api.post('me/sessions/revoke-all');
        } catch {
          /* still sign out locally */
        }
        void signOut({
          callbackUrl: '/login?reason=signed-out',
        } as Parameters<typeof signOut>[0]);
      },
    });
  };

  const revokeSession = (s: SessionInfo) => {
    if (s.current) {
      signOutHere();
      return;
    }
    setConfirming({
      title: 'Sign out this session?',
      message: `${deviceLine(s.browser, s.os)} will be signed out within about 30 seconds.`,
      confirmLabel: 'Sign out session',
      run: async () => {
        await api.post(`me/security/sessions/${s.id}/revoke`);
        show('Session signed out');
      },
    });
  };

  const revokeOtherSessions = () => {
    setConfirming({
      title: 'Sign out all other sessions?',
      message:
        'Every session except this one is revoked. Anyone using them will need to sign in again.',
      confirmLabel: 'Sign out others',
      run: async () => {
        await sensitive(async () => {
          await api.post('me/security/sessions/revoke-others');
          show('Other sessions signed out');
        });
      },
    });
  };

  // ---------------------------------------------------------------------
  // Trusted devices
  // ---------------------------------------------------------------------

  const revokeDevice = (d: TrustedDeviceInfo) => {
    setConfirming({
      title: `Stop trusting “${d.name}”?`,
      message: 'The next sign-in from that device will ask for your second factor again.',
      confirmLabel: 'Revoke trust',
      run: async () => {
        await api.post(`me/security/trusted-devices/${d.id}/revoke`);
        show('Trusted device revoked');
      },
    });
  };

  const revokeOtherDevices = () => {
    setConfirming({
      title: 'Revoke all other trusted devices?',
      message:
        'Every trusted device except this one is forgotten; those devices will be asked for a second factor at their next sign-in.',
      confirmLabel: 'Revoke others',
      run: async () => {
        await sensitive(async () => {
          await api.post('me/security/trusted-devices/revoke-others');
          show('Other trusted devices revoked');
        });
      },
    });
  };

  const runConfirmed = async () => {
    if (!confirming || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirming.run();
      setConfirming(null);
      await refresh().catch(() => undefined);
    } catch (err) {
      show(errMsg(err, 'That didn’t go through — try again'), 'alert');
    } finally {
      setConfirmBusy(false);
    }
  };

  const onReauthSuccess = () => {
    const run = reauthRun;
    setReauthRun(null);
    setConfirming(null);
    if (run) {
      void (async () => {
        try {
          await run();
          await refresh().catch(() => undefined);
        } catch (err) {
          show(errMsg(err, 'That didn’t go through — try again'), 'alert');
        }
      })();
    }
  };

  const currentTrusted = devices.some((d) => d.current);

  return (
    <>
      <div className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadSplit}`}>
          <div>
            <p>Active sessions</p>
            <p className={styles.note}>
              {loading
                ? 'Loading…'
                : `${sessions.length || 1} session${sessions.length === 1 ? '' : 's'} signed in`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`${styles.btn} ${styles.btnSm}`} type="button" onClick={signOutHere}>
              Sign out
            </button>
            {sessions.length > 1 && (
              <button
                className={`${styles.btn} ${styles.btnSm}`}
                type="button"
                onClick={revokeOtherSessions}
              >
                Sign out others
              </button>
            )}
            <button
              className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
              type="button"
              onClick={signOutEverywhere}
            >
              Sign out everywhere
            </button>
          </div>
        </div>
        {loading ? (
          <p className={styles.loadingRow}>Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <ul>
            <li className={styles.sessionRow}>
              <span className={`${styles.sessionIcon} ${styles.sessionIconCurrent}`}>
                <Icon name="globe" size={18} />
              </span>
              <div className={styles.stackBody}>
                <p className={styles.sessionDevice}>
                  This browser <span className={`${styles.chip} ${styles.chipOn}`}>Current</span>
                </p>
                <p className={styles.stackDesc}>
                  Signed in before session tracking began — sign in again to see full details here.
                </p>
              </div>
            </li>
          </ul>
        ) : (
          <ul>
            {sessions.map((s) => (
              <li key={s.id} className={styles.sessionRow}>
                <span
                  className={`${styles.sessionIcon}${s.current ? ` ${styles.sessionIconCurrent}` : ''}`}
                >
                  <Icon name={deviceIcon(s.deviceType)} size={18} />
                </span>
                <div className={styles.stackBody}>
                  <p className={styles.sessionDevice}>
                    {deviceLine(s.browser, s.os)}{' '}
                    {s.current && (
                      <span className={`${styles.chip} ${styles.chipOn}`}>Current</span>
                    )}
                  </p>
                  <p className={styles.stackDesc}>
                    {amrLabel(s.amr)}
                    {s.ip ? ` · ${s.ip}` : ''} · Signed in {formatRelative(s.createdAt)} · Active{' '}
                    {formatRelative(s.lastSeenAt ?? s.createdAt)} · Expires{' '}
                    {formatDateTime(s.expiresAt)}
                  </p>
                </div>
                <button className={styles.revoke} type="button" onClick={() => revokeSession(s)}>
                  {s.current ? 'Sign out' : 'Revoke'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadSplit}`}>
          <div>
            <p>Trusted devices</p>
            <p className={styles.note}>
              Devices that skip the two-factor step
              {currentTrusted ? ' · this device is trusted' : ''}
            </p>
          </div>
          {devices.length > 1 && (
            <button
              className={`${styles.btn} ${styles.btnSm}`}
              type="button"
              onClick={revokeOtherDevices}
            >
              Revoke others
            </button>
          )}
        </div>
        {loading ? (
          <p className={styles.loadingRow}>Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className={styles.sectionNote}>
            No trusted devices. When two-factor authentication is on, you can choose “remember this
            device” after a successful code — it will then skip the second step for 60 days.
          </p>
        ) : (
          <ul>
            {devices.map((d) => (
              <li key={d.id} className={styles.sessionRow}>
                <span
                  className={`${styles.sessionIcon}${d.current ? ` ${styles.sessionIconCurrent}` : ''}`}
                >
                  <Icon name="monitor" size={18} />
                </span>
                <div className={styles.stackBody}>
                  <p className={styles.sessionDevice}>
                    {d.name}{' '}
                    {d.current && (
                      <span className={`${styles.chip} ${styles.chipOn}`}>This device</span>
                    )}
                  </p>
                  <p className={styles.stackDesc}>
                    {d.ip ? `${d.ip} · ` : ''}Trusted {formatRelative(d.createdAt)} · Last used{' '}
                    {d.lastUsedAt ? formatRelative(d.lastUsedAt) : 'never'} · Expires{' '}
                    {formatDateTime(d.expiresAt)}
                  </p>
                </div>
                <button className={styles.revoke} type="button" onClick={() => revokeDevice(d)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>Security activity</div>
        {loading ? (
          <p className={styles.loadingRow}>Loading activity…</p>
        ) : events.length === 0 && recentSignIns.length === 0 ? (
          <p className={styles.sectionNote}>No security activity recorded yet.</p>
        ) : events.length === 0 ? (
          <table className={styles.table}>
            <tbody>
              {recentSignIns.map((row) => (
                <tr key={`${row.at}-${row.method}`}>
                  <td>{formatDateTime(row.at)}</td>
                  <td>Signed in with an email code</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul>
            {events.map((e) => (
              <li key={e.id} className={styles.sessionRow}>
                <span
                  className={`${styles.sessionIcon}${eventIsAlert(e.type) ? ` ${styles.sessionIconAlert}` : ''}`}
                >
                  <Icon name={eventIcon(e.type)} size={16} />
                </span>
                <div className={styles.stackBody}>
                  <p className={styles.sessionDevice}>{eventLabel(e)}</p>
                  <p className={styles.stackDesc}>
                    {formatDateTime(e.createdAt)}
                    {e.ip ? ` · ${e.ip}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          message={confirming.message}
          confirmLabel={confirmBusy ? 'Working…' : confirming.confirmLabel}
          onConfirm={() => void runConfirmed()}
          onCancel={() => {
            if (!confirmBusy) setConfirming(null);
          }}
        />
      )}

      {reauthRun && (
        <ReauthDialog
          overview={overview}
          email={email}
          onSuccess={onReauthSuccess}
          onClose={() => setReauthRun(null)}
        />
      )}
    </>
  );
}
