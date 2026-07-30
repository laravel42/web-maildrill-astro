import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import { matchesSearchQuery } from '@/lib/app/search-match';
import { tagStyle } from '@/lib/app/tag-style';
import styles from './TagFilter.module.css';

export type TagFilterOption = {
  name: string;
  /** How many items carry this tag (images, lists, subscribers, …). */
  count: number;
};

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
  /** Tags present in the data, with per-tag item counts. */
  tags: TagFilterOption[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const count = selected.size;
  const empty = tags.length === 0;

  const visible = useMemo(() => {
    const q = query.trim();
    if (!q) return tags;
    // Word/prefix match — "two" must not surface the tag "artwork".
    return tags.filter((t) => matchesSearchQuery(t.name, q));
  }, [tags, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    // Focus search once the panel mounts so typing filters immediately.
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const close = () => setOpen(false);

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
            onClick={close}
          />
          <div
            className={styles.pop}
            role="menu"
            aria-label="Filter by tags"
            style={{ animation: 'pop .14s ease' }}
          >
            <div className={styles.title}>Filter by tag</div>
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
                placeholder="Search tags…"
                aria-label="Search tags"
              />
            </label>
            <div className={styles.list}>
              {visible.length === 0 ? (
                <div className={styles.empty}>No tags match “{query.trim()}”</div>
              ) : (
                visible.map((t) => {
                  const on = selected.has(t.name);
                  const s = tagStyle(t.name);
                  return (
                    <button
                      key={t.name}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      className={styles.opt}
                      onClick={() => onToggle(t.name)}
                    >
                      <span className={`${styles.box}${on ? ` ${styles.boxOn}` : ''}`}>
                        {on && <Icon name="check" size={15} stroke={3.5} />}
                      </span>
                      <span className={styles.dot} style={{ background: s.color }} />
                      <span className={styles.name}>{t.name}</span>
                      <span className={`${styles.n} tnum`}>{t.count}</span>
                    </button>
                  );
                })
              )}
            </div>
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
