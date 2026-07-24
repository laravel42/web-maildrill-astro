/**
 * Custom field definitions — the workspace's subscriber attribute schema.
 *
 * These are tenant-wide, not per-list: values live in one flat
 * `subscribers.attributes` bag and a subscriber can belong to many lists, so a
 * key's type has to mean the same thing everywhere. The list drawer edits this
 * shared catalogue.
 */

/** Matches the `custom_field_type` enum in workers. */
export const FIELD_TYPES = ['text', 'number', 'date', 'boolean'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Boolean',
};

export type CustomField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  createdAt: string;
};

/**
 * Coerce typed text into a key the API will accept: lowercase, underscores for
 * runs of anything else, and a leading letter (the backend regex requires one).
 * Returns '' when nothing usable is left, which the caller treats as "can't add".
 */
export function normalizeKey(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(slug) ? slug.slice(0, 64) : '';
}

/** One entry in the editor's merge-tag menu (structurally an editor MergeTag). */
export type MergeTagEntry = { label?: string; value?: string; type?: 'divider' };
/** A labelled group of merge tags (structurally an editor MergeTagGroup). */
export type MergeTagMenu = { label: string; children: MergeTagEntry[] };

/**
 * Build the editor's merge-tag menu from the real subscriber schema: the always-
 * present fields plus every workspace custom field. Tokens use the `{{…}}`
 * grammar the send pipeline substitutes (`{{name}}`, `{{email}}`, `{{phone}}`,
 * `{{attributes.<key>}}`) — so what a user inserts is exactly what gets merged,
 * not a placeholder from another ESP.
 */
export function buildMergeTagMenu(fields: CustomField[]): MergeTagMenu {
  const children: MergeTagEntry[] = [
    { label: 'Name', value: '{{name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Phone', value: '{{phone}}' },
  ];
  if (fields.length > 0) {
    children.push({ type: 'divider' });
    for (const f of fields) {
      children.push({ label: f.label, value: `{{attributes.${f.key}}}` });
    }
  }
  return { label: 'Merge tags', children };
}
