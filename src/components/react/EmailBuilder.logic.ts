import type { ChannelType } from '@/types/app';
import type { BlockDef } from './EmailBuilder.types';

/** Structure blocks shown in the email canvas palette. */
export const BLOCKS: BlockDef[] = [
  { label: 'Heading', icon: 'templates' },
  { label: 'Text', icon: 'lists' },
  { label: 'Image', icon: 'media' },
  { label: 'Button', icon: 'zap' },
  { label: 'Divider', icon: 'menu' },
  { label: 'Columns', icon: 'dashboard' },
  { label: 'Spacer', icon: 'chevron-down' },
  { label: 'Social', icon: 'star' },
];

/** Personalization tokens offered as insertable chips. */
export const VARIABLES = ['[first_name]', '[last_name]', '[company]', '[order_id]'];

/** Per-channel textarea placeholder copy. */
export const PLACEHOLDER: Record<ChannelType, string> = {
  email: '',
  sms: 'Type your SMS… keep it short — 160 characters fit a single segment.',
  whatsapp: 'Write your WhatsApp message. You can use *bold* and _italic_ formatting.',
  voice: 'Write the script your recipients will hear when they answer the call.',
};

/** Per-channel best-practice tips shown in the left rail. */
export const TIPS: Record<ChannelType, string[]> = {
  email: [],
  sms: [
    'Keep it under 160 characters to fit one segment.',
    'Always include a clear opt-out such as “Reply STOP”.',
    'Use a short branded link instead of a long URL.',
  ],
  whatsapp: [
    'Lead with the value in your very first line.',
    'Add quick-reply buttons to drive responses.',
    'Marketing templates must be pre-approved by Meta.',
  ],
  voice: [
    'Write the way people speak — short, plain sentences.',
    'Say who is calling in the first sentence.',
    'Aim to keep the whole call under 30 seconds.',
  ],
};

/** Per-channel fallback preview text when the message is empty. */
export const PREVIEW_FALLBACK: Record<ChannelType, string> = {
  email: '',
  sms: 'Hi [first_name], your order is on its way! Track it here: mldr.io/go',
  whatsapp: 'Hi [first_name] 👋 thanks for shopping with us. Reply here if you need anything.',
  voice: 'Hello [first_name], this is a courtesy call from Maildrill about your recent order.',
};

export const VOICE_OPTS = ['Ava · US English', 'Noah · US English', 'Emma · UK English'];
export const SPEED_OPTS = ['Slow', 'Normal', 'Fast'];
