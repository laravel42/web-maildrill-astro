import { randomInt } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, magicLinkTokens, type User } from '@maildrill/database';
import { sha256Hex } from '@maildrill/domain';
import { sendTransactionalEmail } from '@maildrill/providers';
import { createLogger } from '@maildrill/observability';
import { findOrCreateUser, getUser } from './users';
import type { RequestContext } from './security/sessions';
import { deviceLabel } from './security/ua';
import { escapeHtml, sendWelcomeEmail } from './welcome';
import {
  ensurePersonalWorkspace,
  listMembershipsForUser,
  type WorkspaceMembership,
} from './memberships';

const log = createLogger({ component: 'login-code' });

export interface VerifyResult {
  user: User;
  workspaces: WorkspaceMembership[];
}

/** Codes are stored hashed and scoped to the email, so 6 digits stay unique. */
function codeHash(email: string, code: string): string {
  return sha256Hex(`${email}:${code}`);
}

/**
 * Issue a 6-digit login code plus a matching auto-login link. Stores only a
 * hash; prior unconsumed codes for the email are invalidated. The email rides
 * the Cloudflare transactional relay (never Infobip / the campaign pipeline),
 * so sign-in never depends on the workers.
 */
export async function requestLoginCode(
  email: string,
  ctx?: RequestContext,
): Promise<{ code: string; url: string }> {
  const normalized = email.trim().toLowerCase();
  const code = String(randomInt(100_000, 1_000_000)); // 6 digits, CSPRNG
  const expiresAt = new Date(Date.now() + config.auth.magicLinkTtlMinutes * 60_000);

  await db
    .delete(magicLinkTokens)
    .where(and(eq(magicLinkTokens.email, normalized), isNull(magicLinkTokens.consumedAt)));
  await db.insert(magicLinkTokens).values({
    email: normalized,
    tokenHash: codeHash(normalized, code),
    expiresAt,
  });

  const url = `${config.app.url}/auth/verify?email=${encodeURIComponent(normalized)}&code=${code}`;
  await sendLoginEmail(normalized, code, url, ctx);
  return { code, url };
}

async function sendLoginEmail(
  email: string,
  code: string,
  url: string,
  ctx?: RequestContext,
): Promise<void> {
  if (!config.isProd) log.info({ email, code, url }, 'login code (dev)');
  const result = await sendTransactionalEmail({
    to: email,
    subject: `${code} is your Maildrill sign-in code`,
    html: loginEmailHtml(email, code, url, ctx),
    text:
      `Your Maildrill sign-in code is ${code}. ` +
      `It expires in ${config.auth.magicLinkTtlMinutes} minutes.\n\n` +
      `Or sign in directly: ${url}`,
  });
  if (result.accepted) {
    log.info({ email }, 'login-code email sent (cloudflare relay)');
  } else if (result.skipped) {
    log.warn({ email }, 'SMTP not configured — login-code email skipped');
  } else {
    log.error({ email, error: result.error }, 'login-code email send FAILED');
  }
}

/**
 * Verify + single-use consume a code for an email. Self-serve signup on first
 * use: a fresh email gets a user + personal workspace, the optional `name` and
 * `phone` (captured by the sign-up form), and the welcome email
 * (fire-and-forget).
 */
export async function verifyLoginCode(
  email: string,
  code: string,
  name?: string | null,
  phone?: string | null,
): Promise<VerifyResult | null> {
  const normalized = email.trim().toLowerCase();
  const clean = code.replace(/\D/g, '');
  if (clean.length !== 6) return null;

  const now = new Date();
  const consumed = await db
    .update(magicLinkTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(magicLinkTokens.tokenHash, codeHash(normalized, clean)),
        eq(magicLinkTokens.email, normalized),
        isNull(magicLinkTokens.consumedAt),
        gt(magicLinkTokens.expiresAt, now),
      ),
    )
    .returning();
  if (!consumed[0]) return null;

  const { user, created } = await findOrCreateUser(normalized, name, phone);
  await ensurePersonalWorkspace(user);
  if (created) void sendWelcomeEmail(normalized, name?.trim().split(/\s+/)[0]);
  const workspaces = await listMembershipsForUser(user.id);
  return { user, workspaces };
}

export async function getMe(userId: string): Promise<VerifyResult | null> {
  const user = await getUser(userId);
  if (!user) return null;
  const workspaces = await listMembershipsForUser(user.id);
  return { user, workspaces };
}

/**
 * The sign-in email (design/MagicLinkEmail.html). The "Requested from" line
 * shows the classified device + IP when the caller passes the browser context;
 * without it (e.g. step-up re-auth without headers) it degrades to plain
 * "didn't request this" copy.
 */
function loginEmailHtml(email: string, code: string, url: string, ctx?: RequestContext): string {
  const expiry = `${config.auth.magicLinkTtlMinutes} minutes`;
  const href = escapeHtml(url);
  const requestedFrom = [ctx?.userAgent ? deviceLabel(ctx.userAgent) : null, ctx?.ip ?? null]
    .filter((part): part is string => Boolean(part))
    .map(escapeHtml)
    .join(' &middot; ');
  const securityLine = requestedFrom
    ? `Requested from ${requestedFrom}. If that wasn't you, ignore this email &mdash; nobody can sign in without it.`
    : `Didn't request this? Ignore this email &mdash; nobody can sign in without it.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Sign in to Maildrill — code ${code}</title>
<style>
  body{margin:0;padding:0;width:100%!important;background:#eceae3;}
  table{border-collapse:collapse;}
  a{color:#4f46e5;}
  @media (max-width:620px){
    .container{width:100%!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .code{font-size:32px!important;letter-spacing:.22em!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eceae3;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Code ${code}. One tap or one code &mdash; both expire in ${expiry}.</span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eceae3;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">

          <!-- Logo -->
          <tr>
            <td class="px" style="padding:4px 40px 20px;font-family:Arial,Helvetica,sans-serif;">
              <span style="font-size:20px;font-weight:bold;letter-spacing:-.02em;color:#1f1e1b;">Mail<span style="color:#ff441f;">drill</span></span>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td width="600" style="background:#131211;border-radius:20px 20px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:44px 40px 38px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a5a39a;">/ One-time sign-in</div>
                    <h1 style="margin:14px 0 0;font-size:32px;line-height:1.1;mso-line-height-rule:exactly;letter-spacing:-.02em;color:#ffffff;font-weight:bold;">Sign in to Maildrill</h1>
                    <p style="margin:16px 0 0;font-size:15px;line-height:1.6;mso-line-height-rule:exactly;color:rgba(255,255,255,.68);">Requested for <strong style="color:rgba(255,255,255,.9);font-weight:bold;">${escapeHtml(email)}</strong> &middot; expires in ${expiry}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td width="600" style="background:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                <!-- Code -->
                <tr>
                  <td class="px" style="padding:34px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border:1px solid #e4e2da;border-radius:14px;">
                      <tr>
                        <td style="padding:22px 24px;font-family:Arial,Helvetica,sans-serif;">
                          <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a887f;">Your one-time code</div>
                          <div class="code" style="margin-top:8px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:.28em;line-height:1;mso-line-height-rule:exactly;color:#1f1e1b;">${code}</div>
                          <div style="margin-top:10px;font-size:14px;line-height:1.55;mso-line-height-rule:exactly;color:#57554e;">Enter it on the sign-in screen, or use the one-tap link below. Either way, no password needed.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td class="px" align="center" style="padding:28px 40px 8px;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0;">
                      <tr>
                        <td bgcolor="#4f46e5" style="border-radius:10px;">
                          <a href="${href}" style="display:block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Sign in with one tap</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="px" align="center" style="padding:0 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:14px 0 0;font-size:14px;line-height:1.6;mso-line-height-rule:exactly;color:#77756c;">The link and the code are single-use and expire in ${expiry}.</p>
                  </td>
                </tr>

                <!-- Security note -->
                <tr>
                  <td class="px" style="padding:26px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr><td height="1" style="height:1px;background:#eceae3;font-size:0;line-height:1px;">&nbsp;</td></tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:14px;line-height:1.6;mso-line-height-rule:exactly;color:#77756c;">${securityLine}</p>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:16px 40px 34px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;font-size:14px;line-height:1.65;mso-line-height-rule:exactly;color:#77756c;">Trouble signing in? Reply to this email or reach <a href="mailto:support@maildrill.net" style="color:#4f46e5;text-decoration:none;font-weight:bold;">support@maildrill.net</a>.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td width="600" style="background:#ffffff;border-radius:0 0 20px 20px;border-top:1px solid #eceae3;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:24px 40px 30px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 6px;font-size:12px;line-height:1.6;mso-line-height-rule:exactly;color:#a5a39a;">This is a security email for your Maildrill account and can't be unsubscribed from.</p>
                    <p style="margin:0;font-size:12px;line-height:1.6;mso-line-height-rule:exactly;color:#a5a39a;">Maildrill, Inc. &middot; 2261 Market St, San Francisco, CA 94114</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
