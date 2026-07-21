import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';

export const prerender = false;

/** BFF: ask maildrill-service to email a 6-digit sign-in code. No enumeration. */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return new Response(JSON.stringify({ error: 'email required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  await fetch(`${serviceBaseUrl()}/v1/auth/code/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => undefined);

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};
