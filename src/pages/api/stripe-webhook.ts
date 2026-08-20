import type { APIRoute } from 'astro';
import { serviceBaseUrl } from '@/lib/server/service';

export const prerender = false;

/**
 * Public Stripe webhook intake: forwards the delivery verbatim (raw body +
 * signature header) to the workers billing processor, which verifies the HMAC
 * and applies the event idempotently. No session auth — the signature is the
 * authentication, and this route holds no secrets. Point the Stripe endpoint
 * at `https://<site>/api/stripe-webhook`.
 */
export const POST: APIRoute = async ({ request }) => {
  // Raw text, untouched: signature verification hashes the exact bytes.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  try {
    const res = await fetch(`${serviceBaseUrl()}/v1/billing/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(signature ? { 'stripe-signature': signature } : {}),
      },
      body: rawBody,
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    // Backend unreachable — 502 so Stripe retries the delivery later.
    return new Response(JSON.stringify({ error: 'upstream_unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
