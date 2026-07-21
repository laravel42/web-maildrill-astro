import { useState } from 'react';
import Icon from '../Icon';
import { tagStyle } from '@/lib/app/tag-style';
import styles from './TagFilter.module.css';

/**
 * Multi-select "Tags" filter dropdown shared by the subscribers, lists, and
 * media screens so the control reads identically everywhere. The parent owns the
 * selected set and the filtering; this only surfaces the available tags and
 * toggles them. When no tags exist yet the button is disabled.
 */
export default function TagFilter({
  tags,
  selected,
  onToggle,
  onClear,
}: {
  /** All tags present in the data, already de-duplicated. */
  tags: string[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  const empty = tags.length === 0;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.btn}${count ? ` ${styles.isOn}` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={empty}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="filter" size={14} />
        Tags
        {count > 0 && <span className={`${styles.count} tnum`}>{count}</span>}
        <Icon name="chevron-down" size={12} className={styles.caret} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close tags filter"
            onClick={() => setOpen(false)}
          />
          <div className={styles.pop} role="menu" aria-label="Filter by tags" style={{ animation: 'pop .14s ease' }}>
            <div className={styles.title}>Filter by tag</div>
            {tags.map((t) => {
              const on = selected.has(t);
              const s = tagStyle(t);
              return (
                <button
                  key={t}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={styles.opt}
                  onClick={() => onToggle(t)}
                >
                  <span className={`${styles.box}${on ? ` ${styles.boxOn}` : ''}`}>
                    {on && <Icon name="check" size={15} stroke={3.5} />}
                  </span>
                  <span className={styles.dot} style={{ background: s.color }} />
                  <span className={styles.name}>{t}</span>
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
