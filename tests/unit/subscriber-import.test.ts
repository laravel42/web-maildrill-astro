import { describe, expect, it } from 'vitest';
import {
  buildImportRows,
  guessTarget,
  normalizeStatus,
  parseCsv,
  splitTags,
  type MapTarget,
} from '@/lib/app/subscriber-import';
import type { CustomField } from '@/lib/app/custom-fields';

const fields: CustomField[] = [
  { id: '1', key: 'company', label: 'Company', type: 'text', createdAt: '' },
  { id: '2', key: 'city', label: 'City', type: 'text', createdAt: '' },
];

describe('parseCsv', () => {
  it('parses commas, quoted cells, and CRLF', () => {
    const sheet = parseCsv('email,name\r\na@b.com,"Doe, Jane"\r\nc@d.com,"He said ""hi"""\r\n');
    expect(sheet.headers).toEqual(['email', 'name']);
    expect(sheet.rows).toEqual([
      ['a@b.com', 'Doe, Jane'],
      ['c@d.com', 'He said "hi"'],
    ]);
  });

  it('sniffs semicolon and tab delimiters', () => {
    expect(parseCsv('email;name\na@b.com;Jane\n').rows).toEqual([['a@b.com', 'Jane']]);
    expect(parseCsv('email\tname\na@b.com\tJane\n').rows).toEqual([['a@b.com', 'Jane']]);
  });

  it('names blank headers and skips leading empty lines', () => {
    const sheet = parseCsv('\n\nemail,,name\na@b.com,x,Jane\n');
    expect(sheet.headers).toEqual(['email', 'Column 2', 'name']);
    expect(sheet.rows).toHaveLength(1);
  });
});

describe('guessTarget', () => {
  it('maps common headers and claims singletons once', () => {
    const taken = new Set<MapTarget>();
    expect(guessTarget('E-Mail Address', fields, taken)).toBe('email');
    taken.add('email');
    expect(guessTarget('Email', fields, taken)).toBe('skip');
    expect(guessTarget('Phone Number', fields, taken)).toBe('phone');
    expect(guessTarget('Tags', fields, taken)).toBe('tags');
  });

  it('matches custom fields by key or label', () => {
    expect(guessTarget('Company', fields, new Set())).toBe('attr:company');
    expect(guessTarget('city', fields, new Set())).toBe('attr:city');
    expect(guessTarget('Favourite color', fields, new Set())).toBe('skip');
  });
});

describe('normalizeStatus / splitTags', () => {
  it('normalizes aliases and rejects unknowns', () => {
    expect(normalizeStatus('Subscribed')).toBe('active');
    expect(normalizeStatus('OPT-OUT')).toBe('unsubscribed');
    expect(normalizeStatus('spam')).toBe('complained');
    expect(normalizeStatus('maybe')).toBeUndefined();
  });

  it('splits tags on commas and semicolons, deduped', () => {
    expect(splitTags('vip, beta; vip ,')).toEqual(['vip', 'beta']);
  });
});

describe('buildImportRows', () => {
  const sheet = parseCsv(
    [
      'email,name,phone,status,tags,company',
      'a@b.com,Jane,+1 555,active,"vip, beta",Acme',
      'not-an-email,Bob,,,',
      ',,,,,',
      'C@D.com,,,optout,,',
    ].join('\n'),
  );
  const mapping: MapTarget[] = ['email', 'name', 'phone', 'status', 'tags', 'attr:company'];

  it('builds rows, lowercases emails, and maps every target', () => {
    const built = buildImportRows(sheet, mapping);
    expect(built.rows).toEqual([
      {
        email: 'a@b.com',
        name: 'Jane',
        phone: '+1 555',
        status: 'active',
        attributes: { tags: ['vip', 'beta'], company: 'Acme' },
      },
      { email: 'c@d.com', status: 'unsubscribed' },
    ]);
  });

  it('reports invalid emails with file line numbers and drops empty lines', () => {
    const built = buildImportRows(sheet, mapping);
    expect(built.invalid).toEqual([{ line: 3, value: 'not-an-email' }]);
    expect(built.emptySkipped).toBe(1);
  });

  it('returns nothing when no column maps to email', () => {
    expect(buildImportRows(sheet, ['skip', 'name', 'skip', 'skip', 'skip', 'skip']).rows).toEqual(
      [],
    );
  });
});
