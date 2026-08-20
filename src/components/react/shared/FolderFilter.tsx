import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import { matchesSearchQuery } from '@/lib/app/search-match';
import styles from './FolderFilter.module.css';

export type FolderFilterOption = {
  /** Stable folder key used for filtering. */
  key: string;
  /** Display label. */
  label: string;
  count: number;
};

/**
 * Single-select searchable folder combobox for the Media Library toolbar
 * (and upload form). "All files" / cleared selection is represented by null.
 */
export default function FolderFilter({
  options,
  value,
  onChange,
  block = false,
  disabled = false,
}: {
  options: FolderFilterOption[];
  /** Selected folder key, or null for all files / none. */
  value: string | null;
  onChange: (key: string | null) => void;
  /** Stretch the trigger to full width (upload form). */
  block?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const active = value != null;
  const activeLabel = active ? (options.find((o) => o.key === value)?.label ?? value) : null;

  // Surface an autofilled / unknown folder so it stays selectable & checked.
  const list = useMemo(() => {
    if (!value || options.some((o) => o.key === value)) return options;
    return [{ key: value, label: value, count: 0 }, ...options];
  }, [options, value]);

  const visible = useMemo(() => {
    const q = query.trim();
    if (!q) return list;
    return list.filter((o) => matchesSearchQuery(o.label, q) || matchesSearchQuery(o.key, q));
  }, [list, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const close = () => setOpen(false);
  const empty = options.length === 0 && !active;

  return (
    <div className={`${styles.wrap}${block ? ` ${styles.block}` : ''}`}>
      <button
        type="button"
        className={`${styles.btn}${active ? ` ${styles.isOn}` : ''}${block ? ` ${styles.btnBlock}` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled || empty}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="folder" size={14} />
        <span className={styles.btnLabel}>{activeLabel ?? 'Folder'}</span>
        {active && <span className={`${styles.count} tnum`}>1</span>}
        <Icon name="chevron-down" size={12} className={styles.caret} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close folder filter"
            onClick={close}
          />
          <div
            className={`${styles.pop}${block ? ` ${styles.popBlock}` : ''}`}
            role="menu"
            aria-label="Filter by folder"
            style={{ animation: 'pop .14s ease' }}
          >
            <div className={styles.title}>Filter by folder</div>
            <label className={styles.search}>
              <Icon name="search" size={14} className={styles.searchIc} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    if (query) setQuery('');
                    else close();
                  }
                }}
                placeholder="Search folders…"
                aria-label="Search folders"
              />
            </label>
            <div className={styles.list}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!active}
                className={styles.opt}
                onClick={() => {
                  onChange(null);
                  close();
                }}
              >
                <span className={`${styles.radio}${!active ? ` ${styles.radioOn}` : ''}`}>
                  {!active && <span className={styles.radioDot} />}
                </span>
                <span className={styles.name}>All files</span>
              </button>
              {visible.length === 0 ? (
                <div className={styles.empty}>No folders match “{query.trim()}”</div>
              ) : (
                visible.map((o) => {
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
                        close();
                      }}
                    >
                      <span className={`${styles.radio}${on ? ` ${styles.radioOn}` : ''}`}>
                        {on && <span className={styles.radioDot} />}
                      </span>
                      <span className={styles.name}>{o.label}</span>
                      <span className={`${styles.n} tnum`}>{o.count}</span>
                    </button>
                  );
                })
              )}
            </div>
            {active && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  onChange(null);
                  close();
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
