/**
 * `@maildrill/automations` — the Automations subsystem.
 *
 * Layering (enforced by imports, not convention):
 *   domain/   pure rules — limits, retry classification
 *   engine/   the Activepieces-derived executor. Imports NOTHING from the product.
 *   pieces/   Maildrill triggers/actions, calling existing product services
 *   runtime/  persistence, run lifecycle, queue plumbing, connections, webhooks
 *   events/   the domain-event bridge and the segment differ
 *
 * See docs/architecture/automations-activepieces.md.
 */
export * from './domain/limits';
export * from './domain/retry';

export type {
  AutomationEngine,
  AutomationExecutionContext,
  EngineRunInput,
  EngineRunResult,
  PieceRunner,
  PieceRunOutcome,
  RunJournalSink,
  StepRunRecord,
} from './engine/ports';
export { MaildrillAutomationEngine } from './engine/engine';

export type { MaildrillPiece, MaildrillPieceContext } from './pieces/context';
export {
  allPieces,
  getAction,
  getPiece,
  getTrigger,
  pieceCatalog,
  subscribedEventTypes,
  triggersForEvent,
  type PieceMetadata,
} from './pieces/registry';
export { MaildrillPieceRunner } from './pieces/runner';
export { delayUntil, parseConditionGroups } from './pieces/logic';
export { isBlockedAddress, performHttpRequest } from './pieces/http-client';

export * from './runtime/repository';
export * from './runtime/runs';
export * from './runtime/validation';
export * from './runtime/connections';
export {
  lastWebhookPayload,
  recordWebhookPayload,
  resolveWebhookToken,
  webhookUrl,
} from './runtime/webhooks';
export { ensureWebhook as mintAutomationWebhook } from './runtime/repository';

export { installAutomationEventSink, uninstallAutomationEventSink } from './events/sink';
export { currentAutomationOrigin, withAutomationOrigin } from './events/origin';
export { dispatchAutomationEvents, type DispatchResult } from './events/dispatcher';
export {
  pruneUnwatchedSegments,
  sweepSegmentMembership,
  type SegmentSweepResult,
} from './events/segments';
export { runAutomationMaintenance, type MaintenanceResult } from './runtime/maintenance';
export {
  installSubscriptionFilter,
  refreshSubscriptions,
  subscriptionSnapshot,
  uninstallSubscriptionFilter,
  warmSubscriptions,
} from './events/subscriptions';
