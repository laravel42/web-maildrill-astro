import { eq } from 'drizzle-orm';
import { automations, automationVersions, db } from '@maildrill/database';
import { setMaildrillEventFilter, type MaildrillEventType } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';
import type { PieceTriggerSettings } from '@maildrill/activepieces-core';
import { getTrigger } from '../pieces/registry';

const log = createLogger({ component: 'automation-subscriptions' });

/**
 * Which workspaces are listening for which domain events.
 *
 * This exists to keep the event bridge from taxing the hot paths it hooks into. Assembling
 * a `campaign.delivered` payload costs a subscriber lookup and a campaign lookup; on a
 * large send that is two queries per recipient, spent for nothing in every workspace that
 * has no automation watching campaigns. The index is refreshed on a timer and consulted
 * synchronously, so the common case — nobody is listening — costs a `Set.has`.
 *
 * Correctness note: the index is eventually consistent, by at most one refresh interval.
 * The failure it can produce is a *missed* event in the seconds after an automation is
 * published, never a wrong one. `refreshSubscriptions()` is called on publish to shrink
 * even that window.
 */
type Index = Map<string, Set<string>>;

let index: Index = new Map();
let loaded = false;

export async function refreshSubscriptions(): Promise<number> {
  const rows = await db
    .select({ tenantId: automations.tenantId, trigger: automationVersions.trigger })
    .from(automations)
    .innerJoin(automationVersions, eq(automationVersions.id, automations.publishedVersionId))
    .where(eq(automations.status, 'active'));

  const next: Index = new Map();
  for (const row of rows) {
    const trigger = row.trigger as { settings?: PieceTriggerSettings };
    const settings = trigger.settings;
    if (!settings?.pieceName || !settings.triggerName) continue;
    const definition = getTrigger(settings.pieceName, settings.triggerName);
    if (!definition) continue;
    const set = next.get(row.tenantId) ?? new Set<string>();
    for (const eventType of definition.eventTypes) set.add(eventType);
    next.set(row.tenantId, set);
  }

  index = next;
  loaded = true;
  return rows.length;
}

/** Install the synchronous filter the domain bus consults. */
export function installSubscriptionFilter(): void {
  setMaildrillEventFilter((type: MaildrillEventType, tenantId: string) => {
    // Before the first refresh, let everything through: dropping events because a cache
    // has not warmed up would lose runs on every deploy.
    if (!loaded) return true;
    return index.get(tenantId)?.has(type) ?? false;
  });
}

export function uninstallSubscriptionFilter(): void {
  setMaildrillEventFilter(null);
  index = new Map();
  loaded = false;
}

/** Test/introspection hook. */
export function subscriptionSnapshot(): Record<string, string[]> {
  return Object.fromEntries([...index].map(([tenantId, types]) => [tenantId, [...types]]));
}

export async function warmSubscriptions(): Promise<void> {
  try {
    const count = await refreshSubscriptions();
    log.debug({ activeAutomations: count }, 'automation subscription index refreshed');
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      'failed to refresh automation subscription index',
    );
  }
}
