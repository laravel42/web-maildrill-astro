import { describe, expect, it } from 'vitest';
import {
  flagEmoji,
  formatNational,
  matchInternational,
  maxNationalLen,
  nationalLengthError,
  phoneCountry,
  PHONE_COUNTRIES,
  toE164,
} from '@/lib/app/phone-countries';

const mx = phoneCountry('mx')!;
const us = phoneCountry('US')!;
const fr = phoneCountry('FR')!;

describe('phone-countries data', () => {
  it('has unique ISO codes and sane length bounds', () => {
    const isos = PHONE_COUNTRIES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
    for (const c of PHONE_COUNTRIES) {
      expect(c.len[0]).toBeGreaterThanOrEqual(6);
      expect(c.len[1]).toBeGreaterThanOrEqual(c.len[0]);
      expect(c.dial).toMatch(/^\d{1,3}$/);
    }
  });

  it('looks up countries case-insensitively', () => {
    expect(mx.name).toBe('Mexico');
    expect(phoneCountry('zz')).toBeNull();
  });
});

describe('formatNational', () => {
  it('groups digits per country pattern as you type', () => {
    expect(formatNational('33', mx)).toBe('33');
    expect(formatNational('331975', mx)).toBe('33 1975');
    expect(formatNational('3319751986', mx)).toBe('33 1975 1986');
    expect(formatNational('5550100000', us)).toBe('555 010 0000');
    expect(formatNational('612345678', fr)).toBe('6 12 34 56 78');
  });

  it('appends overflow digits past the pattern', () => {
    expect(formatNational('55501000001', us)).toBe('555 010 0000 1');
  });
});

describe('validation + E.164', () => {
  it('flags too-short numbers with a country-specific message', () => {
    expect(nationalLengthError('331975', mx)).toContain('Mexico');
    expect(nationalLengthError('3319751986', mx)).toBe('');
    expect(nationalLengthError('', mx)).toBe('');
  });

  it('describes ranges when min and max differ', () => {
    const de = phoneCountry('DE')!;
    expect(nationalLengthError('12345', de)).toContain('10–11');
  });

  it('builds E.164 and caps at the country max', () => {
    expect(toE164('3319751986', mx)).toBe('+523319751986');
    expect(toE164('', mx)).toBe('');
    expect(maxNationalLen(mx)).toBe(10);
  });
});

describe('matchInternational', () => {
  it('parses pasted international numbers, longest dial first', () => {
    const m = matchInternational('+52 33 1975 1986');
    expect(m?.country.iso).toBe('MX');
    expect(m?.digits).toBe('3319751986');
    const ie = matchInternational('+353851234567');
    expect(ie?.country.iso).toBe('IE');
  });

  it('resolves shared prefixes by priority (+1 → US)', () => {
    expect(matchInternational('+15550100000')?.country.iso).toBe('US');
  });

  it('accepts the 00 international prefix and rejects national input', () => {
    expect(matchInternational('0044 7911 123456')?.country.iso).toBe('GB');
    expect(matchInternational('5550100000')).toBeNull();
  });
});
