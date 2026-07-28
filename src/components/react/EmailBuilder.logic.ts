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

/** A TTS voice as Infobip's Voice APIs know it. */
export type VoiceOption = {
  /** Picker label, e.g. 'Joanna · US English'. */
  label: string;
  /** Exact Infobip voice name (`voice.name` on /tts/3, `preferences.voiceName` on /say). */
  name: string;
  gender: 'female' | 'male';
  /** Infobip TTS language code for this voice ("en", "pt-br", "zh-cn", …). */
  sayLanguage: string;
};

/**
 * TTS voices available per template language (header picker drives this list).
 * Names MUST be real Infobip voices — they're sent verbatim to the provider
 * for both delivery and the in-browser preview. Standard (non-neural) voices
 * preferred to avoid the neural surcharge; languages without standard voices
 * use neural ones (the "(neural)" suffix is part of the API name).
 */
export const VOICES_BY_LANGUAGE: Record<string, readonly VoiceOption[]> = {
  en_US: [
    { label: 'Joanna · US English', name: 'Joanna', gender: 'female', sayLanguage: 'en' },
    { label: 'Matthew · US English', name: 'Matthew', gender: 'male', sayLanguage: 'en' },
    { label: 'Amy · UK English', name: 'Amy', gender: 'female', sayLanguage: 'en-gb' },
  ],
  es: [
    { label: 'Conchita · Spanish', name: 'Conchita', gender: 'female', sayLanguage: 'es' },
    { label: 'Enrique · Spanish', name: 'Enrique', gender: 'male', sayLanguage: 'es' },
  ],
  it: [
    { label: 'Carla · Italian', name: 'Carla', gender: 'female', sayLanguage: 'it' },
    { label: 'Giorgio · Italian', name: 'Giorgio', gender: 'male', sayLanguage: 'it' },
  ],
  pt_BR: [
    { label: 'Camila · Portuguese', name: 'Camila', gender: 'female', sayLanguage: 'pt-br' },
    { label: 'Ricardo · Portuguese', name: 'Ricardo', gender: 'male', sayLanguage: 'pt-br' },
  ],
  fr: [
    { label: 'Celine · French', name: 'Celine', gender: 'female', sayLanguage: 'fr' },
    { label: 'Mathieu · French', name: 'Mathieu', gender: 'male', sayLanguage: 'fr' },
  ],
  de: [
    { label: 'Marlene · German', name: 'Marlene', gender: 'female', sayLanguage: 'de' },
    { label: 'Hans · German', name: 'Hans', gender: 'male', sayLanguage: 'de' },
  ],
  nl: [
    { label: 'Lotte · Dutch', name: 'Lotte', gender: 'female', sayLanguage: 'nl' },
    { label: 'Ruben · Dutch', name: 'Ruben', gender: 'male', sayLanguage: 'nl' },
  ],
  ar: [
    { label: 'Zeina · Arabic', name: 'Zeina', gender: 'female', sayLanguage: 'ar' },
    { label: 'Fuaad · Arabic', name: 'Fuaad', gender: 'male', sayLanguage: 'ar' },
  ],
  hi: [
    { label: 'Aditi · Hindi', name: 'Aditi', gender: 'female', sayLanguage: 'hi' },
    { label: 'Arjun · Hindi', name: 'Arjun', gender: 'male', sayLanguage: 'hi' },
  ],
  id: [
    { label: 'Gadis · Indonesian', name: 'Gadis (neural)', gender: 'female', sayLanguage: 'id' },
    { label: 'Ardi · Indonesian', name: 'Ardi (neural)', gender: 'male', sayLanguage: 'id' },
  ],
  ja: [
    { label: 'Mizuki · Japanese', name: 'Mizuki', gender: 'female', sayLanguage: 'ja' },
    { label: 'Takumi · Japanese', name: 'Takumi', gender: 'male', sayLanguage: 'ja' },
  ],
  ko: [
    { label: 'Seoyeon · Korean', name: 'Seoyeon', gender: 'female', sayLanguage: 'ko' },
    { label: 'InJoon · Korean', name: 'InJoon (neural)', gender: 'male', sayLanguage: 'ko' },
  ],
  zh_CN: [
    { label: 'Zhiyu · Chinese', name: 'Zhiyu', gender: 'female', sayLanguage: 'zh-cn' },
    { label: 'Yunyang · Chinese', name: 'Yunyang (neural)', gender: 'male', sayLanguage: 'zh-cn' },
  ],
};

export function voicesForLanguage(code: string | null | undefined): readonly VoiceOption[] {
  const canonical = normalizeTemplateLanguageCode(code);
  return VOICES_BY_LANGUAGE[canonical] ?? VOICES_BY_LANGUAGE.en_US;
}

/** @deprecated Use `voicesForLanguage('en_US')`. */
export const VOICE_OPTS = VOICES_BY_LANGUAGE.en_US;
export const SPEED_OPTS = ['Slow', 'Normal', 'Fast'];
