import type { MergeTag } from './merge-tags-config';

export type MergeTagDisplayGroup = {
  title: string;
  items: MergeTag[];
};

const CORE_TOKEN = /^\{\{(name|email|phone)\}\}$|^\[(name|email)\]$/;
const CUSTOM_TOKEN = /^\{\{attributes\.[^}]+\}\}$/;

/**
 * Group flat merge-tag entries into WA-style sections for the bubble-menu picker.
 * Core subscriber tokens → "Subscriber fields"; `{{attributes.*}}` → "Custom fields";
 * everything else (special links, date tags, legacy `[…]` tokens) → "Other tags".
 */
export function groupMergeTagsForDisplay(children: MergeTag[]): MergeTagDisplayGroup[] {
  const subscriber: MergeTag[] = [];
  const custom: MergeTag[] = [];
  const other: MergeTag[] = [];

  for (const tag of children) {
    if (tag.type === 'divider') continue;
    const value = tag.value ?? '';
    if (!tag.label || !value) continue;

    if (CORE_TOKEN.test(value)) {
      subscriber.push(tag);
    } else if (CUSTOM_TOKEN.test(value)) {
      custom.push(tag);
    } else {
      other.push(tag);
    }
  }

  const groups: MergeTagDisplayGroup[] = [];
  if (other.length > 0) groups.push({ title: 'Other tags', items: other });
  if (subscriber.length > 0) groups.push({ title: 'Subscriber fields', items: subscriber });
  if (custom.length > 0) groups.push({ title: 'Custom fields', items: custom });
  return groups;
}
