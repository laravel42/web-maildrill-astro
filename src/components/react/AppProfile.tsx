import { signOut } from 'auth-astro/client';
import Icon from './Icon';
import styles from './AppProfile.module.css';

/*
 * Profile — the signed-in account, read-only until a profile-update endpoint
 * exists. Reached from the sidebar account menu.
 */
export default function AppProfile({
  name = null,
  email = null,
  role = null,
}: {
  name?: string | null;
  email?: string | null;
  role?: string | null;
} = {}) {
  const displayName = name?.trim() || (email ? email.split('@')[0] : 'Your account');
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '—';

  const details: { k: string; v: string }[] = [
    { k: 'Name', v: displayName },
    { k: 'Email', v: email ?? '—' },
    { k: 'Role', v: roleLabel },
    { k: 'Sign-in', v: 'Magic link + 6-digit code' },
  ];

  return (
    <div className="screen screen--capped" style={{ animation: 'fade .3s ease' }}>
      <h1 className={`screen__h1 ${styles.h1}`}>Profile</h1>

      <section className={`acrd ${styles.card}`} aria-label="Your account">
        <div className={styles.id}>
          <span className={styles.avatar} aria-hidden="true">
            {initial}
          </span>
          <div>
            <div className={styles.name}>{displayName}</div>
            <div className={styles.email}>{email ?? ''}</div>
          </div>
        </div>

        <div>
          {details.map((d) => (
            <div key={d.k} className="adetail">
              <span className="adetail__k">{d.k}</span>
              <span className={`adetail__v ${styles.dv} tnum`}>{d.v}</span>
            </div>
          ))}
        </div>

        <div className={styles.foot}>
          <button type="button" className={`sbtn ${styles.logout}`} onClick={() => void signOut()}>
            <Icon name="logout" size={14} stroke={2} />
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
