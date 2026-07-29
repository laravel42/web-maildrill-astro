/**
 * Browser cache for dashboard aggregates. Survives in-app navigation for
 * TTL_MS so revisiting /dashboard doesn't re-hit PostHog-backed stats.
 */
import type { Campaign } from '@/types/app';
import type { ChannelBreakdown } from '@/components/react/AppAnalytics.logic';
import type { FeedItem } from '@/components/react/AppDashboard.types';
import type { ActivityPoint, Summary } from '@/components/react/AppDashboard.logic';

export const DASHBOARD_CACHE_TTL_MS = 30 * 60 * 1000;
const KEY = 'md:dashboard:v1';

export type DashboardCache = {
  savedAt: number;
  summary: Summary | null;
  campaigns: Campaign[];
  feed: FeedItem[];
  /** Daily activity keyed by requested `days` query (e.g. 14 for a 7d window). */
  activityByDays: Record<string, ActivityPoint[]>;
  /** Channel breakdown keyed by selected window days. */
  channelsByDays: Record<string, ChannelBreakdown[]>;
};

function empty(): DashboardCache {
  return {
    savedAt: 0,
    summary: null,
    campaigns: [],
    feed: [],
    activityByDays: {},
    channelsByDays: {},
  };
}

export function readDashboardCache(): DashboardCache | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCache;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > DASHBOARD_CACHE_TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return {
      ...empty(),
      ...parsed,
      activityByDays: parsed.activityByDays ?? {},
      channelsByDays: parsed.channelsByDays ?? {},
    };
  } catch {
    return null;
  }
}

export function writeDashboardCache(patch: Partial<DashboardCache>): DashboardCache {
  const prev = readDashboardCache() ?? empty();
  const next: DashboardCache = {
    ...prev,
    ...patch,
    activityByDays: { ...prev.activityByDays, ...patch.activityByDays },
    channelsByDays: { ...prev.channelsByDays, ...patch.channelsByDays },
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
  return next;
}
