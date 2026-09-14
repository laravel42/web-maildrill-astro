/**
 * tourAnchors.ts — registro único de claves `data-tour` para el editor de email.
 *
 * Única fuente de verdad de los strings de ancla (§4 F2a de
 * docs/product-tour-driverjs-plan.md, tabla §3.1): ningún `.tsx` de este paquete, ni el host
 * (`src/components/react/shared/EditorHeader.tsx`), debe escribir literalmente
 * `"eb.toolbar.views"` o cualquier otra clave — todos importan de aquí.
 *
 * Este módulo no importa `driver.js`: es deliberadamente una hoja sin
 * dependencias (solo strings + un helper de DOM), consumible tanto desde el paquete como desde
 * el host sin arrastrar nada del tour en sí. La carga diferida de driver.js, el motor del tour
 * (`@md/product-tour`, F1) y el registro de pasos (F3a, fase posterior) no son
 * responsabilidad de este archivo.
 */

/** Claves de ancla del tour "Editor de email" — orden y valores fijados por §3.1 del plan. */
export const EMAIL_BUILDER_TOUR_ANCHORS = {
  /** Host: `EditorHeader.tsx` — nombre, categoría, idioma, autoguardado. */
  headerIdentity: 'eb.header.identity',
  /** `TemplatePanel/MainTabsGroup.tsx` — editar vs. previsualizar, tamaño de pantalla. */
  toolbarViews: 'eb.toolbar.views',
  /** `TemplatePanel/index.tsx` — deshacer/rehacer (banda `#ee-editor-header`). */
  toolbarHistory: 'eb.toolbar.history',
  /** `ComponentsLibrary/ComponentsLibraryHandle.tsx` + `CompactBlocksList.tsx` — rail de bloques. */
  libraryRail: 'eb.library.rail',
  /** `ComponentsLibraryDrawer.tsx` — categorías `blocks`/`templates` (drawer expandido). */
  libraryTabs: 'eb.library.tabs',
  /** `TemplatePanel` — lienzo (`.preview-container`): clic para seleccionar, arrastrar para insertar. */
  canvasRoot: 'eb.canvas.root',
  /** `InspectorDrawer/index.tsx` (+ `InspectorHandle`) — editar el bloque seleccionado. */
  inspectorPanel: 'eb.inspector.panel',
  /** `@md/merge-tag-menu` en campos de texto — personalización con datos del suscriptor. */
  inspectorMergeTags: 'eb.inspector.mergeTags',
  /** `components/ImageSourceTabs.tsx` — galería / Unsplash / subida. */
  imageSources: 'eb.image.sources',
  /** `AIGeneration/AIGenerationDialog.tsx` — botón de entrada a generación con IA. */
  aiGenerate: 'eb.ai.generate',
  /** `TemplatePanel/ThemePresets/ThemePresetsButton.tsx` — tema global de la plantilla. */
  themePresets: 'eb.theme.presets',
  /** `App/CommandPalette/index.tsx` — paleta de comandos (⌘K). */
  commandPalette: 'eb.commandPalette',
  /** Host: `EditorHeader.tsx` — enviar prueba + guardar. */
  headerActions: 'eb.header.actions',
} as const;

/** Unión de todas las claves de ancla válidas del tour de EmailBuilder. */
export type EmailBuilderTourAnchorKey =
  (typeof EMAIL_BUILDER_TOUR_ANCHORS)[keyof typeof EMAIL_BUILDER_TOUR_ANCHORS];

/**
 * Emite el atributo `data-tour` para una ancla del registro, listo para spread en JSX:
 * `<div {...dataTourAttr(EMAIL_BUILDER_TOUR_ANCHORS.canvasRoot)}>`.
 *
 * Devolver un objeto (en vez de la string sola) deja la forma abierta a añadir más adelante
 * otros atributos derivados de la ancla (p. ej. `data-tour-group`) sin tocar cada sitio de
 * llamada.
 */
export function dataTourAttr(key: EmailBuilderTourAnchorKey): { 'data-tour': EmailBuilderTourAnchorKey } {
  return { 'data-tour': key };
}
