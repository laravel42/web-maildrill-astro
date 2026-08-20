import { describe, expect, it } from 'vitest';
import {
  audienceRecipientCount,
  isAudienceSelectable,
  listToAudienceChoice,
  prepareAudiencesForChannel,
  totalSelectedRecipients,
} from '@/lib/app/audience-map';
import type { AudienceChoice } from '@/components/react/CampaignWizard.types';

const list: AudienceChoice = {
  id: 'list-1',
  kind: 'list',
  name: 'Newsletter',
  desc: 'List',
  count: 100,
  phoneCount: 40,
  channels: ['email', 'sms', 'whatsapp', 'voice'],
};

const emptyPhoneList: AudienceChoice = {
  id: 'list-2',
  kind: 'list',
  name: 'Email only',
  desc: 'List',
  count: 50,
  phoneCount: 0,
  channels: ['email'],
};

const unknownPhoneSegment: AudienceChoice = {
  id: 'seg-1',
  kind: 'segment',
  name: 'VIP',
  desc: 'Segment',
  count: 12,
  phoneCount: null,
  channels: ['email', 'sms', 'whatsapp', 'voice'],
};

describe('audienceRecipientCount', () => {
  it('uses total members on email', () => {
    expect(audienceRecipientCount(list, 'email')).toBe(100);
  });

  it('uses phone-capable members on SMS', () => {
    expect(audienceRecipientCount(list, 'sms')).toBe(40);
  });
});

describe('listToAudienceChoice', () => {
  it('derives zero phone reach from zero members when API omits phoneMemberCount', () => {
    const choice = listToAudienceChoice({ id: 'x', name: 'Empty', memberCount: 0 });
    expect(choice.phoneCount).toBe(0);
  });

  it('uses enriched preview counts when API omits phoneMemberCount', () => {
    const choice = listToAudienceChoice(
      { id: 'x', name: 'Email only', memberCount: 50 },
      { phoneCount: 0 },
    );
    expect(choice.phoneCount).toBe(0);
    expect(prepareAudiencesForChannel([choice, list], 'sms').map((a) => a.id)).toEqual(['list-1']);
  });
});

describe('prepareAudiencesForChannel', () => {
  it('filters zero-reach audiences and maps display counts', () => {
    const prepared = prepareAudiencesForChannel([list, emptyPhoneList, unknownPhoneSegment], 'sms');
    expect(prepared.map((a) => a.id)).toEqual(['list-1', 'seg-1']);
    expect(prepared.find((a) => a.id === 'list-1')?.count).toBe(40);
  });

  it('hides empty lists on SMS when phoneMemberCount is missing', () => {
    const emptyNoPhone = listToAudienceChoice({ id: 'empty', name: 'Empty', memberCount: 0 });
    const prepared = prepareAudiencesForChannel([emptyNoPhone, list], 'sms');
    expect(prepared.map((a) => a.id)).toEqual(['list-1']);
  });

  it('filters zero total members on email', () => {
    const zeroEmail: AudienceChoice = { ...emptyPhoneList, count: 0, phoneCount: 0 };
    const prepared = prepareAudiencesForChannel([zeroEmail, list], 'email');
    expect(prepared.map((a) => a.id)).toEqual(['list-1']);
  });

  it('hides lists that do not declare the selected channel', () => {
    const emailOnly = listToAudienceChoice({
      id: 'email-only',
      name: 'Email only',
      memberCount: 20,
      phoneMemberCount: 10,
      channels: ['email'],
    });
    const smsReady = listToAudienceChoice({
      id: 'sms-ready',
      name: 'SMS ready',
      memberCount: 30,
      phoneMemberCount: 25,
      channels: ['email', 'sms'],
    });
    expect(prepareAudiencesForChannel([emailOnly, smsReady], 'sms').map((a) => a.id)).toEqual([
      'sms-ready',
    ]);
    expect(prepareAudiencesForChannel([emailOnly, smsReady], 'email').map((a) => a.id)).toEqual([
      'email-only',
      'sms-ready',
    ]);
  });

  it('hides segments that do not declare the selected channel', () => {
    const emailSeg: AudienceChoice = {
      id: 'seg-email',
      kind: 'segment',
      name: 'Email VIPs',
      desc: 'Segment',
      count: 10,
      phoneCount: 8,
      channels: ['email'],
    };
    const smsSeg: AudienceChoice = {
      id: 'seg-sms',
      kind: 'segment',
      name: 'SMS VIPs',
      desc: 'Segment',
      count: 10,
      phoneCount: 8,
      channels: ['sms'],
    };
    expect(prepareAudiencesForChannel([emailSeg, smsSeg], 'sms').map((a) => a.id)).toEqual([
      'seg-sms',
    ]);
  });
});

describe('isAudienceSelectable', () => {
  it('keeps unknown counts visible', () => {
    expect(isAudienceSelectable(unknownPhoneSegment, 'whatsapp')).toBe(true);
  });

  it('hides explicit zero phone reach', () => {
    expect(
      isAudienceSelectable(
        { ...emptyPhoneList, channels: ['email', 'sms', 'whatsapp', 'voice'] },
        'voice',
      ),
    ).toBe(false);
  });

  it('hides lists whose channels omit the campaign channel', () => {
    expect(isAudienceSelectable({ ...list, channels: ['email'] }, 'sms')).toBe(false);
    expect(isAudienceSelectable({ ...list, channels: ['email', 'sms'] }, 'sms')).toBe(true);
  });
});

describe('totalSelectedRecipients', () => {
  it('sums known selected counts', () => {
    const prepared = prepareAudiencesForChannel([list, unknownPhoneSegment], 'sms');
    expect(totalSelectedRecipients(prepared, new Set(['list-1']))).toBe(40);
    expect(totalSelectedRecipients(prepared, new Set(['list-1', 'seg-1']))).toBeNull();
  });
});
