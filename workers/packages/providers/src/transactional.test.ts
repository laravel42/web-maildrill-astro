import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { createTransactionalMailer } from './transactional';

const unconfigured = { host: '', port: 465, user: '', pass: '', secure: false, from: 'X <x@y.z>' };

describe('createTransactionalMailer', () => {
  it('no-ops with skipped=true when SMTP is unconfigured', async () => {
    const mailer = createTransactionalMailer(unconfigured);
    expect(mailer.configured).toBe(false);
    const r = await mailer.send({ to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 't' });
    expect(r.accepted).toBe(false);
    expect(r.skipped).toBe(true);
  });

  it('is configured when host+user+pass are all present', () => {
    const mailer = createTransactionalMailer({
      ...unconfigured,
      host: 'smtp.mx.cloudflare.net',
      user: 'api_token',
      pass: 'secret',
    });
    expect(mailer.configured).toBe(true);
  });
});

describe('cloudflare-safe MIME boundaries', () => {
  it('uses an md- prefix instead of nodemailer default --_NmP', async () => {
    const transport = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    const info = await transport.sendMail({
      from: 'Maildrill <hello@maildrill.net>',
      to: 'a@b.c',
      subject: 's',
      html: '<p>hi</p>',
      text: 'hi',
      ...({ boundaryPrefix: 'md' } as Record<string, string>),
    });
    const raw = Buffer.from(info.message as string | Buffer).toString('utf8');
    expect(raw).toContain('boundary=md-');
    expect(raw).not.toContain('--_NmP');
    expect(raw).toContain('<p>hi</p>');
    expect(raw).toContain('hi');
  });
});
