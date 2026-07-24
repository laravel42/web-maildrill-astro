import type { APIRoute } from 'astro';
import { sendSignupNotification, sendWelcomeEmail } from '@/lib/server/mail/send';
import { getPostHogServer } from '@/lib/posthog-server';

export const prerender = false;

/**
 * On sign-up: email the subscriber the welcome email AND notify the team
 * (SIGNUP_NOTIFY_TO) with the submitted details. Both are in-repo over SMTP.
 * Fire-and-forget: always 202 so the sign-up UX doesn't wait on delivery. No
 * address enumeration.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : undefined;
  if (!email) {
    return new Response(JSON.stringify({ error: 'email required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  void sendWelcomeEmail(email, firstName).catch(() => undefined);
  void sendSignupNotification({ email, firstName, lastName }).catch(() => undefined);

  const posthog = getPostHogServer();
  if (posthog) {
    // Unauthenticated route: key people by submitted email only — never trust
    // client X-PostHog-Distinct-Id (would allow PII misbinding onto another person).
    posthog.identify({
      distinctId: email,
      properties: { email, first_name: firstName, last_name: lastName },
    });
    posthog.capture({
      distinctId: email,
      event: 'signup_welcome_sent',
    });
    await posthog.flush();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};
