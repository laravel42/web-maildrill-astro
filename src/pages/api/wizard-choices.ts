import type { APIRoute } from 'astro';
import { productClient } from '@/lib/server/service';
import { toApprovalStatus } from '@/lib/app/template-map';
import type { AudienceChoice, TemplateChoice } from '@/components/react/CampaignWizard.types';
import {
  enrichSegmentAudienceCounts,
  listToAudienceChoice,
  segmentToAudienceChoice,
  type ApiAudienceSegment,
} from '@/lib/app/audience-map';
import type { ApiList } from '@/lib/app/list-map';

export const prerender = false;

/**
 * Audience and template choices for the campaign wizard.
 *
 * Split out of the campaigns page so the board no longer blocks on it: between
 * them /v1/lists/audience and /v1/templates cost ~876ms of SSR (and 1.1MB) on
 * every board view, for a dialog most visits never open. The board calls this
 * when the wizard is first opened.
 */
export const GET: APIRoute = async (ctx) => {
  const session = ctx.locals.session;
  if (!session?.user?.id || !session.activeTenantId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const client = productClient({
    userId: session.user.id,
    activeTenantId: session.activeTenantId,
    role: session.role,
  });
  const unwrap = <T,>(d: unknown): T[] => (d as { data?: T[] } | undefined)?.data ?? [];

  const [listsRes, segmentsRes, templatesRes] = await Promise.all([
    client.GET('/v1/lists/audience'),
    client.GET('/v1/segments'),
    client.GET('/v1/templates'),
  ]);

  const apiLists = unwrap<ApiList>(listsRes.data);
  const apiSegments = unwrap<ApiAudienceSegment>(segmentsRes.data);
  const segmentCounts = await enrichSegmentAudienceCounts(client, apiSegments);
  const audiences: AudienceChoice[] = [
    ...apiLists.map((l) => listToAudienceChoice(l)),
    ...apiSegments.map((s) => segmentToAudienceChoice(s, segmentCounts.get(s.id))),
  ];
  const templates = unwrap<{
    id: string;
    name: string;
    channel?: string | null;
    category?: string | null;
    approvalStatus?: string | null;
  }>(templatesRes.data).map(
    (t): TemplateChoice => ({
      id: t.id,
      name: t.name,
      category: t.category ?? null,
      channel: (t.channel as TemplateChoice['channel']) ?? 'email',
      approvalStatus: toApprovalStatus(t.approvalStatus),
    }),
  );

  return new Response(JSON.stringify({ audiences, templates }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
