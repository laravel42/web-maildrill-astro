import type { APIRoute } from 'astro';
import { sendContactNotification } from '@/lib/server/mail/send';
import { getPostHogServer } from '@/lib/posthog-server';

export const prerender = false;

/**
 * `/contact` form submissions: email the team (CONTACT_NOTIFY_TO, falling
 * back to SIGNUP_NOTIFY_TO) with reply-to set to the submitter, in-repo over
 * SMTP. Fire-and-forget on the mail send so a relay hiccup doesn't surface as
 * a false failure to the visitor, but the request itself is awaited so the
 * form's success state reflects whether SMTP actually accepted the message.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    topic?: unknown;
    message?: unknown;
  };
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!firstName || !lastName || !email || !topic || !message) {
    return new Response(JSON.stringify({ error: 'all fields required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const sent = await sendContactNotification({ firstName, lastName, email, topic, message });
  if (!sent) {
    return new Response(JSON.stringify({ error: 'delivery failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const posthog = getPostHogServer();
  if (posthog) {
    // Unauthenticated route: key people by submitted email only — never trust
    // client X-PostHog-Distinct-Id (would allow PII misbinding onto another person).
    posthog.capture({
      distinctId: email,
      event: 'contact_form_submitted',
      properties: { topic },
    });
    await posthog.flush();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
