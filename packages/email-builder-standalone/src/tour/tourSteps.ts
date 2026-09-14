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

/**
 * Construye los pasos elegibles del tour de EmailBuilder, ya filtrados por `config` y con el
 * copy resuelto desde el namespace i18n `tour` en el idioma activo de `i18next`. El propio
 * motor (`createTour`) vuelve a aplicar `when()` en runtime; los `when` de aquí son la
 * garantía estática de que ningún paso apunta a una superficie apagada (§1.4.6).
 */
export function buildEmailBuilderTourSteps(config: EmailBuilderTourStepsConfig): TourStep[] {
  const steps: TourStep[] = [
    // 1. eb.header.identity — Host: EditorHeader.tsx (nombre, categoría, idioma, autoguardado).
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

    // 2. eb.toolbar.views — MainTabsGroup.tsx (editar/previsualizar, tamaño de pantalla).
    // Siempre visible: editor/preview no están gateados por ningún flag del embed.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.toolbarViews,
      popover: {
        title: t('steps.toolbarViews.title'),
        description: t('steps.toolbarViews.description'),
        side: 'bottom',
      },
    },

    // 3. eb.toolbar.history — TemplatePanel/index.tsx (undo/redo).
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.toolbarHistory,
      popover: {
        title: t('steps.toolbarHistory.title'),
        description: t('steps.toolbarHistory.description'),
        side: 'bottom',
      },
    },

    // 4. eb.library.rail — ComponentsLibraryHandle.tsx + CompactBlocksList.tsx.
    {
      anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.libraryRail,
      popover: {
        title: t('steps.libraryRail.title'),
        description: t('steps.libraryRail.description'),
        side: 'right',
      },
    },

    // 5. eb.library.tabs — ComponentsLibraryDrawer.tsx (categorías blocks/templates).
    // Solo existe en el DOM con el drawer abierto (§1.4.5): `before` lo abre, `after` lo
    // deja como estaba encontrado (no lo cierra por decisión propia, ver más abajo) — el
    // motor ya trae `waitForElement`/`skipMissingElement` como red de seguridad si el drawer
    // tarda en montar el panel de tabs.
    (() => {
      let wasOpenBeforeStep = false;
      return {
        anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.libraryTabs,
        popover: {
          title: t('steps.libraryTabs.title'),
          description: t('steps.libraryTabs.description'),
          side: 'right',
        },
        before: () => {
          wasOpenBeforeStep = editorStateStore.getState().componentsLibraryDrawerOpen;
          setComponentsLibraryDrawerOpen(true);
        },
        after: () => {
          if (!wasOpenBeforeStep) setComponentsLibraryDrawerOpen(false);
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),

    // 6. eb.canvas.root — TemplatePanel `.preview-container`. Puramente descriptivo: el
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

    // 7. eb.inspector.panel — InspectorDrawer/index.tsx. Requiere bloque seleccionado
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

  // 8. eb.image.sources — ImageSourceTabs.tsx (galería / Unsplash / subida). Solo si al
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

  // 9. eb.commandPalette — App/CommandPalette/index.tsx (⌘K). Siempre visible.
  steps.push({
    anchorKey: EMAIL_BUILDER_TOUR_ANCHORS.commandPalette,
    popover: {
      title: t('steps.commandPalette.title'),
      description: t('steps.commandPalette.description'),
      side: 'top',
    },
  });

  // 10. eb.header.actions — Host: EditorHeader.tsx (enviar prueba + guardar). Solo si el
  // host pasó `onSendTest` (§3.1 precondición: "onSendTest presente"). El guardado en sí
  // (autosave) no depende de este flag, pero el ancla del host solo se renderiza junto al
  // botón de enviar prueba — sin `onSendTest` no hay nada que resaltar ahí.
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
