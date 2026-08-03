/**
 * Browser cache for dashboard aggregates. Survives in-app navigation for
 * TTL_MS so revisiting /dashboard doesn't re-hit PostHog-backed stats.
 *
 * Scoped per workspace: these figures are tenant-specific, and a single
 * shared key meant switching accounts in one browser session showed the
 * previous workspace's numbers — including an empty workspace's zeros on a
 * workspace full of data, for up to the whole TTL.
 */
import type { Campaign } from '@/types/app';
import type { ChannelBreakdown } from '@/components/react/AppAnalytics.logic';
import type { FeedItem } from '@/components/react/AppDashboard.types';
import type { ActivityPoint, Summary } from '@/components/react/AppDashboard.logic';

export const DASHBOARD_CACHE_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = 'md:dashboard:v1';

/** Null tenant (demo/preview) gets its own bucket rather than sharing one. */
const keyFor = (tenantId: string | null | undefined) => `${KEY_PREFIX}:${tenantId ?? 'anon'}`;

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

export function readDashboardCache(tenantId: string | null | undefined): DashboardCache | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(keyFor(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCache;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > DASHBOARD_CACHE_TTL_MS) {
      sessionStorage.removeItem(keyFor(tenantId));
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

export function writeDashboardCache(
  tenantId: string | null | undefined,
  patch: Partial<DashboardCache>,
): DashboardCache {
  const prev = readDashboardCache(tenantId) ?? empty();
  const next: DashboardCache = {
    ...prev,
    ...patch,
    activityByDays: { ...prev.activityByDays, ...patch.activityByDays },
    channelsByDays: { ...prev.channelsByDays, ...patch.channelsByDays },
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(keyFor(tenantId), JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
  return next;
}
