import type { Campaign, CampaignStatus, ChannelType } from '@/types/app';
import type { CampaignDraft } from '@/components/react/CampaignWizard.types';

/** Shape of a campaign as returned by workers /v1/campaigns. */
export interface ApiCampaign {
  id: string;
  name: string;
  status?: string | null;
  channel?: string | null;
  listId?: string | null;
  segmentId?: string | null;
  templateId?: string | null;
  /** Ad-hoc body for non-email channels, when no template is used. */
  content?: Record<string, unknown> | null;
  /** Derived server-side: list name, segment name, or "All subscribers". */
  audience?: string | null;
  recipients?: number | null;
  delivered?: number | null;
  failed?: number | null;
  /** Messages past queued/processing (submitted → terminal). */
  accepted?: number | null;
  lastErrorMessage?: string | null;
  scheduledAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'sending', 'sent', 'paused'];

function toStatus(s?: string | null): CampaignStatus {
  return STATUSES.includes(s as CampaignStatus) ? (s as CampaignStatus) : 'draft';
}

function toChannel(c?: string | null): ChannelType {
  return c === 'sms' || c === 'whatsapp' || c === 'voice' ? c : 'email';
}

/**
 * Map a live API campaign into the board's row shape. Counters come from the
 * service (derived from real messages); open/click rates and unsubscribes stay
 * null/0 until provider engagement events are normalized — no invented numbers.
 */
export function toCampaign(c: ApiCampaign): Campaign {
  return {
    id: c.id,
    name: c.name,
    status: toStatus(c.status),
    channel: toChannel(c.channel),
    audience: c.audience || 'All subscribers',
    listId: c.listId ?? null,
    segmentId: c.segmentId ?? null,
    templateId: c.templateId ?? null,
    scheduledAt: c.scheduledAt ?? null,
    openRate: null,
    clickRate: null,
    updatedAt: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
    recipients: c.recipients ?? 0,
    delivered: c.delivered ?? 0,
    failed: c.failed ?? 0,
    accepted: c.accepted ?? 0,
    unsubscribed: 0,
  };
}

export function toCampaigns(rows: ApiCampaign[]): Campaign[] {
  return rows.map(toCampaign);
}

/** Read saved multi-audience selection from campaign content, with single-id fallback. */
export function audienceIdsFromApiCampaign(c: ApiCampaign): string[] {
  const stored = c.content?.audienceIds;
  if (Array.isArray(stored) && stored.every((x) => typeof x === 'string')) {
    return stored;
  }
  const single = c.listId ?? c.segmentId;
  return single ? [single] : [];
}

/** Map wizard draft audience fields into API create/update payload shape. */
export function campaignAudiencePayload(draft: CampaignDraft): {
  listId: string | null;
  segmentId: string | null;
  content: Record<string, unknown>;
} {
  const listIds = draft.listIds ?? (draft.listId ? [draft.listId] : []);
  const segmentIds = draft.segmentIds ?? (draft.segmentId ? [draft.segmentId] : []);
  const audienceIds = [...listIds, ...segmentIds];
  const baseContent = { ...(draft.content ?? {}) };
  return {
    listId: listIds[0] ?? null,
    segmentId: segmentIds[0] ?? null,
    content: { ...baseContent, audienceIds },
  };
}

/** Payload for POST /v1/campaigns/send — one shot create + dispatch. */
export function campaignSendPayload(
  draft: CampaignDraft,
  name: string,
): {
  name: string;
  channel: ChannelType;
  listId?: string;
  segmentId?: string;
  templateId?: string;
  content: Record<string, unknown>;
} {
  const audience = campaignAudiencePayload(draft);
  return {
    name,
    channel: draft.channel,
    ...(audience.listId ? { listId: audience.listId } : {}),
    ...(audience.segmentId ? { segmentId: audience.segmentId } : {}),
    ...(draft.templateId ? { templateId: draft.templateId } : {}),
    content: audience.content,
  };
}

export type CampaignSendResult = {
  campaignId: string;
  queued: number;
  audience: number;
  truncated: boolean;
};

/** Poll until the campaign leaves `sending` (all messages terminal) or we time out. */
export async function waitForCampaignDelivery(
  id: string,
  opts: { maxMs?: number; intervalMs?: number } = {},
): Promise<ApiCampaign> {
  const { api } = await import('./api');
  const maxMs = opts.maxMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const start = Date.now();
  let latest = await api.get<ApiCampaign>(`campaigns/${id}`);
  while (Date.now() - start < maxMs) {
    if (latest.status === 'sent' || latest.status === 'paused') return latest;
    const recipients = latest.recipients ?? 0;
    if (recipients === 0 && latest.status !== 'sending') return latest;
    await new Promise((r) => setTimeout(r, intervalMs));
    latest = await api.get<ApiCampaign>(`campaigns/${id}`);
  }
  return latest;
}

/** Progress 0–100 while a campaign is sending.
 *  Accepted (Infobip handoff) fills up to 90%; DLR confirmations fill the last
 *  10% as they land, and 100% only when all are terminal (delivered/failed/…)
 *  so the bar never says "done" while status is still Sending.
 */
export function campaignSendProgress(c: {
  recipients?: number | null;
  accepted?: number | null;
  delivered?: number | null;
  failed?: number | null;
}): number {
  const recipients = c.recipients ?? 0;
  if (recipients <= 0) return 0;
  const terminal = (c.delivered ?? 0) + (c.failed ?? 0);
  if (terminal >= recipients) return 100;
  const accepted = c.accepted ?? terminal;
  const base = Math.min(90, Math.round((accepted / recipients) * 90));
  const tail = Math.round((terminal / recipients) * 10);
  return Math.min(99, base + tail);
}

export function campaignDeliveryToast(name: string, c: ApiCampaign): string {
  const failed = c.failed ?? 0;
  const delivered = c.delivered ?? 0;
  if (c.status === 'sending') {
    return `“${name}” is sending…`;
  }
  if (failed > 0 && delivered === 0) {
    const detail = c.lastErrorMessage?.trim();
    return detail
      ? `“${name}” failed — ${detail}`
      : `“${name}” failed at the provider`;
  }
  if (failed > 0) {
    return `“${name}” finished — ${delivered.toLocaleString()} delivered, ${failed.toLocaleString()} failed`;
  }
  if (delivered > 0) {
    return `“${name}” delivered to ${delivered.toLocaleString()} recipient${delivered === 1 ? '' : 's'}`;
  }
  if ((c.recipients ?? 0) === 0) {
    return `“${name}” reached nobody — its audience is empty`;
  }
  return `“${name}” finished`;
}
