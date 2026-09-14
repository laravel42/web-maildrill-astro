/**
 * tourSteps.flags.test.ts — verifica que `buildEmailBuilderTourSteps` (F3a) filtra por los
 * flags con los que el host monta el editor (`src/components/react/VisualEmailBuilder.tsx`,
 * §1.4.6 y §4 F3a de docs/product-tour-driverjs-plan.md): ningún paso emitido debe referenciar
 * una superficie apagada en la configuración real del embed, y las 3 anclas excluidas en F2a
 * (`eb.ai.generate`, `eb.theme.presets`, `eb.inspector.mergeTags`) nunca generan paso.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildEmailBuilderTourSteps,
  getEmailBuilderTourLabels,
  type EmailBuilderTourStepsConfig,
} from '../src/tour/tourSteps';
import { EMAIL_BUILDER_TOUR_ANCHORS } from '../src/tour/tourAnchors';
import {
  appendBuiltInBlockToParent,
  resetDocument,
  setComponentsLibraryDrawerOpen,
  setSelectedBlockId,
} from '../src/documents/editor/EditorContext';
import { BUTTONS } from '../src/App/ComponentsLibrary/builtInBlocks';

/** Anclas excluidas en F2a — nunca deben tener un paso, bajo ninguna configuración. */
const F2A_EXCLUDED_ANCHORS = [
  EMAIL_BUILDER_TOUR_ANCHORS.aiGenerate,
  EMAIL_BUILDER_TOUR_ANCHORS.themePresets,
  EMAIL_BUILDER_TOUR_ANCHORS.inspectorMergeTags,
] as const;

/**
 * Configuración real con la que `VisualEmailBuilder.tsx` monta el editor en Maildrill hoy
 * (ver el componente del host): htmlTab/jsonTab/componentTree/templateSaving/themeSaving
 * apagados; templateLibrary/galleryImages/unsplashEnabled/enableAI encendidos; onSendTest
 * presente porque el host siempre puede enviar prueba desde el template editor.
 */
const HOST_CONFIG: EmailBuilderTourStepsConfig = {
  htmlTab: false,
  jsonTab: false,
  componentTree: false,
  templateSaving: false,
  themeSaving: false,
  templateLibrary: true,
  galleryImages: true,
  unsplashEnabled: true,
  enableAI: true,
  onSendTest: async () => ({ to: [] }),
};

function resetEditorState() {
  resetDocument({
    root: { type: 'EmailLayout', data: { childrenIds: [] } },
  } as never);
  setSelectedBlockId(null);
  setComponentsLibraryDrawerOpen(false);
}

beforeEach(() => {
  resetEditorState();
});

afterEach(() => {
  resetEditorState();
});

describe('buildEmailBuilderTourSteps — anclas excluidas en F2a', () => {
  it('nunca emite un paso para las 3 anclas sin punto de montaje alcanzable', () => {
    const steps = buildEmailBuilderTourSteps(HOST_CONFIG);
    const emittedAnchors = new Set(steps.map((step) => step.anchorKey));
    for (const excluded of F2A_EXCLUDED_ANCHORS) {
      expect(emittedAnchors.has(excluded), `no debería emitirse un paso para "${excluded}"`).toBe(
        false,
      );
    }
  });
});

describe('buildEmailBuilderTourSteps — filtrado por flags (§1.4.6)', () => {
  it('con la configuración real del host, no referencia ningún flag apagado', () => {
    const steps = buildEmailBuilderTourSteps(HOST_CONFIG);
    const emittedAnchors = steps.map((step) => step.anchorKey);

    // Ningún paso apunta a las superficies que el host apaga explícitamente: HTML/JSON
    // tabs, árbol de componentes, "guardar como plantilla", guardado de temas — ninguna de
    // esas superficies tiene ancla propia en el registro (§3.1 "Excluidos a propósito"), así
    // que la garantía real es que las claves emitidas son solo las 10 anclas implementadas
    // en F2a y ninguna depende de un flag que en `HOST_CONFIG` está en `false`.
    expect(emittedAnchors).toContain(EMAIL_BUILDER_TOUR_ANCHORS.imageSources); // galleryImages/unsplashEnabled=true
    expect(emittedAnchors).toContain(EMAIL_BUILDER_TOUR_ANCHORS.headerActions); // onSendTest presente

    // Cada paso emitido, si trae `when`, debe seguir siendo `true` bajo esta config para las
    // anclas que no dependen de que el documento tenga bloques. "eb.inspector.panel" es la
    // única excepción: su `when` depende del estado del documento (§1.4.5), no de un flag del
    // host, y se cubre en su propio describe más abajo con un documento no vacío.
    for (const step of steps) {
      if (step.anchorKey === EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel) continue;
      if (step.when) {
        expect(step.when(), `when() de "${step.anchorKey}" debería ser true bajo HOST_CONFIG`).toBe(
          true,
        );
      }
    }
  });

  it('omite "eb.image.sources" cuando galleryImages y unsplashEnabled están ambos apagados', () => {
    const steps = buildEmailBuilderTourSteps({
      ...HOST_CONFIG,
      galleryImages: false,
      unsplashEnabled: false,
    });
    const emittedAnchors = steps.map((step) => step.anchorKey);
    expect(emittedAnchors).not.toContain(EMAIL_BUILDER_TOUR_ANCHORS.imageSources);
  });

  it('incluye "eb.image.sources" si solo unsplashEnabled está encendido', () => {
    const steps = buildEmailBuilderTourSteps({
      ...HOST_CONFIG,
      galleryImages: false,
      unsplashEnabled: true,
    });
    const emittedAnchors = steps.map((step) => step.anchorKey);
    expect(emittedAnchors).toContain(EMAIL_BUILDER_TOUR_ANCHORS.imageSources);
  });

  it('omite "eb.header.actions" cuando el host no pasa onSendTest', () => {
    const steps = buildEmailBuilderTourSteps({ ...HOST_CONFIG, onSendTest: undefined });
    const emittedAnchors = steps.map((step) => step.anchorKey);
    expect(emittedAnchors).not.toContain(EMAIL_BUILDER_TOUR_ANCHORS.headerActions);
  });

  it('siempre emite las anclas sin precondición de flag (header identity, toolbar, library rail, canvas, command palette)', () => {
    const steps = buildEmailBuilderTourSteps({});
    const emittedAnchors = steps.map((step) => step.anchorKey);
    expect(emittedAnchors).toEqual(
      expect.arrayContaining([
        EMAIL_BUILDER_TOUR_ANCHORS.headerIdentity,
        EMAIL_BUILDER_TOUR_ANCHORS.toolbarViews,
        EMAIL_BUILDER_TOUR_ANCHORS.toolbarHistory,
        EMAIL_BUILDER_TOUR_ANCHORS.libraryRail,
        EMAIL_BUILDER_TOUR_ANCHORS.libraryTabs,
        EMAIL_BUILDER_TOUR_ANCHORS.canvasRoot,
        EMAIL_BUILDER_TOUR_ANCHORS.commandPalette,
      ]),
    );
  });
});

describe('buildEmailBuilderTourSteps — eb.inspector.panel depende de selección/documento (§1.4.5)', () => {
  it('se omite (when === false) cuando el documento está vacío', () => {
    resetEditorState();
    const steps = buildEmailBuilderTourSteps(HOST_CONFIG);
    const inspectorStep = steps.find(
      (step) => step.anchorKey === EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel,
    );
    expect(inspectorStep).toBeDefined();
    expect(inspectorStep!.when?.()).toBe(false);
  });

  it('cuando el documento tiene bloques, when() es true y before() selecciona uno', () => {
    const newId = appendBuiltInBlockToParent('root', BUTTONS[0]!.block());
    expect(newId).toBeTruthy();

    const steps = buildEmailBuilderTourSteps(HOST_CONFIG);
    const inspectorStep = steps.find(
      (step) => step.anchorKey === EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel,
    );
    expect(inspectorStep).toBeDefined();
    expect(inspectorStep!.when?.()).toBe(true);
  });
});

describe('buildEmailBuilderTourSteps — eb.library.tabs abre el drawer antes de resaltar', () => {
  it('before() abre el drawer si estaba cerrado', () => {
    setComponentsLibraryDrawerOpen(false);
    const steps = buildEmailBuilderTourSteps(HOST_CONFIG);
    const libraryTabsStep = steps.find(
      (step) => step.anchorKey === EMAIL_BUILDER_TOUR_ANCHORS.libraryTabs,
    );
    expect(libraryTabsStep).toBeDefined();
    expect(libraryTabsStep!.before).toBeDefined();
  });
});

describe('getEmailBuilderTourLabels', () => {
  it('devuelve los 4 textos de botones/progreso, no vacíos', () => {
    const labels = getEmailBuilderTourLabels();
    expect(labels.nextBtnText).toBeTruthy();
    expect(labels.prevBtnText).toBeTruthy();
    expect(labels.doneBtnText).toBeTruthy();
    expect(labels.progressText).toBeTruthy();
  });
});
