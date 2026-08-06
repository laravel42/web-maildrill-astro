import { describe, expect, it } from 'vitest';
import {
  normalizeWhatsAppTemplateName,
  storedComponentsToInfobipStructure,
  validateInfobipStructure,
  validateWhatsAppTemplateName,
} from './wa-infobip-structure';

describe('storedComponentsToInfobipStructure', () => {
  it('maps a plain text body', () => {
    const r = storedComponentsToInfobipStructure(
      { category: 'MARKETING', body: { text: 'Hello there' } },
      null,
      'MARKETING',
    );
    expect(r).toEqual({
      structure: { body: { text: 'Hello there' } },
      type: 'TEXT',
    });
  });

  it('converts Meta media header example to Infobip string', () => {
    const r = storedComponentsToInfobipStructure(
      {
        category: 'MARKETING',
        body: { text: 'Hi {{1}}', examples: ['Ada'] },
        header: {
          format: 'IMAGE',
          example: { header_handle: ['https://cdn.example.com/hero.jpg'] },
        },
      },
      null,
      'MARKETING',
    );
    expect(r?.type).toBe('MEDIA');
    expect(r?.structure.header).toEqual({
      format: 'IMAGE',
      example: 'https://cdn.example.com/hero.jpg',
    });
  });

  it('preserves URL button example for dynamic links', () => {
    const r = storedComponentsToInfobipStructure(
      {
        category: 'MARKETING',
        body: { text: 'Tap below' },
        buttons: [
          {
            type: 'URL',
            text: 'Open',
            url: 'https://shop.example/o/{{1}}',
            example: 'https://shop.example/o/1042',
          },
        ],
      },
      null,
      'MARKETING',
    );
    expect(r?.structure.buttons).toEqual([
      {
        type: 'URL',
        text: 'Open',
        url: 'https://shop.example/o/{{1}}',
        example: 'https://shop.example/o/1042',
      },
    ]);
  });

  it('builds authentication structure without structure.type', () => {
    const r = storedComponentsToInfobipStructure(
      {
        category: 'AUTHENTICATION',
        body: { add_security_recommendation: true },
        footer: { code_expiration_minutes: 5 },
        buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }],
      },
      null,
      'AUTHENTICATION',
    );
    expect(r?.type).toBeUndefined();
    expect(r?.structure).toEqual({
      body: { addSecurityRecommendation: true },
      footer: { codeExpirationMinutes: 5 },
      buttons: [{ text: 'Copy code', otpType: 'COPY_CODE' }],
    });
  });
});

describe('validateInfobipStructure', () => {
  it('rejects blob media samples', () => {
    expect(
      validateInfobipStructure(
        {
          body: { text: 'Hi' },
          header: { format: 'IMAGE', example: { header_handle: ['blob:http://localhost/x'] } },
        },
        null,
        'MARKETING',
      ),
    ).toMatch(/public HTTPS URL/);
  });

  it('requires body examples for each placeholder', () => {
    expect(
      validateInfobipStructure(
        { body: { text: 'Hi {{1}} and {{2}}', examples: ['Ada'] } },
        null,
        'MARKETING',
      ),
    ).toMatch(/2 variable/);
  });

  it('rejects COPY_CODE without example (Jose template shape)', () => {
    expect(
      validateInfobipStructure(
        {
          category: 'MARKETING',
          body: {
            text: 'Hi {{1}}, you are invited to Jose party on Aug. 15.',
            examples: ['Alex Morgan'],
          },
          footer: { text: 'Reply STOP to unsubscribe' },
          header: { text: 'Happy Birthday!!', format: 'TEXT' },
          buttons: [{ type: 'COPY_CODE' }],
        },
        null,
        'MARKETING',
        { templateName: 'joses_birthday' },
      ),
    ).toMatch(/Copy offer code/);
  });

  it('normalizes display names for submission instead of rejecting them', () => {
    expect(normalizeWhatsAppTemplateName("Jose's Birthday")).toBe('joses_birthday');
    // Strict checker still reports the derived name for UI hints…
    expect(validateWhatsAppTemplateName("Jose's Birthday")).toMatch(/joses_birthday/);
    // …but the submit pre-flight only blocks names with nothing to normalize.
    expect(
      validateInfobipStructure(
        { category: 'MARKETING', body: { text: 'Hello there' } },
        null,
        'MARKETING',
        { templateName: "Jose's Birthday" },
      ),
    ).toBeUndefined();
    expect(
      validateInfobipStructure(
        { category: 'MARKETING', body: { text: 'Hello there' } },
        null,
        'MARKETING',
        { templateName: '¡¡¡' },
      ),
    ).toMatch(/letters or numbers/);
  });
});
