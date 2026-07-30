import { lists as baseLists } from '@/lib/app/mock-data';
import type { ApiCampaign } from '@/lib/app/campaign-map';
import { ago } from './shared/time';
import type { ListMeta, ListRow } from './AppLists.types';

/** Rows shown per page in the lists table/cards. */
export const PAGE_SIZE = 15;

const META: Record<string, ListMeta> = {
  list_1: {
    color: '#4f46e5',
    trend: [16800, 17150, 17480, 17720, 17980, 18220, 18420],
    recentCampaign: 'Spring Launch',
    tags: ['Marketing', 'VIP', 'Opt-in'],
    notes: 'Used for the weekly product newsletter. Keep double opt-in on for GDPR.',
    more: '+240',
    openRate: '58.2%',
    clickRate: '12.1%',
  },
  list_2: {
    color: '#f59e0b',
    trend: [58200, 58720, 59180, 59520, 59810, 60050, 60211],
    recentCampaign: 'Welcome Series',
    tags: ['Weekly', 'Opt-in'],
    notes: '',
    more: '+18',
    openRate: '46.7%',
    clickRate: '9.4%',
  },
  list_3: {
    color: '#22c55e',
    trend: [2510, 2680, 2840, 2980, 3080, 3160, 3200],
    recentCampaign: 'Order shipped SMS',
    tags: ['Automation', 'Transactional'],
    notes: '',
    more: '+12',
    openRate: '71.4%',
    clickRate: '18.9%',
  },
};

export const rows: ListRow[] = baseLists.map((l) => ({
  ...l,
  ...(META[l.id] ?? {
    color: '#4f46e5',
    trend: [l.subscribers],
    recentCampaign: '—',
    tags: [],
    notes: '',
    more: '+0',
    openRate: '—',
    clickRate: '—',
  }),
}));

export const AVATAR_GRADS = [
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#818cf8,#4f46e5)',
  'linear-gradient(135deg,#34d399,#059669)',
];

/** One row in the drawer's "Recent campaigns" section. */
export interface DrawerCampaign {
  name: string;
  status: string;
  when: string;
  open: string | null;
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

/**
 * The three most recent campaigns targeting a list, with real open rates.
 * Opens only exist for channels that track them (email, WhatsApp); SMS and
 * voice campaigns — and anything not yet sent — show "—".
 */
export function recentCampaignRows(all: ApiCampaign[], listId: string): DrawerCampaign[] {
  const at = (c: ApiCampaign) =>
    new Date(c.completedAt ?? c.updatedAt ?? c.createdAt ?? 0).getTime();
  return all
    .filter((c) => c.listId === listId)
    .sort((a, b) => at(b) - at(a))
    .slice(0, 3)
    .map((c) => {
      const sentAt = c.completedAt ?? c.updatedAt;
      const delivered = c.delivered ?? 0;
      const tracked = c.channel === 'email' || c.channel === 'whatsapp';
      return {
        name: c.name,
        status: CAMPAIGN_STATUS_LABEL[c.status ?? ''] ?? '—',
        when: c.status === 'sent' && sentAt ? ago(sentAt) : '—',
        open:
          c.status === 'sent' && tracked && delivered > 0
            ? `${Math.round(((c.opened ?? 0) / delivered) * 100)}%`
            : null,
      };
    });
}

export function fmtPct(pct: number): string {
  const arrow = pct >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}

export function weeklyGain(trend: number[]): number {
  if (trend.length < 2) return 0;
  return trend[trend.length - 1] - trend[trend.length - 2];
}

// SVG area+line sparkline for the subscriber-trend chart.
export function trendPath(pts: number[], w: number, h: number, pad = 5) {
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
