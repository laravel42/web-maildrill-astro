import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '@maildrill/config';

/**
 * Transactional mail (login codes, welcome, account notices) rides the
 * Cloudflare Email Service SMTP relay — NEVER the campaign pipeline. Campaign
 * email goes through the MessagingProvider drivers (Infobip, or Cloudflare's
 * Email Sending REST API via PROVIDER_EMAIL_DRIVER=cloudflare); keeping the
 * two lanes separate protects sign-in deliverability from campaign sender
 * reputation.
 *
 * Callers own logging: this module only returns outcomes (matching the rest of
 * the providers package). Unconfigured SMTP no-ops with `skipped: true`.
 */

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface TransactionalSendResult {
  accepted: boolean;
  /** True when SMTP is unconfigured and the send was skipped (dev without creds). */
  skipped?: boolean;
  error?: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  from: string;
}

export interface TransactionalMailer {
  readonly configured: boolean;
  send(message: TransactionalEmail): Promise<TransactionalSendResult>;
}

export function createTransactionalMailer(mail: SmtpSettings = config.mail): TransactionalMailer {
  const transport: Transporter | null =
    mail.host && mail.user && mail.pass
      ? nodemailer.createTransport({
          host: mail.host,
          port: mail.port,
          secure: mail.secure,
          auth: { user: mail.user, pass: mail.pass },
        })
      : null;

  return {
    configured: transport != null,
    async send(message: TransactionalEmail): Promise<TransactionalSendResult> {
      if (!transport) return { accepted: false, skipped: true, error: 'SMTP not configured' };
      try {
        await transport.sendMail({
          from: mail.from,
          to: message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        return { accepted: true };
      } catch (err) {
        return { accepted: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

let singleton: TransactionalMailer | null = null;

/** Send one transactional email through the shared Cloudflare relay transport. */
export function sendTransactionalEmail(
  message: TransactionalEmail,
): Promise<TransactionalSendResult> {
  singleton ??= createTransactionalMailer();
  return singleton.send(message);
}
