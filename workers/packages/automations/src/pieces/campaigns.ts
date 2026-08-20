import { definePiece, defineTrigger, Property } from '@maildrill/activepieces-core';
import type { MaildrillPieceContext } from './context';

/**
 * Campaign triggers.
 *
 * These fire per *recipient*, not per campaign: "campaign delivered" means one
 * subscriber's copy was delivered, which is what a follow-up workflow needs. The events
 * come from the existing delivery pipeline (PostHog HogQL poller → `applyProviderOutcome`
 * / `applyTrackingOutcome`), so they inherit its idempotency.
 */

const SAMPLE = {
  subscriber: {
    id: '5e1f1f2c-0b3a-4a2b-9b6e-1f2a3b4c5d6e',
    email: 'ada@example.com',
    phone: '+15551234567',
    name: 'Ada Lovelace',
    status: 'active',
    attributes: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  campaignId: '7d2f3a1b-8c9d-4e0f-a1b2-c3d4e5f60718',
  campaignName: 'August promo',
  messageId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  channel: 'email',
};

const campaignProp = Property.DynamicDropdown({
  displayName: 'Campaign',
  description: 'Leave empty to fire for every campaign.',
  source: 'campaigns',
});

function matchesCampaign({
  propsValue,
  payload,
}: {
  propsValue: Record<string, unknown>;
  payload: unknown;
}): boolean {
  const wanted = propsValue.campaignId;
  if (typeof wanted !== 'string' || wanted.length === 0) return true;
  return (payload as Record<string, unknown> | null)?.campaignId === wanted;
}

const trigger = (
  name: string,
  displayName: string,
  description: string,
  eventType: string,
  accent: string,
  extraSample: Record<string, unknown> = {},
) =>
  defineTrigger({
    name,
    displayName,
    description,
    category: 'Campaigns',
    accent,
    props: { campaignId: campaignProp },
    eventTypes: [eventType],
    samplePayload: { ...SAMPLE, ...extraSample },
    matches: matchesCampaign,
  });

export const campaignsPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/campaigns',
  displayName: 'Campaigns',
  description: 'React to how a campaign performed, per recipient.',
  version: '1.0.0',
  accent: '--brand',
  actions: [],
  triggers: [
    trigger(
      'campaign_sent',
      'Campaign sent',
      'A campaign message left for this subscriber.',
      'campaign.sent',
      '--text3',
    ),
    trigger(
      'campaign_delivered',
      'Campaign delivered',
      'A campaign message reached this subscriber.',
      'campaign.delivered',
      '--success',
    ),
    trigger(
      'campaign_opened',
      'Campaign opened',
      'This subscriber opened a campaign message.',
      'campaign.opened',
      '--success',
    ),
    trigger(
      'campaign_clicked',
      'Campaign clicked',
      'This subscriber clicked a link in a campaign message.',
      'campaign.clicked',
      '--accent',
      { url: 'https://example.com/pricing' },
    ),
    trigger(
      'campaign_bounced',
      'Campaign bounced',
      'A campaign message could not be delivered to this subscriber.',
      'campaign.bounced',
      '--danger',
      { errorCode: 'EC_ABSENT_SUBSCRIBER', errorMessage: 'Mailbox does not exist' },
    ),
    trigger(
      'campaign_failed',
      'Campaign failed',
      'A campaign message was rejected before delivery.',
      'campaign.failed',
      '--danger',
      { errorCode: 'EC_GENERAL_ERROR', errorMessage: 'Rejected by provider' },
    ),
  ],
});
