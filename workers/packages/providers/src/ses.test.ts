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

    it('tags the send with the workspace SES Tenant when provided, for reputation isolation', async () => {
      const send = vi.fn().mockResolvedValue({ MessageId: 'ses-msg-3' });
      const provider = new SesProvider(settings, fakeClient(send));
      await provider.send({ ...base, sesTenantName: 'ws-t1' });
      const command = send.mock.calls[0]![0] as { input: Record<string, unknown> };
      expect(command.input.TenantName).toBe('ws-t1');
    });

    it('omits TenantName when the workspace has no SES Tenant (falls back to account-wide reputation)', async () => {
      const send = vi.fn().mockResolvedValue({ MessageId: 'ses-msg-4' });
      const provider = new SesProvider(settings, fakeClient(send));
      await provider.send(base);
      const command = send.mock.calls[0]![0] as { input: Record<string, unknown> };
      expect(command.input.TenantName).toBeUndefined();
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

  describe('createEntity (SES Tenant provisioning)', () => {
    it('creates a tenant and associates the shared identity + configuration set', async () => {
      const send = vi.fn(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'CreateTenantCommand') {
          return { TenantArn: 'arn:aws:ses:us-east-1:111122223333:tenant/ws-t1' };
        }
        if (command.constructor.name === 'CreateTenantResourceAssociationCommand') {
          return {};
        }
        throw new Error(`unexpected command: ${command.constructor.name}`);
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const result = await provider.createEntity({ entityId: 'ws-t1', entityName: 'Acme' });

      expect(result).toEqual({ ok: true, existed: false });
      const calls = send.mock.calls.map(([c]) => c.constructor.name);
      // Tries both possible identity forms of `settings.from` (bare email and
      // its domain) since there's no API to know which one is actually
      // verified — plus the configuration set.
      expect(calls).toEqual([
        'CreateTenantCommand',
        'CreateTenantResourceAssociationCommand',
        'CreateTenantResourceAssociationCommand',
        'CreateTenantResourceAssociationCommand',
      ]);

      const assocCalls = send.mock.calls.filter(([c]) => c.constructor.name === 'CreateTenantResourceAssociationCommand');
      const arns = assocCalls.map(([c]) => (c as unknown as { input: { ResourceArn: string } }).input.ResourceArn);
      expect(arns).toContain('arn:aws:ses:us-east-1:111122223333:identity/no-reply@maildrill.net');
      expect(arns).toContain('arn:aws:ses:us-east-1:111122223333:identity/maildrill.net');
      expect(arns).toContain('arn:aws:ses:us-east-1:111122223333:configuration-set/maildrill-campaigns');
    });

    it('treats an already-existing tenant as success and still (re-)associates resources', async () => {
      const send = vi.fn(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'CreateTenantCommand') {
          throw Object.assign(new Error('exists'), { name: 'AlreadyExistsException' });
        }
        if (command.constructor.name === 'GetTenantCommand') {
          return { Tenant: { TenantArn: 'arn:aws:ses:us-east-1:111122223333:tenant/ws-t1' } };
        }
        return {};
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const result = await provider.createEntity({ entityId: 'ws-t1', entityName: 'Acme' });
      expect(result).toEqual({ ok: true, existed: true });
    });

    it('treats an already-associated resource as success rather than failing the whole call', async () => {
      const send = vi.fn(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'CreateTenantCommand') {
          return { TenantArn: 'arn:aws:ses:us-east-1:111122223333:tenant/ws-t1' };
        }
        throw Object.assign(new Error('already associated'), { name: 'AlreadyExistsException' });
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const result = await provider.createEntity({ entityId: 'ws-t1', entityName: 'Acme' });
      expect(result).toEqual({ ok: true, existed: false });
    });

    it('fails with the SES message when tenant creation errors for another reason', async () => {
      const send = vi.fn(async () => {
        throw Object.assign(new Error('boom'), { name: 'TooManyRequestsException' });
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const result = await provider.createEntity({ entityId: 'ws-t1', entityName: 'Acme' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('boom');
    });
  });

  describe('domain identity management (Settings → Domains, PROVIDER_EMAIL_DRIVER=ses)', () => {
    const getIdentityResult = {
      VerifiedForSendingStatus: false,
      DkimAttributes: { Status: 'PENDING', Tokens: ['tok1', 'tok2', 'tok3'] },
      MailFromAttributes: { MailFromDomain: 'mkt.acme.com', MailFromDomainStatus: 'PENDING' },
    };

    it('creates a domain identity, sets its MAIL FROM domain, then returns the DNS records to publish', async () => {
      const send = vi.fn(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetEmailIdentityCommand') return getIdentityResult;
        return {};
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const result = await provider.createDomainIdentity('acme.com');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.domain.domainName).toBe('acme.com');
      expect(result.domain.active).toBe(false);
      expect(result.domain.dnsRecords).toEqual([
        { recordType: 'CNAME', name: 'tok1._domainkey.acme.com', expectedValue: 'tok1.dkim.amazonses.com', verified: false },
        { recordType: 'CNAME', name: 'tok2._domainkey.acme.com', expectedValue: 'tok2.dkim.amazonses.com', verified: false },
        { recordType: 'CNAME', name: 'tok3._domainkey.acme.com', expectedValue: 'tok3.dkim.amazonses.com', verified: false },
        { recordType: 'MX', name: 'mkt.acme.com', expectedValue: '10 feedback-smtp.us-east-1.amazonses.com', verified: false },
        { recordType: 'TXT', name: 'mkt.acme.com', expectedValue: '"v=spf1 include:amazonses.com ~all"', verified: false },
      ]);

      const calls = send.mock.calls.map(([c]: [{ constructor: { name: string }; input?: unknown }]) => c);
      expect(calls[0]!.constructor.name).toBe('CreateEmailIdentityCommand');
      expect(calls[1]!.constructor.name).toBe('PutEmailIdentityMailFromAttributesCommand');
      expect((calls[1]!.input as { MailFromDomain: string }).MailFromDomain).toBe('mkt.acme.com');
    });

    it('treats an already-existing identity as success and still sets MAIL FROM', async () => {
      const send = vi.fn(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'CreateEmailIdentityCommand') {
          throw Object.assign(new Error('exists'), { name: 'AlreadyExistsException' });
        }
        if (command.constructor.name === 'GetEmailIdentityCommand') return getIdentityResult;
        return {};
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const result = await provider.createDomainIdentity('acme.com');
      expect(result.ok).toBe(true);
    });

    it('reports a domain with no SES identity as null rather than throwing', async () => {
      const send = vi.fn(async () => {
        throw Object.assign(new Error('not found'), { name: 'NotFoundException' });
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      expect(await provider.getDomainIdentity('never-registered.com')).toBeNull();
    });

    it('marks a domain active once both DKIM and sending verification succeed', async () => {
      const send = vi.fn().mockResolvedValue({
        VerifiedForSendingStatus: true,
        DkimAttributes: { Status: 'SUCCESS', Tokens: ['tok1'] },
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      const domain = await provider.getDomainIdentity('acme.com');
      expect(domain?.active).toBe(true);
      expect(domain?.dnsRecords[0]!.verified).toBe(true);
    });

    it('deletes a domain identity, tolerating one that is already gone', async () => {
      const send = vi.fn(async () => {
        throw Object.assign(new Error('not found'), { name: 'NotFoundException' });
      });
      const provider = new SesProvider(settings, fakeClient(send as never));
      await expect(provider.deleteDomainIdentity('acme.com')).resolves.toBeUndefined();
    });
  });
});
