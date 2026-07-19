import { campaigns, lists } from '@/lib/app/mock-data';
import type { ActivityItem, ChannelPerf, GetStartedStep, Kpi } from './AppDashboard.types';

export const statusLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

const totalSubs = lists.reduce((sum, l) => sum + l.subscribers, 0);
const sentCount = campaigns.filter((c) => c.status === 'sent').length;

export const kpis: Kpi[] = [
  {
    label: 'Active subscribers',
    value: totalSubs.toLocaleString('en-US'),
    delta: '↑ 1,006 this month',
    up: true,
  },
  { label: 'Lists', value: String(lists.length), delta: 'All active', up: false },
  { label: 'Campaigns', value: String(campaigns.length), delta: `${sentCount} sent`, up: false },
  { label: 'Emails sent today', value: '0', delta: '—', up: false },
  { label: 'Open rate', value: '43%', delta: '↑ 4% vs 30d', up: true },
  { label: 'Click rate', value: '12%', delta: '↑ 2% vs 30d', up: true },
];

export const recent = campaigns.slice(0, 4);

export const activity: ActivityItem[] = [
  {
    icon: 'subscribers',
    bg: 'var(--accent-tint)',
    color: 'var(--accent)',
    text: 'Imported 300 contacts to VIP buyers',
    time: '2 hours ago',
  },
  {
    icon: 'edit',
    bg: 'var(--surface2)',
    color: 'var(--text4)',
    text: 'Winback draft created',
    time: '3 hours ago',
  },
  {
    icon: 'templates',
    bg: 'var(--warning-bg)',
    color: 'var(--warning)',
    text: 'Template "Product launch" updated',
    time: '5 hours ago',
  },
  {
    icon: 'plus',
    bg: 'var(--success-bg)',
    color: 'var(--success-strong)',
    text: 'Recent buyers list created',
    time: 'Yesterday',
  },
];

export const channelPerf: ChannelPerf[] = [
  { channel: 'email', sent: '11,240', open: '43.2%', click: '12.1%', openW: 43 },
  { channel: 'sms', sent: '980', open: '61.4%', click: '24.3%', openW: 61 },
  { channel: 'whatsapp', sent: '260', open: '88.5%', click: '31.2%', openW: 88 },
  { channel: 'voice', sent: '95', open: '71.0%', click: '—', openW: 71 },
];

const spark = [32, 34, 33, 38, 36, 40, 39, 43, 41, 44];

function sparkPoints(pts: number[], w: number, h: number): string {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const rng = max - min || 1;
  return pts
    .map(
      (p, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((p - min) / rng) * h).toFixed(1)}`,
    )
    .join(' ');
}

export const sparkLine = sparkPoints(spark, 320, 66);
export const sparkArea = `${sparkLine} 320,70 0,70`;

export const getStarted: GetStartedStep[] = [
  {
    label: 'Import your contacts',
    bg: 'var(--surface2)',
    ring: '#22c55e',
    fill: '#22c55e',
    text: 'var(--text3)',
  },
  {
    label: 'Create your first campaign',
    bg: 'var(--accent-tint)',
    ring: 'var(--accent)',
    fill: 'transparent',
    text: 'var(--accent)',
  },
  {
    label: 'Send your first email',
    bg: 'var(--surface2)',
    ring: 'var(--muted2)',
    fill: 'transparent',
    text: 'var(--text4)',
  },
];
