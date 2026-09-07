import { describe, expect, it } from 'vitest';
import { createNodeTreeForType } from '@/builder/registry/componentRegistry';
import { getDefinition } from '@/builder/registry/componentRegistry';
import { migrateSiteCompositeSlots } from '@/builder/model/migrateSlots';
import { createSiteFromDocument } from '@/builder/model/site';
import { resolveValueOrigin } from '@/builder/inspector/panel/origin';
import { DEFAULT_BREAKPOINTS } from '@/builder/model/types';
import type { BuilderDocument, BuilderNode, NodeId } from '@/builder/model/types';

// Cobertura de la recomposición de `testimonial` en componentes base
// (container/text/avatar) en vez de sub-elementos con CSS fijo. El bug
// original: el espacio entre la cita y el bloque de avatar/nombre vivía en un
// `marginTop` fijo no editable (`CAPTION_STYLE`) — el Inspector mostraba
// `margin: 0` en la raíz (correcto) mientras el usuario veía un espacio real
// que no podía tocar. Estos tests verifican que ese margin ahora es un
// `spacing.margin` real y editable en un nodo hijo (`testimonial-caption`).

describe('testimonial — creación con defaultChildren', () => {
  it('un testimonial nuevo nace con children (quote + caption[avatar, author[name, role]])', () => {
    const { rootId, nodes } = createNodeTreeForType('testimonial');
    const root = nodes[rootId];
    expect(root?.type).toBe('testimonial');
    expect(root?.children?.length).toBe(2);

    const [quoteId, captionId] = root!.children as NodeId[];
    expect(nodes[quoteId]?.type).toBe('text');
    expect(nodes[captionId]?.type).toBe('container');

    const caption = nodes[captionId]!;
    const [avatarId, authorId] = caption.children as NodeId[];
    expect(nodes[avatarId]?.type).toBe('avatar');
    expect(nodes[authorId]?.type).toBe('container');

    const author = nodes[authorId]!;
    const [nameId, roleId] = author.children as NodeId[];
    expect(nodes[nameId]?.type).toBe('text');
    expect(nodes[roleId]?.type).toBe('text');
  });

  it('el margin antes fijo (CAPTION_STYLE.marginTop) ahora es spacing.margin real y editable en el nodo caption', () => {
    const { rootId, nodes } = createNodeTreeForType('testimonial');
    const root = nodes[rootId]!;
    const [, captionId] = root.children as NodeId[];
    const caption = nodes[captionId]!;

    // El bug reportado: el Inspector debe poder leer un margin ≠ 0 declarado
    // EN LA CAPA ACTIVA del nodo (activeLayer), no heredado/default — eso es
    // justo lo que permite editarlo y que el botón de reset se active.
    const origin = resolveValueOrigin(
      caption.style,
      getDefinition('container')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['spacing', 'margin'],
    );
    expect(origin.kind).toBe('activeLayer');
    expect(origin.kind === 'activeLayer' && origin.value).toBe('16px 0 0 0');
  });

  it('la raíz del testimonial sigue teniendo margin:0 (comportamiento correcto, no confundir con el margin del caption)', () => {
    const { rootId, nodes } = createNodeTreeForType('testimonial');
    const root = nodes[rootId]!;
    const origin = resolveValueOrigin(
      root.style,
      getDefinition('testimonial')?.defaultStyle,
      'base',
      DEFAULT_BREAKPOINTS,
      ['spacing', 'margin'],
    );
    expect(origin.kind).toBe('activeLayer');
    expect(origin.kind === 'activeLayer' && origin.value).toBe('0');
  });
});

describe('testimonial — migración retrocompatible de nodos legacy', () => {
  function legacyDocument(): BuilderDocument {
    const rootId = 'root' as NodeId;
    const testimonialId = 'legacy-testimonial' as NodeId;
    const nodes: Record<NodeId, BuilderNode> = {
      [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} }, children: [testimonialId] },
      [testimonialId]: {
        id: testimonialId,
        type: 'testimonial',
        props: { quote: 'Excelente servicio', name: 'Juan Pérez', role: 'Cliente', initials: 'JP' },
        style: { base: { spacing: { padding: '24px', margin: '0' } } },
      },
    };
    return { rootId, nodes };
  }

  it('un testimonial viejo (props planas, sin children) se expande a children al migrar el sitio', () => {
    const site = createSiteFromDocument(legacyDocument());
    const migrated = migrateSiteCompositeSlots(site);
    const page = Object.values(migrated.pages)[0]!;
    const node = page.document.nodes['legacy-testimonial' as NodeId]!;

    expect(node.children?.length).toBe(2);
    expect(node.props).not.toHaveProperty('quote');
    expect(node.props).not.toHaveProperty('name');
    expect(node.props).not.toHaveProperty('role');
    expect(node.props).not.toHaveProperty('initials');

    const quoteNode = page.document.nodes['legacy-testimonial-quote' as NodeId];
    const captionNode = page.document.nodes['legacy-testimonial-caption' as NodeId];
    const avatarNode = page.document.nodes['legacy-testimonial-avatar' as NodeId];
    const authorNode = page.document.nodes['legacy-testimonial-author' as NodeId];
    const nameNode = page.document.nodes['legacy-testimonial-name' as NodeId];
    const roleNode = page.document.nodes['legacy-testimonial-role' as NodeId];

    expect(quoteNode?.props.content).toBe('<p>Excelente servicio</p>');
    expect(avatarNode?.props.initials).toBe('JP');
    expect(nameNode?.props.content).toBe('<strong>Juan Pérez</strong>');
    expect(roleNode?.props.content).toBe('Cliente');
    expect(captionNode?.type).toBe('container');
    expect(authorNode?.type).toBe('container');
  });

  it('es idempotente: un testimonial ya migrado (con children) no se vuelve a migrar', () => {
    const site = createSiteFromDocument(legacyDocument());
    const migratedOnce = migrateSiteCompositeSlots(site);
    const migratedTwice = migrateSiteCompositeSlots(migratedOnce);
    // Misma referencia: `migrateSiteCompositeSlots` devuelve el mismo `site`
    // si no hay nada que migrar (P7, ver migrateSlots.ts).
    expect(migratedTwice).toBe(migratedOnce);
  });

  it('no toca sitios sin ningún testimonial legacy (referencia estable)', () => {
    const rootId = 'root' as NodeId;
    const doc: BuilderDocument = {
      rootId,
      nodes: { [rootId]: { id: rootId, type: 'container', props: {}, style: { base: {} } } },
    };
    const site = createSiteFromDocument(doc);
    const migrated = migrateSiteCompositeSlots(site);
    expect(migrated).toBe(site);
  });
});
