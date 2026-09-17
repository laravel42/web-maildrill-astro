/**
 * SUPERSEDED — kept for reference only, NOT deployed. The live path is an
 * EventBridge Pipe (SNS → SQS → Pipe → API Destination → PostHog), which
 * does the same job with zero code to deploy or maintain, once it turned out
 * an SNS→SQS subscription already existed. See ../posthog-ses-hog.md for the
 * actual live architecture and setup.
 *
 * SNS → PostHog relay for SES delivery events.
 *
 * Subscribed DIRECTLY to the SNS topic with protocol `lambda` (not `https`) —
 * this exists purely to work around a real, confirmed platform limitation:
 * SNS always posts HTTP(S) notifications as `Content-Type: text/plain`
 * (not configurable on AWS's side), and PostHog's `source_webhook` function
 * type cannot parse a text/plain body at all (both `request.body` and
 * `request.stringBody` come back empty — confirmed live; the identical
 * payload parses correctly under `application/json`).
 *
 * SNS-to-Lambda delivery has no such problem — it's a native event
 * invocation, not an HTTP body — so this function unwraps
 * `Records[].Sns.Message` (the actual SES event, JSON-encoded) and re-POSTs
 * it to the PostHog webhook as real `application/json`. The Hog function
 * (../posthog-ses.hog) then only ever sees the bare SES event shape
 * (eventType/mail/…), never an SNS envelope.
 *
 * Lambda subscriptions to SNS are auto-confirmed by AWS — no
 * SubscriptionConfirmation handshake to handle here, unlike an HTTPS
 * subscription.
 *
 * Env:
 *   POSTHOG_WEBHOOK_URL — the "SES webhooks" Hog function's webhook URL
 *                         (https://webhooks.us.posthog.com/public/webhooks/<id>)
 */
export const handler = async (event) => {
  const webhookUrl = process.env.POSTHOG_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('POSTHOG_WEBHOOK_URL is not set');
  }

  const records = Array.isArray(event.Records) ? event.Records : [];
  const results = await Promise.allSettled(
    records
      .filter((record) => record.EventSource === 'aws:sns' && record.Sns?.Message)
      .map(async (record) => {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // record.Sns.Message is already the raw SES event JSON string —
          // forward it verbatim rather than re-stringifying a parsed copy,
          // so a malformed payload fails downstream (visibly, in PostHog's
          // own function logs) instead of being silently reshaped here.
          body: record.Sns.Message,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`posthog webhook ${res.status}: ${text.slice(0, 300)}`);
        }
      }),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    // Throwing lets SNS's Lambda delivery retry policy handle redelivery;
    // logged individually first so a partial-batch failure is diagnosable.
    for (const f of failed) {
      console.error('posthog relay failed for a record:', f.reason?.message ?? f.reason);
    }
    throw new Error(`${failed.length}/${records.length} record(s) failed to relay`);
  }

  return { relayed: records.length };
};
