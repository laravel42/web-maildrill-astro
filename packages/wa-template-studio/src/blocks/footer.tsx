import * as React from 'react';
import { z } from 'zod';
import { PanelBottom } from 'lucide-react';

import { Field } from '@/ui/field';
import { Input } from '@/ui/input';
import { LIMITS } from '@/core/limits';
import type { BlockPlugin, ValidationIssue } from '@/core/types';
import { extractVariables } from '@/core/variables';

const schema = z.object({ text: z.string() });
type Data = z.infer<typeof schema>;

export const footerPlugin: BlockPlugin<Data> = {
  type: 'footer',
  slot: 'footer',
  meta: {
    label: 'Footer',
    description: 'Small print under the message, up to 60 characters',
    group: 'Footer',
    icon: PanelBottom,
    keywords: ['disclaimer', 'unsubscribe', 'opt out'],
  },
  schema,
  defaults: () => ({ text: '' }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication footers show the code expiration instead' }
      : { available: true },
  validate: (data) => {
    const issues: ValidationIssue[] = [];
    if (!data.text.trim()) {
      issues.push({
        severity: 'warning',
        slot: 'footer',
        code: 'footer/empty',
        message: 'Footer is empty — remove it or add text',
      });
    }
    if (data.text.length > LIMITS.FOOTER_TEXT_MAX) {
      issues.push({
        severity: 'error',
        slot: 'footer',
        code: 'footer/too-long',
        message: `Footer exceeds ${LIMITS.FOOTER_TEXT_MAX} characters`,
      });
    }
    if (extractVariables(data.text).length > 0) {
      issues.push({
        severity: 'error',
        slot: 'footer',
        code: 'footer/no-variables',
        message: 'Footers cannot contain variables',
      });
    }
    return issues;
  },
  Editor: function FooterEditor({ value, onChange }) {
    return (
      <Field
        label="Footer text"
        counter={`${value.text.length}/${LIMITS.FOOTER_TEXT_MAX}`}
        hint="Plain text — no formatting or variables"
      >
        <Input
          value={value.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Reply STOP to unsubscribe"
          aria-label="Footer text"
        />
      </Field>
    );
  },
  Preview: function FooterPreview({ data, ctx }) {
    return (
      <div
        className={`px-[9px] pt-[2px] text-[12.5px] leading-[17px] ${ctx.dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}
      >
        {data.text || <span className="opacity-60">Footer</span>}
      </div>
    );
  },
  toMeta: (data) => ({ type: 'FOOTER', text: data.text }),
  fromMeta: (component, template) => {
    if (String(component.type).toUpperCase() !== 'FOOTER') return null;
    if (template.category === 'AUTHENTICATION') return null;
    if (typeof component.text !== 'string') return null;
    return { text: component.text };
  },
};
