import type { ChannelType } from '@/types/app';

export type ChannelSenderDisplay = {
  label: string;
  value: string;
};

export type ChannelSenders = Record<ChannelType, ChannelSenderDisplay>;

/** Preview/offline placeholders when the service isn't connected. */
export const DEFAULT_CHANNEL_SENDERS: ChannelSenders = {
  email: { label: 'Sender', value: 'Maildrill Team <hello@maildrill.net>' },
  sms: { label: 'Sender ID', value: 'MAILDRILL' },
  whatsapp: { label: 'Business number', value: '+1 555 010 0142' },
  voice: { label: 'Caller ID', value: '+1 555 010 0199' },
};

export function channelSender(
  channel: ChannelType,
  senders: ChannelSenders | undefined,
): ChannelSenderDisplay {
  return senders?.[channel] ?? DEFAULT_CHANNEL_SENDERS[channel];
}
