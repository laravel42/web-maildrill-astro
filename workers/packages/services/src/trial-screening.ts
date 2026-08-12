import { and, eq, inArray } from 'drizzle-orm';
import { isTenantOnTrial } from '@maildrill/billing';
import { db, subscribers, type Subscriber } from '@maildrill/database';
import { TRIAL_ALLOWANCES, type Channel } from '@maildrill/domain';
import { createLogger, metrics } from '@maildrill/observability';
import { getProvider } from '@maildrill/providers';

const log = createLogger({ component: 'trial-screening' });

/**
 * Provider-side validation of every recipient of a trial campaign.
 *
 * Free sending is what spammers come for, so the trial tier gets the strictest
 * screening we have: each recipient that survived our own local checks is put
 * to Infobip's mailbox validation immediately before the send. Addresses it
 * calls bad are marked `invalid` and dropped from the audience.
 *
 * This is affordable *only* because the trial is capped. At $0.0077 per
 * address — 15× the cost of the email itself — screening a paying account's
 * sends would cost more than the sends. The trial's 100-email ceiling bounds
 * the spend to well under a dollar per workspace for its whole trial, which is
 * a rounding error against one spam incident on the shared sending domain.
 * Paying accounts are protected by list health instead (`list-health.ts`).
 *
 * Must run *after* the allowance gate, so an oversized audience is rejected
 * before any money is spent validating it.
 */

/** Hard ceiling on addresses screened per send, whatever the audience says. */
const MAX_SCREENED = TRIAL_ALLOWANCES.email;

export interface ScreenResult {
  /** Recipients that may be sent to. */
  recipients: Subscriber[];
  /** How many the provider positively rejected. */
  rejected: number;
  /** True when screening actually ran (trial + email + provider capable). */
  screened: boolean;
}

/**
 * Screen a trial campaign's audience. A no-op for paying workspaces, non-email
 * channels, and providers without the capability.
 *
 * Fails open by design: an address the provider could not decide on is kept.
 * The alternative — dropping recipients because Infobip had an outage — turns
 * a provider blip into silent, invisible under-delivery, which is worse than
 * letting a few unverified addresses through a 100-email trial.
 */
export async function screenTrialAudience(
  tenantId: string,
  channel: Channel,
  audience: Subscriber[],
): Promise<ScreenResult> {
  const unscreened: ScreenResult = { recipients: audience, rejected: 0, screened: false };
  if (channel !== 'email' || audience.length === 0) return unscreened;

  const provider = getProvider();
  if (!provider.validateEmailAddresses) return unscreened;
  if (!(await isTenantOnTrial(tenantId))) return unscreened;

  const targets = audience.slice(0, MAX_SCREENED);
  const verdicts = await provider.validateEmailAddresses(targets.map((s) => s.email));

  const badIds: string[] = [];
  const kept: Subscriber[] = [];
  for (const sub of audience) {
    const verdict = verdicts.get(sub.email.trim().toLowerCase());
    // Only a positive rejection drops a recipient; unknown means keep.
    if (verdict && verdict.valid === false) badIds.push(sub.id);
    else kept.push(sub);
  }

  if (badIds.length > 0) {
    // Persist the verdict so the address is not re-screened (and re-billed) on
    // the next send, and so the CRM shows why it stopped being mailable.
    await db
      .update(subscribers)
      .set({ status: 'invalid', updatedAt: new Date() })
      .where(and(eq(subscribers.tenantId, tenantId), inArray(subscribers.id, badIds)));
    metrics.inc('trial_screening_rejected_total', { count: String(badIds.length) });
    log.warn(
      { tenantId, screened: targets.length, rejected: badIds.length },
      'trial screening dropped undeliverable recipients',
    );
  }

  return { recipients: kept, rejected: badIds.length, screened: true };
}
