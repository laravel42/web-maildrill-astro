import type {
  AnalyticsPoint,
  Campaign,
  ListSummary,
  MediaAsset,
  Subscriber,
  TemplateItem,
} from '@/types/app';

/**
 * Seed data intentionally removed — the workspace is driven entirely by
 * maildrill-service. These typed empty arrays remain so screens not yet wired
 * to the service render clean empty states (and keep their imports valid) until
 * each is connected to a real endpoint.
 */
export const campaigns: Campaign[] = [];
export const subscribers: Subscriber[] = [];
export const templates: TemplateItem[] = [];
export const mediaAssets: MediaAsset[] = [];
export const lists: ListSummary[] = [];
export const analyticsSeries: AnalyticsPoint[] = [];
