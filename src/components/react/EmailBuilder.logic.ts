import type { ChannelType } from '@/types/app';
import { normalizeTemplateLanguageCode } from '@/lib/app/template-language';
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
  sms: 'Hi {{name}}, your order is on its way! Track it here: mldr.io/go',
  whatsapp: 'Hi {{name}} 👋 thanks for shopping with us. Reply here if you need anything.',
  voice: 'Hello {{name}}, this is a courtesy call from Maildrill about your recent order.',
};

/** TTS voices available per template language (header picker drives this list). */
export const VOICES_BY_LANGUAGE: Record<string, readonly string[]> = {
  en_US: ['Ava · US English', 'Noah · US English', 'Emma · UK English'],
  es: ['Lucia · Spanish', 'Diego · Spanish'],
  it: ['Giulia · Italian', 'Marco · Italian'],
  pt_BR: ['Camila · Portuguese', 'Thiago · Portuguese'],
  fr: ['Chloé · French', 'Henri · French'],
  de: ['Anna · German', 'Klaus · German'],
  nl: ['Lotte · Dutch', 'Daan · Dutch'],
  ar: ['Amira · Arabic', 'Omar · Arabic'],
  hi: ['Priya · Hindi', 'Arjun · Hindi'],
  id: ['Sari · Indonesian', 'Budi · Indonesian'],
  ja: ['Yuki · Japanese', 'Kenji · Japanese'],
  ko: ['Min-jun · Korean', 'Soo-jin · Korean'],
  zh_CN: ['Wei · Chinese', 'Mei · Chinese'],
};

export function voicesForLanguage(code: string | null | undefined): readonly string[] {
  const canonical = normalizeTemplateLanguageCode(code);
  return VOICES_BY_LANGUAGE[canonical] ?? VOICES_BY_LANGUAGE.en_US;
}

/** @deprecated Use `voicesForLanguage('en_US')`. */
export const VOICE_OPTS = VOICES_BY_LANGUAGE.en_US;
export const SPEED_OPTS = ['Slow', 'Normal', 'Fast'];
