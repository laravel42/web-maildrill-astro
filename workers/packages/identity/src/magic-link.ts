import { randomInt } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, magicLinkTokens, type User } from '@maildrill/database';
import { sha256Hex } from '@maildrill/domain';
import { getProvider } from '@maildrill/providers';
import { createLogger } from '@maildrill/observability';
import { findOrCreateUser, getUser } from './users';
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
 * hash; prior unconsumed codes for the email are invalidated. Email is sent
 * directly via the provider (not the campaign pipeline), so sign-in never
 * depends on the workers.
 */
export async function requestLoginCode(email: string): Promise<{ code: string; url: string }> {
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
  await sendLoginEmail(normalized, code, url);
  return { code, url };
}

async function sendLoginEmail(email: string, code: string, url: string): Promise<void> {
  if (!config.isProd) log.info({ email, code, url }, 'login code (dev)');
  const result = await getProvider().send({
    messageId: `code-${codeHash(email, code).slice(0, 12)}`,
    tenantId: 'system',
    channel: 'email',
    to: email,
    correlationId: 'auth-login-code',
    content: {
      subject: `${code} is your Maildrill sign-in code`,
      html: loginEmailHtml(code, url),
      text:
        `Your Maildrill sign-in code is ${code}. ` +
        `It expires in ${config.auth.magicLinkTtlMinutes} minutes.\n\n` +
        `Or sign in directly: ${url}`,
    },
  });
  if (result.accepted) {
    log.info(
      { email, provider: getProvider().name, providerMessageId: result.providerMessageId },
      'login-code email sent',
    );
  } else {
    log.error({ email, error: result.error }, 'login-code email send FAILED');
  }
}

/** Verify + single-use consume a code for an email. Self-serve signup on first use. */
export async function verifyLoginCode(email: string, code: string): Promise<VerifyResult | null> {
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

  const user = await findOrCreateUser(normalized);
  await ensurePersonalWorkspace(user);
  const workspaces = await listMembershipsForUser(user.id);
  return { user, workspaces };
}

export async function getMe(userId: string): Promise<VerifyResult | null> {
  const user = await getUser(userId);
  if (!user) return null;
  const workspaces = await listMembershipsForUser(user.id);
  return { user, workspaces };
}

/** Brand-styled sign-in email (Maildrill marketing accent #ff441f). */
function loginEmailHtml(code: string, url: string): string {
  const ttl = config.auth.magicLinkTtlMinutes;
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Maildrill code is ${code}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;background:#ffffff;border:1px solid #ececf0;border-radius:16px;">
            <tr>
              <td style="padding:28px 32px 0;">
                <span style="font-size:19px;font-weight:800;letter-spacing:-0.02em;color:#0b0b0f;">Mail<span style="color:#ff441f;">drill</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 4px;">
                <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#0b0b0f;">Your sign-in code</h1>
                <p style="margin:0;font-size:14px;line-height:1.55;color:#6b7280;">Enter this code to sign in to your workspace. It expires in ${ttl} minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <div style="text-align:center;padding:18px;background:#fff6f4;border:1px solid #ffd9cf;border-radius:12px;">
                  <span style="font-family:'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0b0b0f;padding-left:10px;">${code}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 6px;">
                <a href="${url}" style="display:block;text-align:center;background:#ff441f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 18px;border-radius:10px;">Sign in to Maildrill</a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 26px;">
                <p style="margin:0;font-size:12px;line-height:1.55;color:#9ca3af;">Didn't request this? You can safely ignore this email — never share this code.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #f1f1f4;background:#fbfbfc;border-radius:0 0 16px 16px;">
                <p style="margin:0;font-size:11px;color:#9ca3af;">Maildrill — one inbox for every channel.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
