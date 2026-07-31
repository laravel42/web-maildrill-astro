import { lists as baseLists } from '@/lib/app/mock-data';
import type { ListMeta, ListRow } from './AppLists.types';

/** Rows shown per page in the lists table/cards. */
export const PAGE_SIZE = 15;

const META: Record<string, ListMeta> = {
  list_1: {
    color: '#4f46e5',
    trend: [16800, 17150, 17480, 17720, 17980, 18220, 18420],
    gdprConsent: true,
    tags: ['Marketing', 'VIP', 'Opt-in'],
    notes: 'Used for the weekly product newsletter. Keep double opt-in on for GDPR.',
    more: '+240',
    openRate: '58.2%',
    clickRate: '12.1%',
  },
  list_2: {
    color: '#f59e0b',
    trend: [58200, 58720, 59180, 59520, 59810, 60050, 60211],
    gdprConsent: true,
    tags: ['Weekly', 'Opt-in'],
    notes: '',
    more: '+18',
    openRate: '46.7%',
    clickRate: '9.4%',
  },
  list_3: {
    color: '#22c55e',
    trend: [2510, 2680, 2840, 2980, 3080, 3160, 3200],
    gdprConsent: false,
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
    gdprConsent: false,
    tags: [],
    notes: '',
    more: '+0',
    openRate: '—',
    clickRate: '—',
  }),
}));

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
