import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './merge-tag-menu.css';

/*
 * The merge-tag list every template editor drops into its own popover: the
 * email bubble menu (MUI), the WhatsApp studio's variable mapping (Radix) and
 * anything else that offers subscriber tokens. Only the list is shared — the
 * three live in different UI stacks with different anchoring and dismissal
 * needs, so each caller keeps its own chrome (border, shadow, width) and this
 * panel renders flush inside it.
 */

/** One pickable token. `id` only needs to be stable within a menu. */
export type MergeTagOption = {
  id: string;
  label: string;
  /** Token inserted at send time — shown as the row's second line. */
  token: string;
  /** Extra text the search box should match (e.g. a sample value). */
  keywords?: string;
};

export type MergeTagGroup = {
  title: string;
  options: MergeTagOption[];
};

export type MergeTagMenuPanelProps = {
  groups: MergeTagGroup[];
  onSelect: (option: MergeTagOption) => void;
  /**
   * Marks the current pick and reserves the check column. Menus that only
   * insert (rather than map) leave this unset so rows sit flush left.
   */
  selectedId?: string | null;
  searchable?: boolean;
  autoFocusSearch?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Caps the scrolling list; the popover may clamp it further. */
  maxHeight?: number | string;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="md-tag-menu-search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function matches(option: MergeTagOption, query: string): boolean {
  return `${option.label} ${option.token} ${option.keywords ?? ''}`.toLowerCase().includes(query);
}

export default function MergeTagMenuPanel({
  groups,
  onSelect,
  selectedId,
  searchable = false,
  autoFocusSearch = false,
  searchPlaceholder = 'Search fields…',
  emptyLabel = 'No fields match.',
  maxHeight,
}: MergeTagMenuPanelProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchable || !autoFocusSearch) return;
    // A frame late: popovers move focus themselves as they open.
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [searchable, autoFocusSearch]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({ ...group, options: group.options.filter((o) => matches(o, q)) }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const selectable = selectedId !== undefined;

  return (
    <div className="md-tag-menu">
      {searchable && (
        <div className="md-tag-menu-search">
          <div className="md-tag-menu-search-field">
            <SearchIcon />
            <input
              ref={searchRef}
              type="text"
              className="md-tag-menu-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      )}

      <div
        className="md-tag-menu-list"
        style={
          maxHeight === undefined
            ? undefined
            : ({
                '--md-tag-menu-max-height':
                  typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
              } as CSSProperties)
        }
      >
        {visible.length === 0 ? (
          <p className="md-tag-menu-empty">{emptyLabel}</p>
        ) : (
          visible.map((group) => (
            <div key={group.title}>
              <div className="md-tag-menu-header">{group.title}</div>
              {group.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="md-tag-menu-item"
                  data-selected={selectedId === option.id ? '' : undefined}
                  // Rows insert at the caret the editor already has; taking
                  // focus on press would collapse that selection first.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  {selectable && (
                    <span className="md-tag-menu-check" aria-hidden="true">
                      {selectedId === option.id ? <CheckIcon /> : null}
                    </span>
                  )}
                  <span className="md-tag-menu-text">
                    <span className="md-tag-menu-label">{option.label}</span>
                    <span className="md-tag-menu-token">{option.token}</span>
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
