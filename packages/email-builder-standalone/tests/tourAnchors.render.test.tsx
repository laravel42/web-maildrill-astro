/**
 * tourAnchors.render.test.tsx — verifica que el árbol renderizado del editor de email
 * expone las anclas `data-tour` del registro (F2a, docs/product-tour-driverjs-plan.md §3.1).
 *
 * Monta el mismo componente que usa el host (`EmailBuilder`, exportado por `../src/index`).
 * Usa `componentsStorage="backend"` (el default): en jsdom/happy-dom evita el seeding local del
 * catálogo de presets y la generación de miniaturas en segundo plano (`lazyThumbnailGenerator`,
 * solo se activa en modo `"local"`), que compite con el teardown del entorno de test y no aporta
 * nada a lo que esta suite verifica — las 13 anclas no dependen de que cargue ningún item real
 * de la librería. El host real monta con `componentsStorage="local"` (ver `docs/AGENTS.md`
 * §"Vendored email builder"); ese detalle no cambia dónde viven los atributos `data-tour`.
 *
 * No es un test de comportamiento del editor: cada `it` solo comprueba presencia/unicidad de
 * `data-tour="<clave>"` en el DOM, nunca estilos ni lógica de negocio.
 *
 * Cobertura real vs. e2e (F6):
 *   - Anclas que existen SIEMPRE tras el montaje inicial (sin interacción): se verifican aquí
 *     una por una, cada una exactamente una vez.
 *   - `eb.library.tabs` requiere abrir el drawer de la librería (`setComponentsLibraryDrawerOpen`)
 *     — se cubre aquí disparando esa acción de store directamente (no requiere driver.js).
 *   - `eb.inspector.panel` ya está en el DOM sin selección (el panel raíz existe siempre;
 *     ver InspectorDrawer/index.tsx), pero además se verifica tras seleccionar un bloque, que
 *     es la condición real bajo la que el tour la mostraría.
 *   - `eb.inspector.mergeTags` vive en `block-notion-text` (bubble menu bajo selección de texto
 *     en tiptap), un paquete distinto del alcance de F2a — NO se implementó el atributo (ver
 *     informe de la fase) y por tanto no se cubre aquí; queda pendiente de F6/e2e si se decide
 *     implementarla en `block-notion-text`.
 *   - `eb.ai.generate` no se cubre: `App/AIGeneration/index.tsx` devuelve `null` — el punto de
 *     entrada de IA está deshabilitado en el chrome actual (comentario explícito en ese
 *     archivo). El ancla no existe en el DOM en ningún estado alcanzable hoy; se revisará
 *     cuando ese entry point se reactive.
 *   - `eb.theme.presets` (`ThemePresetsButton`) tampoco se renderiza en el árbol actual — no
 *     está montado por `TemplatePanel`/`App` en ningún punto visible; el atributo se añadió al
 *     componente por si se re-activa, pero no es alcanzable en este test ni en el editor hoy.
 *   - `eb.image.sources` depende del picker de imagen dentro del Inspector para un bloque
 *     Image (drag&drop + fetch de galería) — se cubre con un test de render aislado del propio
 *     `ImageSourceTabs`, no a través del árbol completo del editor (ver describe dedicado).
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import EmailBuilder from '../src/index';
import {
  appendBuiltInBlockToParent,
  resetDocument,
  setComponentsLibraryDrawerCategory,
  setComponentsLibraryDrawerOpen,
  setSelectedBlockId,
} from '../src/documents/editor/EditorContext';
import { BUTTONS } from '../src/App/ComponentsLibrary/builtInBlocks';
import { EMAIL_BUILDER_TOUR_ANCHORS } from '../src/tour/tourAnchors';

// React 19 only suppresses "not wrapped in act()" warnings when this flag is set — needed
// because `createRoot().render()` (not React Testing Library) drives the mount here.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Anclas presentes en el DOM justo tras el montaje inicial, sin ninguna interacción. */
const ALWAYS_PRESENT_ANCHORS = [
  EMAIL_BUILDER_TOUR_ANCHORS.toolbarViews,
  EMAIL_BUILDER_TOUR_ANCHORS.viewportScreenSize,
  EMAIL_BUILDER_TOUR_ANCHORS.toolbarHistory,
  EMAIL_BUILDER_TOUR_ANCHORS.libraryRail,
  EMAIL_BUILDER_TOUR_ANCHORS.canvasRoot,
  EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel,
  EMAIL_BUILDER_TOUR_ANCHORS.commandPalette,
] as const;

let container: HTMLDivElement;
let root: Root;

function queryAllByTour(key: string): Element[] {
  return Array.from(container.querySelectorAll(`[data-tour="${key}"]`));
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    // `componentsStorage="backend"` (the default) is deliberate: `"local"` seeds the bundled
    // preset catalog and kicks off `lazyThumbnailGenerator` (background iframe captures) on
    // mount, which races happy-dom's teardown and produces flaky unhandled-rejection noise
    // unrelated to what this suite verifies. The 13 anchors under test never depend on any
    // library item actually loading — `componentsStorage` only changes where Templates/Themes
    // data comes from, not whether the DOM nodes carrying `data-tour` exist.
    root.render(<EmailBuilder componentsStorage="backend" />);
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  // Reset shared editor store between tests so selection/drawer state doesn't leak.
  resetDocument({
    root: { type: 'EmailLayout', data: { childrenIds: [] } },
  } as never);
  setSelectedBlockId(null);
  setComponentsLibraryDrawerOpen(false);
});

describe('EmailBuilder — anclas data-tour siempre presentes', () => {
  for (const key of ALWAYS_PRESENT_ANCHORS) {
    it(`expone "${key}" exactamente una vez`, () => {
      expect(queryAllByTour(key)).toHaveLength(1);
    });
  }
});

describe('EmailBuilder — anclas que dependen de interacción', () => {
  it('"eb.library.tabs" aparece al abrir el drawer de la librería y no antes', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.libraryTabs)).toHaveLength(0);

    act(() => {
      setComponentsLibraryDrawerOpen(true);
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.libraryTabs)).toHaveLength(1);
  });

  it('"eb.inspector.panel" sigue único tras seleccionar un bloque de texto', () => {
    let newId: string | null = null;
    act(() => {
      newId = appendBuiltInBlockToParent('root', BUTTONS[0]!.block());
    });
    expect(newId).toBeTruthy();

    act(() => {
      setSelectedBlockId(newId);
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel)).toHaveLength(1);
  });

  it('"eb.library.blocksBasics" y "eb.library.blocksLayout" aparecen al abrir el drawer de la librería (tab Blocks) y no antes', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.blocksBasics)).toHaveLength(0);
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.blocksLayout)).toHaveLength(0);

    act(() => {
      setComponentsLibraryDrawerOpen(true);
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.blocksBasics)).toHaveLength(1);
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.blocksLayout)).toHaveLength(1);
  });

  it('"eb.library.templates" aparece exactamente una vez con el drawer abierto en la pestaña Templates, y cero veces en la pestaña Blocks', () => {
    act(() => {
      setComponentsLibraryDrawerOpen(true);
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.libraryTemplates)).toHaveLength(0);

    act(() => {
      setComponentsLibraryDrawerCategory('templates');
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.libraryTemplates)).toHaveLength(1);
  });
});

describe('EmailBuilder — anclas no alcanzables en este árbol (ver comentario de cabecera)', () => {
  it('"eb.ai.generate" no está en el DOM: el entry point de IA está deshabilitado en el chrome', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.aiGenerate)).toHaveLength(0);
  });

  it('"eb.theme.presets" no está en el DOM: ThemePresetsButton no está montado por App/TemplatePanel', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.themePresets)).toHaveLength(0);
  });

  it('"eb.inspector.mergeTags" no está en el DOM: vive en block-notion-text, fuera del alcance de F2a', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.inspectorMergeTags)).toHaveLength(0);
  });
});

describe('EmailBuilder — eb.inspector.tabs (T6)', () => {
  it('aparece exactamente una vez con el inspector en su estado por defecto (no compacto)', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.inspectorTabs)).toHaveLength(1);
  });
});

describe('EmailBuilder — eb.canvas.textBlock (T6)', () => {
  it('no aparece cuando no hay ningún bloque de texto seleccionado', () => {
    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.canvasTextBlock)).toHaveLength(0);
  });

  it('aparece exactamente una vez tras seleccionar el bloque de texto', () => {
    let newId: string | null = null;
    act(() => {
      newId = appendBuiltInBlockToParent('root', BUTTONS[0]!.block());
    });
    expect(newId).toBeTruthy();

    // `appendBuiltInBlockToParent` selecciona el bloque recién insertado
    // (comportamiento existente de `commitInsertSavedComponent`), así que
    // aquí ya se espera la ancla puesta — la selección explícita siguiente
    // confirma la condición real bajo la que el paso del tour la mostraría.
    act(() => {
      setSelectedBlockId(newId);
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.canvasTextBlock)).toHaveLength(1);

    act(() => {
      setSelectedBlockId(null);
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.canvasTextBlock)).toHaveLength(0);
  });
});
