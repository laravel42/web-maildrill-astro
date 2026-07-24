import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { TtlLruCache } from '../unsplash/cache.js';
import {
  createUnsplashClient,
  type UnsplashClient,
  UnsplashConfigError,
  UnsplashUpstreamError,
} from '../unsplash/client.js';
import { type DailyQuota, dailyQuota as defaultDailyQuota } from '../unsplash/daily-quota.js';
import type { UnsplashSearchResponseDTO } from '../unsplash/dto.js';

const SearchQuerySchema = z.object({
  query: z.string().trim().min(1, 'query is required').max(100),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(30).optional().default(20),
  orientation: z.enum(['landscape', 'portrait', 'squarish']).optional(),
  color: z
    .enum([
      'black_and_white',
      'black',
      'white',
      'yellow',
      'orange',
      'red',
      'purple',
      'magenta',
      'green',
      'teal',
      'blue',
    ])
    .optional(),
  content_filter: z.enum(['low', 'high']).optional().default('high'),
});

const TrackBodySchema = z.object({
  downloadLocation: z.string().url(),
});

export interface CreateImagesRouteOptions {
  client?: UnsplashClient;
  cache?: TtlLruCache<UnsplashSearchResponseDTO>;
  quota?: DailyQuota;
}

export function createImagesRoute(options: CreateImagesRouteOptions = {}) {
  const client = options.client ?? createUnsplashClient();
  const cache = options.cache ?? new TtlLruCache<UnsplashSearchResponseDTO>();
  const quota = options.quota ?? defaultDailyQuota;

  return async function imagesPlugin(fastify: FastifyInstance) {
    fastify.get('/images/search', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = SearchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_request', issues: parsed.error.issues });
      }
      const { query, page, per_page, orientation, color, content_filter } = parsed.data;

      const cacheKey = JSON.stringify({
        q: query.toLowerCase(),
        page,
        pp: per_page,
        o: orientation ?? '',
        c: color ?? '',
        cf: content_filter,
      });

      const cached = cache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        reply.header('X-Quota-Remaining', String(quota.remaining('picker')));
        return reply.send(cached);
      }

      if (!quota.tryConsume('picker', 1)) {
        const usage = quota.usage();
        reply.header('X-Quota-Remaining', '0');
        return reply.status(429).send({
          error: 'quota_exceeded',
          scope: 'picker',
          usage: usage.picker,
          resetAt: `${usage.date}T24:00:00Z`,
        });
      }

      try {
        const result = await client.searchPhotos({
          query,
          page,
          perPage: per_page,
          orientation,
          color,
          contentFilter: content_filter,
        });
        cache.set(cacheKey, result);
        reply.header('X-Cache', 'MISS');
        reply.header('X-Quota-Remaining', String(quota.remaining('picker')));
        return reply.send(result);
      } catch (error) {
        if (error instanceof UnsplashConfigError) {
          return reply.status(503).send({ error: 'unsplash_not_configured' });
        }
        if (error instanceof UnsplashUpstreamError) {
          if (error.status === 429) return reply.status(429).send({ error: 'rate_limited' });
          if (error.status === 401 || error.status === 403) {
            return reply.status(error.status).send({ error: 'unsplash_unauthorized' });
          }
          return reply.status(502).send({ error: 'unsplash_upstream', status: error.status });
        }
        return reply.status(500).send({ error: 'unsplash_unknown' });
      }
    });

    fastify.post('/images/track', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: z.infer<typeof TrackBodySchema>;
      try {
        body = TrackBodySchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: error.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const ok = await client.trackDownload(body.downloadLocation);
        return reply.send({ tracked: ok });
      } catch (error) {
        if (error instanceof UnsplashConfigError) {
          return reply.status(503).send({ error: 'unsplash_not_configured' });
        }
        return reply.send({ tracked: false });
      }
    });

    fastify.get('/images/quota', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(quota.usage());
    });
  };
}

/** Default plugin instance mounted by `src/index.ts`. */
export const imagesPlugin = createImagesRoute();
