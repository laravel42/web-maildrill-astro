/**
 * tourSteps.ts — registro de pasos del tour "Editor de email" (F3a,
 * docs/product-tour-driverjs-plan.md §3.1 y §4).
 *
 * Construye `TourStep[]` (`@md/product-tour`) a partir de `EMAIL_BUILDER_TOUR_ANCHORS`
 * (F2a), filtrando por los flags con los que el host monta el editor
 * (`src/components/react/VisualEmailBuilder.tsx`). Este módulo no lee `window` ni ningún
 * global: toda condición de flag llega vía `EmailBuilderTourStepsConfig`, resuelta por el
 * consumidor real (el host) o por los tests.
 *
 * No incluye pasos para `eb.ai.generate`, `eb.theme.presets` ni `eb.inspector.mergeTags` —
 * las 3 anclas excluidas en F2a por falta de punto de montaje alcanzable (ver el comentario
 * de cabecera de `tourAnchors.ts` y de `tests/tourAnchors.render.test.tsx`). Si esas anclas
 * se reactivan en una fase posterior, sus pasos se añaden ahí, no aquí por adelantado.
 */

import type { TourStep } from '@md/product-tour';
import i18n from '../i18n';
import {
  editorStateStore,
  setComponentsLibraryDrawerCategory,
  setComponentsLibraryDrawerOpen,
  setSelectedBlockId,
} from '../documents/editor/EditorContext';
import { EMAIL_BUILDER_TOUR_ANCHORS } from './tourAnchors';

/**
 * Subconjunto de `EmailBuilderProps` (ver `src/index.tsx`) que determina qué pasos del tour
 * son alcanzables. Refleja exactamente los flags con los que
 * `src/components/react/VisualEmailBuilder.tsx` monta el editor en Maildrill — no todos los
 * flags de `EmailBuilderProps`, solo los que gatean una superficie con paso de tour (§1.4.6).
 */
export interface EmailBuilderTourStepsConfig {
  /** Pestaña HTML del panel principal. El host la monta en `false`. */
  htmlTab?: boolean;
  /** Pestaña JSON del panel principal. El host la monta en `false`. */
  jsonTab?: boolean;
  /** Árbol de componentes. El host lo monta en `false`. Sin paso de tour propio (§3.1 excluidos por flag). */
  componentTree?: boolean;
  /** Botón "Guardar como plantilla". El host lo monta en `false`. */
  templateSaving?: boolean;
  /** "Guardar como tema" en el inspector raíz. El host lo monta en `false`. */
  themeSaving?: boolean;
  /** Pestaña Templates del drawer de librería. El host lo monta en `true`. */
  templateLibrary?: boolean;
  /** Pestaña de galería del workspace en el picker de imagen. El host lo monta en `true`. */
  galleryImages?: boolean;
  /** Pestaña Unsplash en el picker de imagen. El host lo monta en `true`. */
  unsplashEnabled?: boolean;
  /** Entrada de generación con IA. El host lo monta en `true`. Sin ancla alcanzable (F2a). */
  enableAI?: boolean;
  /** Presente cuando el host puede enviar un correo de prueba (pasa `onSendTest`). */
  onSendTest?: unknown;
}

/** Namespace i18n de este registro — ver `src/locales/<locale>/tour.json`. */
const TOUR_I18N_NAMESPACE = 'tour';

function t(key: string): string {
  return i18n.t(key, { ns: TOUR_I18N_NAMESPACE });
}

/** `true` si el documento actual no tiene ningún bloque hijo bajo el root (canvas vacío). */
function isDocumentEmpty(): boolean {
  const document = editorStateStore.getState().document;
  const root = document.root as { data?: { childrenIds?: unknown } } | undefined;
  const childrenIds = root?.data?.childrenIds;
  return !Array.isArray(childrenIds) || childrenIds.length === 0;
}

/** Primer bloque hijo del root, o `null` si el canvas está vacío. */
function firstRootBlockId(): string | null {
  const document = editorStateStore.getState().document;
  const root = document.root as { data?: { childrenIds?: unknown } } | undefined;
  const childrenIds = root?.data?.childrenIds;
  if (!Array.isArray(childrenIds) || childrenIds.length === 0) return null;
  const [first] = childrenIds as string[];
  return first ?? null;
}

/** Snapshot del drawer de librería tomado al entrar en el primer paso de librería del grupo. */
interface LibraryStepSnapshot {
  open: boolean;
  category: string;
}

/**
 * Guardia compartida de los 4 pasos de librería consecutivos (`eb.library.tabs`,
 * `eb.library.blocksBasics`, `eb.library.blocksLayout`, `eb.library.templates` — §D33). Sin
 * esta guardia, cada paso abriría/cerraría el drawer por su cuenta y el usuario vería un
 * parpadeo entre cada uno de los 4 pasos consecutivos. En su lugar: el primer paso del grupo
 * toma una única foto del estado previo del drawer (abierto/cerrado + categoría activa);
 * cada paso siguiente del grupo solo pide el tab que necesita; y el restore al estado previo
 * se programa con `setTimeout(0)` al salir de un paso de librería — si el siguiente paso del
 * tour es también de librería, `enterLibraryStep` cancela ese restore antes de que llegue a
 * ejecutarse (el motor llama `after()` del paso saliente antes que `before()` del entrante,
 * ver `createTour.ts`), así el drawer nunca se cierra entre dos pasos de librería seguidos.
 */
let libraryStepSnapshot: LibraryStepSnapshot | null = null;
let libraryStepRestoreTimer: ReturnType<typeof setTimeout> | null = null;

function applyLibraryStepSnapshot(snapshot: LibraryStepSnapshot): void {
  const state = editorStateStore.getState();
  if (state.componentsLibraryDrawerOpen !== snapshot.open) {
    setComponentsLibraryDrawerOpen(snapshot.open);
  }
  if (state.componentsLibraryDrawerCategory !== snapshot.category) {
    setComponentsLibraryDrawerCategory(snapshot.category);
  }
}

/** Foto del estado del drawer de librería tomada al entrar en el primer paso de librería. */
export function enterLibraryStep(category: 'blocks' | 'templates'): void {
  if (libraryStepRestoreTimer !== null) {
    clearTimeout(libraryStepRestoreTimer);
    libraryStepRestoreTimer = null;
  }
  if (libraryStepSnapshot === null) {
    const state = editorStateStore.getState();
    libraryStepSnapshot = {
      open: state.componentsLibraryDrawerOpen,
      category: state.componentsLibraryDrawerCategory,
    };
  }
  const state = editorStateStore.getState();
  if (!state.componentsLibraryDrawerOpen) {
    setComponentsLibraryDrawerOpen(true);
  }
  if (state.componentsLibraryDrawerCategory !== category) {
    setComponentsLibraryDrawerCategory(category);
  }
}

/** Programa el restore del estado previo del drawer; se cancela si entra otro paso de librería. */
export function leaveLibraryStep(): void {
  if (libraryStepSnapshot === null) return;
  if (libraryStepRestoreTimer !== null) {
    clearTimeout(libraryStepRestoreTimer);
  }
  libraryStepRestoreTimer = setTimeout(() => {
    flushLibraryStepRestore();
  }, 0);
}

/** Ejecuta de inmediato el restore pendiente, si hay uno (helper de test; seguro en producción). */
export function flushLibraryStepRestore(): void {
  if (libraryStepRestoreTimer !== null) {
    clearTimeout(libraryStepRestoreTimer);
    libraryStepRestoreTimer = null;
  }
  if (libraryStepSnapshot !== null) {
    const snapshot = libraryStepSnapshot;
    libraryStepSnapshot = null;
    applyLibraryStepSnapshot(snapshot);
  }
}

/** Descarta la foto y cualquier restore pendiente sin tocar el store (solo para tests). */
export function resetLibraryStepGuard(): void {
  if (libraryStepRestoreTimer !== null) {
    clearTimeout(libraryStepRestoreTimer);
    libraryStepRestoreTimer = null;
  }
  libraryStepSnapshot = null;
}

/**
 * Construye los pasos elegibles del tour de EmailBuilder, ya filtrados por `config` y con el
 * copy resuelto desde el namespace i18n `tour` en el idioma activo de `i18next`. El propio
 * motor (`createTour`) vuelve a aplicar `when()` en runtime; los `when` de aquí son la
 * garantía estática de que ningún paso apunta a una superficie apagada (§1.4.6).
 */
export function buildEmailBuilderTourSteps(config: EmailBuilderTourStepsConfig): TourStep[] {
  const steps: TourStep[] = [
    // 1. eb.header.identity — Host: EditorHeader.tsx, campo de nombre a solas.
    // Siempre visible: el header de identidad no depende de ningún flag del editor.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.headerIdentity,
      popover: {
        title: t('steps.headerIdentity.title'),
        description: t('steps.headerIdentity.description'),
        side: 'bottom',
        align: 'start',
      },
    },

    // 2. eb.header.save — Host: EditorHeader.tsx, botón "Save template" a solas.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.headerSave,
      popover: {
        title: t('steps.headerSave.title'),
        description: t('steps.headerSave.description'),
        side: 'bottom',
        align: 'start',
      },
    },

    // 3. eb.header.status — Host: EditorHeader.tsx, indicador de autoguardado a solas.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.headerStatus,
      popover: {
        title: t('steps.headerStatus.title'),
        description: t('steps.headerStatus.description'),
        side: 'bottom',
        align: 'end',
      },
    },

    // 4. eb.toolbar.views — MainTabsGroup.tsx (editar/previsualizar).
    // Siempre visible: editor/preview no están gateados por ningún flag del embed.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.toolbarViews,
      popover: {
        title: t('steps.toolbarViews.title'),
        description: t('steps.toolbarViews.description'),
        side: 'bottom',
      },
    },

    // 5. eb.viewport.screenSize — SelectScreen.tsx (ScreenSizeSelector), cambio desktop/mobile.
    // Va inmediatamente después de eb.toolbar.views: ambos son controles del toolbar del
    // lienzo (§ contrato D16/D17 — el orden sigue la vista, no el registro).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.viewportScreenSize,
      popover: {
        title: t('steps.viewportScreenSize.title'),
        description: t('steps.viewportScreenSize.description'),
        side: 'bottom',
      },
    },

    // 6. eb.toolbar.history — TemplatePanel/index.tsx (undo/redo).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.toolbarHistory,
      popover: {
        title: t('steps.toolbarHistory.title'),
        description: t('steps.toolbarHistory.description'),
        side: 'bottom',
      },
    },

    // 7. eb.library.rail — ComponentsLibraryHandle.tsx + CompactBlocksList.tsx.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.libraryRail,
      popover: {
        title: t('steps.libraryRail.title'),
        description: t('steps.libraryRail.description'),
        side: 'right',
      },
    },

    // 8. eb.library.tabs — ComponentsLibraryDrawer.tsx (categorías blocks/templates).
    // Solo existe en el DOM con el drawer abierto (§1.4.5). Primer paso del grupo de 4 pasos
    // de librería consecutivos (8-11, §D33): usa la guardia compartida `enterLibraryStep` /
    // `leaveLibraryStep` en vez de abrir/cerrar el drawer por su cuenta, así los 4 pasos no
    // parpadean entre sí — el motor ya trae `waitForElement`/`skipMissingElement` como red de
    // seguridad si el drawer tarda en montar el panel de tabs.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.libraryTabs,
      popover: {
        title: t('steps.libraryTabs.title'),
        description: t('steps.libraryTabs.description'),
        side: 'right',
      },
      before: () => enterLibraryStep('blocks'),
      after: () => leaveLibraryStep(),
      skipMissingElement: true,
    },

    // 9. eb.library.blocksBasics — BlocksCategoryContent.tsx, grupo "Basics" (Text, Image,
    // Button, Divider, Spacer, Social). Segundo paso del grupo de librería (§D33).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.blocksBasics,
      popover: {
        title: t('steps.blocksBasics.title'),
        description: t('steps.blocksBasics.description'),
        side: 'right',
      },
      before: () => enterLibraryStep('blocks'),
      after: () => leaveLibraryStep(),
      skipMissingElement: true,
    },

    // 10. eb.library.blocksLayout — BlocksCategoryContent.tsx, grupo "Structure" (Columns,
    // Container). Tercer paso del grupo de librería (§D33).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.blocksLayout,
      popover: {
        title: t('steps.blocksLayout.title'),
        description: t('steps.blocksLayout.description'),
        side: 'right',
      },
      before: () => enterLibraryStep('blocks'),
      after: () => leaveLibraryStep(),
      skipMissingElement: true,
    },

    // 11. eb.library.templates — ComponentsLibraryDrawer.tsx, pestaña Templates. Cuarto y
    // último paso del grupo de librería (§D33). Condicional al flag `templateLibrary`
    // (precondición §3.1: "Solo si templateLibrary"); vive en el literal (no `push`eado) para
    // que el orden de los 4 pasos de librería se mantenga (§D17).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.libraryTemplates,
      popover: {
        title: t('steps.libraryTemplates.title'),
        description: t('steps.libraryTemplates.description'),
        side: 'right',
      },
      when: () => Boolean(config.templateLibrary),
      before: () => enterLibraryStep('templates'),
      after: () => leaveLibraryStep(),
      skipMissingElement: true,
    },

    // 12. eb.canvas.root — TemplatePanel `.preview-container`. Puramente descriptivo: el
    // overlay de driver.js pone `pointer-events: none` sobre todo menos el elemento
    // resaltado (§1.4.4), así que el paso no promete "arrastra un bloque aquí" como acción
    // ejecutable dentro del tour, solo explica qué es el lienzo.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.canvasRoot,
      popover: {
        title: t('steps.canvasRoot.title'),
        description: t('steps.canvasRoot.description'),
        side: 'left',
      },
    },

    // 13. eb.inspector.panel — InspectorDrawer/index.tsx. Requiere bloque seleccionado
    // (§1.4.5); si el documento está vacío no hay nada que seleccionar, así que el paso se
    // omite por completo vía `when` (no solo se salta el highlight: no debe contarse en la
    // barra de progreso de un tour sin nada que inspeccionar).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel,
      popover: {
        title: t('steps.inspectorPanel.title'),
        description: t('steps.inspectorPanel.description'),
        side: 'left',
      },
      when: () => !isDocumentEmpty(),
      before: () => {
        const blockId = firstRootBlockId();
        if (blockId) setSelectedBlockId(blockId);
      },
      skipMissingElement: true,
    },
  ];

  // 14. eb.image.sources — ImageSourceTabs.tsx (galería / Unsplash / subida). Solo si al
  // menos una fuente adicional a la subida directa está encendida (§3.1 precondición:
  // "Solo si galleryImages/unsplashEnabled").
  if (config.galleryImages || config.unsplashEnabled) {
    steps.push({
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.imageSources,
      popover: {
        title: t('steps.imageSources.title'),
        description: t('steps.imageSources.description'),
        side: 'top',
      },
      when: () => Boolean(config.galleryImages || config.unsplashEnabled),
      skipMissingElement: true,
    });
  }

  // 15. eb.commandPalette — App/CommandPalette/index.tsx (⌘K). Siempre visible.
  steps.push({
    anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.commandPalette,
    popover: {
      title: t('steps.commandPalette.title'),
      description: t('steps.commandPalette.description'),
      side: 'top',
    },
  });

  // 16. eb.header.actions — Host: EditorHeader.tsx, botón "Send test" a solas. Solo si el
  // host pasó `onSendTest` (§3.1 precondición: "onSendTest presente"). Última parada del
  // tour por decisión de contrato (D16/D17): "Send test" siempre cierra el recorrido.
  if (config.onSendTest) {
    steps.push({
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.headerActions,
      popover: {
        title: t('steps.headerActions.title'),
        description: t('steps.headerActions.description'),
        side: 'bottom',
        align: 'end',
      },
      when: () => Boolean(config.onSendTest),
      skipMissingElement: true,
    });
  }

  return steps;
}

/** Textos de botones/progreso del tour, resueltos desde el namespace i18n `tour`. */
export function getEmailBuilderTourLabels(): {
  nextBtnText: string;
  prevBtnText: string;
  doneBtnText: string;
  progressText: string;
} {
  return {
    nextBtnText: t('labels.nextBtnText'),
    prevBtnText: t('labels.prevBtnText'),
    doneBtnText: t('labels.doneBtnText'),
    progressText: t('labels.progressText'),
  };
}
