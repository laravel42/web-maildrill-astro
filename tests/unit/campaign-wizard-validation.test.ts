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
  selTpl: { id: 'tpl-1', name: 'Summer Sale', thumb: '#000', cat: 'Promo' },
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

  // Every channel is template-only — there is no composer downstream that
  // could supply content later, so step 1's pick is required everywhere.
  it.each(['sms', 'voice', 'whatsapp'] as const)(
    'requires a template on step 1 for %s',
    (channel) => {
      expect(getStepBlockedReason({ ...base, step: 1, channel, selTpl: null })).toMatch(/template/i);
      expect(getStepBlockedReason({ ...base, step: 1, channel })).toBeNull();
    },
  );

  it('names the WhatsApp requirement as an approved template', () => {
    expect(
      getStepBlockedReason({ ...base, step: 1, channel: 'whatsapp', selTpl: null }),
    ).toMatch(/approved whatsapp template/i);
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

  it('never blocks the tracking step (step 3) — toggles are optional', () => {
    expect(getStepBlockedReason({ ...base, step: 3 })).toBeNull();
    expect(isWizardStepBlocked({ ...base, step: 3 })).toBe(false);
    expect(getStepBlockedReason({ ...base, step: 3, channel: 'voice' })).toBeNull();
  });

  it('blocks the schedule step (step 4) silently when the time is in the past', () => {
    expect(getStepBlockedReason({ ...base, step: 4, schedule: 'now' })).toBeNull();
    expect(
      getStepBlockedReason({
        ...base,
        step: 4,
        schedule: 'later',
        scheduledDate: '2020-01-01',
        scheduledTime: '09:00',
      }),
    ).toBeNull();
    expect(
      isWizardStepBlocked({
        ...base,
        step: 4,
        schedule: 'later',
        scheduledDate: '2020-01-01',
        scheduledTime: '09:00',
      }),
    ).toBe(true);
    expect(
      isWizardStepBlocked({
        ...base,
        step: 4,
        schedule: 'later',
        scheduledDate: '2099-06-15',
        scheduledTime: '09:00',
      }),
    ).toBe(false);
  });

  it('reuses the send guard on the review step (step 5) in live create mode', () => {
    expect(
      getStepBlockedReason({ ...base, step: 5, audienceIds: new Set(), selTpl: null }),
    ).toMatch(/audience before sending/i);
    expect(getStepBlockedReason({ ...base, step: 5, selTpl: null })).toMatch(/template/i);
    expect(getStepBlockedReason({ ...base, step: 5, mode: 'edit' })).toBeNull();
  });

  it('requires a template before sending on the text channels too', () => {
    expect(
      getStepBlockedReason({ ...base, step: 5, channel: 'sms', selTpl: null }),
    ).toMatch(/template/i);
  });
});
