import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/app/api';
import { fetchWallet, fetchWalletTransactions } from '@/lib/app/billing';
import { toCampaigns, type ApiCampaign } from '@/lib/app/campaign-map';
import type { ApiTemplate } from '@/lib/app/template-map';
import { routes } from '@/config/routes';
import type { IconName } from '@/lib/icons';
import Icon from '../Icon';
import { CHANNEL } from './channels';
import styles from './NotificationsInbox.module.css';

/**
 * Topbar notifications: a derived inbox over what actually happened in the
 * workspace — campaign sends, WhatsApp template approvals, billing events —
 * assembled from the tenant APIs on open (no notifications table exists).
 * The unread dot compares item timestamps against a local last-opened marker,
 * so it only lights for activity the user hasn't seen.
 */

type InboxItem = {
  id: string;
  icon: IconName;
  tone: 'ok' | 'warn' | 'info';
  title: string;
  detail: string;
  /** Epoch ms of the underlying event — sorting and unread both key off it. */
  ts: number;
  href: string;
  /** Standing alerts (low balance) show pinned but never light the dot. */
  alert?: boolean;
};

const SEEN_KEY = 'md:inbox-seen:v1';
const CACHE_KEY = 'md:inbox:v1';
const CACHE_TTL_MS = 5 * 60_000;
const WINDOW_MS = 14 * 86_400_000;
const MAX_ITEMS = 12;

const readSeen = (): number => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeSeen = (at: number): void => {
  try {
    localStorage.setItem(SEEN_KEY, String(at));
  } catch {
    /* private mode */
  }
};
const readCache = (): InboxItem[] | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; items: InboxItem[] };
    return Date.now() - parsed.at < CACHE_TTL_MS ? parsed.items : null;
  } catch {
    return null;
  }
};
const writeCache = (items: InboxItem[]): void => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* quota/private mode */
  }
};

const ago = (ts: number): string => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
};

const atDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const usd = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function loadInbox(): Promise<InboxItem[]> {
  const cutoff = Date.now() - WINDOW_MS;
  const [campaignsRes, templatesRes, walletRes, txRes] = await Promise.allSettled([
    api.get<{ data: ApiCampaign[] }>('campaigns'),
    api.get<{ data: ApiTemplate[] }>('templates'),
    fetchWallet(),
    fetchWalletTransactions(),
  ]);

  const items: InboxItem[] = [];

  if (walletRes.status === 'fulfilled' && walletRes.value.lowBalance) {
    items.push({
      id: 'wallet-low',
      icon: 'alert-triangle',
      tone: 'warn',
      title: `Balance low — ${usd(walletRes.value.balanceUsd)} left`,
      detail: 'Top up to keep sending',
      ts: Date.now(),
      href: routes.app.settings,
      alert: true,
    });
  }

  if (campaignsRes.status === 'fulfilled') {
    for (const c of toCampaigns(campaignsRes.value.data)) {
      const meta = CHANNEL[c.channel];
      const report = routes.app.campaignReport(c.id);
      if (c.status === 'sent' && c.completedAt) {
        const ts = Date.parse(c.completedAt);
        if (ts >= cutoff) {
          items.push({
            id: `sent-${c.id}`,
            icon: meta.icon,
            tone: 'ok',
            title: `“${c.name}” delivered`,
            detail: `${meta.label} campaign · ${c.delivered.toLocaleString('en-US')} delivered · ${ago(ts)}`,
            ts,
            href: report,
          });
        }
      } else if (c.status === 'sending') {
        const ts = Date.parse(c.startedAt ?? c.updatedAt);
        items.push({
          id: `sending-${c.id}`,
          icon: meta.icon,
          tone: 'info',
          title: `“${c.name}” is sending`,
          detail: `${meta.label} campaign · started ${ago(ts)}`,
          ts,
          href: report,
        });
      } else if (c.status === 'scheduled' && c.scheduledAt) {
        const sendAt = Date.parse(c.scheduledAt);
        // Unread keys off when the scheduling happened, not the future send.
        const ts = Date.parse(c.updatedAt);
        if (sendAt > Date.now()) {
          items.push({
            id: `scheduled-${c.id}`,
            icon: 'clock',
            tone: 'info',
            title: `“${c.name}” scheduled`,
            detail: `${meta.label} campaign · sends ${atDate(sendAt)}`,
            ts,
            href: report,
          });
        }
      }
    }
  }

  if (templatesRes.status === 'fulfilled') {
    for (const t of templatesRes.value.data) {
      if (t.channel !== 'whatsapp') continue;
      const status = t.approvalStatus;
      if (status !== 'approved' && status !== 'rejected') continue;
      const ts = Date.parse(t.updatedAt ?? t.createdAt ?? '');
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      items.push({
        id: `tpl-${t.id}`,
        icon: CHANNEL.whatsapp.icon,
        tone: status === 'approved' ? 'ok' : 'warn',
        title: `Template “${t.name}” ${status === 'approved' ? 'approved' : 'rejected'} by Meta`,
        detail: ago(ts),
        ts,
        href: `${routes.app.templateBuilder('whatsapp')}?id=${encodeURIComponent(t.id)}`,
      });
    }
  }

  if (txRes.status === 'fulfilled') {
    for (const tx of txRes.value) {
      if (tx.amountUsd <= 0 || tx.type === 'consumption') continue;
      const ts = Date.parse(tx.createdAt);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      items.push({
        id: `tx-${tx.id}`,
        icon: 'check',
        tone: 'ok',
        title: `${usd(tx.amountUsd)} credit added`,
        detail: tx.description ? `${tx.description} · ${ago(ts)}` : ago(ts),
        ts,
        href: routes.app.settings,
      });
    }
  }

  return items
    .sort((a, b) => Number(b.alert ?? false) - Number(a.alert ?? false) || b.ts - a.ts)
    .slice(0, MAX_ITEMS);
}

const hasUnread = (items: InboxItem[], seen: number): boolean =>
  items.some((i) => !i.alert && i.ts > seen);

export default function NotificationsInbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Dot on mount: cached items when fresh, one background fetch otherwise.
  useEffect(() => {
    let alive = true;
    const seen = readSeen();
    const cached = readCache();
    if (cached) {
      setUnread(hasUnread(cached, seen));
      return;
    }
    void loadInbox()
      .then((fresh) => {
        writeCache(fresh);
        if (alive) setUnread(hasUnread(fresh, seen));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    setLoading(true);
    void loadInbox()
      .then((fresh) => {
        writeCache(fresh);
        setItems(fresh);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // Opening is reading: the dot clears and stays off until new activity.
    writeSeen(Date.now());
    setUnread(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className="iconbtn"
        title="Notifications"
        aria-label={unread ? 'Notifications — new activity' : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <Icon name="inbox" size={16} />
        {unread && <span className={styles.dot} aria-hidden="true" />}
      </button>
      {open && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Notifications"
          style={{ animation: 'pop 0.16s var(--ease-out)' }}
        >
          <div className={styles.head}>
            <span className={styles.title}>Notifications</span>
          </div>
          <div className={styles.list}>
            {loading ? (
              [0, 1, 2].map((i) => <div key={i} className={styles.skelRow} aria-hidden="true" />)
            ) : items.length === 0 ? (
              <p className={styles.empty}>
                Nothing new here yet — campaign, template, and billing activity shows up as it
                happens.
              </p>
            ) : (
              items.map((item) => (
                <a key={item.id} className={styles.item} href={item.href}>
                  <span
                    className={`${styles.bubble} ${
                      item.tone === 'ok'
                        ? styles.toneOk
                        : item.tone === 'warn'
                          ? styles.toneWarn
                          : styles.toneInfo
                    }`}
                    aria-hidden="true"
                  >
                    <Icon name={item.icon} size={14} />
                  </span>
                  <span className={styles.main}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemSub}>{item.detail}</span>
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
