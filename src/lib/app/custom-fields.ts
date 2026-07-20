/**
 * Custom field definitions — the workspace's subscriber attribute schema.
 *
 * These are tenant-wide, not per-list: values live in one flat
 * `subscribers.attributes` bag and a subscriber can belong to many lists, so a
 * key's type has to mean the same thing everywhere. The list drawer edits this
 * shared catalogue.
 */

/** Matches the `custom_field_type` enum in maildrill-service. */
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
