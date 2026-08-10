import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell, subscribersCsv } from '@/lib/app/subscriber-export';
import type { ApiSubscriber } from '@/lib/app/subscriber-map';
import type { CustomField } from '@/lib/app/custom-fields';

describe('csvCell / buildCsv', () => {
  it('quotes only cells that need it and doubles quotes', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('joins with CRLF and a trailing newline', () => {
    expect(buildCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2\r\n');
  });
});

describe('subscribersCsv', () => {
  const fields: CustomField[] = [
    { id: '1', key: 'company', label: 'Company', type: 'text', createdAt: '' },
  ];
  const subs: ApiSubscriber[] = [
    {
      id: 's1',
      email: 'a@b.com',
      name: 'Jane, Doe',
      phone: '+1 555',
      status: 'active',
      attributes: { tags: ['vip'], company: 'Acme' },
      lists: [{ id: 'l1', name: 'Newsletter' }],
      tagNames: [],
    },
    { id: 's2', email: 'c@d.com', status: 'unsubscribed', tagNames: ['beta', 'vip'] },
  ];

  it('lays out built-ins, tags (relation over legacy blob), lists, custom fields', () => {
    const lines = subscribersCsv(subs, fields).trimEnd().split('\r\n');
    expect(lines[0]).toBe('email,name,phone,status,tags,lists,company');
    expect(lines[1]).toBe('a@b.com,"Jane, Doe",+1 555,active,vip,Newsletter,Acme');
    expect(lines[2]).toBe('c@d.com,,,unsubscribed,beta; vip,,');
  });
});
