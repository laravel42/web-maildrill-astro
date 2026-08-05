import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';
import { isAllowedLoginEmail } from '@/lib/auth/login-allowlist';
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

  // Private rollout: only allowlisted accounts get a code. Everyone else gets
  // the same 202 (no enumeration) but no code is sent — the form shows them the
  // waitlist notice. This mirrors the client gate so a direct call can't bypass.
  let codeRequested = false;
  if (isAllowedLoginEmail(email)) {
    try {
      const res = await fetch(`${serviceBaseUrl()}/v1/auth/code/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      codeRequested = res.ok;
    } catch {
      // Unreachable backend counts as "not requested"; the response is 202 either way.
    }
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
