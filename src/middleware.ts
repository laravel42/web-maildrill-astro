import { defineMiddleware } from 'astro:middleware';
import { getSession } from 'auth-astro/server';

const PROTECTED = /^\/(app|dashboard)(\/|$)/;

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered (static) routes have no real request — skip session work so we
  // don't touch request headers at build time.
  if (context.isPrerendered) {
    context.locals.session = null;
    return next();
  }

  const session = await getSession(context.request);
  context.locals.session = (session as unknown as App.Locals['session']) ?? null;

  if (PROTECTED.test(context.url.pathname) && !session) {
    return context.redirect(`/login?next=${encodeURIComponent(context.url.pathname)}`);
  }
  return next();
});
