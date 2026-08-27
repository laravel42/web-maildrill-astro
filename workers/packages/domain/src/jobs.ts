import { z } from 'zod';
import { channelSchema, type Channel } from './channels';

export const QUEUE_NAMES = {
  dispatch: 'message-dispatch',
  events: 'provider-events',
  scheduled: 'scheduled-messages',
  maintenance: 'maintenance',
  deadLetter: 'dead-letter',
  /** Automation runs: first execution and every resume after a delay. */
  automationRun: 'automation-run',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  sendEmail: 'send-email',
  sendSms: 'send-sms',
  sendWhatsApp: 'send-whatsapp',
  sendVoice: 'send-voice',
  processDeliveryReport: 'process-delivery-report',
  processEngagementEvent: 'process-engagement-event',
  processVoiceEvent: 'process-voice-event',
  processProviderError: 'process-provider-error',
  activateMessage: 'activate-message',
  activateCampaignBatch: 'activate-campaign-batch',
  publishOutbox: 'publish-outbox',
  reconcileProviderStatus: 'reconcile-provider-status',
  recoverStalledMessages: 'recover-stalled-messages',
  expireIdempotencyRecords: 'expire-idempotency-records',
  purgeRetainedJobs: 'purge-retained-jobs',
  executeAutomationRun: 'execute-automation-run',
  resumeAutomationRun: 'resume-automation-run',
} as const;

export const sendMessageJobV1 = z.object({
  version: z.literal(1),
  tenantId: z.string().min(1),
  messageId: z.string().min(1),
  channel: channelSchema,
  provider: z.string().min(1),
  generation: z.number().int().nonnegative(),
  correlationId: z.string().min(1),
});
export type SendMessageJobV1 = z.infer<typeof sendMessageJobV1>;

export const processWebhookJobV1 = z.object({
  version: z.literal(1),
  webhookEventId: z.string().min(1),
  provider: z.string().min(1),
  correlationId: z.string().min(1),
});
export type ProcessWebhookJobV1 = z.infer<typeof processWebhookJobV1>;

export const activateMessageJobV1 = z.object({
  version: z.literal(1),
  tenantId: z.string().min(1),
  messageId: z.string().min(1),
  correlationId: z.string().min(1),
});
export type ActivateMessageJobV1 = z.infer<typeof activateMessageJobV1>;

export function jobNameForChannel(channel: Channel): string {
  switch (channel) {
    case 'email':
      return JOB_NAMES.sendEmail;
    case 'sms':
      return JOB_NAMES.sendSms;
    case 'whatsapp':
      return JOB_NAMES.sendWhatsApp;
    case 'voice':
      return JOB_NAMES.sendVoice;
  }
}

export const automationRunJobV1 = z.object({
  version: z.literal(1),
  tenantId: z.string().min(1),
  runId: z.string().min(1),
  /**
   * `start` for the first segment, `resume` after a delay. The worker re-reads the run row
   * either way — the job carries identity, never state.
   */
  mode: z.enum(['start', 'resume']),
});
export type AutomationRunJobV1 = z.infer<typeof automationRunJobV1>;

/**
 * Deterministic BullMQ job id for an automation run segment. Colons are illegal in custom
 * job ids (Redis key separator), hence underscores — same rule as `dispatchJobId`.
 */
export function automationRunJobId(runId: string, attempt: number): string {
  return `autorun_${runId}_${attempt}`;
}
