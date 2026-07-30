import { useState } from 'react';
import Icon from '../Icon';
import styles from './FolderFilter.module.css';

export type FolderFilterOption = {
  /** Stable folder key used for filtering. */
  key: string;
  /** Display label. */
  label: string;
  count: number;
};

/**
 * Single-select folder filter dropdown for the Media Library toolbar.
 * "All files" is represented by a cleared selection (no key).
 */
export default function FolderFilter({
  options,
  value,
  onChange,
}: {
  options: FolderFilterOption[];
  /** Selected folder key, or null for all files. */
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value != null;
  const activeLabel = active ? (options.find((o) => o.key === value)?.label ?? value) : null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.btn}${active ? ` ${styles.isOn}` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={options.length === 0}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="folder" size={14} />
        {activeLabel ?? 'Folder'}
        {active && <span className={`${styles.count} tnum`}>1</span>}
        <Icon name="chevron-down" size={12} className={styles.caret} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close folder filter"
            onClick={() => setOpen(false)}
          />
          <div
            className={styles.pop}
            role="menu"
            aria-label="Filter by folder"
            style={{ animation: 'pop .14s ease' }}
          >
            <div className={styles.title}>Filter by folder</div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!active}
              className={styles.opt}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span className={`${styles.radio}${!active ? ` ${styles.radioOn}` : ''}`}>
                {!active && <span className={styles.radioDot} />}
              </span>
              <span className={styles.name}>All files</span>
            </button>
            {options.map((o) => {
              const on = value === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className={styles.opt}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                >
                  <span className={`${styles.radio}${on ? ` ${styles.radioOn}` : ''}`}>
                    {on && <span className={styles.radioDot} />}
                  </span>
                  <span className={styles.name}>{o.label}</span>
                  <span className={`${styles.n} tnum`}>{o.count}</span>
                </button>
              );
            })}
            {active && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
