import { beforeAll, describe, expect, it } from 'vitest';

import { registerBuiltInPlugins } from '../src/blocks';
import { newId, type MetaTemplate, type TemplateDoc } from '../src/core/types';
import { fromMetaJson, toMetaJson } from '../src/core/serialize';
import { hasErrors, validateTemplate } from '../src/core/validation';
import { analyzeVariables, renumberVariables } from '../src/core/variables';

beforeAll(() => {
  registerBuiltInPlugins();
});

function marketingDoc(): TemplateDoc {
  return {
    name: 'spring_sale',
    language: 'en_US',
    category: 'MARKETING',
    blocks: {
      header: {
        id: newId('header'),
        type: 'header-text',
        data: { text: 'Spring sale {{1}}', variables: { '1': { example: '20% off' } } },
      },
      body: {
        id: newId('body'),
        type: 'body',
        data: {
          text: 'Hi {{1}}, everything is {{2}} off until Sunday.',
          variables: { '1': { name: 'Customer', example: 'Ada' }, '2': { example: '20%' } },
        },
      },
      footer: { id: newId('footer'), type: 'footer', data: { text: 'Reply STOP to opt out' } },
      buttons: [
        { id: newId('btn'), type: 'quick-reply', data: { text: 'Show me' } },
        { id: newId('btn'), type: 'url', data: { text: 'Shop now', url: 'https://shop.example.com/sale/{{1}}', example: 'https://shop.example.com/sale/spring' } },
        { id: newId('btn'), type: 'copy-code', data: { example: 'SPRING20' } },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

describe('variable engine', () => {
  it('analyzes usage, duplicates, gaps and malformed syntax', () => {
    const analysis = analyzeVariables('Hi {{1}} and {{3}} and {{1}} and {{name}}', { '2': { example: 'x' } });
    expect(analysis.used).toEqual([1, 3]);
    expect(analysis.duplicated).toEqual([1]);
    expect(analysis.sequential).toBe(false);
    expect(analysis.unused).toEqual([2]);
    expect(analysis.malformed).toContain('{{name}}');
  });

  it('renumbers to a sequential series and remaps metadata', () => {
    const result = renumberVariables('A {{4}} B {{2}} C {{4}}', { '4': { example: 'four' }, '2': { example: 'two' } });
    expect(result.text).toBe('A {{1}} B {{2}} C {{1}}');
    expect(result.map).toEqual({ '1': { example: 'four' }, '2': { example: 'two' } });
    expect(result.mapping).toEqual({ 4: 1, 2: 2 });
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validation engine', () => {
  it('tolerates block data missing optional maps (draft/import robustness)', () => {
    const doc = marketingDoc();
    // Simulate a draft saved before plugins registered / an older schema:
    // body data without a `variables` key must not crash validation.
    doc.blocks.body = { ...doc.blocks.body, data: { text: 'Hi {{1}} there' } };
    expect(() => validateTemplate(doc)).not.toThrow();
  });

  it('passes a complete marketing template', () => {
    expect(validateTemplate(marketingDoc()).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('enforces template name format', () => {
    const doc = { ...marketingDoc(), name: 'Bad Name!' };
    expect(validateTemplate(doc).some((i) => i.code === 'template/name-format')).toBe(true);
  });

  it('rejects category-incompatible buttons', () => {
    const doc = marketingDoc();
    doc.category = 'UTILITY';
    doc.blocks.buttons.push({ id: newId('btn'), type: 'catalog', data: { text: 'View catalog' } });
    const issues = validateTemplate(doc);
    expect(issues.some((i) => i.code === 'buttons/not-allowed-in-category')).toBe(true);
  });

  it('enforces per-type button ceilings', () => {
    const doc = marketingDoc();
    doc.blocks.buttons = [
      { id: newId('btn'), type: 'url', data: { text: 'A', url: 'https://a.com' } },
      { id: newId('btn'), type: 'url', data: { text: 'B', url: 'https://b.com' } },
      { id: newId('btn'), type: 'url', data: { text: 'C', url: 'https://c.com' } },
    ];
    expect(validateTemplate(doc).some((i) => i.code === 'buttons/too-many-url')).toBe(true);
  });

  it('enforces button grouping (no interleaving)', () => {
    const doc = marketingDoc();
    doc.blocks.buttons = [
      { id: newId('btn'), type: 'quick-reply', data: { text: 'A' } },
      { id: newId('btn'), type: 'url', data: { text: 'B', url: 'https://b.com' } },
      { id: newId('btn'), type: 'quick-reply', data: { text: 'C' } },
    ];
    expect(validateTemplate(doc).some((i) => i.code === 'buttons/grouping')).toBe(true);
  });

  it('requires an OTP button on authentication templates', () => {
    const doc: TemplateDoc = {
      name: 'login_code',
      language: 'en_US',
      category: 'AUTHENTICATION',
      blocks: {
        header: null,
        body: { id: newId('body'), type: 'body-auth', data: { securityRecommendation: true } },
        footer: { id: newId('footer'), type: 'footer-auth', data: { codeExpirationMinutes: 10 } },
        buttons: [],
      },
    };
    expect(validateTemplate(doc).some((i) => i.code === 'auth/otp-required')).toBe(true);

    doc.blocks.buttons.push({ id: newId('btn'), type: 'otp', data: { otpType: 'COPY_CODE', text: 'Copy code' } });
    expect(hasErrors(validateTemplate(doc))).toBe(false);
  });

  it('flags dynamic URLs that are not a trailing {{1}}', () => {
    const doc = marketingDoc();
    doc.blocks.buttons = [{ id: newId('btn'), type: 'url', data: { text: 'Go', url: 'https://a.com/{{2}}/x' } }];
    expect(validateTemplate(doc).some((i) => i.code === 'url/dynamic-suffix')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('meta serialization', () => {
  it('exports the full component set', () => {
    const meta = toMetaJson(marketingDoc());
    expect(meta.name).toBe('spring_sale');
    const types = meta.components.map((c) => c.type);
    expect(types).toEqual(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']);

    const header = meta.components[0]!;
    expect(header.format).toBe('TEXT');
    expect(header.example).toEqual({ header_text: ['20% off'] });

    const body = meta.components[1]!;
    expect(body.example).toEqual({ body_text: [['Ada', '20%']] });

    const buttons = meta.components[3]!.buttons as Array<Record<string, unknown>>;
    expect(buttons.map((b) => b.type)).toEqual(['QUICK_REPLY', 'URL', 'COPY_CODE']);
    expect(buttons[1]!.example).toEqual(['https://shop.example.com/sale/spring']);
  });

  it('round-trips losslessly (export → import → export)', () => {
    const first = toMetaJson(marketingDoc());
    const reimported = fromMetaJson(first);
    const second = toMetaJson(reimported);
    expect(second).toEqual(first);
  });

  it('round-trips an authentication template', () => {
    const meta: MetaTemplate = {
      name: 'login_code',
      language: 'en_US',
      category: 'AUTHENTICATION',
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 5 },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'OTP', otp_type: 'ONE_TAP', text: 'Copy code', autofill_text: 'Autofill', package_name: 'com.x', signature_hash: 'hash' },
          ],
        },
      ],
    };
    const doc = fromMetaJson(meta);
    expect(doc.blocks.body.type).toBe('body-auth');
    expect(doc.blocks.footer?.type).toBe('footer-auth');
    expect(doc.blocks.buttons[0]?.type).toBe('otp');
    expect(toMetaJson(doc)).toEqual(meta);
  });

  it('preserves unknown components and root fields (forward compatibility)', () => {
    const meta: MetaTemplate = {
      name: 'future',
      language: 'en_US',
      category: 'MARKETING',
      some_future_field: { nested: true },
      components: [
        { type: 'BODY', text: 'Hello' },
        { type: 'HOLOGRAM', shimmer: 'max' },
      ],
    };
    const doc = fromMetaJson(meta);
    const out = toMetaJson(doc);
    expect(out.some_future_field).toEqual({ nested: true });
    expect(out.components.some((c) => c.type === 'HOLOGRAM')).toBe(true);
  });

  it('imports every supported button type', () => {
    const meta: MetaTemplate = {
      name: 'all_buttons',
      language: 'en_US',
      category: 'MARKETING',
      components: [
        { type: 'BODY', text: 'Everything' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Hi' },
            { type: 'URL', text: 'Web', url: 'https://x.com' },
            { type: 'PHONE_NUMBER', text: 'Call', phone_number: '+1555' },
            { type: 'COPY_CODE', example: 'SAVE' },
            { type: 'FLOW', text: 'Book', flow_id: '123', flow_action: 'navigate', navigate_screen: 'HOME' },
            { type: 'CATALOG', text: 'View catalog' },
            { type: 'MPM', text: 'View items' },
          ],
        },
      ],
    };
    const doc = fromMetaJson(meta);
    expect(doc.blocks.buttons.map((b) => b.type)).toEqual([
      'quick-reply',
      'url',
      'phone',
      'copy-code',
      'flow',
      'catalog',
      'mpm',
    ]);
    expect(toMetaJson(doc)).toEqual(meta);
  });
});
