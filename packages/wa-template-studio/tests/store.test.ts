import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { registerBuiltInPlugins } from '../src/blocks';
import {
  addButton,
  emptyDoc,
  placeBlock,
  redo,
  removeBlock,
  removeButton,
  reorderButtons,
  replaceDoc,
  setTemplateField,
  undo,
  updateBlockData,
  useStudio,
} from '../src/core/store';

beforeAll(() => {
  registerBuiltInPlugins();
});

beforeEach(() => {
  replaceDoc(emptyDoc(), { resetHistory: true });
});

describe('studio store', () => {
  it('places, replaces and removes slot blocks with selection tracking', () => {
    placeBlock('header', 'header-text');
    let doc = useStudio.getState().doc;
    expect(doc.blocks.header?.type).toBe('header-text');
    expect(useStudio.getState().selection).toMatchObject({ kind: 'block', slot: 'header' });

    placeBlock('header', 'header-image');
    doc = useStudio.getState().doc;
    expect(doc.blocks.header?.type).toBe('header-image');

    removeBlock('header');
    expect(useStudio.getState().doc.blocks.header).toBeNull();
  });

  it('adds, reorders and removes buttons', () => {
    addButton('copy-code');
    addButton('url');
    addButton('phone');
    let buttons = useStudio.getState().doc.blocks.buttons;
    expect(buttons.map((b) => b.type)).toEqual(['copy-code', 'url', 'phone']);

    reorderButtons(2, 0);
    buttons = useStudio.getState().doc.blocks.buttons;
    expect(buttons.map((b) => b.type)).toEqual(['phone', 'copy-code', 'url']);

    const removedId = buttons[0]!.id;
    removeButton(removedId);
    expect(useStudio.getState().doc.blocks.buttons.map((b) => b.type)).toEqual(['copy-code', 'url']);
  });

  it('undo/redo restore document states across mutation kinds', () => {
    const initial = useStudio.getState().doc;

    updateBlockData('body', { text: 'Hello', variables: {} });
    placeBlock('footer', 'footer');
    const withFooter = useStudio.getState().doc;

    undo();
    expect(useStudio.getState().doc.blocks.footer).toBeNull();
    undo();
    expect(useStudio.getState().doc).toEqual(initial);

    redo();
    redo();
    expect(useStudio.getState().doc).toEqual(withFooter);
  });

  it('a new mutation clears the redo stack', () => {
    updateBlockData('body', { text: 'One', variables: {} });
    undo();
    updateBlockData('body', { text: 'Two', variables: {} });
    expect(useStudio.getState().future).toEqual([]);
    redo();
    expect((useStudio.getState().doc.blocks.body.data as { text: string }).text).toBe('Two');
  });

  it('does not push history for no-op template field updates or identical commits', () => {
    setTemplateField('name', '');
    expect(useStudio.getState().past).toEqual([]);

    updateBlockData('body', { text: 'Hello', variables: {} });
    updateBlockData('body', { text: 'Hello', variables: {} });
    expect(useStudio.getState().past).toHaveLength(1);
  });
});
