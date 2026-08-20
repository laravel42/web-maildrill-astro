import type { VariableMeta } from './variables';

/** Workspace custom field row from `/api/v1/custom-fields`. */
export type SubscriberCustomField = {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
};

/** One pickable subscriber attribute for template variable mapping. */
export type SubscriberFieldOption = {
  id: string;
  label: string;
  /** Merge token used at send time (`{{name}}`, `{{attributes.company}}`, …). */
  token: string;
  /** Sample value for Meta review + live preview. */
  example: string;
  group: 'core' | 'custom';
};

const CORE_FIELDS: SubscriberFieldOption[] = [
  { id: 'name', label: 'Name', token: '{{name}}', example: 'Alex Morgan', group: 'core' },
  { id: 'email', label: 'Email', token: '{{email}}', example: 'alex@example.com', group: 'core' },
  { id: 'phone', label: 'Phone', token: '{{phone}}', example: '+1 555 0100', group: 'core' },
];

function exampleForCustomField(field: SubscriberCustomField): string {
  switch (field.type) {
    case 'number':
      return '42';
    case 'date':
      return 'May 14';
    case 'boolean':
      return 'Yes';
    default:
      return field.label.trim() || 'Sample value';
  }
}

/** Core subscriber fields plus workspace custom fields. */
export function buildSubscriberFieldOptions(
  customFields: SubscriberCustomField[] = [],
): SubscriberFieldOption[] {
  const custom = customFields.map((f) => ({
    id: `attr:${f.key}`,
    label: f.label,
    token: `{{attributes.${f.key}}}`,
    example: exampleForCustomField(f),
    group: 'custom' as const,
  }));
  return [...CORE_FIELDS, ...custom];
}

/** Resolve the combobox selection from stored variable metadata. */
export function matchSubscriberField(
  meta: VariableMeta | undefined,
  options: SubscriberFieldOption[],
): SubscriberFieldOption | null {
  if (!meta) return null;
  if (meta.source) {
    const bySource = options.find((o) => o.token === meta.source);
    if (bySource) return bySource;
  }
  if (meta.name) {
    const byLabel = options.find((o) => o.label === meta.name);
    if (byLabel) return byLabel;
  }
  if (meta.example) {
    const byExample = options.find((o) => o.example === meta.example);
    if (byExample) return byExample;
  }
  return null;
}
