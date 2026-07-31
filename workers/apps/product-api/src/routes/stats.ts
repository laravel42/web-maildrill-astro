import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { channelSchema } from '@maildrill/domain';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  activityFeed,
  channelBreakdown,
  dailyActivity,
  workspaceSummary,
} from '@maildrill/product';

const TAG = ['Stats'];
const seriesQuery = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
  channel: channelSchema.optional(),
});

export async function statsRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.get(
    '/v1/stats/summary',
    { schema: { tags: TAG, summary: 'Workspace counters for the dashboard' } },
    async (req) => workspaceSummary(req.tenantId),
  );

  app.get(
    '/v1/stats/feed',
    { schema: { tags: TAG, summary: 'Recent workspace activity for the dashboard feed' } },
    async (req) => ({ data: await activityFeed(req.tenantId) }),
  );

  app.get(
    '/v1/stats/activity',
    {
      schema: {
        tags: TAG,
        summary: 'Daily send activity, zero-filled (no open/click data yet)',
        querystring: seriesQuery,
      },
    },
    async (req) => ({
      data: await dailyActivity(req.tenantId, req.query.days ?? 30, req.query.channel),
    }),
  );

  app.get(
    '/v1/stats/channels',
    {
      schema: {
        tags: TAG,
        summary: 'Per-channel delivery + engagement breakdown for a date range',
        querystring: z.object({
          days: z.coerce.number().int().positive().max(365).optional(),
        }),
      },
    },
    async (req) => ({
      data: await channelBreakdown(req.tenantId, req.query.days ?? 30),
    }),
  );
}
