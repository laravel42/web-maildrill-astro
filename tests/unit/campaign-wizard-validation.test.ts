import { describe, expect, it } from 'vitest';
import { getStepBlockedReason, isWizardStepBlocked } from '@/components/react/CampaignWizard.logic';
import type { WizardValidationInput } from '@/components/react/CampaignWizard.logic';

const base: Omit<WizardValidationInput, 'step'> = {
  name: 'Summer Sale',
  subject: 'Summer Sale — 50% off',
  fromEmail: 'No Reply <no-reply@example.com>',
  verifiedDomains: ['example.com'],
  domainsReady: true,
  channel: 'email',
  audienceIds: new Set(['list-1']),
  audienceList: [
    { id: 'list-1', kind: 'list', name: 'Newsletter', desc: 'Subscribers', count: 100 },
  ],
  message: '',
  selTpl: { id: 'tpl-1', name: 'Summer Sale', thumb: '#000', cat: 'Promo' },
  hasChannelTemplates: true,
  live: true,
  mode: 'create',
  schedule: 'now',
  scheduledDate: '2026-07-23',
  scheduledTime: '09:00',
};

describe('getStepBlockedReason', () => {
  it('requires a campaign name on step 1', () => {
    expect(getStepBlockedReason({ ...base, step: 1, name: '  ' })).toMatch(/campaign name/i);
    expect(getStepBlockedReason({ ...base, step: 1 })).toBeNull();
  });

  it('requires a template on step 1 for email', () => {
    expect(getStepBlockedReason({ ...base, step: 1, selTpl: null })).toMatch(/template/i);
    expect(
      getStepBlockedReason({
        ...base,
        step: 1,
        live: true,
        selTpl: { name: 'Fixture', thumb: '', cat: '' },
      }),
    ).toMatch(/template/i);
  });

  it('requires a WhatsApp template on step 1 when approved templates exist', () => {
    expect(
      getStepBlockedReason({
        ...base,
        step: 1,
        channel: 'whatsapp',
        selTpl: null,
        hasChannelTemplates: true,
      }),
    ).toMatch(/whatsapp template/i);
    expect(
      getStepBlockedReason({
        ...base,
        step: 1,
        channel: 'whatsapp',
        selTpl: null,
        hasChannelTemplates: false,
      }),
    ).toBeNull();
  });

  it('does not require a template on step 1 for SMS', () => {
    expect(
      getStepBlockedReason({
        ...base,
        step: 1,
        channel: 'sms',
        selTpl: null,
      }),
    ).toBeNull();
  });

  it('requires a verified sending domain and From on step 1 for live email', () => {
    expect(getStepBlockedReason({ ...base, step: 1, domainsReady: false })).toMatch(
      /loading sending domains/i,
    );
    expect(getStepBlockedReason({ ...base, step: 1, verifiedDomains: [], fromEmail: '' })).toMatch(
      /sending domain/i,
    );
    expect(getStepBlockedReason({ ...base, step: 1, fromEmail: '' })).toMatch(/sender/i);
  });

  it('requires at least one audience on step 2', () => {
    expect(getStepBlockedReason({ ...base, step: 2, audienceIds: new Set() })).toMatch(/audience/i);
    expect(
      getStepBlockedReason({ ...base, step: 2, audienceList: [], audienceIds: new Set() }),
    ).toMatch(/list or segment/i);
  });

  it('requires email template id in live mode on step 3', () => {
    expect(
      getStepBlockedReason({
        ...base,
        step: 3,
        selTpl: null,
      }),
    ).toMatch(/template/i);
  });

  it('requires message or template for SMS on step 3', () => {
    const sms = {
      ...base,
      channel: 'sms' as const,
      selTpl: null,
      message: '',
    };
    expect(getStepBlockedReason({ ...sms, step: 3 })).toMatch(/message or choose a template/i);
    expect(getStepBlockedReason({ ...sms, step: 3, message: 'Hi there' })).toBeNull();
  });

  it('never blocks the tracking step (step 4) — toggles are optional', () => {
    expect(getStepBlockedReason({ ...base, step: 4 })).toBeNull();
    expect(isWizardStepBlocked({ ...base, step: 4 })).toBe(false);
    expect(getStepBlockedReason({ ...base, step: 4, channel: 'voice' })).toBeNull();
  });

  it('blocks step 5 without a message when schedule is in the past', () => {
    expect(getStepBlockedReason({ ...base, step: 5, schedule: 'now' })).toBeNull();
    expect(
      getStepBlockedReason({
        ...base,
        step: 5,
        schedule: 'later',
        scheduledDate: '2020-01-01',
        scheduledTime: '09:00',
      }),
    ).toBeNull();
    expect(
      isWizardStepBlocked({
        ...base,
        step: 5,
        schedule: 'later',
        scheduledDate: '2020-01-01',
        scheduledTime: '09:00',
      }),
    ).toBe(true);
    expect(
      isWizardStepBlocked({
        ...base,
        step: 5,
        schedule: 'later',
        scheduledDate: '2099-06-15',
        scheduledTime: '09:00',
      }),
    ).toBe(false);
  });

  it('reuses send guard on step 6 in live create mode', () => {
    expect(
      getStepBlockedReason({ ...base, step: 6, audienceIds: new Set(), selTpl: null }),
    ).toMatch(/audience before sending/i);
    expect(getStepBlockedReason({ ...base, step: 6, mode: 'edit' })).toBeNull();
  });
});
