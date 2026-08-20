import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '@maildrill/config';

/**
 * Transactional mail (login codes, welcome, account notices) rides the
 * Cloudflare Email Service — NEVER the campaign pipeline. Campaign email goes
 * through the MessagingProvider drivers (Infobip, or Cloudflare's Email Sending
 * REST API via PROVIDER_EMAIL_DRIVER=cloudflare); keeping the two lanes
 * separate protects sign-in deliverability from campaign sender reputation.
 *
 * Prefer the Email Sending REST API when CLOUDFLARE_ACCOUNT_ID is set (structured
 * html/text fields — no MIME parsing). Otherwise fall back to SMTP with a
 * nodemailer boundary that Cloudflare's SMTP ingress can parse (the default
 * `--_NmP-…` prefix produces `----_NmP-…` delimiters that have been observed to
 * arrive with an empty body).
 *
 * Callers own logging: this module only returns outcomes (matching the rest of
 * the providers package). Unconfigured SMTP/REST no-ops with `skipped: true`.
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

/** Nodemailer's default `--_NmP` prefix makes multipart delimiters look like
 * `----_NmP-…`, which Cloudflare's SMTP MIME ingress can fail to parse. */
const SAFE_BOUNDARY_PREFIX = 'md';

function parseFrom(value: string): { address: string; name?: string } {
  const match = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/.exec(value);
  if (match?.[2]) {
    const name = match[1]?.replace(/^"|"$/g, '').trim();
    return name ? { address: match[2], name } : { address: match[2] };
  }
  return { address: value.trim() };
}

async function sendViaRest(
  message: TransactionalEmail,
  from: string,
  accountId: string,
  apiToken: string,
): Promise<TransactionalSendResult> {
  const body: Record<string, unknown> = {
    to: message.to,
    from: parseFrom(from),
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.replyTo) body.reply_to = parseFrom(message.replyTo);

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        accepted: false,
        error: `cloudflare email ${res.status}${text ? `: ${text.slice(0, 240)}` : ''}`,
      };
    }
    return { accepted: true };
  } catch (err) {
    return { accepted: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function createTransactionalMailer(mail: SmtpSettings = config.mail): TransactionalMailer {
  const restAccountId = config.cloudflare.accountId;
  const restToken = config.cloudflare.apiToken || mail.pass;
  const restReady = Boolean(restAccountId && restToken);

  const transport: Transporter | null =
    !restReady && mail.host && mail.user && mail.pass
      ? nodemailer.createTransport({
          host: mail.host,
          port: mail.port,
          secure: mail.secure,
          auth: { user: mail.user, pass: mail.pass },
        })
      : null;

  return {
    configured: restReady || transport != null,
    async send(message: TransactionalEmail): Promise<TransactionalSendResult> {
      if (restReady) {
        return sendViaRest(message, mail.from, restAccountId, restToken);
      }
      if (!transport) return { accepted: false, skipped: true, error: 'SMTP not configured' };
      try {
        await transport.sendMail({
          from: mail.from,
          to: message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          // Avoid nodemailer's default `--_NmP` multipart boundaries.
          // Typed Options omit this MimeNode option, but MailComposer reads it.
          ...({ boundaryPrefix: SAFE_BOUNDARY_PREFIX } as Record<string, string>),
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
