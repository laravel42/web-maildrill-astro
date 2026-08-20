import { describe, expect, it } from 'vitest';

import { insertTextAt } from '@/components/react/shared/useMessageDraft';

describe('insertTextAt', () => {
  it('inserts into empty text', () => {
    expect(insertTextAt('', '{{name}}', 0)).toEqual({ text: '{{name}}', caret: 8 });
  });

  it('inserts at the start', () => {
    expect(insertTextAt('world', '{{name}} ', 0)).toEqual({
      text: '{{name}} world',
      caret: 9,
    });
  });

  it('inserts at the caret in the middle', () => {
    const text = 'Hi , your order shipped';
    const start = 'Hi '.length;
    expect(insertTextAt(text, '{{name}}', start)).toEqual({
      text: 'Hi {{name}}, your order shipped',
      caret: start + '{{name}}'.length,
    });
  });

  it('replaces the current selection', () => {
    const text = 'Hi NAME, welcome';
    expect(insertTextAt(text, '{{name}}', 3, 7)).toEqual({
      text: 'Hi {{name}}, welcome',
      caret: 11,
    });
  });

  it('appends at the end', () => {
    const text = 'Track your order:';
    expect(insertTextAt(text, ' {{url}}', text.length)).toEqual({
      text: 'Track your order: {{url}}',
      caret: 'Track your order: {{url}}'.length,
    });
  });
});
