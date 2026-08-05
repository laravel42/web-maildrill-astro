import type { ReactNode } from 'react';
import { colorFor, initials, type Pill as PillT } from '@/lib/app/admin-data';
import styles from '../AppAdmin.module.css';

export function Pill({ p, children }: { p: PillT; children?: ReactNode }) {
  return (
    <span className={styles.pill} style={{ color: p.fg, background: p.bg }}>
      {p.dot && <span className={styles.pillDot} style={{ background: p.dot }} />}
      {children ?? p.label}
    </span>
  );
}

export function Tag({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span className={styles.tag} style={{ color: fg, background: bg }}>
      {label}
    </span>
  );
}

export function Avatar({
  name,
  size = 32,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <span
      className={styles.tblAvatar}
      style={{
        width: size,
        height: size,
        borderRadius: size >= 32 ? 9 : 8,
        fontSize: size >= 32 ? 12 : 10.5,
        background: color ?? colorFor(name),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`${styles.toggle}${on ? ` ${styles.toggleOn}` : ''}`}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

export function Bar({
  pct,
  color,
  width,
}: {
  pct: number;
  color: string;
  width?: number | string;
}) {
  return (
    <div className={styles.bar} style={{ width, maxWidth: width == null ? undefined : width }}>
      <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
