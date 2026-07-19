import type { Campaign, CampaignStatus, ChannelType } from '@/types/app';

/** Shape of a campaign as returned by maildrill-service /v1/campaigns. */
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
    scheduledAt: c.scheduledAt ?? null,
    openRate: null,
    clickRate: null,
    updatedAt: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
    recipients: c.recipients ?? 0,
    delivered: c.delivered ?? 0,
    unsubscribed: 0,
  };
}

export function toCampaigns(rows: ApiCampaign[]): Campaign[] {
  return rows.map(toCampaign);
}
