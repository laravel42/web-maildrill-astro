import * as React from 'react';
import { z } from 'zod';
import { ShieldCheck, TimerReset } from 'lucide-react';

import { Field } from '@/ui/field';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import { LIMITS } from '@/core/limits';
import type { BlockPlugin, ValidationIssue } from '@/core/types';

/**
 * Authentication-category blocks. Meta generates the copy for auth
 * templates — the studio exposes exactly the knobs the API accepts:
 * body → add_security_recommendation, footer → code_expiration_minutes.
 */

// ---------------------------------------------------------------------------
// Body (authentication)
// ---------------------------------------------------------------------------

const authBodySchema = z.object({
  securityRecommendation: z.boolean(),
});
type AuthBodyData = z.infer<typeof authBodySchema>;

export const bodyAuthPlugin: BlockPlugin<AuthBodyData> = {
  type: 'body-auth',
  slot: 'body',
  meta: {
    label: 'Authentication body',
    description: 'Meta-generated OTP copy with optional security note',
    group: 'Body',
    icon: ShieldCheck,
    keywords: ['otp', 'code', 'verification', '2fa'],
  },
  schema: authBodySchema,
  defaults: () => ({ securityRecommendation: true }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: true }
      : { available: false, reason: 'Only available in Authentication templates' },
  validate: () => [],
  Editor: function AuthBodyEditor({ value, onChange }) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div>
          <Label htmlFor="sec-rec" className="text-sm font-medium">
            Security recommendation
          </Label>
          <p className="text-xs text-muted-foreground">
            Appends “For your security, do not share this code.”
          </p>
        </div>
        <Switch
          id="sec-rec"
          checked={value.securityRecommendation}
          onCheckedChange={(securityRecommendation) => onChange({ securityRecommendation })}
        />
      </div>
    );
  },
  Preview: function AuthBodyPreview({ data, ctx }) {
    return (
      <div
        className={`px-[9px] py-[5px] text-[14.2px] leading-[19px] ${ctx.dark ? 'text-[#e9edef]' : 'text-[#111b21]'}`}
      >
        <span className="rounded-[3px] bg-emerald-500/15 px-0.5 font-semibold">123456</span> is your
        verification code.
        {data.securityRecommendation && ' For your security, do not share this code.'}
      </div>
    );
  },
  toMeta: (data) => ({
    type: 'BODY',
    ...(data.securityRecommendation ? { add_security_recommendation: true } : {}),
  }),
  fromMeta: (component, template) => {
    if (String(component.type).toUpperCase() !== 'BODY') return null;
    if (template.category !== 'AUTHENTICATION') return null;
    return { securityRecommendation: Boolean(component.add_security_recommendation) };
  },
};

// ---------------------------------------------------------------------------
// Footer (authentication) — code expiration
// ---------------------------------------------------------------------------

const authFooterSchema = z.object({
  codeExpirationMinutes: z.number(),
});
type AuthFooterData = z.infer<typeof authFooterSchema>;

export const footerAuthPlugin: BlockPlugin<AuthFooterData> = {
  type: 'footer-auth',
  slot: 'footer',
  meta: {
    label: 'Code expiration',
    description: 'Shows “This code expires in N minutes.”',
    group: 'Footer',
    icon: TimerReset,
    keywords: ['expiry', 'expiration', 'timeout', 'otp'],
  },
  schema: authFooterSchema,
  defaults: () => ({ codeExpirationMinutes: 10 }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: true }
      : { available: false, reason: 'Only available in Authentication templates' },
  validate: (data) => {
    const issues: ValidationIssue[] = [];
    if (
      !Number.isInteger(data.codeExpirationMinutes) ||
      data.codeExpirationMinutes < LIMITS.CODE_EXPIRATION_MIN ||
      data.codeExpirationMinutes > LIMITS.CODE_EXPIRATION_MAX
    ) {
      issues.push({
        severity: 'error',
        slot: 'footer',
        code: 'footer/code-expiration-range',
        message: `Code expiration must be ${LIMITS.CODE_EXPIRATION_MIN}–${LIMITS.CODE_EXPIRATION_MAX} minutes`,
      });
    }
    return issues;
  },
  Editor: function AuthFooterEditor({ value, onChange }) {
    return (
      <Field
        label="Expires after (minutes)"
        hint={`${LIMITS.CODE_EXPIRATION_MIN}–${LIMITS.CODE_EXPIRATION_MAX} minutes`}
      >
        <Input
          type="number"
          min={LIMITS.CODE_EXPIRATION_MIN}
          max={LIMITS.CODE_EXPIRATION_MAX}
          value={value.codeExpirationMinutes}
          onChange={(e) => onChange({ codeExpirationMinutes: Number(e.target.value) })}
        />
      </Field>
    );
  },
  Preview: function AuthFooterPreview({ data, ctx }) {
    return (
      <div
        className={`px-[9px] pt-[2px] text-[12.5px] leading-[17px] ${ctx.dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}
      >
        This code expires in {data.codeExpirationMinutes} minutes.
      </div>
    );
  },
  toMeta: (data) => ({ type: 'FOOTER', code_expiration_minutes: data.codeExpirationMinutes }),
  fromMeta: (component, template) => {
    if (String(component.type).toUpperCase() !== 'FOOTER') return null;
    if (template.category !== 'AUTHENTICATION' && component.code_expiration_minutes === undefined)
      return null;
    const minutes = component.code_expiration_minutes;
    if (typeof minutes !== 'number') return null;
    return { codeExpirationMinutes: minutes };
  },
};
