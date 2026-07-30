import type { IconName } from '@/lib/icons';
import Icon from '../Icon';
import styles from './ColFilter.module.css';

/**
 * Multi-select column filter dropdown — same control Templates uses for Category,
 * Opens, and Clicks. Parent owns selection state and which dropdown is open so
 * only one panel shows at a time across a toolbar row.
 */
export default function ColFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
  open,
  onOpenToggle,
  icon,
}: {
  label: string;
  options: readonly string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
  open: boolean;
  onOpenToggle: () => void;
  /** Optional leading icon (e.g. Media Orientation / Ratio). */
  icon?: IconName;
}) {
  const count = selected.size;
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.btn}${count ? ` ${styles.btnOn}` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onOpenToggle}
      >
        {icon && <Icon name={icon} size={14} />}
        {label}
        {count > 0 && <span className={`${styles.count} tnum`}>{count}</span>}
        <Icon
          name="chevron-down"
          size={12}
          className={`${styles.caret}${open ? ` ${styles.caretOpen}` : ''}`}
        />
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close filter"
            onClick={onOpenToggle}
          />
          <div
            className={styles.pop}
            role="menu"
            aria-label={label}
            style={{ animation: 'pop .14s ease' }}
          >
            {options.map((o) => {
              const on = selected.has(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={styles.opt}
                  onClick={() => onToggle(o)}
                >
                  <span className={`${styles.box}${on ? ` ${styles.boxOn}` : ''}`}>
                    {on && <Icon name="check" size={15} stroke={3.5} />}
                  </span>
                  {o}
                </button>
              );
            })}
            {count > 0 && (
              <button type="button" className={styles.clear} onClick={onClear}>
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
