import { useEffect, useMemo, useRef, useState } from 'react';
import { campaigns as allCampaigns } from '@/lib/app/mock-data';
import type { Campaign, CampaignStatus, ChannelType } from '@/types/app';
import Icon from './Icon';
import CampaignWizard from './CampaignWizard';
import EmailBuilder from './EmailBuilder';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { ago } from './shared/time';
import { useToast } from './shared/useToast';
import { STATUS_LABEL, TABS, pct } from './CampaignsBoard.logic';
import type { SortKey } from './CampaignsBoard.types';
import styles from './CampaignsBoard.module.css';

function ChannelPill({ channel }: { channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <span className="apill" style={{ background: m.tint, color: m.color }}>
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}

export default function CampaignsBoard() {
  const [tab, setTab] = useState<CampaignStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<Set<ChannelType>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, show } = useToast(2600);
  const [wizard, setWizard] = useState<
    { mode: 'create' } | { mode: 'edit'; channel: ChannelType; name: string } | null
  >(null);
  const [builder, setBuilder] = useState<{ channel: ChannelType; name: string | null } | null>(
    null,
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allCampaigns.length };
    for (const t of TABS) if (t !== 'all') c[t] = allCampaigns.filter((x) => x.status === t).length;
    return c;
  }, []);

  const rows = useMemo(() => {
    let list = allCampaigns.filter((c) => {
      if (tab !== 'all' && c.status !== tab) return false;
      if (channelFilter.size > 0 && !channelFilter.has(c.channel)) return false;
      if (query) {
        const q = query.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.audience.toLowerCase().includes(q);
      }
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      let av: number | string = a[key] ?? '';
      let bv: number | string = b[key] ?? '';
      if (key === 'updatedAt') {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [tab, query, channelFilter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const bulk = (verb: string) => {
    show(`${verb} ${selected.size} campaign${selected.size === 1 ? '' : 's'}`);
    setSelected(new Set());
  };

  const toggleChannel = (ch: ChannelType) => {
    setChannelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
    setSelected(new Set()); // changing filters clears selection (spec §12)
  };

  const open = openId ? (allCampaigns.find((c) => c.id === openId) ?? null) : null;
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  return (
    <div className="screen cb">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Campaigns</h1>
          <p className="screen__sub">Create, schedule, and measure every send in one place.</p>
        </div>
        <button type="button" className="pbtn" onClick={() => setWizard({ mode: 'create' })}>
          <Icon name="plus" size={15} stroke={2.2} />
          Create campaign
        </button>
      </div>

      {/* tabs */}
      <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Campaign status">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`atab${tab === t ? ' is-active' : ''}`}
            onClick={() => {
              setTab(t);
              setSelected(new Set());
            }}
          >
            {t === 'all' ? 'All' : STATUS_LABEL[t]}
            <span className="atab__count tnum">{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} className={styles.searchic} />
          <input
            type="search"
            placeholder="Search campaigns…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(new Set());
            }}
            aria-label="Search campaigns"
          />
        </label>
        <div className={styles.filterwrap}>
          <button
            type="button"
            className={`${styles.filter}${channelFilter.size ? ' is-on' : ''}`}
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Icon name="filter" size={14} />
            Channel
            {channelFilter.size > 0 && (
              <span className={styles.filtercount}>{channelFilter.size}</span>
            )}
            <Icon name="chevron-down" size={12} className={styles.filtercaret} />
          </button>
          {filterOpen && (
            <>
              <button
                type="button"
                className={styles.filterscrim}
                aria-label="Close"
                onClick={() => setFilterOpen(false)}
              />
              <div className={styles.filterpop} style={{ animation: 'pop .14s ease' }}>
                {CHANNEL_ORDER.map((ch) => (
                  <label key={ch} className={styles.filteropt}>
                    <input
                      type="checkbox"
                      checked={channelFilter.has(ch)}
                      onChange={() => toggleChannel(ch)}
                    />
                    <ChannelPill channel={ch} />
                  </label>
                ))}
                {channelFilter.size > 0 && (
                  <button
                    type="button"
                    className={styles.filterclear}
                    onClick={() => {
                      setChannelFilter(new Set());
                      setSelected(new Set());
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* bulk bar */}
      {selected.size > 0 && (
        <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
          <span className={styles.bulkcount}>{selected.size} selected</span>
          <span className={styles.bulkdiv} />
          <button type="button" className={styles.bulkbtn} onClick={() => bulk('Duplicated')}>
            Duplicate
          </button>
          <button type="button" className={styles.bulkbtn} onClick={() => bulk('Archived')}>
            Archive
          </button>
          <button
            type="button"
            className={`${styles.bulkbtn} ${styles.bulkbtnDanger}`}
            onClick={() => bulk('Deleted')}
          >
            Delete
          </button>
          <button type="button" className={styles.bulkclear} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* table */}
      <div className="atable cb__table">
        <div className={`athead ${styles.grid}`}>
          <div className={styles.check}>
            <button
              type="button"
              className={`${styles.box}${allChecked ? ' is-on' : ''}`}
              onClick={toggleAll}
              aria-label="Select all"
              aria-pressed={allChecked}
            >
              {allChecked && <Icon name="check" size={11} stroke={3} />}
            </button>
          </div>
          <div>
            <button type="button" onClick={() => toggleSort('name')}>
              Campaign <span className="tnum">{sortArrow('name')}</span>
            </button>
          </div>
          <div>Status</div>
          <div>Channel</div>
          <div>Audience</div>
          <div>
            <button type="button" onClick={() => toggleSort('recipients')}>
              Recipients <span className="tnum">{sortArrow('recipients')}</span>
            </button>
          </div>
          <div>
            <button type="button" onClick={() => toggleSort('openRate')}>
              Open <span className="tnum">{sortArrow('openRate')}</span>
            </button>
          </div>
          <div>
            <button type="button" onClick={() => toggleSort('updatedAt')}>
              Updated <span className="tnum">{sortArrow('updatedAt')}</span>
            </button>
          </div>
          <div />
        </div>

        {rows.length === 0 ? (
          <div className="atable__empty">No campaigns match your filters.</div>
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              className={`atrow ${styles.grid}${selected.has(c.id) ? ' is-selected' : ''}`}
              onClick={() => setOpenId(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                // Ignore key events bubbling up from the nested checkbox/kebab buttons.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenId(c.id);
                }
              }}
            >
              <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`${styles.box}${selected.has(c.id) ? ' is-on' : ''}`}
                  onClick={() => toggleSelect(c.id)}
                  aria-label={`Select ${c.name}`}
                  aria-pressed={selected.has(c.id)}
                >
                  {selected.has(c.id) && <Icon name="check" size={11} stroke={3} />}
                </button>
              </div>
              <div className={styles.name}>{c.name}</div>
              <div>
                <span className={`astatus astatus--${c.status}`}>{STATUS_LABEL[c.status]}</span>
              </div>
              <div>
                <ChannelPill channel={c.channel} />
              </div>
              <div className={styles.muted}>{c.audience}</div>
              <div className={`tnum ${styles.muted3}`}>{c.recipients.toLocaleString('en-US')}</div>
              <div className={`tnum ${styles.muted3}`}>
                {c.openRate != null ? `${Math.round(c.openRate * 100)}%` : '—'}
              </div>
              <div className={styles.muted}>{ago(c.updatedAt)}</div>
              <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="kbtn"
                  aria-label={`Actions for ${c.name}`}
                  onClick={() => show('Row menu')}
                >
                  <Icon name="more" size={16} />
                </button>
              </div>
            </div>
          ))
        )}

        <div className="atable__foot">
          <span className="tnum">
            {rows.length} of {allCampaigns.length} campaigns
          </span>
        </div>
      </div>

      {/* detail drawer */}
      {open && (
        <CampaignDrawer
          campaign={open}
          onClose={() => setOpenId(null)}
          onToast={show}
          onEdit={() => {
            const c = open;
            setOpenId(null);
            setWizard({ mode: 'edit', channel: c.channel, name: c.name });
          }}
        />
      )}

      {wizard && (
        <CampaignWizard
          mode={wizard.mode}
          initialChannel={wizard.mode === 'edit' ? wizard.channel : 'email'}
          initialName={wizard.mode === 'edit' ? wizard.name : ''}
          onClose={() => setWizard(null)}
          onDone={(msg) => {
            setWizard(null);
            show(msg);
          }}
          onOpenBuilder={(channel, name) => {
            setWizard(null);
            setBuilder({ channel, name });
          }}
        />
      )}

      {builder && (
        <EmailBuilder
          channel={builder.channel}
          name={builder.name}
          kind="campaign"
          onClose={() => setBuilder(null)}
          onSave={({ name }) => {
            setBuilder(null);
            show(name && name !== 'Untitled' ? `“${name}” saved` : 'Draft saved');
          }}
        />
      )}

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
    </div>
  );
}

function CampaignDrawer({
  campaign,
  onClose,
  onToast,
  onEdit,
}: {
  campaign: Campaign;
  onClose: () => void;
  onToast: (m: string) => void;
  onEdit: () => void;
}) {
  const m = CHANNEL[campaign.channel];
  const isSent = campaign.status === 'sent';
  const deliveredPct = campaign.recipients ? (campaign.delivered / campaign.recipients) * 100 : 0;
  const cto =
    campaign.openRate && campaign.clickRate ? (campaign.clickRate / campaign.openRate) * 100 : null;

  const kpis = [
    {
      label: 'Recipients',
      value: campaign.recipients.toLocaleString('en-US'),
      color: 'var(--text)',
    },
    { label: 'Delivered', value: `${deliveredPct.toFixed(1)}%`, color: 'var(--text)' },
    { label: 'Open rate', value: pct(campaign.openRate), color: 'var(--success-strong)' },
    { label: 'Click rate', value: pct(campaign.clickRate), color: 'var(--accent)' },
    {
      label: 'Click-to-open',
      value: cto == null ? '—' : `${cto.toFixed(1)}%`,
      color: 'var(--warning-strong)',
    },
    {
      label: 'Unsubscribed',
      value: campaign.unsubscribed.toLocaleString('en-US'),
      color: 'var(--danger)',
    },
  ];

  // Focus management: focus into the panel on open, trap Tab, Esc closes, restore focus.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const list = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    list()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const els = list();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="adrawer cbd"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${campaign.name} details`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">Campaign details</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="adrawer__body">
          <div className={styles.drawerTitleRow}>
            <ChannelPill channel={campaign.channel} />
            <span className={`astatus astatus--${campaign.status}`}>
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          <h3 className={styles.drawerName}>{campaign.name}</h3>
          <p className={styles.drawerAud}>To {campaign.audience}</p>

          {isSent ? (
            <div className={styles.drawerKpis}>
              {kpis.map((k) => (
                <div key={k.label} className={styles.drawerKpi}>
                  <div className={styles.drawerKpiLbl}>{k.label}</div>
                  <div className={`tnum ${styles.drawerKpiVal}`} style={{ color: k.color }}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="aempty" style={{ marginTop: 18 }}>
              Performance metrics appear here once this campaign has been sent.
            </div>
          )}

          <p className={`adrawer__eyebrow ${styles.drawerEyebrow}`}>Details</p>
          <div className={styles.drawerDetails}>
            <div className="adetail">
              <span className="adetail__k">Channel</span>
              <span className="adetail__v">{m.label}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Audience</span>
              <span className="adetail__v">{campaign.audience}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Scheduled</span>
              <span className="adetail__v">
                {campaign.scheduledAt
                  ? new Date(campaign.scheduledAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
              </span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Recipients</span>
              <span className="adetail__v tnum">{campaign.recipients.toLocaleString('en-US')}</span>
            </div>
          </div>
        </div>
        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 1 }}
            onClick={() => onToast('Campaign duplicated')}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            onClick={() => (isSent ? onToast('Opening report…') : onEdit())}
          >
            {isSent ? 'View report' : 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );
}
