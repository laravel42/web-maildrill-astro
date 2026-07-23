import * as React from 'react';
import { z } from 'zod';
import { Copy, KeyRound, LayoutGrid, ShoppingBag, Workflow } from 'lucide-react';

import { Field } from '@/ui/field';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { LIMITS } from '@/core/limits';
import type { ButtonPlugin, ValidationIssue } from '@/core/types';
import { WaButtonRow } from './row';

// ---------------------------------------------------------------------------
// OTP (authentication): COPY_CODE / ONE_TAP / ZERO_TAP
// ---------------------------------------------------------------------------

const otpSchema = z.object({
  otpType: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']),
  /** Button label (copy-code style). */
  text: z.string().optional(),
  /** One-tap autofill label. */
  autofillText: z.string().optional(),
  /** Android app identity for one-tap/zero-tap handoff. */
  packageName: z.string().optional(),
  signatureHash: z.string().optional(),
});

type OtpData = z.infer<typeof otpSchema>;

export const otpPlugin: ButtonPlugin<OtpData> = {
  type: 'otp',
  maxPerTemplate: LIMITS.MAX_OTP_BUTTONS,
  meta: {
    label: 'OTP button',
    description: 'Copy code, one-tap or zero-tap autofill',
    group: 'Buttons',
    icon: KeyRound,
    keywords: ['authentication', 'code', '2fa', 'autofill', 'one tap'],
  },
  schema: otpSchema,
  defaults: () => ({ otpType: 'COPY_CODE', text: 'Copy code' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: true }
      : { available: false, reason: 'OTP buttons only exist in Authentication templates' },
  validate: (data) => {
    const issues: ValidationIssue[] = [];
    if (data.otpType !== 'COPY_CODE') {
      if (!(data.packageName ?? '').trim()) {
        issues.push({
          severity: 'error',
          slot: 'buttons',
          code: 'otp/package-name-required',
          message: 'One-tap/zero-tap needs the Android package name',
        });
      }
      if (!(data.signatureHash ?? '').trim()) {
        issues.push({
          severity: 'error',
          slot: 'buttons',
          code: 'otp/signature-hash-required',
          message: 'One-tap/zero-tap needs the app signature hash',
        });
      }
    }
    if ((data.text ?? '').length > LIMITS.BUTTON_TEXT_MAX) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        code: 'otp/label-too-long',
        message: `Button label exceeds ${LIMITS.BUTTON_TEXT_MAX} characters`,
      });
    }
    return issues;
  },
  Editor: function OtpEditor({ value, onChange }) {
    return (
      <div className="flex flex-col gap-4">
        <Field label="OTP delivery" hint="How the code reaches your app">
          <Select value={value.otpType} onValueChange={(otpType) => onChange({ ...value, otpType: otpType as OtpData['otpType'] })}>
            <SelectTrigger aria-label="OTP type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COPY_CODE">Copy code</SelectItem>
              <SelectItem value="ONE_TAP">One-tap autofill</SelectItem>
              <SelectItem value="ZERO_TAP">Zero-tap autofill</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Button label" counter={`${(value.text ?? '').length}/${LIMITS.BUTTON_TEXT_MAX}`}>
          <Input value={value.text ?? ''} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder="Copy code" />
        </Field>
        {value.otpType !== 'COPY_CODE' && (
          <>
            <Field label="Autofill label" hint="Shown when the app handles the code">
              <Input
                value={value.autofillText ?? ''}
                onChange={(e) => onChange({ ...value, autofillText: e.target.value })}
                placeholder="Autofill"
              />
            </Field>
            <Field label="Android package name">
              <Input
                value={value.packageName ?? ''}
                onChange={(e) => onChange({ ...value, packageName: e.target.value })}
                placeholder="com.example.app"
              />
            </Field>
            <Field label="App signature hash">
              <Input
                value={value.signatureHash ?? ''}
                onChange={(e) => onChange({ ...value, signatureHash: e.target.value })}
                placeholder="K8a/AINcGX7"
              />
            </Field>
          </>
        )}
      </div>
    );
  },
  Preview: ({ data, ctx }) => (
    <WaButtonRow dark={ctx.dark} icon={<Copy className="size-4" />} label={data.text || 'Copy code'} />
  ),
  toMeta: (data) => ({
    type: 'OTP',
    otp_type: data.otpType,
    ...(data.text ? { text: data.text } : {}),
    ...(data.otpType !== 'COPY_CODE'
      ? {
          ...(data.autofillText ? { autofill_text: data.autofillText } : {}),
          ...(data.packageName ? { package_name: data.packageName } : {}),
          ...(data.signatureHash ? { signature_hash: data.signatureHash } : {}),
        }
      : {}),
  }),
  fromMeta: (button) => {
    if (String(button.type).toUpperCase() !== 'OTP') return null;
    const otpType = String(button.otp_type ?? 'COPY_CODE').toUpperCase();
    if (!['COPY_CODE', 'ONE_TAP', 'ZERO_TAP'].includes(otpType)) return null;
    return {
      otpType: otpType as OtpData['otpType'],
      text: typeof button.text === 'string' ? button.text : undefined,
      autofillText: typeof button.autofill_text === 'string' ? button.autofill_text : undefined,
      packageName: typeof button.package_name === 'string' ? button.package_name : undefined,
      signatureHash: typeof button.signature_hash === 'string' ? button.signature_hash : undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

const flowSchema = z.object({
  text: z.string(),
  flowId: z.string(),
  flowAction: z.enum(['navigate', 'data_exchange']),
  navigateScreen: z.string().optional(),
});

type FlowData = z.infer<typeof flowSchema>;

export const flowPlugin: ButtonPlugin<FlowData> = {
  type: 'flow',
  maxPerTemplate: LIMITS.MAX_FLOW_BUTTONS,
  meta: {
    label: 'Flow',
    description: 'Opens a WhatsApp Flow (forms, booking, surveys)',
    group: 'Buttons',
    icon: Workflow,
    keywords: ['form', 'survey', 'booking', 'interactive'],
  },
  schema: flowSchema,
  defaults: () => ({ text: '', flowId: '', flowAction: 'navigate' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates only allow an OTP button' }
      : { available: true },
  validate: (data) => {
    const issues: ValidationIssue[] = [];
    if (!data.text.trim()) {
      issues.push({ severity: 'error', slot: 'buttons', code: 'flow/label-required', message: 'Button label is required' });
    }
    if (data.text.length > LIMITS.BUTTON_TEXT_MAX) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        code: 'flow/label-too-long',
        message: `Button label exceeds ${LIMITS.BUTTON_TEXT_MAX} characters`,
      });
    }
    if (!data.flowId.trim()) {
      issues.push({ severity: 'error', slot: 'buttons', code: 'flow/id-required', message: 'Flow ID is required' });
    }
    if (data.flowAction === 'navigate' && !(data.navigateScreen ?? '').trim()) {
      issues.push({
        severity: 'warning',
        slot: 'buttons',
        code: 'flow/screen-missing',
        message: 'Set the screen to open (defaults to the Flow’s first screen)',
      });
    }
    return issues;
  },
  Editor: function FlowEditor({ value, onChange }) {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Label" counter={`${value.text.length}/${LIMITS.BUTTON_TEXT_MAX}`}>
          <Input value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder="Book appointment" />
        </Field>
        <Field label="Flow ID" hint="From WhatsApp Manager → Flows">
          <Input value={value.flowId} onChange={(e) => onChange({ ...value, flowId: e.target.value })} placeholder="1234567890" />
        </Field>
        <Field label="Flow action">
          <Select
            value={value.flowAction}
            onValueChange={(flowAction) => onChange({ ...value, flowAction: flowAction as FlowData['flowAction'] })}
          >
            <SelectTrigger aria-label="Flow action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="navigate">Navigate</SelectItem>
              <SelectItem value="data_exchange">Data exchange</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {value.flowAction === 'navigate' && (
          <Field label="Screen">
            <Input
              value={value.navigateScreen ?? ''}
              onChange={(e) => onChange({ ...value, navigateScreen: e.target.value })}
              placeholder="WELCOME_SCREEN"
            />
          </Field>
        )}
      </div>
    );
  },
  Preview: ({ data, ctx }) => <WaButtonRow dark={ctx.dark} icon={<Workflow className="size-4" />} label={data.text || 'Open Flow'} />,
  toMeta: (data) => ({
    type: 'FLOW',
    text: data.text,
    flow_id: data.flowId,
    flow_action: data.flowAction,
    ...(data.flowAction === 'navigate' && data.navigateScreen ? { navigate_screen: data.navigateScreen } : {}),
  }),
  fromMeta: (button) => {
    if (String(button.type).toUpperCase() !== 'FLOW') return null;
    const flowAction = String(button.flow_action ?? 'navigate');
    return {
      text: typeof button.text === 'string' ? button.text : '',
      flowId: String(button.flow_id ?? ''),
      flowAction: (flowAction === 'data_exchange' ? 'data_exchange' : 'navigate') as FlowData['flowAction'],
      navigateScreen: typeof button.navigate_screen === 'string' ? button.navigate_screen : undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// Catalog & Multi-product
// ---------------------------------------------------------------------------

const catalogSchema = z.object({ text: z.string() });

function makeCommercePlugin(config: {
  type: string;
  metaType: 'CATALOG' | 'MPM';
  label: string;
  description: string;
  defaultLabel: string;
  icon: ButtonPlugin<z.infer<typeof catalogSchema>>['meta']['icon'];
  keywords: string[];
  max: number;
}): ButtonPlugin<z.infer<typeof catalogSchema>> {
  return {
    type: config.type,
    maxPerTemplate: config.max,
    meta: {
      label: config.label,
      description: config.description,
      group: 'Buttons',
      icon: config.icon,
      keywords: config.keywords,
    },
    schema: catalogSchema,
    defaults: () => ({ text: config.defaultLabel }),
    availableIn: (category) =>
      category === 'MARKETING'
        ? { available: true }
        : { available: false, reason: `${config.label} buttons are only available in Marketing templates` },
    validate: (data) => {
      const issues: ValidationIssue[] = [];
      if (!data.text.trim()) {
        issues.push({ severity: 'error', slot: 'buttons', code: `${config.type}/label-required`, message: 'Button label is required' });
      }
      if (data.text.length > LIMITS.BUTTON_TEXT_MAX) {
        issues.push({
          severity: 'error',
          slot: 'buttons',
          code: `${config.type}/label-too-long`,
          message: `Button label exceeds ${LIMITS.BUTTON_TEXT_MAX} characters`,
        });
      }
      return issues;
    },
    Editor: function CommerceEditor({ value, onChange }) {
      return (
        <Field label="Label" counter={`${value.text.length}/${LIMITS.BUTTON_TEXT_MAX}`} hint="Products attach at send time">
          <Input value={value.text} onChange={(e) => onChange({ text: e.target.value })} placeholder={config.defaultLabel} />
        </Field>
      );
    },
    Preview: ({ data, ctx }) => {
      const Icon = config.icon;
      return <WaButtonRow dark={ctx.dark} icon={<Icon className="size-4" />} label={data.text || config.defaultLabel} />;
    },
    toMeta: (data) => ({ type: config.metaType, text: data.text }),
    fromMeta: (button) => {
      if (String(button.type).toUpperCase() !== config.metaType) return null;
      return { text: typeof button.text === 'string' ? button.text : config.defaultLabel };
    },
  };
}

export const catalogPlugin = makeCommercePlugin({
  type: 'catalog',
  metaType: 'CATALOG',
  label: 'View catalog',
  description: 'Opens your product catalog',
  defaultLabel: 'View catalog',
  icon: LayoutGrid,
  keywords: ['commerce', 'products', 'shop'],
  max: LIMITS.MAX_CATALOG_BUTTONS,
});

export const mpmPlugin = makeCommercePlugin({
  type: 'mpm',
  metaType: 'MPM',
  label: 'Multi-product',
  description: 'Shows a curated selection of products',
  defaultLabel: 'View items',
  icon: ShoppingBag,
  keywords: ['commerce', 'products', 'multi product message'],
  max: LIMITS.MAX_MPM_BUTTONS,
});
