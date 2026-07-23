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
};

const emptyPhoneList: AudienceChoice = {
  id: 'list-2',
  kind: 'list',
  name: 'Email only',
  desc: 'List',
  count: 50,
  phoneCount: 0,
};

const unknownPhoneSegment: AudienceChoice = {
  id: 'seg-1',
  kind: 'segment',
  name: 'VIP',
  desc: 'Segment',
  count: 12,
  phoneCount: null,
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
});

describe('isAudienceSelectable', () => {
  it('keeps unknown counts visible', () => {
    expect(isAudienceSelectable(unknownPhoneSegment, 'whatsapp')).toBe(true);
  });

  it('hides explicit zero phone reach', () => {
    expect(isAudienceSelectable(emptyPhoneList, 'voice')).toBe(false);
  });
});

describe('totalSelectedRecipients', () => {
  it('sums known selected counts', () => {
    const prepared = prepareAudiencesForChannel([list, unknownPhoneSegment], 'sms');
    expect(totalSelectedRecipients(prepared, new Set(['list-1']))).toBe(40);
    expect(totalSelectedRecipients(prepared, new Set(['list-1', 'seg-1']))).toBeNull();
  });
});
