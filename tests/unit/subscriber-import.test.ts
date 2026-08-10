import { describe, expect, it } from 'vitest';

import {
  buildImportRows,
  guessMapping,
  guessTarget,
  newFieldKeys,
  normalizeStatus,
  parseCsv,
  type ImportTarget,
} from '@/lib/app/subscriber-import';

describe('parseCsv', () => {
  it('parses plain comma rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('name,quote\n"Doe, Jane","She said ""hi"""')).toEqual([
      ['name', 'quote'],
      ['Doe, Jane', 'She said "hi"'],
    ]);
  });

  it('handles CRLF line endings and quoted newlines', () => {
    expect(parseCsv('a,b\r\n"line1\nline2",x\r\n')).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'x'],
    ]);
  });

  it('sniffs semicolon delimiters', () => {
    expect(parseCsv('email;name\njane@x.com;Jane')).toEqual([
      ['email', 'name'],
      ['jane@x.com', 'Jane'],
    ]);
  });

  it('drops fully empty rows and strips the BOM', () => {
    expect(parseCsv('﻿a,b\n,,\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('guessTarget / guessMapping', () => {
  it('recognises the usual header spellings', () => {
    expect(guessTarget('Email Address').kind).toBe('email');
    expect(guessTarget('E-mail').kind).toBe('email');
    expect(guessTarget('Full Name').kind).toBe('name');
    expect(guessTarget('Mobile').kind).toBe('phone');
    expect(guessTarget('Tags').kind).toBe('tags');
    expect(guessTarget('Anything else').kind).toBe('skip');
  });

  it('matches workspace custom fields by key', () => {
    expect(guessTarget('company_size', ['company_size'])).toEqual({
      kind: 'attribute',
      key: 'company_size',
    });
  });

  it('maps only the first column per single-valued target', () => {
    const mapping = guessMapping(['Email', 'Work email', 'Name']);
    expect(mapping.map((m) => m.kind)).toEqual(['email', 'skip', 'name']);
  });
});

describe('buildImportRows', () => {
  const sheet = {
    headers: ['Email', 'Name', 'Phone', 'Tags'],
    rows: [
      ['Jane@Example.com', 'Jane Doe', '+15550100', 'vip, beta'],
      ['not-an-email', 'Ghost', '', ''],
      ['mo@example.com', '', '+15550101', 'beta;vip'],
    ],
  };
  const mapping: ImportTarget[] = [
    { kind: 'email' },
    { kind: 'name' },
    { kind: 'phone' },
    { kind: 'tags' },
  ];

  it('builds rows, lowercases emails, splits + dedupes tags, counts skips', () => {
    const { rows, skipped } = buildImportRows(sheet, mapping);
    expect(skipped).toBe(1);
    expect(rows).toEqual([
      {
        email: 'jane@example.com',
        name: 'Jane Doe',
        phone: '+15550100',
        attributes: { tags: ['vip', 'beta'] },
      },
      { email: 'mo@example.com', phone: '+15550101', attributes: { tags: ['beta', 'vip'] } },
    ]);
  });

  it('routes custom-field columns into attributes', () => {
    const { rows } = buildImportRows(
      { headers: ['Email', 'Company'], rows: [['a@b.co', 'Acme']] },
      [{ kind: 'email' }, { kind: 'attribute', key: 'company' }],
    );
    expect(rows[0]).toEqual({ email: 'a@b.co', attributes: { company: 'Acme' } });
  });
});

describe('normalizeStatus', () => {
  it('accepts the spellings other ESPs export', () => {
    expect(normalizeStatus('Subscribed')).toBe('active');
    expect(normalizeStatus(' UNSUB ')).toBe('unsubscribed');
    expect(normalizeStatus('opt-out')).toBe('unsubscribed');
    expect(normalizeStatus('spam')).toBe('complained');
    expect(normalizeStatus('bounce')).toBe('bounced');
  });

  it('returns undefined for anything unrecognised, so the row still imports', () => {
    expect(normalizeStatus('pending')).toBeUndefined();
    expect(normalizeStatus('')).toBeUndefined();
  });
});

describe('status columns', () => {
  it('is guessed from the usual headers and claimed only once', () => {
    expect(guessTarget('Status')).toEqual({ kind: 'status' });
    expect(guessMapping(['Email', 'Status', 'Subscription Status'])).toEqual([
      { kind: 'email' },
      { kind: 'status' },
      { kind: 'skip' },
    ]);
  });

  it('normalises the cell onto the row and drops unknown values', () => {
    const mapping: ImportTarget[] = [{ kind: 'email' }, { kind: 'status' }];
    const { rows } = buildImportRows(
      {
        headers: ['Email', 'Status'],
        rows: [
          ['a@b.co', 'Unsubscribed'],
          ['c@d.co', 'pending'],
        ],
      },
      mapping,
    );
    expect(rows[0]).toEqual({ email: 'a@b.co', status: 'unsubscribed' });
    expect(rows[1]).toEqual({ email: 'c@d.co' });
  });
});

describe('newFieldKeys', () => {
  it('collects the custom fields the import has to create first', () => {
    expect(
      newFieldKeys([
        { kind: 'email' },
        { kind: 'newAttribute', key: 'plan' },
        { kind: 'attribute', key: 'company' },
        { kind: 'newAttribute', key: 'plan' },
      ]),
    ).toEqual(['plan']);
  });

  it('routes a new custom field into attributes like an existing one', () => {
    const { rows } = buildImportRows({ headers: ['Email', 'Plan'], rows: [['a@b.co', 'Pro']] }, [
      { kind: 'email' },
      { kind: 'newAttribute', key: 'plan' },
    ]);
    expect(rows[0]).toEqual({ email: 'a@b.co', attributes: { plan: 'Pro' } });
  });
});
