import type { APIRoute } from 'astro';
import { sendWelcomeEmail } from '@/lib/server/mail/send';

export const prerender = false;

/**
 * Sends the sign-up welcome email — temporarily in-repo over SMTP, so it no
 * longer depends on maildrill-service. Fire-and-forget: always 202 so the
 * sign-up UX doesn't wait on (or fail on) delivery. No address enumeration.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    firstName?: unknown;
  };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : undefined;
  if (!email) {
    return new Response(JSON.stringify({ error: 'email required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  void sendWelcomeEmail(email, firstName).catch(() => undefined);

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};
