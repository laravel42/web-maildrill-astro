import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import TimeAgo from './shared/TimeAgo';
import ConfirmDialog from './shared/ConfirmDialog';
import { useToast } from './shared/useToast';
import { routes } from '@/config/routes';
import { ApiError } from '@/lib/app/api';
import {
  landingsApi,
  landingStatus,
  landingStatusChipClass,
  formatBytes,
  LANDING_STATUS_LABEL,
  LANDING_STATUS_FILTERS,
  LANDING_SIZE_WARNING_BYTES,
  type LandingStatus,
  type LandingSummary,
} from '@/lib/app/landings';
import styles from './AppLandings.module.css';

const PAGE_SIZE = 25;

type SortKey = 'name' | 'updatedAt' | 'createdAt' | 'publishedAt';

/**
 * Landings list. Each row is one whole Builder42 site, so the columns are the
 * ones that matter for getting it live — status against the published copy, the
 * public URL, how many pages it holds, and its document weight (which is what
 * decides whether publishing will succeed) — not campaign metrics, which an
 * unpublished landing does not have.
 */
export default function AppLandings({
  initial,
  initialTotal = 0,
}: {
  /** SSR-loaded first page. `undefined` means the backend was unreachable. */
  initial?: LandingSummary[];
  initialTotal?: number;
}) {
  const [rows, setRows] = useState<LandingSummary[]>(initial ?? []);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState<LandingStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'updatedAt',
    dir: 'desc',
  });
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(initial === undefined);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LandingSummary | null>(null);
  const [renaming, setRenaming] = useState<LandingSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast, tone, show } = useToast();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const result = await landingsApi.list({
        q: query.trim() || undefined,
        status: status === 'all' ? undefined : status,
        sort: sort.key,
        dir: sort.dir,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(result.items);
      setTotal(result.total);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setBusy(false);
    }
  }, [query, status, sort, page]);

  // Debounced: typing in the search box must not fire a request per keystroke.
  // The SSR-provided first page is authoritative until a filter actually moves,
  // so the initial mount does not immediately re-request what it already has.
  const firstRender = useRef(true);
  useEffect(() => {
    if (
      firstRender.current &&
      status === 'all' &&
      !query &&
      page === 0 &&
      sort.key === 'updatedAt' &&
      sort.dir === 'desc' &&
      initial
    ) {
      firstRender.current = false;
      return;
    }
    firstRender.current = false;
    const timer = window.setTimeout(() => void refresh(), 220);
    return () => window.clearTimeout(timer);
  }, [refresh, status, query, page, sort, initial]);

  useEffect(() => {
    if (!menuFor) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuFor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const create = async () => {
    setCreating(true);
    try {
      const created = await landingsApi.create({ name: 'Untitled landing' });
      window.location.href = routes.app.landingBuilder(created.id);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not create the landing.', 'alert');
      setCreating(false);
    }
  };

  const duplicate = async (row: LandingSummary) => {
    setMenuFor(null);
    try {
      const copy = await landingsApi.duplicate(row.id);
      show(`Duplicated as “${copy.name}”.`);
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'That did not work.', 'alert');
    }
  };

  const rename = async () => {
    if (!renaming) return;
    const target = renaming;
    const name = renameValue.trim();
    setRenaming(null);
    if (!name || name === target.name) return;
    try {
      await landingsApi.update(target.id, { name });
      show('Renamed.');
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not rename it.', 'alert');
    }
  };

  const destroy = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await landingsApi.remove(target.id);
      show(`“${target.name}” deleted.`);
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete it.', 'alert');
    }
  };

  const copyUrl = async (row: LandingSummary) => {
    if (!row.publishedUrl) return;
    setMenuFor(null);
    try {
      await navigator.clipboard.writeText(row.publishedUrl);
      show('Public URL copied.');
    } catch {
      show('Could not copy the URL.', 'alert');
    }
  };

  const toggleSort = (key: SortKey) => {
    setPage(0);
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  };

  const sortLabel = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const empty = !busy && rows.length === 0;
  const visible = useMemo(() => rows, [rows]);

  return (
    <div className="screen screen--capped">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Landings</h1>
          <p className="screen__sub">
            Standalone sites you build visually — a landing can hold several pages.
          </p>
        </div>
        <button type="button" className="pbtn" onClick={() => void create()} disabled={creating}>
          <Icon name="plus" size={15} />
          {creating ? 'Creating…' : 'Create landing'}
        </button>
      </div>

      {loadFailed ? (
        <div className={styles.banner} role="status">
          Couldn’t reach the landings service.{' '}
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className={`atable ${styles.table}`}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Icon name="search" size={15} className={styles.searchic} />
            <input
              type="search"
              value={query}
              placeholder="Search landings"
              aria-label="Search landings"
              onChange={(e) => {
                setPage(0);
                setQuery(e.target.value);
              }}
            />
          </div>
          <div className="aseg" role="tablist" aria-label="Filter by status">
            {LANDING_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={status === filter.value}
                className={`aseg__opt ${status === filter.value ? 'is-active' : ''}`}
                onClick={() => {
                  setPage(0);
                  setStatus(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`athead ${styles.grid}`}>
          <button type="button" className={styles.sortBtn} onClick={() => toggleSort('name')}>
            Name{sortLabel('name')}
          </button>
          <div className={styles.colCenter}>Status</div>
          <div>Public URL</div>
          <div className={styles.numeric}>Pages</div>
          <div className={styles.numeric}>Size</div>
          <button
            type="button"
            className={`${styles.sortBtn} ${styles.colCenter}`}
            onClick={() => toggleSort('updatedAt')}
          >
            Updated{sortLabel('updatedAt')}
          </button>
          <div />
        </div>

        {empty ? (
          <div className="atable__empty">
            {query || status !== 'all' ? (
              <>No landings match that filter.</>
            ) : (
              <div className={styles.emptyState}>
                <Icon name="landing" size={26} />
                <p className={styles.emptyTitle}>No landings yet</p>
                <p className={styles.emptyBody}>
                  Build a page to send campaign traffic to — a launch announcement, a signup form, a
                  simple site for an event.
                </p>
                <button type="button" className="pbtn" onClick={() => void create()}>
                  <Icon name="plus" size={15} />
                  Create your first landing
                </button>
              </div>
            )}
          </div>
        ) : (
          visible.map((row) => {
            const state = landingStatus(row);
            const heavy = row.documentBytes > LANDING_SIZE_WARNING_BYTES;
            const href = routes.app.landingBuilder(row.id);
            return (
              <div
                key={row.id}
                className={`atrow ${styles.grid}${menuFor === row.id ? ` ${styles.rowOpen}` : ''}`}
                role="link"
                tabIndex={0}
                onClick={() => {
                  window.location.href = href;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') window.location.href = href;
                }}
              >
                <div className={styles.nameCell}>
                  <span className={styles.name}>{row.name}</span>
                  {row.siteId ? <span className={styles.slug}>{row.siteId}</span> : null}
                </div>
                <div className={styles.colCenter}>
                  <span className={`astatus ${landingStatusChipClass(state)}`}>
                    {LANDING_STATUS_LABEL[state]}
                  </span>
                </div>
                <div className={styles.urlCell} onClick={(e) => e.stopPropagation()}>
                  {row.publishedUrl ? (
                    <a
                      className={styles.url}
                      href={row.publishedUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {row.publishedUrl.replace(/^https?:\/\//, '')}
                      <Icon name="arrow-up-right" size={12} />
                    </a>
                  ) : (
                    <span className={styles.muted}>Not published</span>
                  )}
                </div>
                <div className={`${styles.numeric} tnum`}>{row.pageCount}</div>
                <div className={`${styles.numeric} tnum ${heavy ? styles.heavy : styles.muted}`}>
                  <span
                    title={
                      heavy
                        ? 'Large documents can fail to publish — images are stored inside the document.'
                        : undefined
                    }
                  >
                    {formatBytes(row.documentBytes)}
                  </span>
                </div>
                <div className={`${styles.muted} ${styles.colCenter}`}>
                  <TimeAgo at={row.updatedAt} />
                </div>
                <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="kbtn"
                    aria-label={`More actions for ${row.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === row.id}
                    onClick={() => setMenuFor(menuFor === row.id ? null : row.id)}
                  >
                    <Icon name="more" size={16} />
                  </button>
                  {menuFor === row.id ? (
                    <div className={styles.menu} role="menu" ref={menuRef}>
                      <a role="menuitem" href={href}>
                        <Icon name="landing" size={14} /> Open in builder
                      </a>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          setRenameValue(row.name);
                          setRenaming(row);
                        }}
                      >
                        <Icon name="edit" size={14} /> Rename
                      </button>
                      <button type="button" role="menuitem" onClick={() => void duplicate(row)}>
                        <Icon name="copy" size={14} /> Duplicate
                      </button>
                      {row.publishedUrl ? (
                        <button type="button" role="menuitem" onClick={() => void copyUrl(row)}>
                          <Icon name="globe" size={14} /> Copy public URL
                        </button>
                      ) : null}
                      {/* Publishing is not wired yet; shown disabled so the
                          capability is discoverable instead of missing. */}
                      <button
                        type="button"
                        role="menuitem"
                        disabled
                        title="Publishing isn’t available yet."
                      >
                        <Icon name="send" size={14} /> Publish
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.danger}
                        onClick={() => {
                          setMenuFor(null);
                          setConfirmDelete(row);
                        }}
                      >
                        <Icon name="trash" size={14} /> Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {total > PAGE_SIZE ? (
          <div className="atable__foot">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <span className={styles.pager}>
              <button
                type="button"
                className="sbtn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="sbtn"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </span>
          </div>
        ) : null}
      </div>

      {renaming ? (
        <ConfirmDialog
          title={`Rename “${renaming.name}”`}
          message="This is the workspace name — it doesn’t change a published URL."
          confirmLabel="Rename"
          tone="default"
          onConfirm={() => void rename()}
          onCancel={() => setRenaming(null)}
        >
          <label className={styles.renameField}>
            <span>Name</span>
            <input
              type="text"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </label>
        </ConfirmDialog>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete “${confirmDelete.name}”?`}
          message="The site and all of its pages go with it. This can’t be undone."
          confirmLabel="Delete"
          onConfirm={() => void destroy()}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}

      {toast ? (
        <div
          className={`${styles.toast} ${tone === 'alert' ? styles.toastAlert : ''}`}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
