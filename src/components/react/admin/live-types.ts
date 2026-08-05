import type { AdminCampaign, BlogPost, Guide, Kpi, LegalDoc, Queue } from '@/lib/app/admin-data';

/**
 * Real (workspace-scoped) data slices for the admin console, produced server-side
 * and passed to the island. Every slice is nullable: when the backend or a
 * content source is unavailable the screen falls back to its preview dataset.
 *
 * These types are intentionally client-safe (no server imports) so the React
 * islands can consume them without pulling `node:crypto` into the browser bundle.
 */

export interface DailyPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface ChannelBreakdown {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface OverviewLive {
  kpis: Kpi[];
  daily: DailyPoint[];
  byChannel: ChannelBreakdown[];
}

export interface CampaignsLive {
  rows: AdminCampaign[];
  kpis: Kpi[];
}

export interface DeliverChannel {
  label: string;
  value: number;
  color: string;
}

export interface SuppressionRow {
  address: string;
  channel: string;
  reason: string | null;
}

export interface DeliverLive {
  kpis: Kpi[];
  channels: DeliverChannel[];
  suppressions: SuppressionRow[];
}

export interface QueuesLive {
  rows: Queue[];
  kpis: Kpi[];
}

export interface AdminLiveData {
  /** Name of the workspace the data is scoped to, for the status strip. */
  workspaceName: string | null;
  overview: OverviewLive | null;
  campaigns: CampaignsLive | null;
  deliver: DeliverLive | null;
  queues: QueuesLive | null;
  blog: BlogPost[] | null;
  guides: Guide[] | null;
  legal: LegalDoc[] | null;
}

/** Screens that can render real data; used to label Live vs Preview. */
export const LIVE_SCREENS = [
  'overview',
  'campaigns',
  'deliver',
  'queues',
  'blogCms',
  'guidesCms',
  'legalCms',
] as const;
