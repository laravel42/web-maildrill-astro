import { describe, expect, it } from 'vitest';
import {
  normalizeTemplateLanguageCode,
  templateLanguageCountry,
  templateLanguageFlagSrc,
  templateLanguageLabel,
} from '@/lib/app/template-language';

describe('normalizeTemplateLanguageCode', () => {
  it('defaults to en_US for empty or unknown codes', () => {
    expect(normalizeTemplateLanguageCode(null)).toBe('en_US');
    expect(normalizeTemplateLanguageCode(undefined)).toBe('en_US');
    expect(normalizeTemplateLanguageCode('xx_XX')).toBe('en_US');
  });

  it('passes canonical codes through', () => {
    expect(normalizeTemplateLanguageCode('en_US')).toBe('en_US');
  });
});

describe('labels, countries, flags', () => {
  it('labels canonical codes and echoes the canonical form', () => {
    expect(templateLanguageLabel('en_US')).toBeTruthy();
    expect(templateLanguageLabel('nope')).toBe(templateLanguageLabel('en_US'));
  });

  it('builds a flagcdn URL from the country', () => {
    const src = templateLanguageFlagSrc('en_US', 20);
    expect(src).toBe(`https://flagcdn.com/w20/${templateLanguageCountry('en_US')}.png`);
  });
});
