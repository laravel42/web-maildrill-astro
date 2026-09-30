/**
 * tourSteps.ts — registro de pasos del tour "Editor de landings" (F3b,
 * docs/product-tour-driverjs-plan.md §3.2 y §4).
 *
 * Construye `TourStep[]` (`@md/product-tour`) a partir de `BUILDER42_TOUR_ANCHORS`
 * (F2b), filtrando por los flags/capabilities con los que el host resuelve el editor
 * (`experienceLevel`, disponibilidad del adapter de publicación — §1.4.6). Este módulo
 * no lee `window` ni ningún global salvo el propio store del documento
 * (`useDocumentStore`, ya interno de `packages/builder42`): toda condición externa al
 * paquete llega vía `Builder42TourStepsConfig`, resuelta por el consumidor real (el
 * host, F4) o por los tests.
 *
 * Boundary de exportabilidad (§0 del plan): cero imports de `src/` del host Astro.
 * Vive en `src/app` (chrome) — nada en `src/builder/runtime` ni en rutas de
 * export (§1.4.7). El copy (ver los JSON de `src/i18n/locales` bajo la clave "tour")
 * describe solo el editor en sí, para que viaje literalmente el día de la
 * extracción a la demo de landing (§0.6).
 *
 * i18n (F19.2 — D-F19.2): este módulo NO importa el singleton global `@/i18n`. El
 * copy se resuelve desde la instancia i18next que el CALLER ya tiene montada,
 * recibida como último parámetro (`i18nInstance`, REQUERIDO) de
 * `buildBuilder42TourSteps` y `getBuilder42TourLabels` — el mismo objeto que
 * `useBuilder42Tour` ya recibe como opción `i18nInstance` y al que ya se suscribe
 * (`languageChanged`) para reconstruir el tour. Antes de este cambio, `t()` leía
 * siempre el singleton (`@/i18n`, que en el embed nadie inicializa con el idioma del
 * host — `Builder42Editor.tsx` construye su PROPIA instancia con
 * `createEditorI18n(locale)`), así que un editor embebido en inglés mostraba el tour
 * en español: el singleton solo lo consume el shell standalone (`app/App.tsx`), pero
 * `tourSteps.ts` lo importaba sin condición. No va dentro de
 * `Builder42TourStepsConfig` porque ese tipo documenta el conjunto de FLAGS que
 * filtran pasos — una instancia de i18n no es un filtro, es de dónde sale el copy.
 */

import type { TourStep } from "@md/product-tour";
import type { i18n as I18nInstance } from "i18next";
import { useDocumentStore, type SideTab } from "@/builder/store/documentStore";
import type { InspectorTab } from "@/builder/inspector/form/types";
import type { Breakpoint } from "@/builder/model/types";
import { readConfig, writeConfig } from "@/hooks/useLocalConfig";
import { BUILDER42_TOUR_ANCHORS, type Builder42TourAnchorKey } from "./tourAnchors";

/**
 * Subconjunto de condiciones externas que determinan qué pasos del tour son
 * alcanzables en el embed de Maildrill (§1.4.6):
 *  - `experienceLevel`: en `"simple"` el sidebar no muestra la pestaña Tokens y el
 *    Inspector no expone Código/JSON/export zip — ninguno de esos tiene ancla propia
 *    en `BUILDER42_TOUR_ANCHORS` (§3.2 "Excluidos"), así que hoy `experienceLevel` no
 *    apaga ningún paso emitido; se recibe explícitamente (en vez de leído de un global)
 *    para que el día en que exista un paso de la variante avanzada (§3.2, nota final)
 *    el filtro ya tenga el dato sin tocar la firma de `buildBuilder42TourSteps`.
 *  - `publishAvailable`: `pbx.publish` (`PublishPanel`) solo se ofrece si el adapter de
 *    publicación del host responde `enabled` (ver `fetchHealth().publish.enabled`,
 *    igual que consulta `EditorPreferences`/`PublishPanel` — este módulo no llama a la
 *    red directamente, recibe el resultado ya resuelto).
 *  - `standaloneChrome`: `pbx.profileMenu` (`ProfileMenu.tsx`) solo existe en el DOM
 *    cuando el editor renderiza su propio `Header` (el shell standalone,
 *    `app/App.tsx`) — el embed (`Builder42Editor.tsx`) nunca monta `Header`; el host
 *    le da su propio header/toolbar en su lugar, y no tiene equivalente embebido para
 *    el menú de perfil. `tourSteps.ts` no es un componente de React y no puede leer
 *    `useEmbeddedChrome` (el context que distingue standalone de embed en tiempo de
 *    render), así que cada caller resuelve el valor y lo pasa explícito, igual que
 *    `publishAvailable`: `app/App.tsx` pasa `true`, `Builder42Editor.tsx` pasa `false`
 *    (D49). Hasta D-F19.1 este mismo flag también gateaba `pbx.pages.breadcrumb` —
 *    ver `pagesBreadcrumbAvailable` abajo para por qué eso dejó de ser cierto.
 *  - `pagesBreadcrumbAvailable` (D-F19.1): `pbx.pages.breadcrumb` (`PageBreadcrumb.tsx`)
 *    existe en el DOM en DOS casos, no uno: (a) el shell standalone, que la monta
 *    dentro de su propio `Header`, o (b) el embed, cuando el HOST le presta un slot de
 *    página (`Builder42Editor.tsx`'s `pagesSlotId`) y `HostPagesPortal` porta
 *    `PageBreadcrumb` dentro del header del host. El commit 5332e8b introdujo (b) y
 *    dejó falsa la premisa original de `standaloneChrome` ("esas anclas solo existen
 *    en standalone") para la mitad del breadcrumb: verificado en `/editor` de este
 *    host, `.pbx-breadcrumb` está presente dentro de `nav.ed-nav` con `.pbx-header`
 *    en `null`. De ahí el campo separado: un flag nombrado por el SHELL no puede
 *    seguir sirviendo de proxy para dos superficies con reglas de existencia
 *    distintas. Es REQUERIDO (no opcional con default) para que el compilador nombre
 *    a cada caller en vez de que uno se quede en silencio con el comportamiento
 *    viejo. `app/App.tsx` pasa `true` (el standalone siempre monta el breadcrumb);
 *    `Builder42Editor.tsx` pasa `Boolean(pagesSlotId)` — el editor ya sabe si el host
 *    le prestó el slot, no hace falta plumbing nuevo.
 */
export interface Builder42TourStepsConfig {
  /** Nivel de experiencia actual (`useLocalConfig("experienceLevel")`). */
  experienceLevel: "simple" | "advanced";
  /** `true` si el adapter/servidor de publicación está disponible (`fetchHealth().publish.enabled`). */
  publishAvailable: boolean;
  /** `true` si el editor renderiza su propio `Header` (shell standalone); `false` en el embed. Desde D-F19.1 gatea SOLO `pbx.profileMenu` (D49). */
  standaloneChrome: boolean;
  /**
   * `true` si `pbx.pages.breadcrumb` (`PageBreadcrumb.tsx`) existe en el DOM: en
   * standalone siempre (dentro del `Header` propio); en el embed solo si el host
   * prestó un slot de página (`pagesSlotId`) y el breadcrumb quedó portado dentro de
   * su header (D-F19.1).
   */
  pagesBreadcrumbAvailable: boolean;
}

/** Namespace i18n de este registro — ver `src/i18n/locales/<lang>/tour.json`. */
const TOUR_I18N_NAMESPACE = "tour";

/** Primer hijo del nodo raíz del documento activo, o `null` si el lienzo está vacío. */
function firstRootChildId(): string | null {
  const { document } = useDocumentStore.getState();
  const root = document.nodes[document.rootId];
  const [first] = root?.children ?? [];
  return first ?? null;
}

/**
 * Garantiza que el lienzo tenga al menos un nodo seleccionable antes de un paso que lo
 * requiere (`canvasNodeActions`, `inspectorTabs`, `inspectorBreakpoints` — §1.4.5): si ya
 * hay contenido, selecciona el primer hijo del root y no toca el documento. Si el lienzo
 * está VACÍO (sitio recién creado, o el usuario borró todo antes de llegar a este paso),
 * inserta un componente `"text"` de relleno como hijo del root para que el paso tenga algo
 * que resaltar en vez de omitirse — antes de este fix, un lienzo vacío hacía que `when()`
 * descartara el paso entero (§1.4.5 original), lo que en la práctica dejaba SIEMPRE fuera
 * del tour justo los pasos que enseñan a duplicar/borrar/inspeccionar un elemento en el
 * caso más común para un usuario nuevo: un sitio que todavía no tiene nada.
 *
 * Devuelve el id insertado si (y solo si) este helper creó el nodo — nunca el id de un
 * nodo que ya existía —, para que el `after()` del paso pueda revertirlo (`removeExample-
 * NodeIfInserted`) y dejar el documento exactamente como estaba si el usuario nunca pidió
 * ese contenido. `addComponent` ya selecciona el nodo insertado (ver `tree.ts`), así que no
 * hace falta un `select()` explícito tras insertarlo.
 */
function ensureSelectableNodeForStep(): { insertedExampleId: string | null } {
  const existing = firstRootChildId();
  if (existing) {
    useDocumentStore.getState().select(existing);
    return { insertedExampleId: null };
  }
  const { document, addComponent } = useDocumentStore.getState();
  addComponent("text", { parentId: document.rootId, index: 0 });
  const insertedId = firstRootChildId();
  return { insertedExampleId: insertedId };
}

/**
 * Revierte el nodo de ejemplo insertado por `ensureSelectableNodeForStep()`, si lo hubo
 * (`insertedExampleId !== null`) — no-op si el paso encontró contenido real del usuario.
 * Selecciona el nodo antes de borrarlo porque `removeSelected()` opera sobre `selectedId`
 * (no acepta un id explícito) — ver `tree.ts`.
 */
function removeExampleNodeIfInserted(insertedExampleId: string | null): void {
  if (!insertedExampleId) return;
  const { select, removeSelected } = useDocumentStore.getState();
  select(insertedExampleId);
  removeSelected();
}

/**
 * Construye los pasos elegibles del tour de Builder42, ya filtrados por `config` y con
 * el copy resuelto desde el namespace i18n `tour` en el idioma activo de
 * `i18nInstance` — la instancia i18next que YA está montada en el caller
 * (`useBuilder42Tour`'s `i18nInstance`, reenviada tal cual: el singleton global en
 * standalone, `createEditorI18n(locale)` en el embed — D-F19.2). El propio motor
 * (`createTour`) vuelve a aplicar `when()` en runtime; los `when` de aquí son la
 * garantía estática de que ningún paso apunta a una superficie apagada (§1.4.6).
 */
export function buildBuilder42TourSteps(
  config: Builder42TourStepsConfig,
  i18nInstance: I18nInstance,
): TourStep[] {
  const t = (key: string): string => i18nInstance.t(key, { ns: TOUR_I18N_NAMESPACE });
  const steps: TourStep[] = [
    // 1. pbx.header.identity — Host: EditorHeader.tsx (nombre + autoguardado de la
    // landing). Siempre visible: no depende de ningún flag del embed.
    {
      anchorKey: BUILDER42_TOUR_ANCHORS.headerIdentity,
      popover: {
        title: t("steps.headerIdentity.title"),
        description: t("steps.headerIdentity.description"),
        side: "bottom",
        align: "start",
      },
    },

    // 2. pbx.toolbar.views — HostToolbar.tsx (grupo Editar/Previsualizar).
    // §1.4.2: el preview renderiza un iframe donde driver.js no puede resaltar nada,
    // así que el tour fuerza `view === "edit"` ANTES de este primer paso de canvas —
    // es el paso más temprano con ancla dentro de la banda de canvas, y forzar la
    // vista aquí garantiza que el resto del recorrido (sidebar, canvas, inspector)
    // encuentre sus anclas montadas. El `before` que fuerza `view` debe seguir en
    // ESTE paso (el primero de la banda de toolbar) y no en el siguiente.
    {
      anchorKey: BUILDER42_TOUR_ANCHORS.toolbarViews,
      popover: {
        title: t("steps.toolbarViews.title"),
        description: t("steps.toolbarViews.description"),
        side: "bottom",
      },
      before: () => {
        const { view, setView } = useDocumentStore.getState();
        if (view !== "edit") setView("edit");
      },
    },

    // 3. pbx.toolbar.viewport — ViewportDropdown.tsx (selector de tamaño de
    // pantalla). Separado del paso anterior (D37/B17-B18): cada paso resalta un
    // único control. Sin `when` ni `before` propios — la vista ya quedó forzada a
    // "edit" en el paso 2, que es quien debe garantizarlo.
    {
      anchorKey: BUILDER42_TOUR_ANCHORS.toolbarViewport,
      popover: {
        title: t("steps.toolbarViewport.title"),
        description: t("steps.toolbarViewport.description"),
        side: "bottom",
      },
      skipMissingElement: true,
    },

    // 4. pbx.toolbar.history — HostToolbar.tsx (deshacer/rehacer).
    {
      anchorKey: BUILDER42_TOUR_ANCHORS.toolbarHistory,
      popover: {
        title: t("steps.toolbarHistory.title"),
        description: t("steps.toolbarHistory.description"),
        side: "bottom",
      },
    },
  ];

  // 5. pbx.sidebar.tabs — Sidebar.tsx (Componentes/Plantillas; Tokens oculto en
  // simple, sin ancla propia). Solo existe en el DOM con `sidebarMode = "open"`
  // (§1.4.5, compact reduce el sidebar a un riel sin tabs): `before` lo abre y lo
  // deja como estaba encontrado si no estaba ya abierto — el motor trae
  // `waitForElement`/`skipMissingElement` como red de seguridad.
  steps.push(
    (() => {
      let wasCompactBeforeStep = false;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.sidebarTabs,
        popover: {
          title: t("steps.sidebarTabs.title"),
          description: t("steps.sidebarTabs.description"),
          side: "right",
        },
        before: () => {
          // `sidebarMode` vive en `useLocalConfig` (localStorage `pb:sidebarMode`),
          // no en `useDocumentStore` — se lee/escribe con `readConfig`/`writeConfig`
          // (D40, finding B29) y NUNCA con `localStorage` directo: un `setItem`
          // crudo persiste el valor pero no notifica a los suscriptores del hook,
          // así que el sidebar no se abriría a tiempo para que driver.js encuentre
          // el ancla.
          wasCompactBeforeStep = readConfig("sidebarMode") === "compact";
          if (wasCompactBeforeStep) writeConfig("sidebarMode", "open");
        },
        after: () => {
          if (wasCompactBeforeStep) writeConfig("sidebarMode", "compact");
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 6. pbx.sidebar.palette — Sidebar.tsx (paleta arrastrable de secciones y
  // elementos). Puramente descriptivo: el overlay de driver.js pone
  // `pointer-events: none` sobre todo menos el elemento resaltado (§1.4.4), así que
  // el paso no promete "arrastra esto aquí" como acción ejecutable dentro del tour.
  // `before` fija la tab "components" (D38: `useDocumentStore().setSidebarTab`) —
  // sin esto el paso resaltaría cualquier tab que estuviera activa, incluida
  // Plantillas, y este paso habla de arrastrar elementos/secciones, no de
  // plantillas de página (ese es el paso 7, simétrico, que fija "templates").
  steps.push({
    anchorKey: BUILDER42_TOUR_ANCHORS.sidebarPalette,
    popover: {
      title: t("steps.sidebarPalette.title"),
      description: t("steps.sidebarPalette.description"),
      side: "right",
    },
    before: () => {
      useDocumentStore.getState().setSidebarTab("components");
    },
    skipMissingElement: true,
  });

  // 6b. pbx.sidebar.dragHint — Sidebar.tsx (SidebarItem, el primer item de la
  // paleta en modo "open"). chain F29, T2b (D-F29.20): enseña el gesto de
  // arrastrar un bloque de la paleta al lienzo (clicar también lo inserta).
  // Mismo `before` que el paso anterior (fija la tab "components") porque este
  // paso también depende de que la paleta de componentes, no de plantillas,
  // esté montada. `skipMissingElement: true` — en modo compact no existe
  // ningún `.pbx-palette__item` (el riel compacto no monta este ancla).
  steps.push({
    anchorKey: BUILDER42_TOUR_ANCHORS.sidebarDragHint,
    popover: {
      title: t("steps.sidebarDragHint.title"),
      description: t("steps.sidebarDragHint.description"),
      side: "right",
    },
    before: () => {
      useDocumentStore.getState().setSidebarTab("components");
    },
    skipMissingElement: true,
  });

  // 7. pbx.sidebar.templates — TemplatesPanel.tsx (tarjetas de plantillas de
  // página). Solo existe en el DOM con la tab "templates" activa Y el sidebar
  // abierto (mismo requisito de `sidebarMode` que el paso 5) — `before` fuerza
  // ambos y `after` los restaura a lo que encontró, siguiendo el mismo patrón de
  // snapshot-en-closure que el paso 5 usa para `sidebarMode`. La tab activa vive
  // en el document store desde D38 (`sidebarTab`/`setSidebarTab`, NO en
  // localStorage): se lee/escribe con esa API, nunca con `localStorage` directo.
  // `sidebarMode` sí vive en localStorage, pero se lee/escribe con
  // `readConfig`/`writeConfig` (`@/hooks/useLocalConfig`) y no con
  // `localStorage.setItem` — a diferencia del paso 5 (D40, finding B29): un
  // `setItem` crudo persiste el valor pero no notifica a los suscriptores del
  // hook, así que el panel no se abriría a tiempo para que driver.js encuentre
  // el ancla.
  steps.push(
    (() => {
      let previousSidebarTab: SideTab = "components";
      let sidebarModeChanged = false;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.sidebarTemplates,
        popover: {
          title: t("steps.sidebarTemplates.title"),
          description: t("steps.sidebarTemplates.description"),
          side: "right",
        },
        before: () => {
          const { sidebarTab, setSidebarTab } = useDocumentStore.getState();
          previousSidebarTab = sidebarTab;
          setSidebarTab("templates");

          const previousSidebarMode = readConfig("sidebarMode");
          sidebarModeChanged = previousSidebarMode !== "open";
          if (sidebarModeChanged) writeConfig("sidebarMode", "open");
        },
        after: () => {
          useDocumentStore.getState().setSidebarTab(previousSidebarTab);
          if (sidebarModeChanged) writeConfig("sidebarMode", "compact");
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 8. pbx.canvas.frame — Canvas.tsx (`.pbx-canvas__frame`, el lienzo y su ancho por
  // dispositivo). Siempre visible en modo edit (ya forzado en el paso 2).
  steps.push({
    anchorKey: BUILDER42_TOUR_ANCHORS.canvasFrame,
    popover: {
      title: t("steps.canvasFrame.title"),
      description: t("steps.canvasFrame.description"),
      side: "left",
    },
  });

  // 9. pbx.canvas.nodeActions — NodeActionsRail.tsx (duplicar/borrar el nodo
  // seleccionado). Requiere un nodo seleccionado que NO sea el root (el rail se
  // posiciona junto al nodo, §1.4.5). Si el lienzo está vacío, `before` inserta un
  // nodo de ejemplo (`ensureSelectableNodeForStep`) en vez de omitir el paso — un
  // lienzo vacío ya no debe dejar SIEMPRE fuera del tour el paso que enseña a
  // duplicar/borrar; `after` lo retira si fue este paso quien lo creó. `before`
  // también fuerza el breakpoint "sm" (móvil, `ViewportDropdown`): en breakpoints
  // más anchos el Inspector sidepanel puede tapar el nodo seleccionado (y por
  // tanto el propio `NodeActionsRail`, que se posiciona junto a él) — mismo
  // patrón snapshot-en-closure que el paso 7 usa para `sidebarTab`; `after`
  // restaura el breakpoint que estaba activo antes del paso.
  steps.push(
    (() => {
      let insertedExampleId: string | null = null;
      let previousBreakpoint: Breakpoint = "xl";
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.canvasNodeActions,
        popover: {
          title: t("steps.canvasNodeActions.title"),
          description: t("steps.canvasNodeActions.description"),
          side: "right",
        },
        before: () => {
          insertedExampleId = ensureSelectableNodeForStep().insertedExampleId;

          const { activeBreakpoint, setActiveBreakpoint } = useDocumentStore.getState();
          previousBreakpoint = activeBreakpoint;
          setActiveBreakpoint("sm");
        },
        after: () => {
          removeExampleNodeIfInserted(insertedExampleId);
          insertedExampleId = null;
          useDocumentStore.getState().setActiveBreakpoint(previousBreakpoint);
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 9b. pbx.canvas.inlineText — NodeRenderer.tsx (el nodo SELECCIONADO). chain
  // F29, T2b (D-F29.20): enseña a editar un texto en línea con doble click (el
  // toolbar de formato es `builder/canvas/TextToolbar.tsx`). `before` selecciona
  // el PRIMER nodo `"text"` del documento activo (no reutiliza
  // `ensureSelectableNodeForStep`, y NO inserta nada — tras el wrapper de
  // plantilla de #26 el primer hijo del root es un contenedor, no un texto, y
  // D-F29.10 prohíbe insertar en un lienzo que el visitante vació a propósito).
  // Si el documento no tiene ningún nodo `"text"`, `when` descarta el paso
  // entero — no hay nada que seleccionar, y `skipMissingElement: true` es la red
  // de seguridad redundante en runtime, mismo patrón que usa `pbx.publish` con
  // su propio flag.
  steps.push(
    (() => {
      let previousSelectedId: string | null = null;
      const firstTextNodeId = (): string | null => {
        const { document } = useDocumentStore.getState();
        const match = Object.values(document.nodes).find((n) => n.type === "text");
        return match?.id ?? null;
      };
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.canvasInlineText,
        popover: {
          title: t("steps.canvasInlineText.title"),
          description: t("steps.canvasInlineText.description"),
          side: "top",
        },
        when: () => firstTextNodeId() !== null,
        before: () => {
          const textId = firstTextNodeId();
          if (!textId) return;
          const { selectedId, select } = useDocumentStore.getState();
          previousSelectedId = selectedId;
          select(textId);
        },
        after: () => {
          useDocumentStore.getState().select(previousSelectedId);
          previousSelectedId = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 9c. pbx.canvas.dragNode — SelectionHandle.tsx (`.pbx-drag-handle`, el grip
  // de arrastre del nodo seleccionado). chain F29, T2b (D-F29.20): enseña a
  // mover el nodo seleccionado arrastrando el grip (las flechas junto a él
  // hacen lo mismo en touch). Mismo patrón que `canvasNodeActions` (paso 9):
  // `ensureSelectableNodeForStep` garantiza una selección, y `after` retira el
  // nodo de ejemplo si fue este paso quien lo insertó. `skipMissingElement:
  // true` es OBLIGATORIO — el grip se OCULTA deliberadamente en el modo
  // touch/coarse-pointer (ver la cabecera de `SelectionHandle.tsx`), donde las
  // flechas de reorden lo sustituyen.
  steps.push(
    (() => {
      let insertedExampleId: string | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.canvasDragNode,
        popover: {
          title: t("steps.canvasDragNode.title"),
          description: t("steps.canvasDragNode.description"),
          side: "top",
        },
        before: () => {
          insertedExampleId = ensureSelectableNodeForStep().insertedExampleId;
        },
        after: () => {
          removeExampleNodeIfInserted(insertedExampleId);
          insertedExampleId = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 10. pbx.inspector.tabs — InspectorForm.tsx (tabs Contenido/Estilo/Interactividad).
  // Requiere nodo seleccionado (el Inspector solo monta `InspectorForm` con un nodo
  // activo) y el panel expandido (`inspectorCollapsed = false`, §1.4.5). Se expande
  // con `writeConfig` (D40, finding B29) — nunca con `localStorage.setItem` directo,
  // que persistiría el valor sin notificar a los suscriptores del hook y dejaría el
  // panel colapsado a tiempo para este paso. Si el lienzo está vacío, `before` inserta
  // un nodo de ejemplo (mismo helper que el paso 9) en vez de omitir el paso; `after`
  // lo retira si fue este paso quien lo creó.
  steps.push(
    (() => {
      let insertedExampleId: string | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.inspectorTabs,
        popover: {
          title: t("steps.inspectorTabs.title"),
          description: t("steps.inspectorTabs.description"),
          side: "left",
        },
        before: () => {
          insertedExampleId = ensureSelectableNodeForStep().insertedExampleId;
          writeConfig("inspectorCollapsed", false);
        },
        after: () => {
          removeExampleNodeIfInserted(insertedExampleId);
          insertedExampleId = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 11. pbx.inspector.breakpoints — InspectorForm.tsx tab "style" (segmented de
  // breakpoints, montado por `VisibilityStrip`). Misma precondición que el paso
  // anterior (nodo seleccionado + panel expandido) — `VisibilityStrip` solo se
  // monta dentro de la tab "style" del Inspector con un nodo activo. Igual que el
  // paso 10, el panel se expande con `writeConfig` (D40), no con `localStorage`
  // directo. Además fuerza la tab "style" del Inspector (D48: `inspectorTab`/
  // `setInspectorTab`, `useDocumentStore`, NO `localStorage` — la tab del
  // Inspector vive en el document store desde D48 por el mismo motivo que
  // `sidebarTab`/D38): sin esto, cualquier nodo con tab "Props" deja el Inspector
  // en esa tab y el ancla de `VisibilityStrip` (montada solo en "style") no
  // existe — el defecto original que este paso no podía avanzar. `after`
  // restaura la tab que estaba activa antes del paso, mismo patrón de
  // snapshot-en-closure que el paso 7 usa para `sidebarTab`. Si el lienzo está
  // vacío, `before` inserta un nodo de ejemplo (mismo helper que los pasos 9/10) en
  // vez de omitir el paso; `after` lo retira si fue este paso quien lo creó.
  steps.push(
    (() => {
      let previousInspectorTab: InspectorTab = "props";
      let insertedExampleId: string | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.inspectorBreakpoints,
        popover: {
          title: t("steps.inspectorBreakpoints.title"),
          description: t("steps.inspectorBreakpoints.description"),
          side: "left",
        },
        before: () => {
          insertedExampleId = ensureSelectableNodeForStep().insertedExampleId;
          writeConfig("inspectorCollapsed", false);

          const { inspectorTab, setInspectorTab } = useDocumentStore.getState();
          previousInspectorTab = inspectorTab;
          setInspectorTab("style");
        },
        after: () => {
          useDocumentStore.getState().setInspectorTab(previousInspectorTab);
          removeExampleNodeIfInserted(insertedExampleId);
          insertedExampleId = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 12. pbx.settings.tabs — SiteSettingsPanel.tsx (tabrow, siempre montado — solo el
  // body de abajo cambia según la tab). Presenta la fila completa de secciones de
  // configuración del sitio (capas, páginas, temas, SEO, idiomas, publicación,
  // ajustes) ANTES de entrar a cada una en detalle en los tres pasos siguientes.
  // Precondición doble (D39/D40/D41): (a) ningún nodo seleccionado — si hay uno, el
  // body del panel muestra el formulario del elemento (`tab === "element"`) en vez
  // del strip de tabs, así que `before` deselecciona con `select(null)` sin forzar
  // ninguna tab en particular; (b) el panel derecho expandido, igual que los pasos
  // 10-11 (`writeConfig("inspectorCollapsed", false)`, D40). El closure-scoped
  // helper `expandInspectorPanel` (definido más abajo, reutilizado por los tres
  // pasos de sección y por `pbx.publish`) encapsula "expandir y recordar si hubo
  // que hacerlo" para no repetir el snapshot-and-restore cuatro veces — mismo
  // patrón que los pasos 5 y 7 ya usan para `sidebarMode`/`sidebarTab`.
  const expandInspectorPanel = (): (() => void) => {
    const wasCollapsed = readConfig("inspectorCollapsed");
    if (wasCollapsed) writeConfig("inspectorCollapsed", false);
    return () => {
      if (wasCollapsed) writeConfig("inspectorCollapsed", true);
    };
  };

  steps.push(
    (() => {
      let restoreInspectorPanel: (() => void) | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.settingsTabs,
        popover: {
          title: t("steps.settingsTabs.title"),
          description: t("steps.settingsTabs.description"),
          side: "left",
        },
        before: () => {
          restoreInspectorPanel = expandInspectorPanel();
          useDocumentStore.getState().select(null);
        },
        after: () => {
          restoreInspectorPanel?.();
          restoreInspectorPanel = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 13. pbx.settings.layers — SiteSettingsPanel.tsx, sección que envuelve
  // `LayersTree` (D41: se estampa en la propia sección, no en un wrapper nuevo).
  // `before` reutiliza el seam del store (D39): `openSiteSettings("layers")`
  // deselecciona el nodo Y fija `requestedSiteTab`, que `SiteSettingsPanel` consume
  // para poner la tab "layers" activa y limpiar la petición.
  steps.push(
    (() => {
      let restoreInspectorPanel: (() => void) | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.settingsLayers,
        popover: {
          title: t("steps.settingsLayers.title"),
          description: t("steps.settingsLayers.description"),
          side: "left",
        },
        before: () => {
          restoreInspectorPanel = expandInspectorPanel();
          useDocumentStore.getState().openSiteSettings("layers");
        },
        after: () => {
          restoreInspectorPanel?.();
          restoreInspectorPanel = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 14. pbx.settings.pages — PageManager.tsx (raíz). Mismo patrón que el paso 13,
  // con `openSiteSettings("pages")`.
  steps.push(
    (() => {
      let restoreInspectorPanel: (() => void) | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.settingsPages,
        popover: {
          title: t("steps.settingsPages.title"),
          description: t("steps.settingsPages.description"),
          side: "left",
        },
        before: () => {
          restoreInspectorPanel = expandInspectorPanel();
          useDocumentStore.getState().openSiteSettings("pages");
        },
        after: () => {
          restoreInspectorPanel?.();
          restoreInspectorPanel = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 15. pbx.settings.languages — I18nSettings.tsx (raíz). Mismo patrón que los
  // pasos 13-14, con `openSiteSettings("languages")`.
  steps.push(
    (() => {
      let restoreInspectorPanel: (() => void) | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.settingsLanguages,
        popover: {
          title: t("steps.settingsLanguages.title"),
          description: t("steps.settingsLanguages.description"),
          side: "left",
        },
        before: () => {
          restoreInspectorPanel = expandInspectorPanel();
          useDocumentStore.getState().openSiteSettings("languages");
        },
        after: () => {
          restoreInspectorPanel?.();
          restoreInspectorPanel = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 15b. pbx.settings.theme — ThemesEditor.tsx (raíz). chain F29, T2b
  // (D-F29.20): enseña que el tema fija color/tipografía/espaciado del sitio
  // entero. Mismo patrón D39/D41 que los pasos 13-15, con
  // `openSiteSettings("themes")`. Deliberadamente ADYACENTE al paso anterior
  // (`settingsLanguages`) y no al final del tour `rightPanel` (donde el plan
  // original lo listaba): `settingsLanguages` y `settingsTheme` son dos tabs del
  // MISMO panel de configuración del sitio, así que mantenerlos contiguos deja
  // el recorrido cambiando de tab una sola vez en vez de salir y volver.
  steps.push(
    (() => {
      let restoreInspectorPanel: (() => void) | null = null;
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.settingsTheme,
        popover: {
          title: t("steps.settingsTheme.title"),
          description: t("steps.settingsTheme.description"),
          side: "left",
        },
        before: () => {
          restoreInspectorPanel = expandInspectorPanel();
          useDocumentStore.getState().openSiteSettings("themes");
        },
        after: () => {
          restoreInspectorPanel?.();
          restoreInspectorPanel = null;
        },
        skipMissingElement: true,
      } satisfies TourStep;
    })(),
  );

  // 15c. pbx.settings.prefs — SiteSettingsPanel.tsx (la `<section>` de la tab
  // "settings"). Habla de las PREFERENCIAS del editor y, sobre todo, del nivel
  // de experiencia (simple/avanzado) — el switch que revela superficies
  // técnicas, entre ellas la pestaña Tokens del sidebar, que es donde se editan
  // tipografías y espaciado (`Sidebar.tsx` filtra esa tab con
  // `embedded && isSimple`). Existe porque el paso del tema (15b) solo habla de
  // color: el usuario reportó que prometer "tipografías" ahí era falso, y que
  // el camino a cambiarlas —pasar a Avanzado— no se explicaba en ningún sitio.
  //
  // Solo en modo EMBEBIDO (`standaloneChrome: false`): ahí esa sección monta
  // `EditorPreferences`, que es lo que el copy describe. En standalone la misma
  // sección muestra `SiteFileActions` y las preferencias viven en el menú de
  // perfil, cubierto por el paso `profileMenu` — push condicional + `when()`
  // como garantía redundante en runtime, exactamente el patrón inverso al de
  // ese paso.
  if (!config.standaloneChrome) {
    steps.push(
      (() => {
        let restoreInspectorPanel: (() => void) | null = null;
        return {
          anchorKey: BUILDER42_TOUR_ANCHORS.settingsPrefs,
          popover: {
            title: t("steps.settingsPrefs.title"),
            description: t("steps.settingsPrefs.description"),
            side: "left",
          },
          when: () => !config.standaloneChrome,
          before: () => {
            restoreInspectorPanel = expandInspectorPanel();
            useDocumentStore.getState().openSiteSettings("settings");
          },
          after: () => {
            restoreInspectorPanel?.();
            restoreInspectorPanel = null;
          },
          skipMissingElement: true,
        } satisfies TourStep;
      })(),
    );
  }

  // 16. pbx.pages.breadcrumb — PageBreadcrumb.tsx. Existe en el DOM en standalone
  // (dentro de su propio Header) o en el embed cuando el host prestó un slot de
  // página y el breadcrumb quedó portado dentro de SU header (D-F19.1; ver el doc
  // del `Builder42TourStepsConfig` de arriba). Con `pagesBreadcrumbAvailable = false`
  // el paso se omite entero, mismo patrón que `pbx.publish` (paso 17) usa para
  // `publishAvailable`: push condicional + `when()` como garantía redundante en
  // runtime. El copy transmite el concepto clave de que una landing es un sitio
  // multipágina (§3.2).
  if (config.pagesBreadcrumbAvailable) {
    steps.push({
      anchorKey: BUILDER42_TOUR_ANCHORS.pagesBreadcrumb,
      popover: {
        title: t("steps.pagesBreadcrumb.title"),
        description: t("steps.pagesBreadcrumb.description"),
        side: "bottom",
      },
      when: () => config.pagesBreadcrumbAvailable,
    });
  }

  // 17. pbx.publish — PublishPanel.tsx (publicar y subdominio). Solo si el adapter de
  // publicación del host está disponible (§3.2 precondición, §1.4.6): con
  // `publishAvailable = false`, `PublishPanel` sigue montado pero solo muestra el
  // mensaje de "deshabilitado" (`publish.disabledTitle`) — un paso de tour ahí sería
  // un tour explicando una superficie apagada, así que se omite entero. `before`
  // abre su propia tab (`openSiteSettings("publish")`, mismo seam D39 que los pasos
  // 13-15) porque `PublishPanel` solo existe en el DOM dentro de la tab "publish" de
  // `SiteSettingsPanel` — sin esto, este paso quedaba silenciosamente saltado en el
  // embed (ninguna otra navegación previa del tour deja esa tab activa).
  if (config.publishAvailable) {
    steps.push(
      (() => {
        let restoreInspectorPanel: (() => void) | null = null;
        return {
          anchorKey: BUILDER42_TOUR_ANCHORS.publish,
          popover: {
            title: t("steps.publish.title"),
            description: t("steps.publish.description"),
            side: "left",
          },
          when: () => config.publishAvailable,
          before: () => {
            restoreInspectorPanel = expandInspectorPanel();
            useDocumentStore.getState().openSiteSettings("publish");
          },
          after: () => {
            restoreInspectorPanel?.();
            restoreInspectorPanel = null;
          },
          skipMissingElement: true,
        } satisfies TourStep;
      })(),
    );
  }

  // 18. pbx.profileMenu — ProfileMenu.tsx (tema, idioma, nivel simple/avanzado,
  // controles de reorden). Solo existe en el DOM cuando el editor renderiza su
  // propio Header (shell standalone) — el embed nunca monta `Header` y no tiene
  // equivalente embebido para esta superficie (§ doc del `Builder42TourStepsConfig`
  // de arriba, D49; a diferencia de `pbx.pages.breadcrumb`, que desde D-F19.1 tiene
  // su propio flag porque sí puede existir embebida). Con `standaloneChrome = false`
  // el paso se omite entero, mismo patrón que `pbx.publish` (paso 17) usa para
  // `publishAvailable`: push condicional + `when()` como garantía redundante en
  // runtime.
  if (config.standaloneChrome) {
    steps.push({
      anchorKey: BUILDER42_TOUR_ANCHORS.profileMenu,
      popover: {
        title: t("steps.profileMenu.title"),
        description: t("steps.profileMenu.description"),
        side: "bottom",
        align: "end",
      },
      when: () => config.standaloneChrome,
    });
  }

  return steps;
}

/**
 * chain F29, T2a — id vocabulary for the four tours the single flat list (above) is
 * split into (D-F29.2/D-F29.20). Namespaced strings (`"builder42.<name>"`, never a bare
 * `"overview"`) so they cannot collide with anything else stored under the `tours`
 * record key (`createConfigBackedTourPersistence()`, chain F29 T1, D-F29.17) — that
 * record is keyed by tour id and is shared with whatever else eventually lands in it.
 */
export const BUILDER42_TOUR_IDS = {
  overview: "builder42.overview",
  library: "builder42.library",
  canvas: "builder42.canvas",
  rightPanel: "builder42.rightPanel",
} as const;

export type Builder42TourId = (typeof BUILDER42_TOUR_IDS)[keyof typeof BUILDER42_TOUR_IDS];

/** Presentation order for the chooser (T3) — overview first. */
export const BUILDER42_TOUR_ORDER: readonly Builder42TourId[] = [
  BUILDER42_TOUR_IDS.overview,
  BUILDER42_TOUR_IDS.library,
  BUILDER42_TOUR_IDS.canvas,
  BUILDER42_TOUR_IDS.rightPanel,
];

/**
 * D-F29.20 — the mapping: an ORDERED list of anchor keys per tour, deliberately not in
 * the flat list's own order. This is a contract, not a convenience grouping — copy it
 * exactly. `canvasFrame` (overview + canvas) and `inspectorTabs` (overview + rightPanel)
 * appear in TWO tours on purpose: this is a mapping, not a partition. `publish` and
 * `profileMenu` appear in NO tour — they stay filtered by the flags they already have
 * in `buildBuilder42TourSteps`, and must never be added here.
 *
 * **Divergence from `builder42-landing` (VENDOR #12, deliberate):** upstream's
 * `overview` list has a FIFTH entry, `headerDownload` (`pbx.header.download`). This
 * host persists landings through its own backend and mounts no `.zip`-download button
 * in its chrome, so that anchor does not exist here and was never ported — the step
 * would have nothing to highlight. `overview` is therefore 4 steps here, 5 upstream;
 * the other three tours match (3 / 8 / 7).
 *
 * Declared as `Record<Builder42TourId, readonly Builder42TourAnchorKey[]>` so the
 * compiler forces all four tours to be present. T2b (D-F29.20) appended one new
 * anchor to `library` (`sidebarDragHint`), two to `canvas` (`canvasInlineText`,
 * `canvasDragNode`) and one to `rightPanel` (`settingsTheme`) — the shape needed
 * no change to grow.
 */
export const BUILDER42_TOUR_ANCHOR_MAP: Record<Builder42TourId, readonly Builder42TourAnchorKey[]> = {
  [BUILDER42_TOUR_IDS.overview]: [
    BUILDER42_TOUR_ANCHORS.headerIdentity,
    BUILDER42_TOUR_ANCHORS.sidebarTabs,
    BUILDER42_TOUR_ANCHORS.canvasFrame,
    BUILDER42_TOUR_ANCHORS.inspectorTabs,
  ],
  [BUILDER42_TOUR_IDS.library]: [
    BUILDER42_TOUR_ANCHORS.sidebarPalette,
    // chain F29, T2b (D-F29.20): `sidebarDragHint` sits in position 2, between
    // `sidebarPalette` and `sidebarTemplates` — NOT position 3 as the original
    // plan listed. Mechanical reason: `sidebarTemplates`'s own `before` switches
    // the sidebar to the Templates tab, which unmounts every
    // `.pbx-palette__item` in the DOM. A drag-hint step placed AFTER that switch
    // would have no element left to highlight.
    BUILDER42_TOUR_ANCHORS.sidebarDragHint,
    BUILDER42_TOUR_ANCHORS.sidebarTemplates,
  ],
  [BUILDER42_TOUR_IDS.canvas]: [
    BUILDER42_TOUR_ANCHORS.canvasFrame,
    BUILDER42_TOUR_ANCHORS.settingsLayers,
    BUILDER42_TOUR_ANCHORS.canvasNodeActions,
    // chain F29, T2b (D-F29.20): `canvasInlineText` (position 4) and
    // `canvasDragNode` (position 5) sit right after `canvasNodeActions` — the
    // task's own contract placement, no deviation here.
    BUILDER42_TOUR_ANCHORS.canvasInlineText,
    BUILDER42_TOUR_ANCHORS.canvasDragNode,
    BUILDER42_TOUR_ANCHORS.toolbarViewport,
    BUILDER42_TOUR_ANCHORS.toolbarViews,
    BUILDER42_TOUR_ANCHORS.toolbarHistory,
  ],
  [BUILDER42_TOUR_IDS.rightPanel]: [
    BUILDER42_TOUR_ANCHORS.inspectorTabs,
    BUILDER42_TOUR_ANCHORS.inspectorBreakpoints,
    BUILDER42_TOUR_ANCHORS.settingsTabs,
    BUILDER42_TOUR_ANCHORS.settingsPages,
    BUILDER42_TOUR_ANCHORS.settingsLanguages,
    // chain F29, T2b (D-F29.20): `settingsTheme` sits right after
    // `settingsLanguages` and before `pagesBreadcrumb` — NOT last, as the
    // original plan listed. Mechanical reason: `settingsLanguages` and
    // `settingsTheme` are both tabs of the same site-settings panel, so keeping
    // them adjacent means the tour switches tabs once in a run instead of
    // leaving the panel's tab strip and coming back to it later.
    BUILDER42_TOUR_ANCHORS.settingsTheme,
    // El paso de preferencias va inmediatamente después del de tema por el
    // mismo argumento de adyacencia: son dos tabs del MISMO panel, así que el
    // recorrido cambia de tab una vez y sigue. Además el orden importa para el
    // relato: 15b dice "el tema es solo color", y 15c explica dónde está el
    // resto (Tokens) y cómo revelarlo (nivel Avanzado). Solo se emite en modo
    // embebido; en standalone esta entrada simplemente no encuentra su paso y
    // se omite, igual que `pagesBreadcrumb`/`publish` cuando su flag es falso.
    BUILDER42_TOUR_ANCHORS.settingsPrefs,
    BUILDER42_TOUR_ANCHORS.pagesBreadcrumb,
  ],
};

/**
 * D-F29.24 — selects and re-orders a subset of `buildBuilder42TourSteps`'s flat,
 * already flag-filtered list for one tour, per `BUILDER42_TOUR_ANCHOR_MAP`
 * (D-F29.20). `buildBuilder42TourSteps` itself is untouched by this function: every
 * call here rebuilds the flat list from scratch, so a step reused by two tours (
 * `canvasFrame`, `inspectorTabs`) gets its OWN fresh `before`/`after` closures — those
 * closures hold per-run state (see `sidebarTabs`'s `wasCompactBeforeStep`), so sharing
 * one instance across two tours would let one tour's run leak state into the other's.
 *
 * A mapped anchor whose step is absent from the flat list (filtered off by a flag —
 * `publish`/`profileMenu`/`pagesBreadcrumb`/`settingsPrefs` are the only anchors in this
 * registry that can be absent) is simply skipped: never a hole, never a thrown error.
 *
 * THE TRAP: in the flat list, `toolbarViews` is the step that forces
 * `useDocumentStore`'s `view` to `"edit"` before anything else runs, because in preview
 * mode the canvas is an `<iframe>` driver.js cannot highlight into — every later
 * canvas/sidebar/inspector anchor depends on that guarantee. Splitting the flat list
 * breaks it: `overview` and `rightPanel` never reach `toolbarViews` at all, and
 * `canvas` only reaches it fifth. So every tour's FIRST returned step here has its
 * `before` wrapped to force `view === "edit"` first, preserving and then calling
 * whatever `before` that step already had — unconditionally, since forcing an
 * already-`"edit"` view is a cheap no-op. The step object itself is never mutated
 * (spread + replaced `before`): the same flat-list step position is reused across
 * multiple tours, and mutating it would leak one tour's wrapper into the next tour's
 * copy of that step.
 *
 * The wrapper RETURNS whatever `originalBefore?.()` returns, rather than calling it as
 * a bare statement. `TourStep.before` is typed `() => void | Promise<void>` and the
 * engine `await`s it (`createTour.ts`), so a wrapper that swallows the inner call's
 * return value would drop an async original `before`'s promise on the floor. The
 * wrapper itself stays a plain, non-`async` arrow function — wrapping it in `async`
 * would force every tour's first step through a promise even when the original
 * `before` is synchronous, which is a timing change nothing here asked for.
 */
export function buildBuilder42TourStepsFor(
  tourId: Builder42TourId,
  config: Builder42TourStepsConfig,
  i18nInstance: I18nInstance,
): TourStep[] {
  const flatSteps = buildBuilder42TourSteps(config, i18nInstance);
  const anchorOrder = BUILDER42_TOUR_ANCHOR_MAP[tourId];

  const orderedSteps: TourStep[] = [];
  for (const anchorKey of anchorOrder) {
    const step = flatSteps.find((candidate) => candidate.anchorKey === anchorKey);
    if (step) orderedSteps.push(step);
  }

  const [firstStep, ...restSteps] = orderedSteps;
  if (!firstStep) return orderedSteps;

  const originalBefore = firstStep.before;
  const forcedFirstStep: TourStep = {
    ...firstStep,
    before: () => {
      const { view, setView } = useDocumentStore.getState();
      if (view !== "edit") setView("edit");
      return originalBefore?.();
    },
  };

  return [forcedFirstStep, ...restSteps];
}

/** Textos de botones/progreso del tour, resueltos desde el namespace i18n `tour` en
 * el idioma activo de `i18nInstance` (mismo contrato que `buildBuilder42TourSteps`,
 * D-F19.2). */
export function getBuilder42TourLabels(i18nInstance: I18nInstance): {
  nextBtnText: string;
  prevBtnText: string;
  doneBtnText: string;
  progressText: string;
} {
  const t = (key: string): string => i18nInstance.t(key, { ns: TOUR_I18N_NAMESPACE });
  return {
    nextBtnText: t("labels.nextBtnText"),
    prevBtnText: t("labels.prevBtnText"),
    doneBtnText: t("labels.doneBtnText"),
    progressText: t("labels.progressText"),
  };
}
