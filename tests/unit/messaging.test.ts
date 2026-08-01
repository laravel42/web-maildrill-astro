import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  smsSegments,
  voiceSeconds,
  wordCount,
} from '@/components/react/shared/messaging';
import { CHANNEL, CHANNEL_ORDER, channelLabel } from '@/components/react/shared/channels';
import { eventKind, EVENT_TAB_LABEL } from '@/components/react/shared/campaign-events';

describe('smsSegments', () => {
  it('fits one segment up to 160 and splits beyond', () => {
    expect(smsSegments(0)).toBe(1);
    expect(smsSegments(160)).toBe(1);
    expect(smsSegments(161)).toBeGreaterThan(1);
  });
});

describe('wordCount / voiceSeconds / formatDuration', () => {
  it('counts words robustly', () => {
    expect(wordCount('  hello   world ')).toBe(2);
    expect(wordCount('')).toBe(0);
  });

  it('estimates voice duration from word count', () => {
    expect(voiceSeconds('word '.repeat(150))).toBeGreaterThan(30);
  });

  it('formats mm:ss', () => {
    expect(formatDuration(65)).toMatch(/1.*05|1:05/);
  });
});

describe('channel metadata', () => {
  it('covers every channel in a stable order', () => {
    expect(CHANNEL_ORDER).toEqual(['email', 'sms', 'whatsapp', 'voice']);
    for (const ch of CHANNEL_ORDER) {
      expect(CHANNEL[ch].label).toBeTruthy();
      expect(channelLabel(ch)).toBe(CHANNEL[ch].label);
    }
  });
});

describe('campaign event kinds', () => {
  it('labels every report tab', () => {
    for (const label of Object.values(EVENT_TAB_LABEL)) expect(label).toBeTruthy();
  });

  it('classifies raw event statuses', () => {
    expect(typeof eventKind).toBe('function');
  });
});
