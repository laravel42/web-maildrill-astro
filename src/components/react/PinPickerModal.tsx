import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/app/api';
import { CHANNEL } from './shared/channels';
import { visiblePageNumbers } from './shared/pagination';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import styles from './PinPickerModal.module.css';

export type PinKind = 'list' | 'campaign' | 'template';

/** A record kept in the sidebar's PINNED section. */
export type Pin = {
  kind: PinKind;
  id: string;
  label: string;
  /** Dot colour — list colour, or channel accent for campaigns/templates. */
  color: string;
  /** Channel for campaigns/templates; omitted for lists. */
  channel?: ChannelType;
};

const DEFAULT_PIN_COLOR = 'var(--accent)';
const PAGE_SIZE = 8;

const KINDS: { id: PinKind; label: string }[] = [
  { id: 'list', label: 'Lists' },
  { id: 'campaign', label: 'Campaigns' },
  { id: 'template', label: 'Templates' },
];

type Props = {
  pinned: Pin[];
  onPin: (pin: Pin) => void;
  onClose: () => void;
};

export default function PinPickerModal({ pinned, onPin, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<PinKind>('list');
  const [page, setPage] = useState(1);
  /** null = loading */
  const [items, setItems] = useState<Pin[] | null>(null);

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
        const [lists, campaigns, templates] = await Promise.all([
          api.get<{ data: Array<{ id: string; name: string; color?: string | null }> }>('lists'),
          api.get<{ data: Array<{ id: string; name: string; channel?: string | null }> }>(
            'campaigns',
          ),
          api.get<{
            data: Array<{ id: string; name: string; channel?: string | null }>;
          }>('templates'),
        ]);
        if (cancelled) return;
        const next: Pin[] = [
          ...(lists.data ?? []).map((l) => ({
            kind: 'list' as const,
            id: l.id,
            label: l.name,
            color: l.color || DEFAULT_PIN_COLOR,
          })),
          ...(campaigns.data ?? []).map((c) => {
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

  const pinnedKeys = useMemo(
    () => new Set(pinned.map((p) => `${p.kind}:${p.id}`)),
    [pinned],
  );

  const available = useMemo(() => {
    if (items == null) return null;
    return items.filter((p) => !pinnedKeys.has(`${p.kind}:${p.id}`));
  }, [items, pinnedKeys]);

  const counts = useMemo(() => {
    const c: Record<PinKind, number> = { list: 0, campaign: 0, template: 0 };
    if (!available) return c;
    for (const p of available) c[p.kind] += 1;
    return c;
  }, [available]);

  const filtered = useMemo(() => {
    if (!available) return null;
    return available.filter((p) => p.kind === kind);
  }, [available, kind]);

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
              Pin a record
            </h2>
            <p className={styles.sub}>
              Keep a list, campaign, or template in the sidebar for quick access.
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
          <div className="aseg">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                className={`aseg__opt${kind === k.id ? ' is-active' : ''}`}
                onClick={() => selectKind(k.id)}
              >
                {k.label}
                <span className={`tnum ${styles.kindCount}`}>{counts[k.id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`atable ${styles.table}`}>
          <div className={`${styles.thead} athead`} aria-hidden="true">
            <div>Name</div>
            <div />
          </div>

          {filtered == null ? (
            <div className="atable__empty">Loading…</div>
          ) : pageItems.length === 0 ? (
            <div className="atable__empty">
              {total === 0 && available != null && available.length === 0
                ? 'Everything is pinned.'
                : `No ${kind === 'list' ? 'lists' : kind === 'campaign' ? 'campaigns' : 'templates'} left to pin.`}
            </div>
          ) : (
            pageItems.map((p) => (
              <button
                key={`${p.kind}:${p.id}`}
                type="button"
                className={`${styles.row} atrow`}
                onClick={() => onPin(p)}
              >
                <span className={styles.name}>
                  <span className={styles.dot} style={{ background: p.color }} aria-hidden="true" />
                  <span className={styles.label}>{p.label}</span>
                </span>
                <span className={styles.action}>
                  Pin
                  <Icon name="plus" size={13} stroke={2.3} />
                </span>
              </button>
            ))
          )}

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
      </div>
    </div>
  );
}
