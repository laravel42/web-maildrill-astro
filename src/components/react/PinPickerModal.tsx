import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/app/api';
import { CHANNEL } from './shared/channels';
import { ChannelPill } from './shared/CampaignPills';
import { visiblePageNumbers } from './shared/pagination';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import styles from './PinPickerModal.module.css';

export type PinKind = 'list' | 'campaign' | 'template' | 'subscriber';

/** A record kept in the sidebar's PINNED section. */
export type Pin = {
  kind: PinKind;
  id: string;
  label: string;
  /** Dot colour — list colour, or channel accent for campaigns/templates. */
  color: string;
  /** Channel for campaigns/templates; omitted for lists/subscribers. */
  channel?: ChannelType;
  /** Extra haystack for picker search (e.g. subscriber email). */
  searchText?: string;
  /** Member count for lists — picker badge only. */
  count?: number;
};

const DEFAULT_PIN_COLOR = 'var(--accent)';
const PAGE_SIZE = 8;

const KINDS: { id: PinKind; label: string; plural: string; search: string }[] = [
  { id: 'list', label: 'Lists', plural: 'lists', search: 'Search lists…' },
  { id: 'campaign', label: 'Campaigns', plural: 'campaigns', search: 'Search campaigns…' },
  { id: 'template', label: 'Templates', plural: 'templates', search: 'Search templates…' },
  { id: 'subscriber', label: 'Subscribers', plural: 'subscribers', search: 'Search subscribers…' },
];

const EMPTY_QUERIES: Record<PinKind, string> = {
  list: '',
  campaign: '',
  template: '',
  subscriber: '',
};

const pinKey = (p: Pick<Pin, 'kind' | 'id'>) => `${p.kind}:${p.id}`;

type Props = {
  pinned: Pin[];
  /** Called with the selected records when the user confirms. */
  onPin: (pins: Pin[]) => void;
  onClose: () => void;
};

export default function PinPickerModal({ pinned, onPin, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<PinKind>('list');
  const [page, setPage] = useState(1);
  const [queries, setQueries] = useState<Record<PinKind, string>>(EMPTY_QUERIES);
  /** null = loading */
  const [items, setItems] = useState<Pin[] | null>(null);
  /** Selected pins keyed by kind:id — survives tab/page changes. */
  const [selected, setSelected] = useState<Map<string, Pin>>(() => new Map());

  const query = queries[kind];
  const kindMeta = KINDS.find((k) => k.id === kind)!;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [lists, campaigns, templates, subscribers] = await Promise.all([
          api.get<{
            data: Array<{
              id: string;
              name: string;
              color?: string | null;
              memberCount?: number | null;
            }>;
          }>('lists'),
          api.get<{
            data: Array<{
              id: string;
              name: string;
              channel?: string | null;
              status?: string | null;
            }>;
          }>('campaigns'),
          api.get<{
            data: Array<{ id: string; name: string; channel?: string | null }>;
          }>('templates'),
          api.get<{
            data: Array<{ id: string; name?: string | null; email: string }>;
          }>('subscribers?limit=200'),
        ]);
        if (cancelled) return;
        const next: Pin[] = [
          ...(lists.data ?? []).map((l) => ({
            kind: 'list' as const,
            id: l.id,
            label: l.name,
            color: l.color || DEFAULT_PIN_COLOR,
            count: l.memberCount ?? 0,
          })),
          ...(campaigns.data ?? [])
            .filter((c) => c.status === 'sent')
            .map((c) => {
              const channel = (c.channel ?? 'email') as ChannelType;
              return {
                kind: 'campaign' as const,
                id: c.id,
                label: c.name,
                channel,
                color: CHANNEL[channel]?.color ?? DEFAULT_PIN_COLOR,
              };
            }),
          ...(templates.data ?? []).map((t) => {
            const channel = (t.channel ?? 'email') as ChannelType;
            return {
              kind: 'template' as const,
              id: t.id,
              label: t.name,
              channel,
              color: CHANNEL[channel]?.color ?? DEFAULT_PIN_COLOR,
            };
          }),
          ...(subscribers.data ?? []).map((s) => {
            const name = s.name?.trim() || '';
            return {
              kind: 'subscriber' as const,
              id: s.id,
              label: name || s.email,
              searchText: s.email,
              color: DEFAULT_PIN_COLOR,
            };
          }),
        ];
        setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-check anything already in the sidebar once the catalog loads.
  useEffect(() => {
    if (items == null) return;
    const pinnedKeySet = new Set(pinned.map((p) => pinKey(p)));
    setSelected(
      new Map(items.filter((p) => pinnedKeySet.has(pinKey(p))).map((p) => [pinKey(p), p])),
    );
  }, [items, pinned]);

  const counts = useMemo(() => {
    const c: Record<PinKind, number> = {
      list: 0,
      campaign: 0,
      template: 0,
      subscriber: 0,
    };
    if (!items) return c;
    for (const p of items) c[p.kind] += 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (p.kind !== kind) return false;
      if (!q) return true;
      const hay = `${p.label} ${p.searchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, kind, query]);

  const total = filtered?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered?.slice(start, start + PAGE_SIZE) ?? [];
  const startIdx = total === 0 ? 0 : start + 1;
  const endIdx = Math.min(start + PAGE_SIZE, total);

  const selectKind = (next: PinKind) => {
    setKind(next);
    setPage(1);
  };

  const setQuery = (value: string) => {
    setQueries((prev) => ({ ...prev, [kind]: value }));
    setPage(1);
  };

  const toggle = (p: Pin) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = pinKey(p);
      if (next.has(key)) next.delete(key);
      else next.set(key, p);
      return next;
    });
  };

  const stripPin = ({ kind: k, id, label, color, channel }: Pin): Pin => ({
    kind: k,
    id,
    label,
    color,
    ...(channel ? { channel } : {}),
  });

  const confirm = () => {
    const catalogKeys = new Set((items ?? []).map((p) => pinKey(p)));
    // Keep any pins the catalog didn't load (e.g. beyond the subscriber page).
    const outside = pinned.filter((p) => !catalogKeys.has(pinKey(p))).map(stripPin);
    const chosenKeys = new Set(selected.keys());
    // Preserve existing pin order, then append newly selected.
    const ordered: Pin[] = [];
    for (const p of pinned) {
      const key = pinKey(p);
      if (!chosenKeys.has(key)) continue;
      const fresh = selected.get(key);
      if (fresh) ordered.push(stripPin(fresh));
      chosenKeys.delete(key);
    }
    for (const p of selected.values()) {
      if (chosenKeys.has(pinKey(p))) ordered.push(stripPin(p));
    }
    onPin([...outside, ...ordered]);
  };

  const rowMeta = (p: Pin): ReactNode => {
    if (p.kind === 'list') {
      return <span className={`${styles.countBadge} tnum`}>{p.count ?? 0}</span>;
    }
    if ((p.kind === 'campaign' || p.kind === 'template') && p.channel) {
      return <ChannelPill channel={p.channel} />;
    }
    if (p.kind === 'subscriber' && p.searchText && p.searchText !== p.label) {
      return <span className={`${styles.emailBadge} tnum`}>{p.searchText}</span>;
    }
    return null;
  };

  const emptyMessage = () => {
    const kindTotal = items?.filter((p) => p.kind === kind).length ?? 0;
    if (kindTotal === 0) return `No ${kindMeta.plural} yet.`;
    if (query.trim()) return `No ${kindMeta.plural} match “${query.trim()}”.`;
    return `No ${kindMeta.plural} yet.`;
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      style={{ animation: 'ovfade 0.16s var(--ease-out)' }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-picker-title"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'pop 0.16s var(--ease-out)' }}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id="pin-picker-title" className={styles.title}>
              Pin records
            </h2>
            <p className={styles.sub}>
              Keep lists, campaigns, templates, or subscribers in the sidebar for quick access.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="x" size={16} stroke={2.2} />
          </button>
        </header>

        <div className={styles.toolbar} role="tablist" aria-label="Record type">
          <div className={`aseg ${styles.kindSeg}`}>
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                className={`${styles.kindOpt} aseg__opt${kind === k.id ? ' is-active' : ''}`}
                onClick={() => selectKind(k.id)}
              >
                <span>{k.label}</span>
                <span className={`tnum ${styles.kindCount}`}>{counts[k.id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.search}>
          <Icon name="search" size={15} className={styles.searchIc} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder={kindMeta.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={kindMeta.search}
          />
          {query && (
            <button
              type="button"
              className={styles.searchClear}
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <Icon name="x" size={13} stroke={2.3} />
            </button>
          )}
        </div>

        <div className={`atable ${styles.table}`}>
          <div className={styles.body}>
            {filtered == null ? (
              <div className="atable__empty">Loading…</div>
            ) : pageItems.length === 0 ? (
              <div className="atable__empty">{emptyMessage()}</div>
            ) : (
              pageItems.map((p) => {
                const key = pinKey(p);
                const on = selected.has(key);
                const meta = rowMeta(p);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.row} atrow${on ? ` ${styles.rowOn}` : ''}`}
                    onClick={() => toggle(p)}
                    aria-pressed={on}
                  >
                    <span className={styles.check} aria-hidden="true">
                      <span className={`${styles.box}${on ? ' is-on' : ''}`}>
                        {on && <Icon name="check" size={12} stroke={3.5} />}
                      </span>
                    </span>
                    <span className={styles.name}>
                      <span
                        className={styles.dot}
                        style={{ background: p.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.label}>{p.label}</span>
                    </span>
                    <span className={styles.meta}>{meta}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className={`atable__foot ${styles.foot}`}>
            <span className={total === 0 ? undefined : 'tnum'}>
              {filtered == null
                ? 'Loading…'
                : total === 0
                  ? 'Nothing to pin in this view'
                  : `${startIdx}–${endIdx} of ${total}`}
            </span>
            {pageCount > 1 && (
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pg}
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <Icon name="chevron-right" size={15} className={styles.pgflip} />
                </button>
                {pagerPages.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.pgn} tnum${n === safePage ? ' is-on' : ''}`}
                    aria-current={n === safePage ? 'page' : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.pg}
                  disabled={safePage === pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  aria-label="Next page"
                >
                  <Icon name="chevron-right" size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className="sbtn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="pbtn" onClick={confirm}>
            Pin selected
          </button>
        </div>
      </div>
    </div>
  );
}
