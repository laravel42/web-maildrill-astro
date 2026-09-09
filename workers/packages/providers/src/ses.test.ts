import { describe, expect, it, vi } from 'vitest';
import { SesProvider, type SesClientLike } from './ses';

const settings = { region: 'us-east-1', from: 'no-reply@maildrill.net', configurationSet: 'maildrill-campaigns' };

const base = {
  messageId: 'm1',
  tenantId: 't1',
  channel: 'email' as const,
  to: 'user@example.com',
  correlationId: 'c1',
  content: { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' },
};

function fakeClient(impl: SesClientLike['send']): SesClientLike {
  return { send: impl };
}

describe('SesProvider', () => {
  describe('send', () => {
    it('submits an email via SendEmailCommand and returns the normalized result', async () => {
      const send = vi.fn().mockResolvedValue({ MessageId: 'ses-msg-1', $metadata: { requestId: 'req-1' } });
      const provider = new SesProvider(settings, fakeClient(send));
      const r = await provider.send(base);

      expect(r.accepted).toBe(true);
      expect(r.status).toBe('submitted');
      expect(r.providerMessageId).toBe('ses-msg-1');
      expect(r.providerRequestId).toBe('req-1');

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0]![0] as { input: Record<string, unknown> };
      expect(command.input).toMatchObject({
        FromEmailAddress: settings.from,
        Destination: { ToAddresses: [base.to] },
        ConfigurationSetName: settings.configurationSet,
      });
      const content = command.input.Content as { Simple: { Subject: { Data: string }; Body: { Html?: { Data: string }; Text?: { Data: string } } } };
      expect(content.Simple.Subject.Data).toBe('Hi');
      expect(content.Simple.Body.Html?.Data).toBe('<p>Hi</p>');
      expect(content.Simple.Body.Text?.Data).toBe('Hi');
      const tags = command.input.EmailTags as Array<{ Name: string; Value: string }>;
      expect(tags).toContainEqual({ Name: 'maildrill_message_id', Value: 'm1' });
      expect(tags).toContainEqual({ Name: 'maildrill_tenant_id', Value: 't1' });
    });

    it('carries campaignReferenceId, reply-to, and custom headers (incl. List-Unsubscribe) into the request', async () => {
      const send = vi.fn().mockResolvedValue({ MessageId: 'ses-msg-2' });
      const provider = new SesProvider(settings, fakeClient(send));
      await provider.send({
        ...base,
        campaignReferenceId: 'camp-1',
        content: {
          ...base.content,
          from: 'Maildrill News <news@maildrill.net>',
          replyTo: 'Help <help@maildrill.net>',
          headers: { 'List-Unsubscribe': '<https://maildrill.net/unsubscribe?t=x>' },
        },
      });

      const command = send.mock.calls[0]![0] as { input: Record<string, unknown> };
      expect(command.input.FromEmailAddress).toBe('Maildrill News <news@maildrill.net>');
      expect(command.input.ReplyToAddresses).toEqual(['help@maildrill.net']);
      const tags = command.input.EmailTags as Array<{ Name: string; Value: string }>;
      expect(tags).toContainEqual({ Name: 'maildrill_campaign_id', Value: 'camp-1' });
      const content = command.input.Content as { Simple: { Headers?: Array<{ Name: string; Value: string }> } };
      expect(content.Simple.Headers).toContainEqual({
        Name: 'List-Unsubscribe',
        Value: '<https://maildrill.net/unsubscribe?t=x>',
      });
    });

    it('falls back to the configured From when the campaign carries none', async () => {
      const send = vi.fn().mockResolvedValue({ MessageId: 'x' });
      const provider = new SesProvider(settings, fakeClient(send));
      await provider.send(base);
      const command = send.mock.calls[0]![0] as { input: Record<string, unknown> };
      expect(command.input.FromEmailAddress).toBe(settings.from);
    });

    it('sends text-only when no html is present', async () => {
      const send = vi.fn().mockResolvedValue({ MessageId: 'x' });
      const provider = new SesProvider(settings, fakeClient(send));
      await provider.send({ ...base, content: { subject: 'Hi', text: 'plain only' } });
      const command = send.mock.calls[0]![0] as { input: Record<string, unknown> };
      const content = command.input.Content as { Simple: { Body: { Html?: unknown; Text?: { Data: string } } } };
      expect(content.Simple.Body.Html).toBeUndefined();
      expect(content.Simple.Body.Text?.Data).toBe('plain only');
    });

    it('rejects non-email channels without touching the client', async () => {
      const send = vi.fn();
      const provider = new SesProvider(settings, fakeClient(send));
      const r = await provider.send({ ...base, channel: 'sms', to: '+15551234567' });
      expect(r.accepted).toBe(false);
      expect(r.error?.category).toBe('validation');
      expect(r.error?.retryable).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });

    it('rejects with a config hint when region is missing', async () => {
      const send = vi.fn();
      const provider = new SesProvider({ region: '', from: '' }, fakeClient(send));
      const r = await provider.send(base);
      expect(r.accepted).toBe(false);
      expect(r.error?.message).toContain('AWS_SES_REGION');
      expect(send).not.toHaveBeenCalled();
    });

    it('rejects with a config hint when there is no From address anywhere', async () => {
      const send = vi.fn();
      const provider = new SesProvider({ region: 'us-east-1', from: '' }, fakeClient(send));
      const r = await provider.send(base);
      expect(r.accepted).toBe(false);
      expect(r.error?.message).toContain('AWS_SES_FROM_EMAIL');
      expect(send).not.toHaveBeenCalled();
    });

    it('maps TooManyRequestsException to a retryable rate_limit error', async () => {
      const err = Object.assign(new Error('Rate exceeded'), {
        name: 'TooManyRequestsException',
        $metadata: { httpStatusCode: 429, requestId: 'req-x' },
      });
      const send = vi.fn().mockRejectedValue(err);
      const provider = new SesProvider(settings, fakeClient(send));
      const r = await provider.send(base);
      expect(r.accepted).toBe(false);
      expect(r.providerRequestId).toBe('req-x');
      expect(r.error?.category).toBe('rate_limit');
      expect(r.error?.code).toBe('TooManyRequestsException');
      expect(r.error?.retryable).toBe(true);
    });

    it('maps InternalServiceErrorException to a retryable temporary error', async () => {
      const err = Object.assign(new Error('boom'), { name: 'InternalServiceErrorException' });
      const send = vi.fn().mockRejectedValue(err);
      const provider = new SesProvider(settings, fakeClient(send));
      const r = await provider.send(base);
      expect(r.error?.category).toBe('temporary');
      expect(r.error?.retryable).toBe(true);
    });

    it.each(['MessageRejected', 'MailFromDomainNotVerifiedException', 'BadRequestException', 'AccountSuspendedException', 'SendingPausedException'])(
      'maps %s to a non-retryable error',
      async (name) => {
        const err = Object.assign(new Error(name), { name });
        const send = vi.fn().mockRejectedValue(err);
        const provider = new SesProvider(settings, fakeClient(send));
        const r = await provider.send(base);
        expect(r.accepted).toBe(false);
        expect(r.error?.code).toBe(name);
        expect(r.error?.retryable).toBe(false);
      },
    );

    it('classifies an unrecognized error by its HTTP status when present', async () => {
      const err = Object.assign(new Error('server error'), {
        name: 'SomeNewException',
        $metadata: { httpStatusCode: 503 },
      });
      const send = vi.fn().mockRejectedValue(err);
      const provider = new SesProvider(settings, fakeClient(send));
      const r = await provider.send(base);
      expect(r.error?.category).toBe('temporary');
      expect(r.error?.retryable).toBe(true);
    });

    it('classifies a network failure with no HTTP status as retryable on known codes', async () => {
      const err = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
      const send = vi.fn().mockRejectedValue(err);
      const provider = new SesProvider(settings, fakeClient(send));
      const r = await provider.send(base);
      expect(r.error?.category).toBe('temporary');
      expect(r.error?.retryable).toBe(true);
    });
  });

  describe('normalizeWebhook (SES event-destination notifications, already unwrapped from SNS)', () => {
    function event(eventType: string, extra: Record<string, unknown> = {}) {
      return {
        eventType,
        mail: {
          timestamp: '2026-07-31T12:00:00.000Z',
          messageId: 'ses-msg-1',
          tags: { maildrill_message_id: ['m1'], maildrill_tenant_id: ['t1'] },
        },
        ...extra,
      };
    }

    const provider = new SesProvider(settings, fakeClient(vi.fn()));

    it('maps Delivery to a delivered outcome, correlated by SES message id', async () => {
      const body = event('Delivery', { delivery: { timestamp: '2026-07-31T12:05:00.000Z', recipients: ['user@example.com'] } });
      const events = await provider.normalizeWebhook({ headers: {}, body, rawBody: JSON.stringify(body), kind: 'delivery' });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        providerMessageId: 'ses-msg-1',
        correlationId: 'm1',
        eventType: 'email.delivered',
        outcome: 'delivered',
      });
      expect(events[0]!.occurredAt?.toISOString()).toBe('2026-07-31T12:05:00.000Z');
    });

    it.each([
      ['Send', 'sent', 'email.sent'],
      ['Bounce', 'failed', 'email.bounced'],
      ['Complaint', 'delivered', 'email.complained'],
      ['Reject', 'failed', 'email.rejected'],
      ['Open', 'read', 'email.opened'],
      ['Click', 'read', 'email.clicked'],
      ['DeliveryDelay', 'submitted', 'email.delayed'],
      ['Subscription', 'delivered', 'email.subscription'],
    ])('maps %s to outcome %s (%s)', async (name, outcome, eventType) => {
      const body = event(name);
      const events = await provider.normalizeWebhook({ headers: {}, body, rawBody: '', kind: 'delivery' });
      expect(events[0]?.outcome).toBe(outcome);
      expect(events[0]?.eventType).toBe(eventType);
    });

    it('maps "Rendering Failure" to a failed outcome and preserves the SES event name', async () => {
      const body = { eventType: 'Rendering Failure', mail: event('x').mail, failure: { templateName: 't1', errorMessage: 'bad template' } };
      const events = await provider.normalizeWebhook({ headers: {}, body, rawBody: '', kind: 'delivery' });
      expect(events[0]?.outcome).toBe('failed');
      expect(events[0]?.eventType).toBe('email.rendering_failed');
      expect(events[0]?.providerStatus).toBe('bad template');
    });

    it('captures bounce type/subtype in providerStatus, preserving the raw payload', async () => {
      const body = event('Bounce', { bounce: { bounceType: 'Permanent', bounceSubType: 'General', timestamp: '2026-07-31T12:01:00.000Z' } });
      const events = await provider.normalizeWebhook({ headers: {}, body, rawBody: '', kind: 'delivery' });
      expect(events[0]?.providerStatus).toBe('Permanent/General');
      expect(events[0]?.raw).toEqual(body);
    });

    it('falls back to the classic notificationType field when eventType is absent', async () => {
      const body = { notificationType: 'Bounce', mail: event('x').mail, bounce: { bounceType: 'Transient', timestamp: '2026-07-31T12:01:00.000Z' } };
      const events = await provider.normalizeWebhook({ headers: {}, body, rawBody: '', kind: 'delivery' });
      expect(events[0]?.outcome).toBe('failed');
      expect(events[0]?.eventType).toBe('email.bounced');
    });

    it('returns no events for an unrecognized body', async () => {
      const events = await provider.normalizeWebhook({ headers: {}, body: { foo: 'bar' }, rawBody: '', kind: 'delivery' });
      expect(events).toHaveLength(0);
    });
  });
});
