import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import TimeAgo from './shared/TimeAgo';
import ConfirmDialog from './shared/ConfirmDialog';
import { useToast } from './shared/useToast';
import { routes } from '@/config/routes';
import { ApiError } from '@/lib/app/api';
import {
  automationsApi,
  statusChipClass,
  STATUS_LABEL,
  type AutomationStatus,
  type AutomationSummary,
} from '@/lib/app/automations';
import styles from './AppAutomations.module.css';

const STATUS_FILTERS: { value: AutomationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

const PAGE_SIZE = 25;

export default function AppAutomations({
  initial,
  initialTotal = 0,
}: {
  /** SSR-loaded first page. `undefined` means the backend was unreachable. */
  initial?: AutomationSummary[];
  initialTotal?: number;
}) {
  const [rows, setRows] = useState<AutomationSummary[]>(initial ?? []);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState<AutomationStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(initial === undefined);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AutomationSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast, tone, show } = useToast();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const result = await automationsApi.list({
        q: query.trim() || undefined,
        status: status === 'all' ? undefined : status,
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
  }, [query, status, page]);

  // Debounced: typing in the search box must not fire a request per keystroke.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current && status === 'all' && !query && page === 0 && initial) {
      firstRender.current = false;
      return;
    }
    firstRender.current = false;
    const timer = window.setTimeout(() => void refresh(), 220);
    return () => window.clearTimeout(timer);
  }, [refresh, status, query, page, initial]);

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
      const created = await automationsApi.create({ name: 'Untitled automation' });
      window.location.href = routes.app.automation(created.id);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not create the automation.', 'alert');
      setCreating(false);
    }
  };

  const act = async (
    row: AutomationSummary,
    action: 'pause' | 'activate' | 'duplicate' | 'archive',
  ) => {
    setMenuFor(null);
    try {
      if (action === 'duplicate') {
        const copy = await automationsApi.duplicate(row.id);
        show(`Duplicated as “${copy.name}”.`);
      } else {
        await automationsApi[action](row.id);
        show(
          action === 'pause'
            ? `“${row.name}” paused.`
            : action === 'activate'
              ? `“${row.name}” is live.`
              : `“${row.name}” archived.`,
        );
      }
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'That did not work.', 'alert');
    }
  };

  const destroy = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await automationsApi.remove(target.id);
      show(`“${target.name}” deleted.`);
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not delete it.', 'alert');
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const empty = !busy && rows.length === 0;
  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="screen screen--capped">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Automations</h1>
          <p className="screen__sub">
            Workflows that run themselves — a trigger, then whatever should happen next.
          </p>
        </div>
        <button type="button" className="pbtn" onClick={() => void create()} disabled={creating}>
          <Icon name="plus" size={15} />
          {creating ? 'Creating…' : 'New automation'}
        </button>
      </div>

      {loadFailed ? (
        <div className={styles.banner} role="status">
          Couldn’t reach the automations service.{' '}
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
              placeholder="Search automations"
              aria-label="Search automations"
              onChange={(e) => {
                setPage(0);
                setQuery(e.target.value);
              }}
            />
          </div>
          <div className="aseg" role="tablist" aria-label="Filter by status">
            {STATUS_FILTERS.map((filter) => (
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
          <div>Name</div>
          <div>Trigger</div>
          <div className={styles.colCenter}>Status</div>
          <div className={styles.numeric}>Runs</div>
          <div className={styles.colCenter}>Last run</div>
          <div />
        </div>

        {empty ? (
          <div className="atable__empty">
            {query || status !== 'all' ? (
              <>No automations match that filter.</>
            ) : (
              <div className={styles.emptyState}>
                <Icon name="automations" size={26} />
                <p className={styles.emptyTitle}>Nothing automated yet</p>
                <p className={styles.emptyBody}>
                  Start with something small: welcome every new subscriber, or follow up two days
                  after a campaign lands.
                </p>
                <button type="button" className="pbtn" onClick={() => void create()}>
                  <Icon name="plus" size={15} />
                  Create your first automation
                </button>
              </div>
            )}
          </div>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className={`atrow ${styles.grid}${menuFor === row.id ? ` ${styles.rowOpen}` : ''}`}
              role="link"
              tabIndex={0}
              onClick={() => {
                window.location.href = routes.app.automation(row.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') window.location.href = routes.app.automation(row.id);
              }}
            >
              <div className={styles.nameCell}>
                <span className={styles.name}>{row.name}</span>
                {row.hasUnpublishedChanges ? (
                  <span className={styles.draftDot} title="This automation has unpublished changes">
                    Unpublished changes
                  </span>
                ) : null}
              </div>
              <div className={styles.muted}>{row.triggerLabel ?? '—'}</div>
              <div className={styles.colCenter}>
                <span className={`astatus ${statusChipClass(row.status)}`}>
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
              <div className={`${styles.numeric} tnum`}>{row.runCount.toLocaleString()}</div>
              <div className={`${styles.muted} ${styles.colCenter}`}>
                {row.lastRunAt ? <TimeAgo at={row.lastRunAt} /> : 'Never'}
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
                    <a role="menuitem" href={routes.app.automation(row.id)}>
                      <Icon name="edit" size={14} /> Edit
                    </a>
                    <a role="menuitem" href={routes.app.automationRuns(row.id)}>
                      <Icon name="lists" size={14} /> Show runs
                    </a>
                    {row.status === 'active' ? (
                      <button type="button" role="menuitem" onClick={() => void act(row, 'pause')}>
                        <Icon name="pause" size={14} /> Pause
                      </button>
                    ) : row.publishedVersion ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void act(row, 'activate')}
                      >
                        <Icon name="play" size={14} /> Resume
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void act(row, 'duplicate')}
                    >
                      <Icon name="copy" size={14} /> Duplicate
                    </button>
                    {row.status !== 'archived' ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void act(row, 'archive')}
                      >
                        <Icon name="inbox" size={14} /> Archive
                      </button>
                    ) : null}
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
          ))
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

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete “${confirmDelete.name}”?`}
          message="Its run history goes with it. Automations you might want back should be archived instead."
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
