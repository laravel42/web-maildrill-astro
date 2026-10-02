/**
 * builtInBlockGroups.test.ts — verifica `groupBuiltInBlockIndices` (D32), la función pura que
 * parte los índices ORIGINALES de `BUTTONS` en los grupos "Basics" y "Structure" que renderiza
 * `BlocksCategoryContent.tsx`.
 *
 * No monta React ni el DOM: sólo ejercita la función contra `BUTTONS` real y contra entradas
 * sintéticas, incluyendo la propiedad de partición (unión ordenada == todos los índices, sin
 * duplicados) y el caso de una etiqueta desconocida, que debe caer en `basics`.
 */
import { describe, expect, it } from 'vitest';

import { BUTTONS } from '../src/App/ComponentsLibrary/builtInBlocks';
import {
  BASICS_BLOCK_ORDER,
  groupBuiltInBlockIndices,
  LAYOUT_BLOCK_LABELS,
} from '../src/App/ComponentsLibrary/BlocksCategoryContent';

describe('groupBuiltInBlockIndices — contra BUTTONS real', () => {
  it('exporta la membresía de grupo fijada por el contrato (D32)', () => {
    expect(LAYOUT_BLOCK_LABELS).toEqual(['Columns', 'Container']);
    expect(BASICS_BLOCK_ORDER).toEqual(['Text', 'Image', 'Button', 'Divider', 'Spacer', 'Social']);
  });

  it('BUTTONS está ordenado como asume este test: Text, Social, Button, Image, Divider, Spacer, Columns, Container', () => {
    expect(BUTTONS.map((b) => b.label)).toEqual([
      'Text',
      'Social',
      'Button',
      'Image',
      'Divider',
      'Spacer',
      'Columns',
      'Container',
    ]);
  });

  it('devuelve los índices ORIGINALES esperados para basics y layout', () => {
    const { basics, layout } = groupBuiltInBlockIndices(BUTTONS);

    // Índices originales: 0 Text, 1 Social, 2 Button, 3 Image, 4 Divider, 5 Spacer, 6 Columns,
    // 7 Container. Basics sigue el orden de lectura explícito (Text, Image, Button, Divider,
    // Spacer, Social) — no el orden relativo en BUTTONS.
    expect(basics).toEqual([0, 3, 2, 4, 5, 1]);
    // Structure: Columns (6) luego Container (7).
    expect(layout).toEqual([6, 7]);
  });

  it('no pierde ni duplica ningún índice de BUTTONS', () => {
    const { basics, layout } = groupBuiltInBlockIndices(BUTTONS);
    const union = [...basics, ...layout].sort((a, b) => a - b);
    expect(union).toEqual(BUTTONS.map((_, index) => index));
    expect(new Set(union).size).toBe(union.length);
  });
});

describe('groupBuiltInBlockIndices — propiedad de partición contra entradas sintéticas', () => {
  const cases: { name: string; buttons: { label: string }[] }[] = [
    { name: 'vacío', buttons: [] },
    { name: 'sólo básicos', buttons: [{ label: 'Text' }, { label: 'Spacer' }] },
    { name: 'sólo estructurales', buttons: [{ label: 'Container' }, { label: 'Columns' }] },
    {
      name: 'mezcla en orden inverso al contrato',
      buttons: [
        { label: 'Container' },
        { label: 'Social' },
        { label: 'Columns' },
        { label: 'Text' },
      ],
    },
    {
      name: 'con una etiqueta desconocida en medio',
      buttons: [{ label: 'Text' }, { label: 'MysteryBlock' }, { label: 'Columns' }],
    },
  ];

  for (const { name, buttons } of cases) {
    it(`partición completa sin pérdidas ni duplicados — ${name}`, () => {
      const { basics, layout } = groupBuiltInBlockIndices(buttons);
      const union = [...basics, ...layout].sort((a, b) => a - b);
      const expectedIndices = buttons.map((_, index) => index);

      expect(union).toEqual(expectedIndices);
      expect(new Set(union).size).toBe(union.length);
    });
  }

  it('layout mantiene el orden de LAYOUT_BLOCK_LABELS aunque BUTTONS lo dé al revés', () => {
    const buttons = [{ label: 'Container' }, { label: 'Columns' }];
    const { layout } = groupBuiltInBlockIndices(buttons);
    // buttons[0] = Container, buttons[1] = Columns; LAYOUT_BLOCK_LABELS = ['Columns', 'Container']
    expect(layout).toEqual([1, 0]);
  });

  it('basics respeta BASICS_BLOCK_ORDER aunque BUTTONS lo dé desordenado', () => {
    const buttons = [{ label: 'Social' }, { label: 'Text' }, { label: 'Spacer' }];
    const { basics } = groupBuiltInBlockIndices(buttons);
    // Orden esperado: Text (índice 1), Spacer (índice 2), Social (índice 0)
    expect(basics).toEqual([1, 2, 0]);
  });

  it('una etiqueta desconocida (futuro 9º bloque) cae en basics, no desaparece', () => {
    const buttons = [{ label: 'Text' }, { label: 'MysteryBlock' }, { label: 'Columns' }];
    const { basics, layout } = groupBuiltInBlockIndices(buttons);

    expect(layout).toEqual([2]);
    expect(basics).toContain(1);
    expect(basics).toEqual([0, 1]);
  });

  it('un array vacío devuelve ambos grupos vacíos', () => {
    expect(groupBuiltInBlockIndices([])).toEqual({ basics: [], layout: [] });
  });
});
