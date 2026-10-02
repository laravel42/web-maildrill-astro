/**
 * tourAnchors.ts — registro único de claves `data-tour` para el editor de landings
 * (Builder42).
 *
 * Única fuente de verdad de los strings de ancla (§4 F2b de
 * docs/product-tour-driverjs-plan.md, tabla §3.2): ningún `.tsx` de este paquete, ni el
 * host (`src/components/react/shared/EditorHeader.tsx`), debe escribir literalmente
 * `"pbx.toolbar.views"` o cualquier otra clave — todos importan de aquí.
 *
 * Mismo shape que el registro homólogo de EmailBuilder
 * (`packages/email-builder-standalone/src/tour/tourAnchors.ts`, F2a) para que ambos
 * editores compartan una forma de registro coherente. Este módulo no importa
 * `driver.js`: es deliberadamente una hoja sin dependencias (solo strings + un helper
 * de DOM), consumible tanto desde `packages/builder42` como desde el host sin arrastrar
 * nada del tour en sí. La carga diferida de driver.js, el motor del tour
 * (`@md/product-tour`, F1) y el registro de pasos (F3b, fase posterior) no son
 * responsabilidad de este archivo.
 *
 * Boundary de exportabilidad (§0 del plan): este archivo vive enteramente dentro de
 * `packages/builder42` y no importa nada de `src/` del host. La única costura permitida
 * hacia el host es la dirección inversa — `EditorHeader.tsx` importa esta ancla para
 * `pbx.header.identity` (host → paquete, nunca al revés) — igual que F2a hizo con
 * `EMAIL_BUILDER_TOUR_ANCHORS.headerIdentity`.
 */

/** Claves de ancla del tour "Editor de landings" — orden y valores fijados por §3.2 del plan. */
export const BUILDER42_TOUR_ANCHORS = {
  /** Host: `EditorHeader.tsx` — nombre y autoguardado de la landing. */
  headerIdentity: 'pbx.header.identity',
  /** `app/layout/HostToolbar.tsx` (`#md-landing-editor-views`) — grupo Editar/Previsualizar. */
  toolbarViews: 'pbx.toolbar.views',
  /** `app/layout/ViewportDropdown.tsx` — selector de tamaño de pantalla (breakpoints). */
  toolbarViewport: 'pbx.toolbar.viewport',
  /** `app/layout/HostToolbar.tsx` (`#md-landing-editor-history`) — deshacer/rehacer. */
  toolbarHistory: 'pbx.toolbar.history',
  /** `app/layout/Sidebar.tsx` — tabs Componentes/Plantillas (solo en modo `sidebarMode = "open"`). */
  sidebarTabs: 'pbx.sidebar.tabs',
  /** `app/layout/Sidebar.tsx` — paleta arrastrable de secciones y elementos. */
  sidebarPalette: 'pbx.sidebar.palette',
  /** `app/layout/TemplatesPanel.tsx` — tarjetas de plantillas de página (solo con la tab Plantillas activa). */
  sidebarTemplates: 'pbx.sidebar.templates',
  /** `app/layout/Canvas.tsx` (`.pbx-canvas__frame`) — el lienzo y su ancho por dispositivo. */
  canvasFrame: 'pbx.canvas.frame',
  /** `builder/dnd/NodeActionsRail.tsx` — duplicar/borrar el nodo seleccionado. */
  canvasNodeActions: 'pbx.canvas.nodeActions',
  /** `builder/inspector/InspectorForm.tsx` — tabs Contenido/Estilo/Interactividad. */
  inspectorTabs: 'pbx.inspector.tabs',
  /** `builder/inspector/panel/VisibilityStrip.tsx` — segmented de breakpoints (montado por InspectorForm). */
  inspectorBreakpoints: 'pbx.inspector.breakpoints',
  /** `builder/inspector/SiteSettingsPanel.tsx` (tabrow) — la fila de tabs de configuración del sitio; precondición: ningún nodo seleccionado (si no, el body muestra el formulario del elemento en vez del strip). */
  settingsTabs: 'pbx.settings.tabs',
  /** `builder/inspector/SiteSettingsPanel.tsx` (sección que envuelve `LayersTree`) — precondición: tab "layers" activa (`requestedSiteTab = "layers"`). */
  settingsLayers: 'pbx.settings.layers',
  /** `builder/inspector/PageManager.tsx` (raíz) — precondición: tab "pages" activa (`requestedSiteTab = "pages"`). */
  settingsPages: 'pbx.settings.pages',
  /** `builder/inspector/I18nSettings.tsx` (raíz) — precondición: tab "languages" activa (`requestedSiteTab = "languages"`). */
  settingsLanguages: 'pbx.settings.languages',
  /** `app/layout/PageBreadcrumb.tsx` — una landing es un sitio multipágina. */
  pagesBreadcrumb: 'pbx.pages.breadcrumb',
  /** `builder/inspector/PublishPanel.tsx` — publicar y subdominio. */
  publish: 'pbx.publish',
  /** `app/layout/ProfileMenu.tsx` — preferencias del editor (tema, idioma, nivel, reorder). */
  profileMenu: 'pbx.profileMenu',
  /**
   * `app/layout/Sidebar.tsx` (`SidebarItem`, el PRIMER item de la paleta en modo
   * "open") — el grip de arrastre (`.pbx-palette__grip`) sobre un item real de la
   * paleta, para enseñar el gesto de arrastrar-para-insertar (chain F29, T2b,
   * D-F29.20). Se aplica CONDICIONALMENTE (una prop `tourAnchor`), no a los ~30
   * items que renderiza el sidebar: solo al primero del primer grupo, en el sitio
   * de montaje de "open" (no en `CompactRail`, que renderiza tiles distintas,
   * `.pbx-compact-rail__tile`, y no items de paleta).
   */
  sidebarDragHint: 'pbx.sidebar.dragHint',
  /**
   * `builder/canvas/NodeRenderer.tsx` — el nodo SELECCIONADO (misma condición que
   * ya calcula `pbx-node--selected`), para enseñar la edición de texto en línea
   * (doble click) (chain F29, T2b, D-F29.20). Se aplica CONDICIONALMENTE: solo al
   * nodo cuyo id coincide con `selectedId`, nunca a los demás — un único elemento
   * en el DOM lleva esta ancla en un momento dado.
   */
  canvasInlineText: 'pbx.canvas.inlineText',
  /**
   * `builder/dnd/SelectionHandle.tsx` (`.pbx-drag-handle`) — el grip de arrastre
   * del nodo seleccionado, para enseñar a moverlo (chain F29, T2b, D-F29.20). Ese
   * grip se OCULTA deliberadamente en el modo touch/coarse-pointer (los controles
   * de flecha lo sustituyen — ver la cabecera de `SelectionHandle.tsx`), así que
   * el paso que usa esta ancla debe llevar `skipMissingElement: true`.
   */
  canvasDragNode: 'pbx.canvas.dragNode',
  /**
   * `builder/inspector/ThemesEditor.tsx` (raíz) — precondición: tab "themes"
   * activa (`requestedSiteTab = "themes"`), mismo seam D39 que `settingsLayers`/
   * `settingsPages`/`settingsLanguages` (chain F29, T2b, D-F29.20).
   */
  settingsTheme: 'pbx.settings.theme',
  /**
   * `builder/inspector/SiteSettingsPanel.tsx` (la `<section>` de la tab
   * "settings") — precondición: esa tab activa, mismo seam D39 que las anclas
   * de arriba. Se estampa SIN condición, pero el paso que la usa solo se emite
   * en modo EMBEBIDO (`standaloneChrome: false`): ahí esa sección renderiza
   * `EditorPreferences` (idioma del editor, tema, controles de reorden y
   * NIVEL DE EXPERIENCIA), que es de lo que habla el paso. En standalone la
   * misma sección muestra `SiteFileActions` y las preferencias viven en el
   * menú de perfil, ya cubierto por `profileMenu` — los dos pasos son
   * simétricos y mutuamente excluyentes por `standaloneChrome`.
   */
  settingsPrefs: 'pbx.settings.prefs',
} as const;

/** Unión de todas las claves de ancla válidas del tour de Builder42. */
export type Builder42TourAnchorKey =
  (typeof BUILDER42_TOUR_ANCHORS)[keyof typeof BUILDER42_TOUR_ANCHORS];

/**
 * Emite el atributo `data-tour` para una ancla del registro, listo para spread en JSX:
 * `<div {...dataTourAttr(BUILDER42_TOUR_ANCHORS.canvasFrame)}>`.
 *
 * Devolver un objeto (en vez de la string sola) deja la forma abierta a añadir más
 * adelante otros atributos derivados de la ancla (p. ej. `data-tour-group`) sin tocar
 * cada sitio de llamada.
 */
export function dataTourAttr(key: Builder42TourAnchorKey): { 'data-tour': Builder42TourAnchorKey } {
  return { 'data-tour': key };
}
