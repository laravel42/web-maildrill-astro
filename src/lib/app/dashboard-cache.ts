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
/* Bumped to v2 with the summary's `trends` block: it went from five weekly
   series (two of them precomputed rates) to six daily count series. A v1 entry
   parses fine and would have fed the KPI cards a shape whose fields no longer
   exist — em-dash cards for the rest of the TTL. The version is part of the
   key rather than a field so a stale entry is never read at all. */
const KEY_PREFIX = 'md:dashboard:v2';

/** Null tenant (demo/preview) gets its own bucket rather than sharing one. */
const keyFor = (tenantId: string | null | undefined) => `${KEY_PREFIX}:${tenantId ?? 'anon'}`;

/**
 * Slices are optional on purpose: absent means "never fetched successfully",
 * which is what lets the dashboard retry them. Storing `summary: null` for a
 * failed request instead made the entry look complete, so every visit for the
 * rest of the TTL skipped the fetch and rendered em-dash KPIs.
 */
export type DashboardCache = {
  savedAt: number;
  summary?: Summary;
  campaigns?: Campaign[];
  feed?: FeedItem[];
  /** Daily activity keyed by requested `days` query (e.g. 14 for a 7d window). */
  activityByDays: Record<string, ActivityPoint[]>;
  /** Channel breakdown keyed by selected window days. */
  channelsByDays: Record<string, ChannelBreakdown[]>;
};

function empty(): DashboardCache {
  return {
    savedAt: 0,
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
      // A legacy entry (or a poisoned one) can carry an explicit null here.
      summary: parsed.summary ?? undefined,
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
