import * as React from 'react';
import { z } from 'zod';
import { Copy, ExternalLink, Phone, Reply } from 'lucide-react';

import { Field } from '@/ui/field';
import { Input } from '@/ui/input';
import { LIMITS } from '@/core/limits';
import type { ButtonPlugin, ValidationIssue } from '@/core/types';
import { uniqueVariables } from '@/core/variables';
import { WaButtonRow } from './row';

/** Shared label-length rule. */
function labelIssues(text: string, code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!text.trim()) {
    issues.push({ severity: 'error', slot: 'buttons', code: `${code}/label-required`, message: 'Button label is required' });
  }
  if (text.length > LIMITS.BUTTON_TEXT_MAX) {
    issues.push({
      severity: 'error',
      slot: 'buttons',
      code: `${code}/label-too-long`,
      message: `Button label exceeds ${LIMITS.BUTTON_TEXT_MAX} characters`,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Quick reply
// ---------------------------------------------------------------------------

const quickReplySchema = z.object({ text: z.string() });

export const quickReplyPlugin: ButtonPlugin<z.infer<typeof quickReplySchema>> = {
  type: 'quick-reply',
  maxPerTemplate: LIMITS.MAX_BUTTONS,
  meta: {
    label: 'Quick reply',
    description: 'Sends a predefined reply back to you',
    group: 'Buttons',
    icon: Reply,
    keywords: ['reply', 'postback'],
  },
  schema: quickReplySchema,
  defaults: () => ({ text: '' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates only allow an OTP button' }
      : { available: true },
  validate: (data) => labelIssues(data.text, 'quick-reply'),
  Editor: function QuickReplyEditor({ value, onChange }) {
    return (
      <Field label="Label" counter={`${value.text.length}/${LIMITS.BUTTON_TEXT_MAX}`}>
        <Input value={value.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Yes, I'm in" />
      </Field>
    );
  },
  Preview: ({ data, ctx }) => <WaButtonRow dark={ctx.dark} icon={<Reply className="size-4" />} label={data.text || 'Quick reply'} />,
  toMeta: (data) => ({ type: 'QUICK_REPLY', text: data.text }),
  fromMeta: (button) => {
    if (String(button.type).toUpperCase() !== 'QUICK_REPLY') return null;
    return { text: typeof button.text === 'string' ? button.text : '' };
  },
};

// ---------------------------------------------------------------------------
// URL (static or dynamic — dynamic ends with {{1}})
// ---------------------------------------------------------------------------

const urlSchema = z.object({
  text: z.string(),
  url: z.string(),
  /** Example full URL for a dynamic suffix (Meta review). */
  example: z.string().optional(),
});

export const urlButtonPlugin: ButtonPlugin<z.infer<typeof urlSchema>> = {
  type: 'url',
  maxPerTemplate: LIMITS.MAX_URL_BUTTONS,
  meta: {
    label: 'Visit website',
    description: 'Opens a static or dynamic URL',
    group: 'Buttons',
    icon: ExternalLink,
    keywords: ['link', 'website', 'dynamic url', 'cta'],
  },
  schema: urlSchema,
  defaults: () => ({ text: '', url: '' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates only allow an OTP button' }
      : { available: true },
  validate: (data) => {
    const issues = labelIssues(data.text, 'url');
    if (!data.url.trim()) {
      issues.push({ severity: 'error', slot: 'buttons', code: 'url/required', message: 'Button URL is required' });
    } else {
      if (!/^https?:\/\//i.test(data.url)) {
        issues.push({ severity: 'error', slot: 'buttons', code: 'url/invalid', message: 'URL must start with http(s)://' });
      }
      if (data.url.length > LIMITS.URL_MAX) {
        issues.push({ severity: 'error', slot: 'buttons', code: 'url/too-long', message: `URL exceeds ${LIMITS.URL_MAX} characters` });
      }
      const vars = uniqueVariables(data.url);
      const dynamic = vars.length > 0;
      if (dynamic && (vars.length > 1 || vars[0] !== 1 || !data.url.trimEnd().endsWith('}}'))) {
        issues.push({
          severity: 'error',
          slot: 'buttons',
          code: 'url/dynamic-suffix',
          message: 'Dynamic URLs allow a single {{1}} at the very end',
        });
      }
      if (dynamic && !(data.example ?? '').trim()) {
        issues.push({
          severity: 'warning',
          slot: 'buttons',
          code: 'url/example-missing',
          message: 'Add an example URL for the dynamic suffix (Meta review)',
        });
      }
    }
    return issues;
  },
  Editor: function UrlEditor({ value, onChange }) {
    const dynamic = uniqueVariables(value.url).length > 0;
    return (
      <div className="flex flex-col gap-4">
        <Field label="Label" counter={`${value.text.length}/${LIMITS.BUTTON_TEXT_MAX}`}>
          <Input value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder="View order" />
        </Field>
        <Field label="URL" hint={'Append {{1}} for a dynamic suffix, e.g. https://shop.com/o/{{1}}'}>
          <Input value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://example.com" />
        </Field>
        {dynamic && (
          <Field label="Example full URL" hint="Shown to Meta reviewers">
            <Input
              value={value.example ?? ''}
              onChange={(e) => onChange({ ...value, example: e.target.value })}
              placeholder="https://shop.com/o/1042"
            />
          </Field>
        )}
      </div>
    );
  },
  Preview: ({ data, ctx }) => (
    <WaButtonRow dark={ctx.dark} icon={<ExternalLink className="size-4" />} label={data.text || 'Visit website'} />
  ),
  toMeta: (data) => {
    const dynamic = uniqueVariables(data.url).length > 0;
    return {
      type: 'URL',
      text: data.text,
      url: data.url,
      ...(dynamic && data.example ? { example: [data.example] } : {}),
    };
  },
  fromMeta: (button) => {
    if (String(button.type).toUpperCase() !== 'URL') return null;
    return {
      text: typeof button.text === 'string' ? button.text : '',
      url: typeof button.url === 'string' ? button.url : '',
      example: Array.isArray(button.example) ? String(button.example[0] ?? '') : undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

const phoneSchema = z.object({ text: z.string(), phoneNumber: z.string() });

export const phoneButtonPlugin: ButtonPlugin<z.infer<typeof phoneSchema>> = {
  type: 'phone',
  maxPerTemplate: LIMITS.MAX_PHONE_BUTTONS,
  meta: {
    label: 'Call phone number',
    description: 'Starts a phone call',
    group: 'Buttons',
    icon: Phone,
    keywords: ['call', 'telephone'],
  },
  schema: phoneSchema,
  defaults: () => ({ text: '', phoneNumber: '' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates only allow an OTP button' }
      : { available: true },
  validate: (data) => {
    const issues = labelIssues(data.text, 'phone');
    if (!data.phoneNumber.trim()) {
      issues.push({ severity: 'error', slot: 'buttons', code: 'phone/required', message: 'Phone number is required' });
    } else if (!/^\+?[\d\s().-]{6,}$/.test(data.phoneNumber) || data.phoneNumber.length > LIMITS.PHONE_MAX) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        code: 'phone/invalid',
        message: 'Enter a valid phone number with country code',
      });
    }
    return issues;
  },
  Editor: function PhoneEditor({ value, onChange }) {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Label" counter={`${value.text.length}/${LIMITS.BUTTON_TEXT_MAX}`}>
          <Input value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder="Call us" />
        </Field>
        <Field label="Phone number" hint="Include the country code">
          <Input
            value={value.phoneNumber}
            onChange={(e) => onChange({ ...value, phoneNumber: e.target.value })}
            placeholder="+1 555 010 4477"
          />
        </Field>
      </div>
    );
  },
  Preview: ({ data, ctx }) => <WaButtonRow dark={ctx.dark} icon={<Phone className="size-4" />} label={data.text || 'Call'} />,
  toMeta: (data) => ({ type: 'PHONE_NUMBER', text: data.text, phone_number: data.phoneNumber }),
  fromMeta: (button) => {
    if (String(button.type).toUpperCase() !== 'PHONE_NUMBER') return null;
    return {
      text: typeof button.text === 'string' ? button.text : '',
      phoneNumber: typeof button.phone_number === 'string' ? button.phone_number : '',
    };
  },
};

// ---------------------------------------------------------------------------
// Copy code (coupon)
// ---------------------------------------------------------------------------

const copyCodeSchema = z.object({ example: z.string() });

export const copyCodePlugin: ButtonPlugin<z.infer<typeof copyCodeSchema>> = {
  type: 'copy-code',
  maxPerTemplate: LIMITS.MAX_COPY_CODE_BUTTONS,
  meta: {
    label: 'Copy offer code',
    description: 'Copies a coupon code to the clipboard',
    group: 'Buttons',
    icon: Copy,
    keywords: ['coupon', 'promo', 'discount', 'offer'],
  },
  schema: copyCodeSchema,
  defaults: () => ({ example: '' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates only allow an OTP button' }
      : { available: true },
  validate: (data) => {
    const issues: ValidationIssue[] = [];
    if (!data.example.trim()) {
      issues.push({ severity: 'error', slot: 'buttons', code: 'copy-code/required', message: 'Offer code example is required' });
    } else if (data.example.length > LIMITS.COPY_CODE_MAX) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        code: 'copy-code/too-long',
        message: `Offer code exceeds ${LIMITS.COPY_CODE_MAX} characters`,
      });
    }
    return issues;
  },
  Editor: function CopyCodeEditor({ value, onChange }) {
    return (
      <Field label="Example code" counter={`${value.example.length}/${LIMITS.COPY_CODE_MAX}`} hint='Shows as "Copy offer code" in chat'>
        <Input value={value.example} onChange={(e) => onChange({ example: e.target.value })} placeholder="SAVE20" />
      </Field>
    );
  },
  Preview: ({ ctx }) => <WaButtonRow dark={ctx.dark} icon={<Copy className="size-4" />} label="Copy offer code" />,
  toMeta: (data) => ({ type: 'COPY_CODE', example: data.example }),
  fromMeta: (button) => {
    if (String(button.type).toUpperCase() !== 'COPY_CODE') return null;
    return { example: typeof button.example === 'string' ? button.example : '' };
  },
};
