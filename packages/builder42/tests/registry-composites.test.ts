import { describe, expect, it } from 'vitest';
import { createNodeTreeForType } from '@/builder/registry/componentRegistry';
import { getDefinition } from '@/builder/registry/componentRegistry';
import { migrateSiteCompositeSlots } from '@/builder/model/migrateSlots';
import { createSiteFromDocument } from '@/builder/model/site';
import { resolveValueOrigin } from '@/builder/inspector/panel/origin';
import { DEFAULT_BREAKPOINTS } from '@/builder/model/types';
import type { BuilderDocument, BuilderNode, NodeId } from '@/builder/model/types';

// Cobertura de la recomposición de `stat`, `quote`, `navbar` y `pricing-card`
// en componentes base (mismo patrón que `testimonial`, ver
// testimonial-composite.test.ts). Cada uno tenía spacing fijo (marginTop/gap)
// en un sub-elemento CSSProperties no editable desde el Inspector.

describe('stat — creación con defaultChildren', () => {
  it('un stat nuevo nace con children [stat-value, text label]', () => {
    const { rootId, nodes } = createNodeTreeForType('stat');
    const root = nodes[rootId]!;
    expect(root.children?.length).toBe(2);
    const [valueId, labelId] = root.children as NodeId[];
    expect(nodes[valueId]?.type).toBe('stat-value');
    expect(nodes[labelId]?.type).toBe('text');
  });

  it('el nodo stat-value lleva el marcador para el behavior count-up (props.value) y su typography es editable', () => {
    const { rootId, nodes } = createNodeTreeForType('stat');
    const root = nodes[rootId]!;
    const [valueId] = root.children as NodeId[];
    const valueNode = nodes[valueId]!;
    expect(valueNode.props.value).toBe('+10k');

    const origin = resolveValueOrigin(
      valueNode.style,
      getDefinition('stat-value')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['typography', 'fontSize'],
    );
    expect(origin.kind).toBe('activeLayer');
  });

  it('el margin antes fijo (LABEL_STYLE.marginTop) ahora es spacing.margin editable en el nodo label', () => {
    const { rootId, nodes } = createNodeTreeForType('stat');
    const root = nodes[rootId]!;
    const [, labelId] = root.children as NodeId[];
    const labelNode = nodes[labelId]!;
    const origin = resolveValueOrigin(
      labelNode.style,
      getDefinition('text')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['spacing', 'margin'],
    );
    expect(origin.kind).toBe('activeLayer');
    expect(origin.kind === 'activeLayer' && origin.value).toBe('4px 0 0 0');
  });
});

describe('stat — migración retrocompatible de nodos legacy', () => {
  it('un stat viejo (props value/label planas, sin children) se expande a children al migrar el sitio', () => {
    const rootId = 'root' as NodeId;
    const statId = 'legacy-stat' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: {
        [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [statId] },
        [statId]: {
          id: statId,
          type: 'stat',
          props: { value: '+10k', label: 'clientes' },
          style: { base: { spacing: { padding: '8px' } } },
        },
      },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const node = page.document.nodes[statId]!;

    expect(node.children?.length).toBe(2);
    expect(node.props).not.toHaveProperty('value');
    expect(node.props).not.toHaveProperty('label');

    const valueNode = page.document.nodes['legacy-stat-value' as NodeId];
    const labelNode = page.document.nodes['legacy-stat-label' as NodeId];
    expect(valueNode?.type).toBe('stat-value');
    expect(valueNode?.props.value).toBe('+10k');
    expect(labelNode?.type).toBe('text');
    expect(labelNode?.props.content).toBe('clientes');
  });
});

describe('quote — creación con defaultChildren', () => {
  it('un quote nuevo nace con children [text content, text attribution]', () => {
    const { rootId, nodes } = createNodeTreeForType('quote');
    const root = nodes[rootId]!;
    expect(root.children?.length).toBe(2);
    const [contentId, attributionId] = root.children as NodeId[];
    expect(nodes[contentId]?.type).toBe('text');
    expect(nodes[attributionId]?.type).toBe('text');
  });

  it('el margin antes fijo (CITE_STYLE.marginTop) ahora es spacing.margin editable en el nodo attribution', () => {
    const { rootId, nodes } = createNodeTreeForType('quote');
    const root = nodes[rootId]!;
    const [, attributionId] = root.children as NodeId[];
    const attributionNode = nodes[attributionId]!;
    const origin = resolveValueOrigin(
      attributionNode.style,
      getDefinition('text')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['spacing', 'margin'],
    );
    expect(origin.kind).toBe('activeLayer');
    expect(origin.kind === 'activeLayer' && origin.value).toBe('12px 0 0 0');
  });
});

describe('quote — migración retrocompatible de nodos legacy', () => {
  it('un quote viejo (props content/attribution planas) se expande a children al migrar el sitio', () => {
    const rootId = 'root' as NodeId;
    const quoteId = 'legacy-quote' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: {
        [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [quoteId] },
        [quoteId]: {
          id: quoteId,
          type: 'quote',
          props: { content: 'Una cita', attribution: 'Autor X' },
          style: { base: {} },
        },
      },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const node = page.document.nodes[quoteId]!;

    expect(node.children?.length).toBe(2);
    const contentNode = page.document.nodes['legacy-quote-content' as NodeId];
    const attributionNode = page.document.nodes['legacy-quote-attribution' as NodeId];
    expect(contentNode?.props.content).toBe('<p>Una cita</p>');
    expect(attributionNode?.props.content).toBe('<cite>— Autor X</cite>');
  });

  it('un quote viejo sin attribution no genera el nodo attribution', () => {
    const rootId = 'root' as NodeId;
    const quoteId = 'legacy-quote-noattr' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: {
        [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [quoteId] },
        [quoteId]: { id: quoteId, type: 'quote', props: { content: 'Solo texto' }, style: { base: {} } },
      },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const node = page.document.nodes[quoteId]!;
    expect(node.children?.length).toBe(1);
    expect(page.document.nodes['legacy-quote-noattr-attribution' as NodeId]).toBeUndefined();
  });
});

describe('navbar — brand como container real', () => {
  it('un navbar nuevo nace con un único hijo container (brand) que a su vez tiene un text de logo', () => {
    const { rootId, nodes } = createNodeTreeForType('navbar');
    const root = nodes[rootId]!;
    expect(root.children?.length).toBe(1);
    const [brandId] = root.children as NodeId[];
    const brandNode = nodes[brandId]!;
    expect(brandNode.type).toBe('container');
    expect(brandNode.children?.length).toBe(1);
    expect(nodes[(brandNode.children as NodeId[])[0]!]?.type).toBe('text');
  });

  it('el gap antes fijo (.pb-navbar__brand) ahora es layout.gap editable en el container brand', () => {
    const { rootId, nodes } = createNodeTreeForType('navbar');
    const root = nodes[rootId]!;
    const [brandId] = root.children as NodeId[];
    const brandNode = nodes[brandId]!;
    const origin = resolveValueOrigin(
      brandNode.style,
      getDefinition('container')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['layout', 'gap'],
    );
    expect(origin.kind).toBe('activeLayer');
    expect(origin.kind === 'activeLayer' && origin.value).toBe('8px');
  });
});

describe('navbar — migración retrocompatible de logo suelto (legacy)', () => {
  it('envuelve children sueltos (logo directo, formato viejo) en un nuevo container', () => {
    const rootId = 'root' as NodeId;
    const navbarId = 'legacy-navbar' as NodeId;
    const logoId = 'legacy-navbar-logo' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: {
        [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [navbarId] },
        [navbarId]: {
          id: navbarId,
          type: 'navbar',
          props: { hiddenPageIds: [] },
          style: { base: {} },
          children: [logoId],
        },
        [logoId]: { id: logoId, type: 'text', props: { content: 'Mi Logo' }, style: { base: {} } },
      },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const navbarNode = page.document.nodes[navbarId]!;

    expect(navbarNode.children?.length).toBe(1);
    const brandNode = page.document.nodes['legacy-navbar-brand' as NodeId];
    expect(brandNode?.type).toBe('container');
    expect(brandNode?.children).toEqual([logoId]);
    // El logo original conserva su id/props intactos, solo cambia de padre.
    expect(page.document.nodes[logoId]?.props.content).toBe('Mi Logo');
  });

  it('un navbar sin children (sin logo aún) no se toca', () => {
    const rootId = 'root' as NodeId;
    const navbarId = 'empty-navbar' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: {
        [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [navbarId] },
        [navbarId]: { id: navbarId, type: 'navbar', props: { hiddenPageIds: [] }, style: { base: {} } },
      },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    expect(migrated).toBe(site);
  });

  it('un navbar ya migrado (children = [container]) no se vuelve a envolver (idempotente)', () => {
    const { rootId: navRootId, nodes: navNodes } = createNodeTreeForType('navbar');
    const navbarNode = navNodes[navRootId]!;
    const rootId = 'root' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: { [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [navRootId] }, ...navNodes },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    expect(migrated).toBe(site);
    expect(navbarNode.children?.length).toBe(1);
  });
});

describe('pricing-card — creación con defaultChildren', () => {
  it('nace con [badge, plan, price-row[price,period], features[...], cta]', () => {
    const { rootId, nodes } = createNodeTreeForType('pricing-card');
    const root = nodes[rootId]!;
    expect(root.children?.length).toBe(5);
    const [badgeId, planId, priceRowId, featuresId, ctaId] = root.children as NodeId[];
    expect(nodes[badgeId]?.type).toBe('text');
    expect(nodes[planId]?.type).toBe('text');
    expect(nodes[priceRowId]?.type).toBe('container');
    expect(nodes[featuresId]?.type).toBe('container');
    expect(nodes[ctaId]?.type).toBe('button');

    const priceRow = nodes[priceRowId]!;
    expect(priceRow.children?.length).toBe(2);
    expect(nodes[(priceRow.children as NodeId[])[0]!]?.type).toBe('text');

    const features = nodes[featuresId]!;
    expect(features.children?.length).toBe(3);
    for (const featureId of features.children as NodeId[]) {
      expect(nodes[featureId]?.type).toBe('container');
    }
  });

  it('el margin antes fijo (CTA_STYLE.marginTop) ahora es spacing.margin editable en el botón CTA', () => {
    const { rootId, nodes } = createNodeTreeForType('pricing-card');
    const root = nodes[rootId]!;
    const ctaId = (root.children as NodeId[])[4]!;
    const ctaNode = nodes[ctaId]!;
    const origin = resolveValueOrigin(
      ctaNode.style,
      getDefinition('button')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['spacing', 'margin'],
    );
    expect(origin.kind).toBe('activeLayer');
    expect(origin.kind === 'activeLayer' && origin.value).toBe('8px 0 0 0');
  });
});

describe('pricing-card — migración retrocompatible de nodos legacy', () => {
  function legacyDoc(popular: boolean): BuilderDocument {
    const rootId = 'root' as NodeId;
    const cardId = 'legacy-card' as NodeId;
    return {
      rootId,
      nodes: {
        [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [cardId] },
        [cardId]: {
          id: cardId,
          type: 'pricing-card',
          props: {
            planName: 'Pro',
            price: '$29',
            period: '/mes',
            features: 'Feature A\nFeature B\nFeature C',
            ctaLabel: 'Empezar',
            ctaLink: { kind: 'external', href: '#' },
            popular,
            popularLabel: 'Popular',
          },
          style: { base: {} },
        },
      },
    };
  }

  it('migra features multilínea a un nodo por feature', () => {
    const site = createSiteFromDocument(legacyDoc(true));
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const node = page.document.nodes['legacy-card' as NodeId]!;

    expect(node.props).not.toHaveProperty('features');
    expect(node.props).not.toHaveProperty('planName');

    const featuresContainer = node.children
      ?.map((id) => page.document.nodes[id]!)
      .find((n) => n.type === 'container' && (n.children?.length ?? 0) === 3);
    expect(featuresContainer).toBeDefined();
  });

  it('omite el nodo badge si popular era false (no introduce un elemento visual nuevo)', () => {
    const site = createSiteFromDocument(legacyDoc(false));
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const node = page.document.nodes['legacy-card' as NodeId]!;

    // plan/price-row/features/cta deben existir igual; badge es el único ausente.
    expect(node.children?.length).toBe(4);
    expect(page.document.nodes['legacy-card-badge' as NodeId]).toBeUndefined();
  });
});
