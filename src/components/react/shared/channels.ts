import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';

/**
 * Canonical channel presentation metadata, shared by every workspace screen and
 * editor. Previously copy-pasted into CampaignsBoard, AppSubscribers,
 * AppSettings, AppDashboard, AppTemplates and the two editors — now sourced
 * here so colour/icon/label stay in lockstep.
 */
export type ChannelMeta = {
  color: string;
  /** Resolved hex for props/APIs that cannot accept CSS variables. */
  hex: string;
  tint: string;
  icon: IconName;
  /** Display label, e.g. "Email", "SMS", "WhatsApp", "Voice". */
  label: string;
};

export const CHANNEL: Record<ChannelType, ChannelMeta> = {
  email: {
    color: 'var(--ch-email)',
    hex: '#4f46e5',
    tint: 'var(--ch-email-tint)',
    icon: 'mail',
    label: 'Email',
  },
  sms: {
    color: 'var(--ch-sms)',
    hex: '#0891b2',
    tint: 'var(--ch-sms-tint)',
    icon: 'sms',
    label: 'SMS',
  },
  whatsapp: {
    color: 'var(--ch-whatsapp)',
    hex: '#16a34a',
    tint: 'var(--ch-whatsapp-tint)',
    icon: 'whatsapp',
    label: 'WhatsApp',
  },
  voice: {
    color: 'var(--ch-voice)',
    hex: '#d97706',
    tint: 'var(--ch-voice-tint)',
    icon: 'voice',
    label: 'Voice',
  },
};

/** Stable channel ordering for tab bars, selectors and filters. */
export const CHANNEL_ORDER: ChannelType[] = ['email', 'sms', 'whatsapp', 'voice'];

/** Display label for a channel (`'email'` → `'Email'`). */
export const channelLabel = (channel: ChannelType): string => CHANNEL[channel].label;
