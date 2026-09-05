import { describe, expect, it } from 'vitest';
import {
  ALWAYS_VISIBLE_ADVANCED_ROW_IDS,
  modifiedCountAt,
  PANEL_SECTIONS,
  rowIsRenderable,
  rowsFor,
  sectionsForNode,
} from '@/builder/inspector/panel/sections';
import type { BuilderNode } from '@/builder/model/types';

// docs/54 §2 H1 + §6: cobertura de las funciones puras de `sections.ts`.
// Antes de este commit el paquete no tenía ningún test para
// `sectionsForNode`/`rowsFor`/`modifiedCountAt`/`rowIsRenderable` a pesar de
// que `sections.ts` cita "se verifica mecánicamente en sections.test.ts" (un
// archivo que no existía) — este es ese archivo.

function makeNode(style: BuilderNode['style']): BuilderNode {
  return {
    id: 'n1' as BuilderNode['id'],
    type: 'container',
    props: {},
    style,
  } as BuilderNode;
}

describe('rowIsRenderable', () => {
  it('accepts every row declared in PANEL_SECTIONS (all fields exist in STYLE_FIELDS today)', () => {
    for (const section of PANEL_SECTIONS) {
      for (const row of section.rows) {
        expect(rowIsRenderable(row)).toBe(true);
      }
    }
  });
});

describe('sectionsForNode', () => {
  it('returns all 6 sections when every group is enabled', () => {
    const sections = sectionsForNode(['layout', 'spacing', 'size', 'typography', 'appearance']);
    expect(sections.map((s) => s.id)).toEqual(['layout', 'spacing', 'size', 'typography', 'appearance', 'effects']);
  });

  it('omits a section entirely when none of its groups are enabled', () => {
    const sections = sectionsForNode(['spacing']);
    expect(sections.map((s) => s.id)).toEqual(['spacing']);
  });

  it('filters rows by enabled groups within a presentation section (typography touches typography+appearance)', () => {
    // Solo `typography` habilitado: `typography.color` (que vive en
    // `appearance.color`, D5) debe desaparecer de la sección.
    const sections = sectionsForNode(['typography']);
    const typographySection = sections.find((s) => s.id === 'typography');
    expect(typographySection?.rows.some((r) => r.id === 'typography.color')).toBe(false);
    expect(typographySection?.rows.some((r) => r.id === 'typography.fontSize')).toBe(true);
  });
});

describe('rowsFor', () => {
  it('separates common and advanced rows for the layout section', () => {
    const layout = PANEL_SECTIONS.find((s) => s.id === 'layout')!;
    const common = rowsFor(layout, 'common');
    const advanced = rowsFor(layout, 'advanced');
    expect(common.every((r) => r.tier === 'common')).toBe(true);
    expect(advanced.every((r) => r.tier === 'advanced')).toBe(true);
    expect(common.some((r) => r.id === 'layout.display')).toBe(true);
    expect(advanced.some((r) => r.id === 'layout.overflow')).toBe(true);
  });
});

describe('ALWAYS_VISIBLE_ADVANCED_ROW_IDS', () => {
  it('lists exactly the 3 rows with their own simple-mode control/visibility logic', () => {
    expect(ALWAYS_VISIBLE_ADVANCED_ROW_IDS).toEqual([
      'layout.gridColumns',
      'effects.boxShadow',
      'appearance.border',
    ]);
  });
});

describe('modifiedCountAt', () => {
  const spacingSection = PANEL_SECTIONS.find((s) => s.id === 'spacing')!;
  const layoutSection = PANEL_SECTIONS.find((s) => s.id === 'layout')!;

  it('counts fields declared in the active breakpoint layer', () => {
    const node = makeNode({ base: { spacing: { padding: '8px' } } });
    expect(modifiedCountAt(node, spacingSection, 'base')).toBe(1);
  });

  it('does not count values declared only in base when the active breakpoint is different (no cascade)', () => {
    const node = makeNode({ base: { spacing: { padding: '8px' } } });
    expect(modifiedCountAt(node, spacingSection, 'md')).toBe(0);
  });

  it('returns 0 for a node with no style declared at all', () => {
    const node = makeNode({ base: {} });
    expect(modifiedCountAt(node, spacingSection, 'base')).toBe(0);
  });

  describe('H1 fix — isSimple excludes hidden advanced rows from the count', () => {
    it('counts an advanced+hidden field in advanced mode (isSimple=false, default)', () => {
      // layout.overflowX/Y -> fila "layout.overflow", tier "advanced", NO
      // está en ALWAYS_VISIBLE_ADVANCED_ROW_IDS -> oculta en modo simple.
      const node = makeNode({ base: { layout: { overflowX: 'scroll' } } });
      expect(modifiedCountAt(node, layoutSection, 'base', false)).toBe(1);
    });

    it('does NOT count that same field in simple mode (isSimple=true) — matches badge to what is visible', () => {
      const node = makeNode({ base: { layout: { overflowX: 'scroll' } } });
      expect(modifiedCountAt(node, layoutSection, 'base', true)).toBe(0);
    });

    it('still counts fields from ALWAYS_VISIBLE_ADVANCED_ROW_IDS rows in simple mode (e.g. layout.gridColumns)', () => {
      const node = makeNode({ base: { layout: { gridTemplateColumns: 'repeat(2, 1fr)' } } });
      expect(modifiedCountAt(node, layoutSection, 'base', true)).toBe(1);
      expect(modifiedCountAt(node, layoutSection, 'base', false)).toBe(1);
    });

    it('common-tier fields are always counted regardless of isSimple', () => {
      const node = makeNode({ base: { layout: { display: 'grid' } } });
      expect(modifiedCountAt(node, layoutSection, 'base', true)).toBe(1);
      expect(modifiedCountAt(node, layoutSection, 'base', false)).toBe(1);
    });

    it('defaults isSimple to false when the 4th argument is omitted (backwards compatible)', () => {
      const node = makeNode({ base: { layout: { overflowX: 'scroll' } } });
      expect(modifiedCountAt(node, layoutSection, 'base')).toBe(1);
    });
  });
});
