import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import styles from './SearchableSelect.module.css';

/**
 * Typeahead select for lists too long to scroll (timezones, currencies…).
 * Same trigger + role="listbox" pattern as PhoneField's country picker rather
 * than a native <select>, so the search box and the option rows can share the
 * app's styling. Keyboard: type to filter, ↑/↓ to move, Enter to pick, Esc to
 * close.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Secondary text shown right-aligned (e.g. a UTC offset). */
  hint?: string;
  /** Extra text matched by the search box but never displayed. */
  keywords?: string;
};

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Search…',
  emptyMessage = 'No matches',
}: {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  /*
   * Opening starts from the current selection, not the top of a 400-row list.
   * Keyed on `open` alone on purpose: `matches` is read once at that moment,
   * and re-running as the user types would fight the arrow-key highlight.
   */
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const index = matchesRef.current.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : 0);
    inputRef.current?.focus();
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: 'nearest',
    });
  }, [active, open]);

  const commit = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        if (matches.length === 0) return 0;
        return (next + matches.length) % matches.length;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const option = matches[active];
      if (option) commit(option);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        id={id}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.triggerLabel}>{selected?.label ?? 'Select…'}</span>
        {selected?.hint && <span className={styles.triggerHint}>{selected.hint}</span>}
        <Icon name="more" size={14} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.searchRow}>
            <Icon name="search" size={14} className={styles.searchIcon} />
            <input
              ref={inputRef}
              className={styles.search}
              value={query}
              placeholder={placeholder}
              aria-label={placeholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          {matches.length === 0 ? (
            <p className={styles.empty}>{emptyMessage}</p>
          ) : (
            <ul className={styles.list} role="listbox" ref={listRef}>
              {matches.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-active={i === active}
                      className={`${styles.option}${i === active ? ` ${styles.optionActive}` : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(o)}
                    >
                      <span className={styles.optionLabel}>{o.label}</span>
                      {o.hint && <span className={styles.optionHint}>{o.hint}</span>}
                      {isSelected && <Icon name="check" size={13} stroke={3} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
