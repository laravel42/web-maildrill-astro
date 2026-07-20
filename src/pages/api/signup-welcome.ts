import type { APIRoute } from 'astro';
import { sendSignupNotification, sendWelcomeEmail } from '@/lib/server/mail/send';

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

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};
