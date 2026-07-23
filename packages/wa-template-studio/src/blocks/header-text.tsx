import * as React from 'react';
import { z } from 'zod';
import { Heading1 } from 'lucide-react';

import { Field } from '@/ui/field';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { LIMITS } from '@/core/limits';
import type { BlockPlugin, ValidationIssue } from '@/core/types';
import { analyzeVariables, exampleRow, uniqueVariables, type VariableMap } from '@/core/variables';
import { renderWaText } from '@/preview/renderWaText';
import { usePluginForm } from './form';

const schema = z.object({
  text: z.string(),
  variables: z.record(z.string(), z.object({ name: z.string().optional(), example: z.string().optional() })).optional(),
});

type Data = z.infer<typeof schema>;

export const headerTextPlugin: BlockPlugin<Data> = {
  type: 'header-text',
  slot: 'header',
  meta: {
    label: 'Text header',
    description: 'Bold headline, up to 60 characters, one variable',
    group: 'Headers',
    icon: Heading1,
    keywords: ['title', 'headline'],
  },
  schema,
  defaults: () => ({ text: '', variables: {} }),
  availableIn: (category) =>
    category === 'AUTHENTICATION'
      ? { available: false, reason: 'Authentication templates have no custom header' }
      : { available: true },
  validate: (data) => {
    const issues: ValidationIssue[] = [];
    if (!data.text.trim()) {
      issues.push({ severity: 'error', slot: 'header', code: 'header/empty', message: 'Header text is empty' });
    }
    if (data.text.length > LIMITS.HEADER_TEXT_MAX) {
      issues.push({
        severity: 'error',
        slot: 'header',
        code: 'header/too-long',
        message: `Header exceeds ${LIMITS.HEADER_TEXT_MAX} characters`,
      });
    }
    const vars = uniqueVariables(data.text);
    if (vars.length > LIMITS.HEADER_MAX_VARIABLES || (vars.length === 1 && vars[0] !== 1)) {
      issues.push({
        severity: 'error',
        slot: 'header',
        code: 'header/variable-limit',
        message: 'Text headers allow a single variable, {{1}}',
      });
    }
    const analysis = analyzeVariables(data.text, data.variables ?? {});
    for (const bad of analysis.malformed) {
      issues.push({
        severity: 'warning',
        slot: 'header',
        code: 'header/malformed-variable',
        message: `"${bad}" is not a valid variable — use {{1}}`,
      });
    }
    return issues;
  },
  Editor: function HeaderTextEditor({ value, onChange }) {
    const form = usePluginForm(schema, value, onChange);
    const text = form.watch('text');
    const vars = uniqueVariables(text);

    return (
      <div className="flex flex-col gap-4">
        <Field label="Header text" counter={`${text.length}/${LIMITS.HEADER_TEXT_MAX}`} hint="Supports one {{1}} variable">
          <Input {...form.register('text')} placeholder="Your order has shipped" aria-label="Header text" />
        </Field>
        {vars.length === 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...value, text: `${value.text}{{1}}` })}
          >
            Insert {'{{1}}'} variable
          </Button>
        )}
        {vars.map((n) => (
          <Field key={n} label={`Example for {{${n}}}`}>
            <Input
              value={(value.variables ?? {})[String(n)]?.example ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  variables: { ...(value.variables ?? {}), [String(n)]: { ...(value.variables ?? {})[String(n)], example: e.target.value } },
                })
              }
              placeholder="Sample value shown to Meta reviewers"
            />
          </Field>
        ))}
      </div>
    );
  },
  Preview: function HeaderTextPreview({ data, ctx }) {
    return (
      <div className={`px-[9px] pt-[6px] text-[15px] font-bold leading-[19px] ${ctx.dark ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
        {data.text ? renderWaText(data.text, ctx.resolveVariable) : <span className="opacity-40">Header</span>}
      </div>
    );
  },
  toMeta: (data) => {
    const vars = uniqueVariables(data.text);
    return {
      type: 'HEADER',
      format: 'TEXT',
      text: data.text,
      ...(vars.length > 0 ? { example: { header_text: exampleRow(data.text, (data.variables ?? {}) as VariableMap) } } : {}),
    };
  },
  fromMeta: (component) => {
    if (String(component.type).toUpperCase() !== 'HEADER') return null;
    if (String(component.format ?? '').toUpperCase() !== 'TEXT') return null;
    const text = typeof component.text === 'string' ? component.text : '';
    const variables: Data['variables'] = {};
    const examples = (component.example as { header_text?: string[] } | undefined)?.header_text ?? [];
    uniqueVariables(text).forEach((n, i) => {
      const example = examples[i];
      if (example !== undefined) variables[String(n)] = { example };
    });
    return { text, variables };
  },
};
