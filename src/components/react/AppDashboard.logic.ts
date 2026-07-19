import { campaigns, lists } from '@/lib/app/mock-data';
import type { ActivityItem, ChannelPerf, GetStartedStep, Kpi } from './AppDashboard.types';

export const statusLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

// Derived from live workspace data (empty until the dashboard is wired). No
// fabricated metrics — engagement rates read as "—" until sends report back.
const totalSubs = lists.reduce((sum, l) => sum + l.subscribers, 0);
const sentCount = campaigns.filter((c) => c.status === 'sent').length;

export const kpis: Kpi[] = [
  { label: 'Active subscribers', value: totalSubs.toLocaleString('en-US'), delta: '—', up: false },
  { label: 'Lists', value: String(lists.length), delta: '—', up: false },
  { label: 'Campaigns', value: String(campaigns.length), delta: `${sentCount} sent`, up: false },
  { label: 'Emails sent today', value: '0', delta: '—', up: false },
  { label: 'Open rate', value: '—', delta: '—', up: false },
  { label: 'Click rate', value: '—', delta: '—', up: false },
];

export const recent = campaigns.slice(0, 4);
export const activity: ActivityItem[] = [];
export const channelPerf: ChannelPerf[] = [];

// Empty sparkline until analytics are wired.
export const sparkLine = '';
export const sparkArea = '';

// Onboarding checklist — UI guidance, kept for the empty workspace.
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
