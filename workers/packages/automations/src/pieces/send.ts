import { and, eq } from 'drizzle-orm';
import { db, suppressions, type Subscriber, type TemplateRow } from '@maildrill/database';
import { NotFoundError, ValidationError, type Channel } from '@maildrill/domain';
import { getSubscriber, getTemplate, resolveMessageContent } from '@maildrill/product';
import { submitMessage } from '@maildrill/services';
import { AutomationStepError } from '../domain/retry';
import type { MaildrillPieceContext } from './context';

/**
 * Shared send path for every channel piece.
 *
 * The one thing this file must never do is reimplement sending. It resolves a recipient,
 * applies the consent gates a campaign would apply, renders content through the *same*
 * `resolveMessageContent` the campaign fan-out uses, and hands off to `submitMessage` —
 * the transactional outbox that already owns idempotency, trial allowance, provider
 * selection and dispatch.
 */

export interface SendParams {
  ctx: MaildrillPieceContext;
  channel: Channel;
  subscriberId: unknown;
  /** Explicit destination; defaults to the subscriber's channel address. */
  to?: unknown;
  templateId?: unknown;
  /** Channel-level copy overrides (subject/html/text/…). */
  content?: Record<string, unknown>;
}

function addressFor(sub: Subscriber, channel: Channel): string | null {
  return channel === 'email' ? sub.email : sub.phone;
}

async function isSuppressed(tenantId: string, channel: Channel, address: string): Promise<boolean> {
  const [row] = await db
    .select({ address: suppressions.address })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.tenantId, tenantId),
        eq(suppressions.channel, channel),
        eq(suppressions.address, address.toLowerCase()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function sendThroughMaildrill(params: SendParams): Promise<Record<string, unknown>> {
  const { ctx, channel } = params;

  const subscriberId = String(params.subscriberId ?? '').trim();
  if (!subscriberId) throw new ValidationError('subscriber is required');
  const sub = await getSubscriber(ctx.tenantId, subscriberId);
  if (!sub) throw new NotFoundError('subscriber not found in this workspace');

  // Consent gates, applied here rather than trusted to the workflow author. A published
  // automation runs unattended for months; "don't mail people who opted out" cannot be a
  // step somebody remembers to add.
  if (sub.status !== 'active') {
    return { sent: false, skipped: `subscriber is ${sub.status}`, subscriberId: sub.id };
  }

  const explicit = typeof params.to === 'string' ? params.to.trim() : '';
  const to = explicit || addressFor(sub, channel);
  if (!to) {
    return {
      sent: false,
      skipped: `subscriber has no ${channel === 'email' ? 'email address' : 'phone number'}`,
      subscriberId: sub.id,
    };
  }
  if (await isSuppressed(ctx.tenantId, channel, to)) {
    return { sent: false, skipped: 'address is suppressed', subscriberId: sub.id };
  }

  let template: TemplateRow | null = null;
  const templateId = typeof params.templateId === 'string' ? params.templateId.trim() : '';
  if (templateId) {
    // Scoped read: a template id from another workspace resolves to nothing.
    template = await getTemplate(ctx.tenantId, templateId);
    if (!template) throw new NotFoundError(`template ${templateId} not found in this workspace`);
    if (template.channel !== channel) {
      throw new AutomationStepError(
        `template "${template.name}" is a ${template.channel} template, not ${channel}`,
        'validation',
      );
    }
    if (channel === 'whatsapp' && template.approvalStatus !== 'approved') {
      throw new AutomationStepError(
        `WhatsApp template "${template.name}" must be approved by Meta before it can be sent`,
        'permanent',
      );
    }
  }

  const content = resolveMessageContent(template, sub, params.content, channel);

  if (ctx.dryRun) {
    return {
      sent: false,
      dryRun: true,
      wouldSend: { channel, to, templateId: template?.id ?? null, content },
      subscriberId: sub.id,
    };
  }

  /*
   * Idempotency key.
   *
   * A run is retried whole (worker crash, queue redelivery), so a send that already
   * happened must not happen again. (run, step) is the identity of "this send": the run id
   * is unique per trigger occurrence and the step name is unique within a flow, so a
   * redelivered job resolves to the message that already exists instead of a second one.
   * It is the FLOW step name, not the action name — two "Send email" steps in one
   * workflow are two different sends.
   */
  const result = await submitMessage({
    tenantId: ctx.tenantId,
    channel,
    to,
    content,
    recipientId: sub.id,
    idempotencyKey: `automation:${ctx.runId}:${ctx.stepName}`,
  });

  return {
    sent: true,
    deduplicated: result.deduplicated,
    messageId: result.message.id,
    channel,
    to,
    subscriberId: sub.id,
    templateId: template?.id ?? null,
  };
}
