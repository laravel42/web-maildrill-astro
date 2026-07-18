import { defineMiddleware } from 'astro:middleware';

/**
 * Placeholder middleware for future auth gating of /app/*.
 * Currently a pass-through so the mock app remains browsable.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  return next();
});
