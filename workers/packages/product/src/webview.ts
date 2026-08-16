import { and, eq } from 'drizzle-orm';
import { campaigns, db, subscribers, templates, type Subscriber } from '@maildrill/database';
import type { WebviewClaims } from '@maildrill/services';
import { resolveMessageContent } from './templates';

/**
 * Re-render the email behind a "view in browser" link.
 *
 * Nothing per-recipient is stored: the page renders from the same template and
 * campaign content the send used, with the recipient's own merge tags applied.
 * That keeps one row per campaign instead of a rendered copy per recipient.
 *
 * The trade-off is fidelity — editing the template after a send changes what
 * the webview shows. Pinning it would mean snapshotting the body per campaign
 * at send time.
 */
export async function renderWebview(
  claims: WebviewClaims,
): Promise<{ subject: string; html: string } | null> {
  const [sub] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, claims.subscriberId), eq(subscribers.tenantId, claims.tenantId)))
    .limit(1);
  if (!sub) return null;

  const [camp] = claims.campaignId
    ? await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, claims.campaignId), eq(campaigns.tenantId, claims.tenantId)))
        .limit(1)
    : [];
  if (claims.campaignId && !camp) return null;

  const [tpl] = camp?.templateId
    ? await db.select().from(templates).where(eq(templates.id, camp.templateId)).limit(1)
    : [];

  const content = resolveMessageContent(
    tpl ?? null,
    sub as Subscriber,
    (camp?.content as Record<string, unknown> | undefined) ?? undefined,
    'email',
    { ...(claims.campaignId ? { campaignId: claims.campaignId } : {}) },
  );
  const html = typeof content.html === 'string' ? content.html : '';
  const text = typeof content.text === 'string' ? content.text : '';
  if (!html && !text) return null;
  return {
    subject: typeof content.subject === 'string' ? content.subject : '',
    // A text-only campaign still deserves a readable page.
    html: html || `<pre style="white-space:pre-wrap;font:14px/1.6 system-ui">${text}</pre>`,
  };
}
