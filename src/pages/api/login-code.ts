import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';
import { getPostHogServer } from '@/lib/posthog-server';

export const prerender = false;

/** BFF: ask workers to email a 6-digit sign-in code. No enumeration. */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return new Response(JSON.stringify({ error: 'email required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let codeRequested = false;
  try {
    const res = await fetch(`${serviceBaseUrl()}/v1/auth/code/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    codeRequested = res.ok;
  } catch {
    codeRequested = false;
  }

  // Always 202 — do not reveal whether the address exists or the backend is up.
  // Analytics only when the upstream call actually succeeded.
  if (codeRequested) {
    const posthog = getPostHogServer();
    if (posthog) {
      // Unauthenticated route: never trust client-supplied PostHog identity headers.
      posthog.capture({
        distinctId: email,
        event: 'login_code_sent',
      });
      await posthog.flush();
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};
