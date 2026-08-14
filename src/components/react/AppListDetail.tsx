import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import ListEditorModal from './ListEditorModal';
import { useToast } from './shared/useToast';
import { api, ApiError } from '@/lib/app/api';
import { routes } from '@/config/routes';
import type { ApiList } from '@/lib/app/list-map';
import type { ApiCampaign } from '@/lib/app/campaign-map';
import {
  buildListDetailView,
  type ApiCustomFieldDef,
  type ApiListMember,
  type ApiSegment,
  type ListDetailView,
  type RosterFilter,
} from '@/lib/app/list-detail';
import { visiblePageNumbers } from './shared/pagination';
import styles from './AppListDetail.module.css';

/*
 * List detail — pixel port of design/list-detail.html, bound to live workspace
 * data. Sections the comp shows from data the backend doesn't record yet
 * (signup sources, imports, owner, sending domain, per-member last open /
 * source) render the standard "—" placeholder or an honest empty line rather
 * than invented values.
 */

type Props = {
  initial: ApiList;
  members?: ApiListMember[];
  campaigns?: ApiCampaign[];
  fields?: ApiCustomFieldDef[];
  segments?: ApiSegment[];
};

const PAGE_SIZE = 12;

const FILTERS: { id: RosterFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'unconfirmed', label: 'Unconfirmed' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
  { id: 'bounced', label: 'Bounced' },
];

export default function AppListDetail({
  initial,
  members = [],
  campaigns = [],
  fields = [],
  segments = [],
}: Props) {
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [page, setPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Public signup form" has no backing column yet — optimistic local only.
  const [publicForm, setPublicForm] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const { toast, show } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);

  // Fetch workspace templates on mount for the welcome/goodbye selectors.
  useEffect(() => {
    void api
      .get<{ data: { id: string; name: string }[] }>('templates')
      .then((res) => setTemplates(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const view: ListDetailView = useMemo(
    () => buildListDetailView(list, members, campaigns, fields, segments),
    [list, members, campaigns, fields, segments],
  );

  const filtered = useMemo(
    () => view.roster.filter((r) => filter === 'all' || r.status === filter),
    [view.roster, filter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIdx = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pagerPages = visiblePageNumbers(safePage, pageCount);

  const maxJoin = Math.max(1, ...view.weeks.map((w) => w.joins));
  const barPct = (n: number) => (n <= 0 ? 0 : Math.max(4, Math.round((n / maxJoin) * 96)));

  const desc = (list.notes ?? '').trim();

  const patchSetting = async (
    key: 'doubleOptIn' | 'doubleOptOut',
    next: boolean,
    label: string,
  ) => {
    const prev = list[key] ?? false;
    setList((l) => ({ ...l, [key]: next }));
    try {
      await api.patch(`lists/${list.id}`, { [key]: next });
      show(`${label} ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setList((l) => ({ ...l, [key]: prev }));
      show(e instanceof ApiError ? e.message : 'Could not save changes');
    }
  };

  // Local toggle state for welcome/goodbye — shows the selector without saving
  // until the user picks a template.
  const [welcomeOpen, setWelcomeOpen] = useState(list.welcomeEmailTemplateId != null);
  const [goodbyeOpen, setGoodbyeOpen] = useState(list.goodbyeEmailTemplateId != null);

  const toggleTemplateSetting = async (
    key: 'welcomeEmailTemplateId' | 'goodbyeEmailTemplateId',
    label: string,
    openSetter: (v: boolean) => void,
    isOpen: boolean,
  ) => {
    if (isOpen) {
      // Turning off — clear the template.
      openSetter(false);
      const prev = list[key] ?? null;
      setList((l) => ({ ...l, [key]: null }));
      if (prev) {
        try {
          await api.patch(`lists/${list.id}`, { [key]: null });
          show(`${label[0]!.toUpperCase()}${label.slice(1)} email disabled`);
        } catch (e) {
          setList((l) => ({ ...l, [key]: prev }));
          openSetter(true);
          show(e instanceof ApiError ? e.message : 'Could not save changes');
        }
      }
    } else {
      // Turning on — just show the selector, don't save yet.
      openSetter(true);
    }
  };

  const changeTemplateSetting = async (
    key: 'welcomeEmailTemplateId' | 'goodbyeEmailTemplateId',
    tplId: string | null,
  ) => {
    const prev = list[key] ?? null;
    setList((l) => ({ ...l, [key]: tplId }));
    if (tplId) {
      try {
        await api.patch(`lists/${list.id}`, { [key]: tplId });
      } catch (e) {
        setList((l) => ({ ...l, [key]: prev }));
        show(e instanceof ApiError ? e.message : 'Could not save changes');
      }
    }
  };

  const deleteList = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.del(`lists/${list.id}`);
      window.location.href = routes.app.lists;
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not delete list');
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['id', 'email', 'name', 'status', 'phone', 'joined'],
      ...members.map((m) => [
        m.id,
        m.email,
        m.name ?? '',
        m.status,
        m.phone ?? '',
        m.joinedAt ?? '',
      ]),
    ];
    const blob = new Blob(
      [rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')],
      { type: 'text/csv' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${list.name || list.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(view.embedSnippet);
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Press ⌘C');
    }
    window.setTimeout(() => setCopyLabel('Copy'), 1400);
  };

  const menuIcon = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  const listColor = list.color || 'var(--accent)';
  const gdprOn = Boolean(list.gdprConsent);

  return (
    <div className={styles.wrap}>
      <main className={styles.page}>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            window.location.assign(routes.app.lists);
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Lists
        </button>
        <section className={styles.identity}>
          <div className={styles.identityMain}>
            <h1 className={styles.identityName}>
              {list.name}
              <span
                className={styles.listColorPill}
                style={{
                  background: `color-mix(in srgb, ${listColor} 14%, transparent)`,
                  color: listColor,
                }}
              >
                <span className={styles.listColorDot} style={{ background: listColor }} />
                List
              </span>
            </h1>
            {desc ? <p className={styles.identityDesc}>{desc}</p> : null}
          </div>
          <div className={styles.identityAside}>
            <div className={styles.identityBadges}>
              {gdprOn && (
                <span className={`${styles.badge} ${styles.badgeGdpr}`}>
                  <Icon name="shield" size={12} stroke={2.4} />
                  GDPR consent
                  <span className={styles.badgeGdprCheck} aria-hidden="true">
                    <Icon name="check" size={8} stroke={3.5} />
                  </span>
                </span>
              )}
            </div>
            <div className={styles.identityActions}>
              <button
                className="pbtn"
                type="button"
                onClick={() => setEditorOpen(true)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" />
                </svg>
                Edit list details
              </button>
              <div className={styles.menuWrap} ref={menuRef}>
                <button
                  className={`sbtn ${styles.moreBtn}`}
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  aria-label="More actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                >
                  <Icon name="more" size={16} stroke={2.4} />
                </button>
                {menuOpen && (
                  <div className={styles.menu} role="menu">
                    <button className={styles.menuItem} type="button" onClick={exportCsv}>
                      <svg {...menuIcon}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Export subscribers (CSV)
                    </button>
                    <button
                      className={`${styles.menuItem} ${styles.menuWarn}`}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        show('Cleaning isn’t available yet');
                      }}
                    >
                      <svg {...menuIcon}>
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                      Clean inactive addresses
                    </button>
                    <button
                      className={`${styles.menuItem} ${styles.menuDanger}`}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDelete(true);
                      }}
                    >
                      <svg {...menuIcon}>
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Delete list
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className={styles.layout}>
          <div className={styles.colMain}>
            <section className={`${styles.card} ${styles.health}`} aria-label="List health">
              <div className={styles.healthTop}>
                <div>
                  <p className={styles.overline}>Recipients</p>
                  <div className={styles.healthCount}>
                    <span className={`${styles.healthTotal} ${styles.tnum}`}>
                      {view.total.toLocaleString('en-US')}
                    </span>
                    <span
                      className={styles.healthGrowth}
                      style={view.growthUp ? undefined : { color: 'var(--danger-text)' }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m3 17 6-6 4 4 8-8" />
                        <path d="M17 7h4v4" />
                      </svg>
                      {view.growthLabel}
                    </span>
                  </div>
                </div>
                <div className={styles.healthRight}>
                  <p className={styles.overline}>Deliverable</p>
                  <p className={`${styles.healthDeliverable} ${styles.tnum}`}>
                    {view.deliverableLabel}
                  </p>
                </div>
              </div>
              <div className={styles.healthBar}>
                {view.health.map((s) =>
                  s.pct > 0 ? (
                    <span
                      key={s.key}
                      className={styles.healthSeg}
                      style={{ width: `${s.pct}%`, background: s.color }}
                      title={`${s.label} · ${s.value.toLocaleString('en-US')}`}
                    />
                  ) : null,
                )}
              </div>
              <div className={styles.healthLegend}>
                {view.health.map((s) => (
                  <div key={s.key}>
                    <p className={styles.healthLabel}>
                      <span className={styles.swatch} style={{ background: s.color }} />
                      {s.label}
                    </p>
                    <p className={`${styles.healthValue} ${styles.tnum}`}>
                      {s.value.toLocaleString('en-US')}
                    </p>
                    <p className={`${styles.healthPct} ${styles.tnum}`}>{s.pct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${styles.card} ${styles.chart}`} aria-label="List growth">
              <div className={styles.chartHead}>
                <div>
                  <h2 className={styles.cardTitle}>List growth</h2>
                  <p className={styles.chartSub}>Joins and leaves per week, last 12 weeks</p>
                </div>
                <div className={styles.legend}>
                  <span>
                    <span className={styles.swatch} style={{ background: 'var(--accent)' }} />
                    Joined
                  </span>
                  <span>
                    <span className={styles.swatch} style={{ background: '#f0c8c2' }} />
                    Left
                  </span>
                </div>
              </div>
              <ul className={styles.barChart} onMouseLeave={() => setHoverWeek(null)}>
                {view.weeks.map((w, i) => (
                  <li
                    key={w.label}
                    className={`${styles.barGroup}${hoverWeek === i ? ` ${styles.barGroupHover}` : ''}`}
                    onMouseEnter={() => setHoverWeek(i)}
                  >
                    {hoverWeek === i && (
                      <div className={styles.barTip} role="tooltip">
                        <div className={`${styles.barTipVal} ${styles.tnum}`}>
                          +{w.joins} joined · −{w.left} left
                        </div>
                        <div className={styles.barTipLbl}>{w.label}</div>
                      </div>
                    )}
                    <span className={styles.bars}>
                      <span
                        className={`${styles.bar} ${styles.barJoin}`}
                        style={{ height: `${barPct(w.joins)}%` }}
                        aria-hidden="true"
                      />
                      <span
                        className={`${styles.bar} ${styles.barLeft}`}
                        style={{ height: `${w.left}%` }}
                        aria-hidden="true"
                      />
                    </span>
                    <span className={styles.barLabel}>{w.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${styles.card} ${styles.tabsCard}`}>
              <div className={styles.tabs} role="tablist" aria-label="Subscriber status">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`${styles.tab} ${filter === f.id ? styles.isActive : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => {
                      setFilter(f.id);
                      setPage(1);
                    }}
                  >
                    {f.label}
                    <span className={`${styles.tabCount} ${styles.tnum}`}>
                      {view.rosterCounts[f.id].toLocaleString('en-US')}
                    </span>
                  </button>
                ))}
              </div>

              <div role="tabpanel">
                {filtered.length === 0 ? (
                  <p className={styles.empty}>No subscribers in this status.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Subscriber</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Last open</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                        <tr
                          key={r.id}
                          className={styles.person}
                          role="link"
                          tabIndex={0}
                          onClick={() => {
                            window.location.href = routes.app.subscriber(r.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              window.location.href = routes.app.subscriber(r.id);
                            }
                          }}
                        >
                          <td>
                            <div className={styles.personCell}>
                              <span
                                className={styles.personAvatar}
                                style={{ background: r.avBg, color: r.avInk }}
                              >
                                {r.initials}
                              </span>
                              <div className={styles.personId}>
                                <span className={styles.personName}>{r.name}</span>
                                <span className={styles.personEmail}>{r.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`astatus astatus--${r.status}`}>
                              <span
                                className={styles.dot}
                                style={{
                                  background: r.status === 'active' ? '#16a34a' : 'currentColor',
                                }}
                              />
                              {r.statusLabel}
                            </span>
                          </td>
                          <td className={styles.tnum}>{r.joinedLabel}</td>
                          <td className={styles.tnum}>—</td>
                          <td className={styles.cellMuted}>—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="atable__foot">
                  <span className={filtered.length === 0 ? undefined : 'tnum'}>
                    {filtered.length === 0
                      ? 'No subscribers match your filters'
                      : `${startIdx}–${endIdx} of ${filtered.length} subscribers`}
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
            </section>
          </div>

          <aside className={styles.colRail}>
            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Details</p>
              <div className="adetail">
                <span className="adetail__k">Created</span>
                <span className="adetail__v">{view.createdLabel}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Last campaign</span>
                <span className="adetail__v">{view.lastCampaignLabel}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Bounce rate</span>
                <span className="adetail__v tnum">{view.bounceRate}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Complaint rate</span>
                <span
                  className={`adetail__v tnum${
                    view.complaintRate !== '—' ? ` ${styles.railValueOk}` : ''
                  }`}
                >
                  {view.complaintRate}
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Unsub rate</span>
                <span className="adetail__v tnum">{view.unsubRate}</span>
              </div>
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Custom fields</p>
              {view.fields.length === 0 ? (
                <p className={styles.railEmpty}>No custom fields defined yet.</p>
              ) : (
                <ul className={styles.fieldList}>
                  {view.fields.map((f) => (
                    <li key={f.id} className={styles.fieldRow}>
                      <div className={styles.fieldMeta}>
                        <span className={styles.fieldLabel}>{f.label}</span>
                        <span className={`${styles.fieldKey} ${styles.mono}`}>
                          {f.key} · {f.typeLabel}
                        </span>
                      </div>
                      <div className={styles.fill}>
                        <div className={styles.fillTrack}>
                          {f.fillPct > 0 && (
                            <div
                              className={styles.fillBar}
                              style={{
                                width: `${f.fillPct}%`,
                                background: f.fillColor,
                              }}
                            />
                          )}
                        </div>
                        <span className={`${styles.tnum} ${styles.fieldFillPct}`}>
                          {f.fillPct}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Settings</p>
              <ul className={styles.settings}>
                <li className={styles.settingRow}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>Double opt-in</p>
                    <p className={styles.stackDesc}>
                      New subscribers must confirm by email before they receive campaigns.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${list.doubleOptIn ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={Boolean(list.doubleOptIn)}
                    aria-label="Double opt-in"
                    onClick={() =>
                      void patchSetting('doubleOptIn', !list.doubleOptIn, 'Double opt-in')
                    }
                  >
                    <span className={styles.switchKnob} />
                  </button>
                </li>
                <li className={styles.settingRow} style={{ flexWrap: 'wrap' }}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>Send welcome email</p>
                    <p className={styles.stackDesc}>
                      A confirmation message goes out the moment someone joins.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${welcomeOpen ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={welcomeOpen}
                    aria-label="Send welcome email"
                    onClick={() => void toggleTemplateSetting('welcomeEmailTemplateId', 'welcome', setWelcomeOpen, welcomeOpen)}
                  >
                    <span className={styles.switchKnob} />
                  </button>
                  {welcomeOpen && (
                    <div style={{ width: '100%' }}>
                      <TemplateDropdown
                        label="Welcome email template"
                        templates={templates}
                        value={list.welcomeEmailTemplateId ?? null}
                        onChange={(id) => void changeTemplateSetting('welcomeEmailTemplateId', id)}
                      />
                    </div>
                  )}
                </li>
                <li className={styles.settingRow} style={{ flexWrap: 'wrap' }}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>Send goodbye email</p>
                    <p className={styles.stackDesc}>
                      Confirm the unsubscribe so people know it worked.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${goodbyeOpen ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={goodbyeOpen}
                    aria-label="Send goodbye email"
                    onClick={() => void toggleTemplateSetting('goodbyeEmailTemplateId', 'goodbye', setGoodbyeOpen, goodbyeOpen)}
                  >
                    <span className={styles.switchKnob} />
                  </button>
                  {goodbyeOpen && (
                    <div style={{ width: '100%' }}>
                      <TemplateDropdown
                        label="Goodbye email template"
                        templates={templates}
                        value={list.goodbyeEmailTemplateId ?? null}
                        onChange={(id) => void changeTemplateSetting('goodbyeEmailTemplateId', id)}
                      />
                    </div>
                  )}
                </li>
                <li className={styles.settingRow}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>Double opt-out</p>
                    <p className={styles.stackDesc}>
                      Ask for confirmation before removing someone from the list.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${list.doubleOptOut ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={Boolean(list.doubleOptOut)}
                    aria-label="Double opt-out"
                    onClick={() =>
                      void patchSetting('doubleOptOut', !list.doubleOptOut, 'Double opt-out')
                    }
                  >
                    <span className={styles.switchKnob} />
                  </button>
                </li>
                <li className={styles.settingRow}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>Public signup form</p>
                    <p className={styles.stackDesc}>
                      Anyone with the hosted link or embed can join this list.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${publicForm ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={publicForm}
                    aria-label="Public signup form"
                    onClick={() => setPublicForm((v) => !v)}
                  >
                    <span className={styles.switchKnob} />
                  </button>
                </li>
              </ul>
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <div className={styles.railHead}>
                <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Signup form</p>
                <button
                  className={`sbtn ${styles.copyBtn}`}
                  type="button"
                  onClick={() => void copyEmbed()}
                >
                  <Icon name="copy" size={12} stroke={2.2} />
                  {copyLabel}
                </button>
              </div>
              <code className={`${styles.embed} ${styles.mono}`}>{view.embedSnippet}</code>
            </section>
          </aside>
        </div>
      </main>

      {toast && (
        <div
          className={styles.toast}
          role="status"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className={styles.toastIc}>
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${list.name}”?`}
          message="Subscribers stay in the workspace. Campaign history is kept."
          confirmLabel="Delete list"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void deleteList();
          }}
        />
      )}

      {editorOpen && (
        <ListEditorModal
          mode="edit"
          initialName={list.name}
          initialNotes={list.notes ?? ''}
          initialColor={list.color ?? undefined}
          onClose={() => setEditorOpen(false)}
          onSave={async (values) => {
            try {
              const updated = await api.patch<ApiList>(`lists/${list.id}`, {
                name: values.name,
                notes: values.notes || null,
                color: values.color,
              });
              setList((l) => ({
                ...l,
                name: updated.name,
                notes: updated.notes ?? values.notes,
                color: updated.color || values.color,
              }));
              setEditorOpen(false);
              show(`List “${values.name}” updated`);
            } catch (e) {
              show(e instanceof ApiError ? e.message : 'Could not save list');
            }
          }}
        />
      )}
    </div>
  );
}

/* ---------------------- Template dropdown (popover) ---------------------- */

function TemplateDropdown({
  label,
  templates,
  value,
  onChange,
}: {
  label: string;
  templates: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.id === value);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          fontSize: '12.5px',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          background: 'var(--surface)',
          color: selected ? 'var(--text)' : 'var(--text-muted)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.name ?? '— Select a template —'}</span>
        <Icon name="chevron-down" size={13} />
      </button>
      {open && (
        <>
          <button
            type="button"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'transparent',
              border: 'none',
              zIndex: 90,
            }}
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label={label}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: 220,
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              padding: 4,
              zIndex: 100,
              animation: 'pop .14s ease',
            }}
          >
            {templates.map((t) => {
              const on = t.id === value;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: '12.5px',
                    border: 'none',
                    borderRadius: 6,
                    background: on ? 'var(--accent-tint)' : 'transparent',
                    color: on ? 'var(--accent-text)' : 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {on && <Icon name="check" size={13} stroke={3} />}
                  <span>{t.name}</span>
                </button>
              );
            })}
            {templates.length === 0 && (
              <p style={{ padding: '8px 10px', fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                No templates yet — create one first.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
