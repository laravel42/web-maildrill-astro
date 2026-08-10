import { describe, expect, it } from 'vitest';

import { groupMergeTagsForDisplay } from '../../packages/block-notion-text/src/merge-tags-groups';
import type { MergeTag } from '../../packages/block-notion-text/src/merge-tags-config';

describe('groupMergeTagsForDisplay', () => {
  it('groups Maildrill subscriber and custom tokens like WA studio', () => {
    const children: MergeTag[] = [
      { label: 'Name', value: '{{name}}' },
      { label: 'Email', value: '{{email}}' },
      { label: 'Phone', value: '{{phone}}' },
      { type: 'divider' },
      { label: 'Plan', value: '{{attributes.plan}}' },
    ];

    expect(groupMergeTagsForDisplay(children)).toEqual([
      {
        title: 'Subscriber fields',
        items: [
          { label: 'Name', value: '{{name}}' },
          { label: 'Email', value: '{{email}}' },
          { label: 'Phone', value: '{{phone}}' },
        ],
      },
      {
        title: 'Custom fields',
        items: [{ label: 'Plan', value: '{{attributes.plan}}' }],
      },
    ]);
  });

  it('puts legacy special and date tags in Other tags', () => {
    const children: MergeTag[] = [
      { label: 'Unsubscribe here', value: '{unsubscribe}Unsubscribe here{/unsubscribe}' },
      { type: 'divider' },
      { label: 'Name', value: '[name]' },
      { label: 'Year', value: '[currentyear]' },
    ];

    expect(groupMergeTagsForDisplay(children)).toEqual([
      {
        title: 'Other tags',
        items: [
          { label: 'Unsubscribe here', value: '{unsubscribe}Unsubscribe here{/unsubscribe}' },
          { label: 'Year', value: '[currentyear]' },
        ],
      },
      {
        title: 'Subscriber fields',
        items: [{ label: 'Name', value: '[name]' }],
      },
    ]);
  });
});
