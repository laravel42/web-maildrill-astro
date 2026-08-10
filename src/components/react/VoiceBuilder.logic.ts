import { normalizeTemplateLanguageCode } from '@/lib/app/template-language';

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

export const SPEED_OPTS = ['Slow', 'Normal', 'Fast'];

/** Playback rate applied per speed option (delivery mirrors via speechRate). */
export const PREVIEW_RATES: Record<string, number> = { Slow: 0.85, Normal: 1, Fast: 1.15 };

/** Sample values spoken in place of {{tokens}} during the voice preview. */
export const TOKEN_SAMPLES: Record<string, string> = {
  name: 'Alex',
  first_name: 'Alex',
  last_name: 'Rivera',
  email: 'alex at example dot com',
  phone: '5 5 5, 0 1 0 0',
};
