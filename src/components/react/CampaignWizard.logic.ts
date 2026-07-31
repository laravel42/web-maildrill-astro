import type { ChannelType } from '@/types/app';
import type { ChannelSenders } from '@/lib/app/channel-senders';
import { channelSender } from '@/lib/app/channel-senders';
import { TEMPLATE_THUMBS, hashTemplateId } from '@/lib/app/template-map';
import {
  formatScheduleSummary,
  isScheduledInFuture,
  type ScheduleDate,
  type ScheduleTime,
} from '@/lib/app/schedule';
import type {
  AudienceChoice,
  Schedule,
  Step,
  Template,
  TemplateChoice,
} from './CampaignWizard.types';

export const CONTENT_SUB: Record<ChannelType, string> = {
  email: 'Choose your template',
  sms: 'Write your text message',
  whatsapp: 'Pick your WhatsApp message template',
  voice: 'Write your voice script',
};

/** "Newsletter (856)" — one audience as shown in the review step and toasts. */
export function audienceLabelOf(a: AudienceChoice | null): string {
  if (!a) return 'No audience selected';
  return a.count == null ? a.name : `${a.name} (${a.count.toLocaleString()})`;
}

/** Human label for one or more selected audiences. */
export function audiencesLabelOf(selected: AudienceChoice[]): string {
  if (selected.length === 0) return 'No audience selected';
  if (selected.length === 1) return audienceLabelOf(selected[0]!);
  return selected.map((a) => a.name).join(', ');
}

/** Split selected audience ids into list and segment buckets. */
export function partitionAudienceIds(
  audienceList: AudienceChoice[],
  selectedIds: Iterable<string>,
): { listIds: string[]; segmentIds: string[] } {
  const byId = new Map(audienceList.map((a) => [a.id, a]));
  const listIds: string[] = [];
  const segmentIds: string[] = [];
  for (const id of selectedIds) {
    const a = byId.get(id);
    if (!a) continue;
    if (a.kind === 'list') listIds.push(id);
    else segmentIds.push(id);
  }
  return { listIds, segmentIds };
}

/* Card gradients for preview fixtures — live templates derive styling from id. */
const FIXTURE_PALETTE: Array<{ thumb: string; fg: string; accent: string }> = [
  { thumb: 'linear-gradient(150deg,#4f46e5,#6d28d9)', fg: '#fff', accent: '#4f46e5' },
  { thumb: 'linear-gradient(150deg,#34d399,#059669)', fg: '#fff', accent: '#059669' },
  { thumb: 'linear-gradient(150deg,#06b6d4,#0891b2)', fg: '#fff', accent: '#0891b2' },
  { thumb: 'linear-gradient(150deg,#f59e0b,#d97706)', fg: '#fff', accent: '#d97706' },
  { thumb: 'linear-gradient(150deg,#ec4899,#be185d)', fg: '#fff', accent: '#db2777' },
];

/**
 * Present a saved template as a wizard card. Real templates only have a name and
 * category, so the decorative fields the preview needs are derived rather than
 * stored — the selection is what matters, not the thumbnail.
 */
export function templateCard(t: TemplateChoice): Template {
  const [thumb, fg, accent] = TEMPLATE_THUMBS[hashTemplateId(t.id) % TEMPLATE_THUMBS.length]!;
  return {
    id: t.id,
    name: t.name,
    thumb,
    fg,
    accent,
    title: t.name.toUpperCase(),
    kicker: t.category ?? '',
    cat: t.category ?? 'Uncategorized',
    cta: 'View',
  };
}

/** Stable key for template selection — saved templates use id, fixtures use name. */
export function templateKey(t: Template): string {
  return t.id ?? t.name;
}

/** Fixture-mode message body derived from the template card (live templates fetch `text`). */
export function fixtureTemplateMessage(t: Template): string {
  return t.title ?? t.name;
}

export const TEMPLATES: Record<ChannelType, Template[]> = {
  email: [
    {
      name: 'Summer Sale',
      thumb: FIXTURE_PALETTE[0]!.thumb,
      fg: FIXTURE_PALETTE[0]!.fg,
      accent: FIXTURE_PALETTE[0]!.accent,
      title: 'SUMMER SALE',
      kicker: 'LIMITED TIME',
      cta: 'Shop the sale',
      cat: 'Promotional',
    },
    {
      name: 'Welcome Series',
      thumb: '#f6b8a0',
      fg: '#7c2d12',
      accent: '#ea6c3f',
      title: 'WELCOME',
      kicker: 'GLAD YOU’RE HERE',
      cta: 'Get started',
      cat: 'Transactional',
    },
    {
      name: 'Spring Preview',
      thumb: FIXTURE_PALETTE[1]!.thumb,
      fg: FIXTURE_PALETTE[1]!.fg,
      accent: FIXTURE_PALETTE[1]!.accent,
      title: 'SPRING PREVIEW',
      kicker: 'THE EDIT',
      cta: 'See the collection',
      cat: 'Newsletter',
    },
  ],
  sms: [
    {
      name: 'Flash Sale Text',
      thumb: FIXTURE_PALETTE[2]!.thumb,
      fg: FIXTURE_PALETTE[2]!.fg,
      accent: FIXTURE_PALETTE[2]!.accent,
      title: 'Flash sale ends tonight',
      kicker: 'MAILDRILL',
      cta: 'Shop now',
      cat: 'Promotional',
    },
    {
      name: 'Appointment Reminder',
      thumb: 'linear-gradient(150deg,#06b6d4,#0e7490)',
      fg: '#fff',
      accent: '#0891b2',
      title: 'Your appointment is tomorrow',
      kicker: 'MAILDRILL',
      cta: 'Confirm',
      cat: 'Transactional',
    },
  ],
  whatsapp: [
    {
      name: 'Order Update',
      thumb: FIXTURE_PALETTE[1]!.thumb,
      fg: FIXTURE_PALETTE[1]!.fg,
      accent: FIXTURE_PALETTE[1]!.accent,
      title: 'Your order has shipped',
      kicker: 'Maildrill',
      cta: 'Track order',
      cat: 'Transactional',
    },
    {
      name: 'Delivery Notice',
      thumb: 'linear-gradient(150deg,#34d399,#059669)',
      fg: '#fff',
      accent: '#059669',
      title: 'Out for delivery today',
      kicker: 'Maildrill',
      cta: 'View status',
      cat: 'Transactional',
    },
  ],
  voice: [
    {
      name: 'Payment Reminder',
      thumb: FIXTURE_PALETTE[3]!.thumb,
      fg: FIXTURE_PALETTE[3]!.fg,
      accent: FIXTURE_PALETTE[3]!.accent,
      title: 'Payment reminder',
      kicker: 'MAILDRILL',
      cta: 'Pay now',
      cat: 'Transactional',
    },
    {
      name: 'Appointment Call',
      thumb: 'linear-gradient(150deg,#fbbf24,#d97706)',
      fg: '#fff',
      accent: '#d97706',
      title: 'Appointment confirmation',
      kicker: 'MAILDRILL',
      cta: 'Confirm',
      cat: 'Reminder',
    },
  ],
};

/** Inputs shared by per-step Continue gating and final send checks. */
export type WizardValidationInput = {
  step: Step;
  name: string;
  /** Email subject line — required for the email channel, ignored otherwise. */
  subject: string;
  channel: ChannelType;
  audienceIds: Set<string>;
  audienceList: AudienceChoice[];
  message: string;
  selTpl: Template | null;
  live: boolean;
  mode: 'create' | 'edit';
  schedule: Schedule;
  scheduledDate: ScheduleDate;
  scheduledTime: ScheduleTime;
};

/** Whether Continue / Send should be disabled (includes schedule validity without a user-facing message). */
export function isWizardStepBlocked(input: WizardValidationInput): boolean {
  if (getStepBlockedReason(input) !== null) return true;
  if (input.step === 4 && input.schedule === 'later') {
    return !isScheduledInFuture(input.scheduledDate, input.scheduledTime);
  }
  return false;
}

/** Why the current step cannot advance, or null when Continue / Send is allowed. */
export function getStepBlockedReason(input: WizardValidationInput): string | null {
  const { step, name, subject, channel, audienceIds, audienceList, message, selTpl, live } = input;
  const isEmail = channel === 'email';

  switch (step) {
    case 1:
      if (!name.trim()) return 'Enter a campaign name to continue.';
      if (isEmail && !subject.trim()) return 'Enter an email subject to continue.';
      return null;
    case 2:
      if (audienceList.length === 0) {
        return 'Create a list or segment under Audience before continuing.';
      }
      if (audienceIds.size === 0) return 'Pick at least one audience to continue.';
      return null;
    case 3:
      if (isEmail) {
        if (live) {
          if (!selTpl?.id) return 'Choose a template — an email campaign needs content to send.';
        } else if (!selTpl) {
          return 'Choose a template to continue.';
        }
        return null;
      }
      if (!selTpl && !message.trim()) {
        return 'Write a message or choose a template to continue.';
      }
      return null;
    case 4:
      return null;
    case 5:
      return getCampaignSendBlockedReason(input);
    default:
      return null;
  }
}

/** Final send guard for live create mode — same rules as step 5 validation. */
export function getCampaignSendBlockedReason(
  input: Omit<WizardValidationInput, 'step'>,
): string | null {
  const { channel, subject, audienceIds, audienceList, message, selTpl, live, mode } = input;
  if (!live || mode === 'edit') return null;

  const selectedCount = audienceList.filter((a) => audienceIds.has(a.id)).length;
  if (selectedCount === 0) return 'Pick at least one audience before sending.';

  const isEmail = channel === 'email';
  if (isEmail && !subject.trim()) return 'Enter an email subject before sending.';
  const draftContent = isEmail ? undefined : message.trim() ? { text: message } : undefined;
  if (!selTpl?.id && !draftContent) {
    return isEmail
      ? 'Choose a template — an email campaign needs content to send.'
      : 'Write a message before sending.';
  }
  return null;
}

/** Left-rail step definitions: `[title, subtitle]`. Step 3's subtitle is channel-specific. */
export function buildStepDefs(contentSub: string): [string, string][] {
  return [
    ['Sender', 'Basics'],
    ['Audience', 'Choose recipients'],
    ['Content', contentSub],
    ['Schedule', 'Set delivery'],
    ['Review', 'Check everything'],
  ];
}

/** One row in the review-step summary — text or structured channel/audience. */
export type ReviewRow =
  | { label: string; kind: 'text'; value: string }
  | { label: string; kind: 'channel'; channel: ChannelType }
  | { label: string; kind: 'audience'; audiences: AudienceChoice[] };

/** Review-step summary rows for step 5. */
export function buildReviewRows(
  name: string,
  subject: string,
  channel: ChannelType,
  selectedAudiences: AudienceChoice[],
  selectedTemplateName: string | null,
  schedule: Schedule,
  scheduledDate: ScheduleDate,
  scheduledTime: ScheduleTime,
  senders?: ChannelSenders,
): ReviewRow[] {
  const isEmail = channel === 'email';
  const sender = channelSender(channel, senders);
  const rows: ReviewRow[] = [
    { label: 'Campaign', kind: 'text', value: name || 'Untitled' },
    { label: 'Channel', kind: 'channel', channel },
    { label: 'Sender', kind: 'text', value: sender.value },
    { label: 'Audience', kind: 'audience', audiences: selectedAudiences },
    { label: 'Template', kind: 'text', value: selectedTemplateName ?? '—' },
    {
      label: 'Delivery',
      kind: 'text',
      value:
        schedule === 'now'
          ? 'Send immediately'
          : formatScheduleSummary(scheduledDate, scheduledTime),
    },
  ];
  // Email carries a subject line; show it just under the campaign name.
  if (isEmail) rows.splice(1, 0, { label: 'Subject', kind: 'text', value: subject.trim() || '—' });
  return rows;
}
