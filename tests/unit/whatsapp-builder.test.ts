import { describe, expect, it, beforeEach } from 'vitest';

import { buildComponents, buildText } from '../../packages/whatsapp-builder-standalone/src/documents/components';
import {
  addSection,
  editorStateStore,
  redoChange,
  removeBlock,
  resetDocument,
  undoChange,
  updateBlockData,
} from '../../packages/whatsapp-builder-standalone/src/documents/editor/EditorContext';
import type { TWhatsAppConfiguration } from '../../packages/whatsapp-builder-standalone/src/documents/schemas';
import { WhatsAppConfigurationSchema } from '../../packages/whatsapp-builder-standalone/src/documents/schemas';
import { validateWhatsAppDocument } from '../../packages/whatsapp-builder-standalone/src/documents/validation';
import { getEmptyWhatsAppMessage } from '../../packages/whatsapp-builder-standalone/src/getConfiguration';

/** Full-featured document exercising every WhatsApp template section. */
function fullDocument(): TWhatsAppConfiguration {
  return {
    root: {
      type: 'WhatsAppMessage',
      data: { language: 'es_MX', category: 'UTILITY', childrenIds: ['h', 'b', 'f', 'btns'] },
    },
    h: { type: 'Header', data: { props: { format: 'text', text: 'Order {{1}}' } } },
    b: {
      type: 'Body',
      data: { props: { text: 'Hi {{1}}, order {{2}} shipped.', examples: ['Ada', '#1042'] } },
    },
    f: { type: 'Footer', data: { props: { text: 'Reply STOP to opt out' } } },
    btns: {
      type: 'Buttons',
      data: {
        props: {
          buttons: [
            { type: 'QUICK_REPLY', text: 'Track it' },
            { type: 'URL', text: 'View order', url: 'https://example.com/o/{{1}}' },
            { type: 'PHONE_NUMBER', text: 'Call us', phoneNumber: '+15550100' },
            { type: 'COPY_CODE', couponCode: 'SHIP10' },
          ],
        },
      },
    },
  };
}

describe('whatsapp-builder document model', () => {
  it('empty seed and full document satisfy the zod schema', () => {
    expect(WhatsAppConfigurationSchema.safeParse(getEmptyWhatsAppMessage()).success).toBe(true);
    expect(WhatsAppConfigurationSchema.safeParse(fullDocument()).success).toBe(true);
  });
});

describe('buildComponents (Meta payload emitter)', () => {
  it('serializes every section into the Meta components shape', () => {
    const out = buildComponents(fullDocument());
    expect(out.category).toBe('UTILITY');
    expect(out.language).toBe('es_MX');
    expect(out.header).toEqual({
      format: 'TEXT',
      text: 'Order {{1}}',
      example: { header_text: ['Sample'] },
    });
    expect(out.body.text).toBe('Hi {{1}}, order {{2}} shipped.');
    expect(out.body.example).toEqual({ body_text: [['Ada', '#1042']] });
    expect(out.footer).toEqual({ text: 'Reply STOP to opt out' });
    expect(out.buttons).toEqual([
      { type: 'QUICK_REPLY', text: 'Track it' },
      { type: 'URL', text: 'View order', url: 'https://example.com/o/{{1}}' },
      { type: 'PHONE_NUMBER', text: 'Call us', phone_number: '+15550100' },
      { type: 'COPY_CODE', example: 'SHIP10' },
    ]);
  });

  it('keeps the legacy body/category keys byte-compatible for minimal docs', () => {
    const doc = getEmptyWhatsAppMessage();
    const bodyId = Object.keys(doc).find((k) => doc[k].type === 'Body')!;
    doc[bodyId] = { type: 'Body', data: { props: { text: 'Plain body' } } };
    const out = buildComponents(doc);
    expect(out.category).toBe('MARKETING');
    expect(out.body).toEqual({ text: 'Plain body' });
    expect(out.header).toBeUndefined();
    expect(out.footer).toBeUndefined();
    expect(out.buttons).toBeUndefined();
    expect(buildText(doc)).toBe('Plain body');
  });

  it('falls back to generated samples for missing variable examples', () => {
    const doc = getEmptyWhatsAppMessage();
    const bodyId = Object.keys(doc).find((k) => doc[k].type === 'Body')!;
    doc[bodyId] = { type: 'Body', data: { props: { text: 'Hello {{1}} {{2}}' } } };
    const out = buildComponents(doc);
    expect(out.body.example).toEqual({ body_text: [['Sample 1', 'Sample 2']] });
  });
});

describe('validateWhatsAppDocument', () => {
  it('flags a missing body', () => {
    const issues = validateWhatsAppDocument(getEmptyWhatsAppMessage());
    expect(issues.some((i) => i.key === 'bodyRequired')).toBe(true);
  });

  it('accepts the full document', () => {
    expect(validateWhatsAppDocument(fullDocument())).toEqual([]);
  });

  it('flags non-sequential variables', () => {
    const doc = fullDocument();
    doc.b = { type: 'Body', data: { props: { text: 'Hi {{2}}' } } };
    expect(validateWhatsAppDocument(doc).some((i) => i.key === 'variablesNotSequential')).toBe(true);
  });

  it('enforces button-type ceilings', () => {
    const doc = fullDocument();
    doc.btns = {
      type: 'Buttons',
      data: {
        props: {
          buttons: [
            { type: 'PHONE_NUMBER', text: 'A', phoneNumber: '+1' },
            { type: 'PHONE_NUMBER', text: 'B', phoneNumber: '+2' },
          ],
        },
      },
    };
    expect(validateWhatsAppDocument(doc).some((i) => i.key === 'tooManyOfType')).toBe(true);
  });

  it('flags over-limit header text', () => {
    const doc = fullDocument();
    doc.h = { type: 'Header', data: { props: { format: 'text', text: 'x'.repeat(61) } } };
    expect(validateWhatsAppDocument(doc).some((i) => i.key === 'headerTooLong')).toBe(true);
  });
});

describe('editor store actions', () => {
  beforeEach(() => {
    resetDocument(getEmptyWhatsAppMessage());
  });

  it('addSection inserts in canonical order and enforces one-per-type', () => {
    const buttonsId = addSection('Buttons', { type: 'Buttons', data: { props: { buttons: [] } } })!;
    const headerId = addSection('Header', { type: 'Header', data: { props: { format: 'text', text: 'T' } } })!;
    const doc = editorStateStore.getState().document;
    const root = doc.root;
    const order = (root.type === 'WhatsAppMessage' ? (root.data.childrenIds ?? []) : []).map((id) => doc[id]?.type);
    expect(order).toEqual(['Header', 'Body', 'Buttons']);

    // Second add of an existing type returns the existing id, adds nothing.
    expect(addSection('Header', { type: 'Header', data: {} })).toBe(headerId);
    expect(addSection('Buttons', { type: 'Buttons', data: {} })).toBe(buttonsId);
  });

  it('removeBlock detaches the section and clears selection; root is immovable', () => {
    const headerId = addSection('Header', { type: 'Header', data: { props: { format: 'text' } } })!;
    removeBlock(headerId);
    const doc = editorStateStore.getState().document;
    expect(doc[headerId]).toBeUndefined();
    removeBlock('root');
    expect(editorStateStore.getState().document.root).toBeDefined();
  });

  it('undo/redo restore document snapshots', () => {
    const before = editorStateStore.getState().document;
    addSection('Footer', { type: 'Footer', data: { props: { text: 'fine print' } } });
    const after = editorStateStore.getState().document;
    expect(after).not.toEqual(before);

    undoChange();
    expect(editorStateStore.getState().document).toEqual(before);
    redoChange();
    expect(editorStateStore.getState().document).toEqual(after);
  });

  it('updateBlockData patches a section immutably', () => {
    const footerId = addSection('Footer', { type: 'Footer', data: { props: { text: 'a' } } })!;
    updateBlockData(footerId, (block) => ({ ...block.data, props: { text: 'b' } }));
    const doc = editorStateStore.getState().document;
    const footer = doc[footerId];
    expect(footer.type === 'Footer' && footer.data.props?.text).toBe('b');
  });
});
