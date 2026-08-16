import type { AudienceChoice } from '@/components/react/CampaignWizard.types';
import type { ChannelType } from '@/types/app';
import type { ApiList } from '@/lib/app/list-map';
import type { ApiSegment, ApiSegmentRule } from '@/lib/app/subscribers-data';

/** Segment row as returned by /v1/segments (counts optional until previewed). */
export type ApiAudienceSegment = ApiSegment & {
  memberCount?: number | null;
  phoneMemberCount?: number | null;
};

function zeroPhoneWhenEmptyMembers(
  memberCount: number | null | undefined,
  phoneCount: number | null | undefined,
): number | null {
  if (phoneCount != null) return phoneCount;
  if (memberCount === 0) return 0;
  return null;
}

export function listToAudienceChoice(
  l: ApiList,
  counts?: { phoneCount?: number | null },
): AudienceChoice {
  const memberCount = l.memberCount ?? null;
  return {
    id: l.id,
    kind: 'list',
    name: l.name,
    desc: 'List',
    count: memberCount,
    phoneCount: zeroPhoneWhenEmptyMembers(memberCount, counts?.phoneCount ?? l.phoneMemberCount),
    color: l.color ?? null,
    channels:
      l.channels && l.channels.length > 0
        ? (l.channels as ChannelType[])
        : (['email'] as ChannelType[]),
  };
}

export function segmentToAudienceChoice(
  s: ApiAudienceSegment,
  counts?: { count?: number | null; phoneCount?: number | null },
): AudienceChoice {
  return {
    id: s.id,
    kind: 'segment',
    name: s.name,
    desc: s.description || 'Segment',
    count: counts?.count ?? s.memberCount ?? null,
    phoneCount: zeroPhoneWhenEmptyMembers(
      counts?.count ?? s.memberCount,
      counts?.phoneCount ?? s.phoneMemberCount,
    ),
    channels:
      s.channels && s.channels.length > 0
        ? (s.channels as ChannelType[])
        : (['email'] as ChannelType[]),
  };
}

export function isPhoneChannel(channel: ChannelType): boolean {
  return channel === 'sms' || channel === 'whatsapp' || channel === 'voice';
}

/** Reach for the active channel — total members on email, phone-capable on SMS/WA/Voice. */
export function audienceRecipientCount(a: AudienceChoice, channel: ChannelType): number | null {
  if (isPhoneChannel(channel)) return a.phoneCount ?? null;
  return a.count;
}

/** Hide audiences whose effective reach is explicitly zero; keep unknown (null) counts.
 *  Lists and segments are also gated on declaring the campaign channel. */
export function isAudienceSelectable(a: AudienceChoice, channel: ChannelType): boolean {
  if (a.kind === 'list' || a.kind === 'segment') {
    const chans = a.channels && a.channels.length > 0 ? a.channels : (['email'] as ChannelType[]);
    if (!chans.includes(channel)) return false;
  }
  const n = audienceRecipientCount(a, channel);
  return n === null || n > 0;
}

/** Filter zero-reach audiences and normalize `count` for display / review labels. */
export function prepareAudiencesForChannel(
  audiences: AudienceChoice[],
  channel: ChannelType,
): AudienceChoice[] {
  return audiences
    .filter((a) => isAudienceSelectable(a, channel))
    .map((a) => ({
      ...a,
      count: audienceRecipientCount(a, channel),
    }));
}

/** Sum selected audience sizes when every selection has a known count. */
export function totalSelectedRecipients(
  audienceList: AudienceChoice[],
  audienceIds: Set<string>,
): number | null {
  const selected = audienceList.filter((a) => audienceIds.has(a.id));
  if (selected.length === 0) return 0;
  if (selected.some((a) => a.count === null)) return null;
  return selected.reduce((sum, a) => sum + (a.count ?? 0), 0);
}

type SegmentPreviewClient = {
  POST: (
    path: '/v1/segments/preview',
    opts: {
      body: {
        matchType?: 'all' | 'any';
        rules?: ApiSegmentRule[];
        limit?: number;
      };
    },
  ) => Promise<{ data?: unknown; error?: unknown }>;
};

function previewCount(data: unknown): number | null {
  const count = (data as { count?: number } | undefined)?.count;
  return typeof count === 'number' ? count : null;
}

/** Resolve list phone reach via preview when /v1/lists omits phoneMemberCount. */
export async function enrichListAudienceCounts(
  client: SegmentPreviewClient,
  lists: ApiList[],
): Promise<Map<string, { phoneCount: number | null }>> {
  const out = new Map<string, { phoneCount: number | null }>();

  await Promise.all(
    lists.map(async (list) => {
      let phoneCount = list.phoneMemberCount ?? null;

      if (phoneCount == null) {
        if (list.memberCount === 0) {
          phoneCount = 0;
        } else {
          const res = await client.POST('/v1/segments/preview', {
            body: {
              matchType: 'all',
              rules: [
                { field: 'list', op: 'eq', value: list.id },
                { field: 'phone', op: 'exists' },
              ],
              limit: 1,
            },
          });
          if (!res.error) phoneCount = previewCount(res.data);
        }
      }

      out.set(list.id, { phoneCount });
    }),
  );

  return out;
}

/** Resolve segment member + phone counts via preview when the list payload omits them. */
export async function enrichSegmentAudienceCounts(
  client: SegmentPreviewClient,
  segments: ApiAudienceSegment[],
): Promise<Map<string, { count: number | null; phoneCount: number | null }>> {
  const out = new Map<string, { count: number | null; phoneCount: number | null }>();

  await Promise.all(
    segments.map(async (seg) => {
      const rules = seg.rules ?? [];
      const matchType = seg.matchType ?? 'all';

      let count = seg.memberCount ?? null;
      let phoneCount = seg.phoneMemberCount ?? null;

      if (count == null) {
        const res = await client.POST('/v1/segments/preview', {
          body: { matchType, rules, limit: 1 },
        });
        if (!res.error) count = previewCount(res.data);
      }

      if (phoneCount == null && count === 0) {
        phoneCount = 0;
      } else if (phoneCount == null && matchType === 'all') {
        const res = await client.POST('/v1/segments/preview', {
          body: {
            matchType: 'all',
            rules: [...rules, { field: 'phone', op: 'exists' }],
            limit: 1,
          },
        });
        if (!res.error) phoneCount = previewCount(res.data);
      }

      out.set(seg.id, { count, phoneCount });
    }),
  );

  return out;
}
