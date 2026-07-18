import { useMemo, useState } from 'react';
import { lists as baseLists } from '@/lib/app/mock-data';
import type { ListSummary } from '@/types/app';
import Icon from './Icon';

// Fixed reference "now" (matches the mock-data window) — deterministic across
// SSR + hydration, so no mismatch and no Date.now() nondeterminism.
const NOW = new Date('2026-07-17T18:00:00Z').getTime();
function ago(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.round(days / 7);
  return wks === 1 ? '1w ago' : `${wks}w ago`;
}

/**
 * Per-list presentation metadata that mock-data.ts does not carry (color dot,
 * a 7-point subscriber trend "6 weeks ago → Now", the most recent campaign,
 * tags and engagement rates). Kept local to this screen per the build rules —
 * the shared mock-data.ts is not edited.
 */
type ListMeta = {
  color: string;
  trend: number[];
  recentCampaign: string;
  tags: string[];
  more: string;
  openRate: string;
  clickRate: string;
};

const META: Record<string, ListMeta> = {
  list_1: {
    color: '#4f46e5',
    trend: [16800, 17150, 17480, 17720, 17980, 18220, 18420],
    recentCampaign: 'Spring Launch',
    tags: ['Marketing', 'VIP', 'Opt-in'],
    more: '+240',
    openRate: '58.2%',
    clickRate: '12.1%',
  },
  list_2: {
    color: '#f59e0b',
    trend: [58200, 58720, 59180, 59520, 59810, 60050, 60211],
    recentCampaign: 'Welcome Series',
    tags: ['Weekly', 'Opt-in'],
    more: '+18',
    openRate: '46.7%',
    clickRate: '9.4%',
  },
  list_3: {
    color: '#22c55e',
    trend: [2510, 2680, 2840, 2980, 3080, 3160, 3200],
    recentCampaign: 'Order shipped SMS',
    tags: ['Automation', 'Transactional'],
    more: '+12',
    openRate: '71.4%',
    clickRate: '18.9%',
  },
};

type ListRow = ListSummary & ListMeta;

const rows: ListRow[] = baseLists.map((l) => ({
  ...l,
  ...(META[l.id] ?? {
    color: '#4f46e5',
    trend: [l.subscribers],
    recentCampaign: '—',
    tags: [],
    more: '+0',
    openRate: '—',
    clickRate: '—',
  }),
}));

const AVATAR_GRADS = [
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#818cf8,#4f46e5)',
  'linear-gradient(135deg,#34d399,#059669)',
];

function fmtPct(pct: number): string {
  const arrow = pct >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}
function weeklyGain(trend: number[]): number {
  if (trend.length < 2) return 0;
  return trend[trend.length - 1] - trend[trend.length - 2];
}

// SVG area+line sparkline for the subscriber-trend chart.
function trendPath(pts: number[], w: number, h: number, pad = 5) {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const rng = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const coords = pts.map((p, i) => {
    const x = pad + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = pad + innerH - ((p - min) / rng) * innerH;
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const last = coords[coords.length - 1];
  return { line, area, last };
}

type SortKey = 'name' | 'subscribers' | 'growthPct' | 'updatedAt';
type View = 'cards' | 'table';

export default function AppLists() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('table');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((l) => {
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q)) ||
        l.recentCampaign.toLowerCase().includes(q)
      );
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      let av: number | string = a[key] as number | string;
      let bv: number | string = b[key] as number | string;
      if (key === 'updatedAt') {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      } else if (key === 'name') {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  const open = openId ? (rows.find((l) => l.id === openId) ?? null) : null;
  const closeDrawer = () => {
    setClosing(true);
    window.setTimeout(() => {
      setOpenId(null);
      setClosing(false);
    }, 240);
  };

  return (
    <div className="screen ll">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Lists</h1>
          <p className="screen__sub">Organize your subscribers into lists.</p>
        </div>
        <button type="button" className="pbtn" onClick={() => showToast('Opening new list…')}>
          <Icon name="plus" size={15} stroke={2.2} />
          New list
        </button>
      </div>

      {/* toolbar */}
      <div className="ll__toolbar">
        <label className="ll__search">
          <Icon name="search" size={15} className="ll__searchic" />
          <input
            type="search"
            placeholder="Search lists…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search lists"
          />
        </label>
        <div className="ll__spacer" />
        <div className="aseg" role="group" aria-label="View mode">
          {(['cards', 'table'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`aseg__opt${view === v ? ' is-active' : ''}`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === 'cards' ? 'Cards' : 'Table'}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE VIEW */}
      {view === 'table' && (
        <div className="atable ll__table">
          <div className="athead ll__grid">
            <div>
              <button type="button" onClick={() => toggleSort('name')}>
                List <span className="tnum">{sortArrow('name')}</span>
              </button>
            </div>
            <div>
              <button type="button" onClick={() => toggleSort('subscribers')}>
                Subscribers <span className="tnum">{sortArrow('subscribers')}</span>
              </button>
            </div>
            <div>
              <button type="button" onClick={() => toggleSort('growthPct')}>
                Growth <span className="tnum">{sortArrow('growthPct')}</span>
              </button>
            </div>
            <div>Recent campaign</div>
            <div>
              <button type="button" onClick={() => toggleSort('updatedAt')}>
                Updated <span className="tnum">{sortArrow('updatedAt')}</span>
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="atable__empty">No lists match your search.</div>
          ) : (
            filtered.map((l) => {
              const up = l.growthPct >= 0;
              return (
                <div
                  key={l.id}
                  className="atrow ll__grid"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(l.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenId(l.id);
                    }
                  }}
                >
                  <div className="ll__namecell">
                    <span className="ll__dot" style={{ background: l.color }} />
                    <span className="ll__name">{l.name}</span>
                  </div>
                  <div className="tnum ll__muted3">{l.subscribers.toLocaleString('en-US')}</div>
                  <div
                    className="tnum ll__growth"
                    style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {fmtPct(l.growthPct)}
                  </div>
                  <div className="ll__muted3">{l.recentCampaign}</div>
                  <div className="ll__muted">{ago(l.updatedAt)}</div>
                </div>
              );
            })
          )}

          <div className="atable__foot">
            <span className="tnum">
              {filtered.length} of {rows.length} lists
            </span>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {view === 'cards' &&
        (filtered.length === 0 ? (
          <div className="atable ll__table">
            <div className="atable__empty">No lists match your search.</div>
          </div>
        ) : (
          <div className="ll__cards">
            {filtered.map((l) => {
              const up = l.growthPct >= 0;
              return (
                <div
                  key={l.id}
                  className="acrd acrd--hover ll__card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(l.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenId(l.id);
                    }
                  }}
                >
                  <div className="ll__card-top">
                    <span className="ll__dot" style={{ background: l.color }} />
                    <span className="ll__card-name">{l.name}</span>
                  </div>
                  <div className="ll__card-num tnum">{l.subscribers.toLocaleString('en-US')}</div>
                  <div className="ll__card-sublabel">subscribers</div>
                  <div
                    className="ll__card-growth tnum"
                    style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {fmtPct(l.growthPct)} · {up ? '↑' : '↓'}{' '}
                    {Math.abs(weeklyGain(l.trend)).toLocaleString('en-US')} this week
                  </div>
                  <div className="ll__card-meta">
                    <span>Recent: {l.recentCampaign}</span>
                    <span>Updated {ago(l.updatedAt)}</span>
                  </div>
                  <div className="ll__card-foot">
                    <div className="ll__avatars" aria-hidden="true">
                      {AVATAR_GRADS.map((g, i) => (
                        <span key={i} className="ll__avatar" style={{ background: g }} />
                      ))}
                    </div>
                    <span className="ll__more tnum">{l.more} more</span>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="ll__card ll__card--new"
              onClick={() => showToast('Opening new list…')}
            >
              <span className="ll__newplus">
                <Icon name="plus" size={18} stroke={2.2} />
              </span>
              Create new list
            </button>
          </div>
        ))}

      {open && (
        <ListDrawer
          key={open.id}
          list={open}
          closing={closing}
          onClose={closeDrawer}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="ll__toast" role="status">
          <span className="ll__toast-ic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        .ll { animation: fade .3s ease; }
        .ll__toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .ll__spacer { flex: 1; }
        .ll__search { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 0 11px; width: 250px; max-width: 100%; }
        .ll__searchic { color: var(--muted); }
        .ll__search input { border: none; background: none; padding: 9px 0; font-size: 13px; color: var(--text); outline: none; width: 100%; }

        .ll__grid { grid-template-columns: 2fr .9fr 1.1fr 1.2fr .8fr; column-gap: 16px; }
        .ll__namecell { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ll__dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
        .ll__name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ll__growth { font-weight: 500; }
        .ll__muted { color: var(--muted); font-size: 12px; }
        .ll__muted3 { color: var(--text3); }

        .ll__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(262px, 1fr)); gap: 16px; }
        .ll__card { text-align: left; padding: 18px 19px; cursor: pointer; display: flex; flex-direction: column; background: var(--surface); }
        .ll__card-top { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
        .ll__card-name { font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ll__card-num { font-size: 24px; font-weight: 600; letter-spacing: -.5px; line-height: 1.1; }
        .ll__card-sublabel { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .ll__card-growth { font-size: 11.5px; font-weight: 500; margin-top: 8px; }
        .ll__card-meta { display: flex; flex-direction: column; gap: 3px; margin-top: 10px; font-size: 12px; color: var(--muted); }
        .ll__card-foot { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--divider); }
        .ll__avatars { display: flex; }
        .ll__avatar { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--surface); margin-left: -8px; }
        .ll__avatar:first-child { margin-left: 0; }
        .ll__more { font-size: 11.5px; color: var(--muted); }
        .ll__card--new { align-items: center; justify-content: center; gap: 8px; flex-direction: row; min-height: 170px; border: 1.5px dashed var(--border2); border-radius: 16px; box-shadow: none; color: var(--text4); font-size: 13px; font-weight: 600; }
        .ll__card--new:hover { border-color: var(--accent); color: var(--accent); }
        .ll__newplus { display: inline-flex; }

        .ll__toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 11px; background: var(--text); color: var(--bg); padding: 12px 16px 12px 13px; border-radius: 12px; box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500; animation: toastin .22s cubic-bezier(.2,.8,.2,1); }
        .ll__toast-ic { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }

        @media (max-width: 900px) {
          .ll__grid { grid-template-columns: 1.8fr 1fr 1fr .8fr; }
          .ll__grid > :nth-child(4) { display: none; }
        }
        @media (max-width: 620px) {
          .ll__grid { grid-template-columns: 1.6fr 1fr .9fr; }
          .ll__grid > :nth-child(5) { display: none; }
        }
      `}</style>
    </div>
  );
}

function ListDrawer({
  list,
  closing,
  onClose,
  onToast,
}: {
  list: ListRow;
  closing: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const DEFAULT_NOTE =
    'Segment used for the weekly product newsletter. Keep double opt-in on for GDPR.';
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [savedNote, setSavedNote] = useState(DEFAULT_NOTE);
  const dirty = note !== savedNote;

  const up = list.growthPct >= 0;
  const gain = weeklyGain(list.trend);
  const chart = trendPath(list.trend, 346, 88);

  const recentCampaigns =
    list.recentCampaign === '—'
      ? []
      : [
          { name: list.recentCampaign, status: 'Sent', when: '2d ago', open: '54.1%' },
          { name: 'Monthly Digest', status: 'Sent', when: '2w ago', open: '48.7%' },
          { name: 'Welcome Series', status: 'Draft', when: '—', open: null },
        ];

  const overlayStyle = closing ? { animation: 'll-ovout .24s ease forwards' } : undefined;
  const panelStyle = closing
    ? { width: 410, animation: 'll-drawerout .24s cubic-bezier(.4,0,1,1) forwards' }
    : { width: 410 };

  return (
    <div className="adrawer-overlay" style={overlayStyle} onClick={onClose}>
      <div
        className="adrawer lld"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${list.name} details`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">List details</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="adrawer__body">
          {/* identity */}
          <div className="lld__identity">
            <span className="lld__dot" style={{ background: list.color }} />
            <div className="lld__idtext">
              <div className="lld__name">{list.name}</div>
              <div className="lld__updated">Updated {ago(list.updatedAt)}</div>
            </div>
          </div>

          {/* tags */}
          {list.tags.length > 0 && (
            <div className="lld__tags">
              {list.tags.map((t) => (
                <span key={t} className="lld__tag">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* stat cards */}
          <div className="lld__stats">
            <div className="lld__stat">
              <div className="lld__stat-lbl">Subscribers</div>
              <div className="tnum lld__stat-val">{list.subscribers.toLocaleString('en-US')}</div>
            </div>
            <div className="lld__stat">
              <div className="lld__stat-lbl">Growth</div>
              <div
                className="tnum lld__stat-val"
                style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
              >
                {fmtPct(list.growthPct)}
              </div>
            </div>
          </div>

          {/* subscriber trend */}
          <div className="lld__trend">
            <div className="lld__trend-head">
              <span className="adrawer__eyebrow">Subscriber trend</span>
              <span
                className="tnum lld__trend-gain"
                style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
              >
                {up ? '↑' : '↓'} {Math.abs(gain).toLocaleString('en-US')} this week
              </span>
            </div>
            <div className="lld__chart">
              <svg
                width="100%"
                height="88"
                viewBox="0 0 346 88"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="lldTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4f46e5" stopOpacity="0.18" />
                    <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline points={chart.area} fill="url(#lldTrend)" stroke="none" />
                <polyline
                  points={chart.line}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={chart.last[0]}
                  cy={chart.last[1]}
                  r="3.5"
                  fill="#4f46e5"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className="lld__axis">
              <span>6 weeks ago</span>
              <span>Now</span>
            </div>
          </div>

          {/* engagement */}
          <p className="adrawer__eyebrow lld__eyebrow">Engagement</p>
          <div className="lld__eng">
            <div className="adetail">
              <span className="adetail__k">Open rate</span>
              <span className="adetail__v tnum">{list.openRate}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Click rate</span>
              <span className="adetail__v tnum">{list.clickRate}</span>
            </div>
            <div className="adetail" style={{ borderBottom: 'none' }}>
              <span className="adetail__k">Recent campaign</span>
              <span className="adetail__v">{list.recentCampaign}</span>
            </div>
          </div>

          {/* recent campaigns */}
          <p className="adrawer__eyebrow lld__eyebrow">Recent campaigns</p>
          {recentCampaigns.length === 0 ? (
            <div className="aempty">No campaigns sent to this list yet</div>
          ) : (
            <div className="lld__camps">
              {recentCampaigns.map((c, i) => (
                <div key={i} className="lld__camp">
                  <span className="lld__camp-dot" style={{ background: list.color }} />
                  <div className="lld__camp-text">
                    <div className="lld__camp-name">{c.name}</div>
                    <div className="lld__camp-sub">
                      {c.status} · {c.when}
                    </div>
                  </div>
                  <div className="lld__camp-open">
                    {c.open ? (
                      <>
                        <span className="tnum lld__camp-openval">{c.open}</span>
                        <span className="lld__camp-openlbl">open</span>
                      </>
                    ) : (
                      <span className="lld__camp-openlbl">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* notes */}
          <div className="lld__noteshead">
            <span className="adrawer__eyebrow">Notes</span>
            <button
              type="button"
              className={`lld__savenote${dirty ? ' is-dirty' : ''}`}
              disabled={!dirty}
              onClick={() => {
                setSavedNote(note);
                onToast('Note saved');
              }}
            >
              Save note
            </button>
          </div>
          <textarea
            className="lld__notes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this list…"
            aria-label="List notes"
          />
        </div>

        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 'none' }}
            onClick={() => onToast(`Exporting ${list.name}`)}
          >
            <Icon name="download" size={15} />
            Export
          </button>
          <button
            type="button"
            className="sbtn"
            style={{ flex: 1 }}
            onClick={() => onToast('Opening list editor…')}
          >
            Edit list
          </button>
          <a href="/app/subscribers" className="pbtn" style={{ flex: 1, textDecoration: 'none' }}>
            Subscribers
          </a>
        </div>

        <style>{`
          @keyframes ll-ovout { from { opacity: 1; } to { opacity: 0; } }
          @keyframes ll-drawerout { from { transform: translateX(0); } to { transform: translateX(100%); } }

          .lld__identity { display: flex; align-items: center; gap: 11px; margin-bottom: 18px; }
          .lld__dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
          .lld__idtext { min-width: 0; }
          .lld__name { font-size: 18px; font-weight: 600; letter-spacing: -.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lld__updated { font-size: 12.5px; color: var(--muted); margin-top: 2px; }

          .lld__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
          .lld__tag { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; background: var(--surface2); color: var(--text3); }

          .lld__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; margin-bottom: 20px; }
          .lld__stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 13px 15px; }
          .lld__stat-lbl { font-size: 11px; color: var(--muted); font-weight: 500; }
          .lld__stat-val { font-size: 22px; font-weight: 600; letter-spacing: -.5px; margin-top: 6px; }

          .lld__trend { margin-bottom: 22px; }
          .lld__trend-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
          .lld__trend-gain { font-size: 11.5px; font-weight: 600; }
          .lld__chart { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px 12px 6px; }
          .lld__chart svg { display: block; width: 100%; }
          .lld__axis { display: flex; justify-content: space-between; margin-top: 6px; font-size: 10.5px; color: var(--muted); }

          .lld__eyebrow { margin: 0 0 10px; }
          .lld__eng { margin-bottom: 8px; }

          .lld__camps { display: flex; flex-direction: column; gap: 8px; }
          .lld__camp { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 11px; }
          .lld__camp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
          .lld__camp-text { flex: 1; min-width: 0; }
          .lld__camp-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lld__camp-sub { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
          .lld__camp-open { text-align: right; flex: none; }
          .lld__camp-openval { font-size: 13px; font-weight: 600; display: block; }
          .lld__camp-openlbl { font-size: 10.5px; color: var(--muted); }

          .lld__noteshead { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 10px; }
          .lld__savenote { padding: 5px 11px; border-radius: 8px; font-size: 12px; font-weight: 600; background: var(--surface2); color: var(--muted); border: none; transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out); }
          .lld__savenote.is-dirty { background: var(--accent); color: #fff; }
          .lld__notes { width: 100%; box-sizing: border-box; min-height: 78px; resize: vertical; border: 1px solid var(--border2); border-radius: 11px; padding: 11px 13px; font-size: 13px; font-family: inherit; color: var(--text); background: var(--surface); outline: none; }
          .lld__notes:focus { border-color: var(--accent); }
        `}</style>
      </div>
    </div>
  );
}
