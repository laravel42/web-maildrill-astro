import { useEffect, useMemo, useRef, useState } from 'react';
import { campaigns as allCampaigns } from '@/lib/app/mock-data';
import type { Campaign, CampaignStatus, ChannelType } from '@/types/app';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';

const NOW = new Date('2026-07-17T18:00:00Z').getTime();
function ago(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

const CHANNEL: Record<ChannelType, { color: string; tint: string; icon: IconName; label: string }> =
  {
    email: { color: 'var(--ch-email)', tint: 'var(--ch-email-tint)', icon: 'mail', label: 'Email' },
    sms: { color: 'var(--ch-sms)', tint: 'var(--ch-sms-tint)', icon: 'sms', label: 'SMS' },
    whatsapp: {
      color: 'var(--ch-whatsapp)',
      tint: 'var(--ch-whatsapp-tint)',
      icon: 'whatsapp',
      label: 'WhatsApp',
    },
    voice: {
      color: 'var(--ch-voice)',
      tint: 'var(--ch-voice-tint)',
      icon: 'voice',
      label: 'Voice',
    },
  };

const TABS: (CampaignStatus | 'all')[] = ['all', 'draft', 'scheduled', 'sending', 'sent', 'paused'];
const CHANNELS: ChannelType[] = ['email', 'sms', 'whatsapp', 'voice'];

type SortKey = 'name' | 'recipients' | 'openRate' | 'updatedAt';

function ChannelPill({ channel }: { channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <span className="apill" style={{ background: m.tint, color: m.color }}>
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}

function pct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export default function CampaignsBoard() {
  const [tab, setTab] = useState<CampaignStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<Set<ChannelType>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const bulk = (verb: string) => {
    showToast(`${verb} ${selected.size} campaign${selected.size === 1 ? '' : 's'}`);
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
        <button
          type="button"
          className="pbtn"
          onClick={() => showToast('Opening campaign wizard…')}
        >
          <Icon name="plus" size={15} stroke={2.2} />
          Create campaign
        </button>
      </div>

      {/* tabs */}
      <div className="cb__tabs atabs" role="tablist" aria-label="Campaign status">
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
      <div className="cb__toolbar">
        <label className="cb__search">
          <Icon name="search" size={15} className="cb__searchic" />
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
        <div className="cb__filterwrap">
          <button
            type="button"
            className={`cb__filter${channelFilter.size ? ' is-on' : ''}`}
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Icon name="filter" size={14} />
            Channel
            {channelFilter.size > 0 && (
              <span className="cb__filtercount">{channelFilter.size}</span>
            )}
            <Icon name="chevron-down" size={12} className="cb__filtercaret" />
          </button>
          {filterOpen && (
            <>
              <button
                type="button"
                className="cb__filterscrim"
                aria-label="Close"
                onClick={() => setFilterOpen(false)}
              />
              <div className="cb__filterpop">
                {CHANNELS.map((ch) => (
                  <label key={ch} className="cb__filteropt">
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
                    className="cb__filterclear"
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
        <div className="cb__bulk">
          <span className="cb__bulkcount">{selected.size} selected</span>
          <span className="cb__bulkdiv" />
          <button type="button" className="cb__bulkbtn" onClick={() => bulk('Duplicated')}>
            Duplicate
          </button>
          <button type="button" className="cb__bulkbtn" onClick={() => bulk('Archived')}>
            Archive
          </button>
          <button
            type="button"
            className="cb__bulkbtn cb__bulkbtn--danger"
            onClick={() => bulk('Deleted')}
          >
            Delete
          </button>
          <button type="button" className="cb__bulkclear" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* table */}
      <div className="atable cb__table">
        <div className="athead cb__grid">
          <div className="cb__check">
            <button
              type="button"
              className={`cb__box${allChecked ? ' is-on' : ''}`}
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
              className={`atrow cb__grid${selected.has(c.id) ? ' is-selected' : ''}`}
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
              <div className="cb__check" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`cb__box${selected.has(c.id) ? ' is-on' : ''}`}
                  onClick={() => toggleSelect(c.id)}
                  aria-label={`Select ${c.name}`}
                  aria-pressed={selected.has(c.id)}
                >
                  {selected.has(c.id) && <Icon name="check" size={11} stroke={3} />}
                </button>
              </div>
              <div className="cb__name">{c.name}</div>
              <div>
                <span className={`astatus astatus--${c.status}`}>{STATUS_LABEL[c.status]}</span>
              </div>
              <div>
                <ChannelPill channel={c.channel} />
              </div>
              <div className="cb__muted">{c.audience}</div>
              <div className="tnum cb__muted3">{c.recipients.toLocaleString('en-US')}</div>
              <div className="tnum cb__muted3">
                {c.openRate != null ? `${Math.round(c.openRate * 100)}%` : '—'}
              </div>
              <div className="cb__muted">{ago(c.updatedAt)}</div>
              <div className="cb__check" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="kbtn"
                  aria-label={`Actions for ${c.name}`}
                  onClick={() => showToast('Row menu')}
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
        <CampaignDrawer campaign={open} onClose={() => setOpenId(null)} onToast={showToast} />
      )}

      {toast && (
        <div className="cb__toast" role="status">
          <span className="cb__toast-ic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        .cb__tabs { margin-bottom: 16px; overflow-x: auto; }
        .cb__toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .cb__search { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 0 11px; width: 250px; max-width: 100%; }
        .cb__searchic { color: var(--muted); }
        .cb__search input { border: none; background: none; padding: 9px 0; font-size: 13px; color: var(--text); outline: none; width: 100%; }
        .cb__filterwrap { position: relative; }
        .cb__filter { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border2); padding: 8px 11px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--text2); }
        .cb__filter.is-on { background: var(--accent-tint); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
        .cb__filtercount { background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; padding: 0 3px; }
        .cb__filtercaret { opacity: .55; }
        .cb__filterscrim { position: fixed; inset: 0; z-index: 39; border: 0; background: none; }
        .cb__filterpop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 190px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); padding: 6px; animation: pop .14s ease; }
        .cb__filteropt { display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 8px; cursor: pointer; }
        .cb__filteropt:hover { background: var(--surface2); }
        .cb__filteropt input { width: 15px; height: 15px; accent-color: var(--accent); }
        .cb__filterclear { display: block; width: 100%; text-align: left; padding: 8px 9px; margin-top: 2px; border-top: 1px solid var(--divider); font-size: 12.5px; color: var(--muted); }

        .cb__bulk { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--accent-tint); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); border-radius: 12px; margin-bottom: 12px; animation: fade .18s ease; }
        .cb__bulkcount { font-size: 13px; font-weight: 600; color: var(--accent); }
        .cb__bulkdiv { width: 1px; height: 16px; background: var(--border2); }
        .cb__bulkbtn { padding: 6px 11px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border2); }
        .cb__bulkbtn:hover { background: var(--surface2); }
        .cb__bulkbtn--danger { color: var(--danger); border-color: #f3c9c9; }
        .cb__bulkclear { margin-left: auto; font-size: 12.5px; color: var(--muted); }

        .cb__grid { grid-template-columns: 36px 2fr .9fr 1fr 1.1fr .8fr .7fr .8fr 36px; }
        .cb__check { display: flex; align-items: center; justify-content: center; }
        .cb__box { width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--border2); background: var(--surface); display: flex; align-items: center; justify-content: center; color: #fff; transition: all .12s; }
        .cb__box.is-on { background: var(--accent); border-color: var(--accent); }
        .cb__name { font-weight: 500; }
        .cb__muted { color: var(--muted); }
        .cb__muted3 { color: var(--text3); }

        .cb__toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 11px; background: var(--text); color: #fff; padding: 12px 16px 12px 13px; border-radius: 12px; box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500; animation: toastin .22s cubic-bezier(.2,.8,.2,1); }
        .cb__toast-ic { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; }

        @media (max-width: 1100px) {
          .cb__grid { grid-template-columns: 36px 1.6fr .9fr 1fr .8fr .8fr 36px; }
          .cb__grid > :nth-child(5), .cb__grid > :nth-child(7) { display: none; }
        }
        @media (max-width: 720px) {
          .cb__grid { grid-template-columns: 30px 1.4fr .9fr .8fr 30px; }
          .cb__grid > :nth-child(4), .cb__grid > :nth-child(6) { display: none; }
        }
      `}</style>
    </div>
  );
}

function CampaignDrawer({
  campaign,
  onClose,
  onToast,
}: {
  campaign: Campaign;
  onClose: () => void;
  onToast: (m: string) => void;
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
          <div className="cbd__title-row">
            <ChannelPill channel={campaign.channel} />
            <span className={`astatus astatus--${campaign.status}`}>
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          <h3 className="cbd__name">{campaign.name}</h3>
          <p className="cbd__aud">To {campaign.audience}</p>

          {isSent ? (
            <div className="cbd__kpis">
              {kpis.map((k) => (
                <div key={k.label} className="cbd__kpi">
                  <div className="cbd__kpi-lbl">{k.label}</div>
                  <div className="tnum cbd__kpi-val" style={{ color: k.color }}>
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

          <p className="adrawer__eyebrow cbd__eyebrow">Details</p>
          <div className="cbd__details">
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
            onClick={() => onToast(isSent ? 'Opening report…' : 'Opening editor…')}
          >
            {isSent ? 'View report' : 'Edit'}
          </button>
        </div>

        <style>{`
          .cbd__title-row { display: flex; align-items: center; gap: 8px; }
          .cbd__name { font-size: 18px; font-weight: 600; letter-spacing: -.3px; margin: 14px 0 2px; }
          .cbd__aud { font-size: 13px; color: var(--text4); margin: 0 0 4px; }
          .cbd__kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
          .cbd__kpi { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px 13px; }
          .cbd__kpi-lbl { font-size: 11px; color: var(--muted); }
          .cbd__kpi-val { font-size: 19px; font-weight: 600; margin-top: 4px; }
          .cbd__eyebrow { margin: 24px 0 10px; }
          .cbd__details { }
        `}</style>
      </div>
    </div>
  );
}
