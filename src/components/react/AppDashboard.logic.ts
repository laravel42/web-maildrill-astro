import type { Campaign } from '@/types/app';
import type { ActivityItem, ChannelPerf, GetStartedStep, Kpi } from './AppDashboard.types';

export const statusLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

/** Live workspace counters from /v1/stats/summary. */
export type Summary = {
  subscribers: { total: number; active: number };
  lists: number;
  campaigns: { total: number; sent: number };
  messages: { total: number; delivered: number; failed: number; sentToday: number };
};

/** One day of send activity from /v1/stats/activity. */
export type ActivityPoint = { date: string; sent: number; delivered: number; failed: number };

const n = (v: number) => v.toLocaleString('en-US');

/**
 * KPI cards. Open and click rate stay "—" on purpose: no provider engagement
 * events are normalized yet, so any percentage here would be invented. The
 * delivered rate is real — it comes from message state.
 */
export function buildKpis(s: Summary | null): Kpi[] {
  if (!s) {
    return [
      { label: 'Active subscribers', value: '—', delta: '—', up: false },
      { label: 'Lists', value: '—', delta: '—', up: false },
      { label: 'Campaigns', value: '—', delta: '—', up: false },
      { label: 'Messages sent today', value: '—', delta: '—', up: false },
      { label: 'Open rate', value: '—', delta: 'Needs open tracking', up: false },
      { label: 'Click rate', value: '—', delta: 'Needs click tracking', up: false },
    ];
  }
  const deliveredPct = s.messages.total
    ? `${((s.messages.delivered / s.messages.total) * 100).toFixed(1)}% delivered`
    : '—';
  return [
    {
      label: 'Active subscribers',
      value: n(s.subscribers.active),
      delta: s.subscribers.total === s.subscribers.active ? '—' : `${n(s.subscribers.total)} total`,
      up: false,
    },
    { label: 'Lists', value: n(s.lists), delta: '—', up: false },
    {
      label: 'Campaigns',
      value: n(s.campaigns.total),
      delta: `${n(s.campaigns.sent)} sent`,
      up: false,
    },
    {
      label: 'Messages sent today',
      value: n(s.messages.sentToday),
      delta: deliveredPct,
      up: false,
    },
    { label: 'Open rate', value: '—', delta: 'Needs open tracking', up: false },
    { label: 'Click rate', value: '—', delta: 'Needs click tracking', up: false },
  ];
}

export function buildRecent(campaigns: Campaign[]): Campaign[] {
  return campaigns.slice(0, 4);
}

export const activity: ActivityItem[] = [];
export const channelPerf: ChannelPerf[] = [];

/**
 * Sparkline path over daily sends. Returns empty strings when there is nothing
 * to plot so the caller can show an empty state instead of a flat line that
 * reads as "zero activity measured".
 */
export function buildSpark(points: ActivityPoint[]): { line: string; area: string; max: number } {
  if (points.length < 2) return { line: '', area: '', max: 0 };
  const max = Math.max(...points.map((p) => p.sent));
  if (max === 0) return { line: '', area: '', max: 0 };
  const W = 100;
  const H = 32;
  const step = W / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - (p.sent / max) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return {
    line: coords.join(' '),
    area: `0,${H} ${coords.join(' ')} ${W},${H}`,
    max,
  };
}

/**
 * Onboarding checklist, completed from real workspace state rather than always
 * showing a green tick.
 */
export function buildGetStarted(s: Summary | null): GetStartedStep[] {
  const done = (v: boolean): Pick<GetStartedStep, 'bg' | 'ring' | 'fill' | 'text'> =>
    v
      ? { bg: 'var(--surface2)', ring: '#22c55e', fill: '#22c55e', text: 'var(--text3)' }
      : { bg: 'var(--accent-tint)', ring: 'var(--accent)', fill: 'transparent', text: 'var(--accent)' };
  return [
    { label: 'Import your contacts', ...done((s?.subscribers.total ?? 0) > 0) },
    { label: 'Create your first campaign', ...done((s?.campaigns.total ?? 0) > 0) },
    { label: 'Send your first email', ...done((s?.messages.total ?? 0) > 0) },
  ];
}

/** Steps render a check only once actually complete. */
export function isStepDone(step: GetStartedStep): boolean {
  return step.fill === '#22c55e';
}
