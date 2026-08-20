import { randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import {
  automations,
  automationWebhooks,
  automationVersions,
  db,
  type AutomationRow,
  type AutomationVersionRow,
} from '@maildrill/database';
import { sha256Hex } from '@maildrill/domain';

/**
 * Webhook trigger tokens.
 *
 * The URL is the credential — there is nothing else an external system can present, and
 * asking integrators to sign requests would make this trigger unusable for most of them.
 * That is the same trade the unsubscribe link makes, so it gets the same treatment: 32
 * bytes of CSPRNG entropy, stored only as a SHA-256 hash, and compared in constant time.
 * A leaked token is revoked by minting a new one.
 */

export interface MintedWebhookToken {
  token: string;
  hash: string;
  prefix: string;
}

export function mintWebhookToken(): MintedWebhookToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256Hex(token), prefix: token.slice(0, 8) };
}

export function webhookUrl(token: string): string {
  return `${config.app.url.replace(/\/$/, '')}/api/automations/webhooks/${token}`;
}

export interface ResolvedWebhook {
  tenantId: string;
  automation: AutomationRow;
  version: AutomationVersionRow;
}

/**
 * Resolve a presented token to its live automation, or null.
 *
 * Returning null for "unknown token", "automation paused" and "never published" alike is
 * deliberate: the caller answers 404 either way, so the endpoint cannot be used to
 * enumerate which tokens exist.
 */
export async function resolveWebhookToken(token: string): Promise<ResolvedWebhook | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const presented = sha256Hex(token);

  const [hook] = await db
    .select()
    .from(automationWebhooks)
    .where(eq(automationWebhooks.tokenHash, presented))
    .limit(1);
  if (!hook) return null;

  // The index lookup already used the hash, so this is belt-and-braces against a future
  // change that widens the query; it costs nothing and keeps the comparison honest.
  const a = Buffer.from(hook.tokenHash, 'hex');
  const b = Buffer.from(presented, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [row] = await db
    .select({ automation: automations, version: automationVersions })
    .from(automations)
    .innerJoin(automationVersions, eq(automationVersions.id, automations.publishedVersionId))
    .where(and(eq(automations.id, hook.automationId), eq(automations.tenantId, hook.tenantId)))
    .limit(1);
  if (!row || row.automation.status !== 'active') return null;

  return { tenantId: hook.tenantId, automation: row.automation, version: row.version };
}

/** Record the last body received, so the composer can offer it as a test payload. */
export async function recordWebhookPayload(
  automationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db
    .update(automationWebhooks)
    .set({ lastPayload: payload, lastSeenAt: new Date() })
    .where(eq(automationWebhooks.automationId, automationId));
}

export async function lastWebhookPayload(
  tenantId: string,
  automationId: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ lastPayload: automationWebhooks.lastPayload })
    .from(automationWebhooks)
    .where(
      and(
        eq(automationWebhooks.automationId, automationId),
        eq(automationWebhooks.tenantId, tenantId),
      ),
    )
    .limit(1);
  return row?.lastPayload ?? null;
}
