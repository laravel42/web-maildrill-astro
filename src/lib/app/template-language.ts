/** Shared template language picker — used in every channel editor header. */

export type TemplateLanguageOption = {
  code: string;
  label: string;
  country: string;
};

export const TEMPLATE_LANGUAGE_OPTIONS: readonly TemplateLanguageOption[] = [
  { code: 'en_US', label: 'English', country: 'us' },
  { code: 'es', label: 'Spanish', country: 'es' },
  { code: 'it', label: 'Italian', country: 'it' },
  { code: 'pt_BR', label: 'Portuguese', country: 'br' },
  { code: 'fr', label: 'French', country: 'fr' },
  { code: 'de', label: 'German', country: 'de' },
  { code: 'nl', label: 'Dutch', country: 'nl' },
  { code: 'ar', label: 'Arabic', country: 'sa' },
  { code: 'hi', label: 'Hindi', country: 'in' },
  { code: 'id', label: 'Indonesian', country: 'id' },
  { code: 'ja', label: 'Japanese', country: 'jp' },
  { code: 'ko', label: 'Korean', country: 'kr' },
  { code: 'zh_CN', label: 'Chinese', country: 'cn' },
] as const;

/** Regional / legacy codes collapsed to the canonical picker code. */
const LANGUAGE_ALIASES: Record<string, string> = {
  en: 'en_US',
  en_GB: 'en_US',
  es_ES: 'es',
  es_MX: 'es',
  pt_PT: 'pt_BR',
};

const LANGUAGE_BY_CODE = new Map(TEMPLATE_LANGUAGE_OPTIONS.map((o) => [o.code, o]));

export function normalizeTemplateLanguageCode(code: string | null | undefined): string {
  if (!code) return 'en_US';
  const aliased = LANGUAGE_ALIASES[code] ?? code;
  return LANGUAGE_BY_CODE.has(aliased) ? aliased : 'en_US';
}

export function templateLanguageLabel(code: string): string {
  const canonical = normalizeTemplateLanguageCode(code);
  return LANGUAGE_BY_CODE.get(canonical)?.label ?? canonical;
}

export function templateLanguageCountry(code: string): string {
  const canonical = normalizeTemplateLanguageCode(code);
  return LANGUAGE_BY_CODE.get(canonical)?.country ?? 'us';
}

/** Square flat flag PNG (flagcdn) sized for the editor header picker. */
export function templateLanguageFlagSrc(code: string, size = 40): string {
  return `https://flagcdn.com/w${size}/${templateLanguageCountry(code)}.png`;
}
