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
 */

import type { TourStep } from "@md/product-tour";
import i18n from "@/i18n";
import { useDocumentStore, type SideTab } from "@/builder/store/documentStore";
import type { InspectorTab } from "@/builder/inspector/form/types";
import { readConfig, writeConfig } from "@/hooks/useLocalConfig";
import { BUILDER42_TOUR_ANCHORS } from "./tourAnchors";

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
 *  - `standaloneChrome`: `pbx.pages.breadcrumb` (`PageBreadcrumb.tsx`) y
 *    `pbx.profileMenu` (`ProfileMenu.tsx`) solo existen en el DOM cuando el editor
 *    renderiza su propio `Header` (el shell standalone, `app/App.tsx`) — el embed
 *    (`Builder42Editor.tsx`) nunca monta `Header`; el host le da su propio
 *    header/toolbar en su lugar. `tourSteps.ts` no es un componente de React y no
 *    puede leer `useEmbeddedChrome` (el context que distingue standalone de embed en
 *    tiempo de render), así que cada caller resuelve el valor y lo pasa explícito,
 *    igual que `publishAvailable`: `app/App.tsx` pasa `true`, `Builder42Editor.tsx`
 *    pasa `false` (D49).
 */
export interface Builder42TourStepsConfig {
  /** Nivel de experiencia actual (`useLocalConfig("experienceLevel")`). */
  experienceLevel: "simple" | "advanced";
  /** `true` si el adapter/servidor de publicación está disponible (`fetchHealth().publish.enabled`). */
  publishAvailable: boolean;
  /** `true` si el editor renderiza su propio `Header` (shell standalone); `false` en el embed (D49). */
  standaloneChrome: boolean;
}

/** Namespace i18n de este registro — ver `src/i18n/locales/<lang>/tour.json`. */
const TOUR_I18N_NAMESPACE = "tour";

function t(key: string): string {
  return i18n.t(key, { ns: TOUR_I18N_NAMESPACE });
}

/** Primer hijo del nodo raíz del documento activo, o `null` si el lienzo está vacío. */
function firstRootChildId(): string | null {
  const { document } = useDocumentStore.getState();
  const root = document.nodes[document.rootId];
  const [first] = root?.children ?? [];
  return first ?? null;
}

/**
 * Construye los pasos elegibles del tour de Builder42, ya filtrados por `config` y con
 * el copy resuelto desde el namespace i18n `tour` en el idioma activo de la instancia
 * i18next del editor. El propio motor (`createTour`) vuelve a aplicar `when()` en
 * runtime; los `when` de aquí son la garantía estática de que ningún paso apunta a una
 * superficie apagada (§1.4.6).
 */
export function buildBuilder42TourSteps(config: Builder42TourStepsConfig): TourStep[] {
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
  // posiciona junto al nodo, §1.4.5): si el lienzo está vacío no hay nada que
  // seleccionar, así que el paso se omite por completo vía `when` (no solo se salta
  // el highlight — no debe contar en la barra de progreso de un tour sin nodos).
  steps.push({
    anchorKey: BUILDER42_TOUR_ANCHORS.canvasNodeActions,
    popover: {
      title: t("steps.canvasNodeActions.title"),
      description: t("steps.canvasNodeActions.description"),
      side: "right",
    },
    when: () => firstRootChildId() !== null,
    before: () => {
      const childId = firstRootChildId();
      if (childId) useDocumentStore.getState().select(childId);
    },
    skipMissingElement: true,
  });

  // 10. pbx.inspector.tabs — InspectorForm.tsx (tabs Contenido/Estilo/Interactividad).
  // Requiere nodo seleccionado (el Inspector solo monta `InspectorForm` con un nodo
  // activo) y el panel expandido (`inspectorCollapsed = false`, §1.4.5). Se expande
  // con `writeConfig` (D40, finding B29) — nunca con `localStorage.setItem` directo,
  // que persistiría el valor sin notificar a los suscriptores del hook y dejaría el
  // panel colapsado a tiempo para este paso.
  steps.push({
    anchorKey: BUILDER42_TOUR_ANCHORS.inspectorTabs,
    popover: {
      title: t("steps.inspectorTabs.title"),
      description: t("steps.inspectorTabs.description"),
      side: "left",
    },
    when: () => firstRootChildId() !== null,
    before: () => {
      const childId = firstRootChildId();
      if (childId) useDocumentStore.getState().select(childId);
      writeConfig("inspectorCollapsed", false);
    },
    skipMissingElement: true,
  });

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
  // snapshot-en-closure que el paso 7 usa para `sidebarTab`.
  steps.push(
    (() => {
      let previousInspectorTab: InspectorTab = "props";
      return {
        anchorKey: BUILDER42_TOUR_ANCHORS.inspectorBreakpoints,
        popover: {
          title: t("steps.inspectorBreakpoints.title"),
          description: t("steps.inspectorBreakpoints.description"),
          side: "left",
        },
        when: () => firstRootChildId() !== null,
        before: () => {
          const childId = firstRootChildId();
          if (childId) useDocumentStore.getState().select(childId);
          writeConfig("inspectorCollapsed", false);

          const { inspectorTab, setInspectorTab } = useDocumentStore.getState();
          previousInspectorTab = inspectorTab;
          setInspectorTab("style");
        },
        after: () => {
          useDocumentStore.getState().setInspectorTab(previousInspectorTab);
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

  // 16. pbx.pages.breadcrumb — PageBreadcrumb.tsx. Solo existe en el DOM cuando el
  // editor renderiza su propio Header (shell standalone) — el embed nunca monta
  // `Header` (§ doc del `Builder42TourStepsConfig` de arriba, D49). Con
  // `standaloneChrome = false` el paso se omite entero, mismo patrón que
  // `pbx.publish` (paso 17) usa para `publishAvailable`: push condicional +
  // `when()` como garantía redundante en runtime. El copy transmite el concepto
  // clave de que una landing es un sitio multipágina (§3.2).
  if (config.standaloneChrome) {
    steps.push({
      anchorKey: BUILDER42_TOUR_ANCHORS.pagesBreadcrumb,
      popover: {
        title: t("steps.pagesBreadcrumb.title"),
        description: t("steps.pagesBreadcrumb.description"),
        side: "bottom",
      },
      when: () => config.standaloneChrome,
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
  // propio Header (shell standalone) — el embed nunca monta `Header` (§ doc del
  // `Builder42TourStepsConfig` de arriba, D49). Con `standaloneChrome = false` el
  // paso se omite entero, mismo patrón que `pbx.publish` (paso 17) usa para
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

/** Textos de botones/progreso del tour, resueltos desde el namespace i18n `tour`. */
export function getBuilder42TourLabels(): {
  nextBtnText: string;
  prevBtnText: string;
  doneBtnText: string;
  progressText: string;
} {
  return {
    nextBtnText: t("labels.nextBtnText"),
    prevBtnText: t("labels.prevBtnText"),
    doneBtnText: t("labels.doneBtnText"),
    progressText: t("labels.progressText"),
  };
}
