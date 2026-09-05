/**
 * Contratos del Component Registry (PLAN §3, docs/03 §2).
 *
 * El core no conoce los tipos concretos (P4): todo componente se describe con
 * una `ComponentDefinition` (defaults + schemas + un único `render`). El canvas
 * y el export usan el MISMO `render` (P3); el DnD y la selección se cuelgan del
 * elemento raíz vía `rootRef`/`rootProps`, sin wrapper (docs/02 §10.3).
 */

import type { ReactElement, ReactNode, Ref, HTMLAttributes } from "react";
import type {
  BehaviorInstance,
  Breakpoint,
  BuilderDocument,
  BuilderNode,
  ImageSource,
  LinkTarget,
  NodeAction,
  NodeId,
  NodeStyle,
  StyleGroup,
  StyleState,
} from "../model/types";

// ---------------------------------------------------------------------------
// Schemas declarativos para el Inspector (docs/03 §2)
// ---------------------------------------------------------------------------

export type ControlType =
  | "text"
  | "number"
  | "numeric"
  | "select"
  | "color"
  | "spacing"
  | "size"
  | "toggle"
  | "richtext"
  | "url"
  | "link"
  | "image-src"
  | "options-list"
  | "string-list"
  | "page-visibility-list"
  | "searchable-select"
  | "theme-select";

export interface FieldSchema {
  /** Ruta dentro de props (o del grupo de estilo). */
  key: string;
  label: string;
  control: ControlType;
  /**
   * Opciones del control. Un array para catálogos pequeños (lo actual), o una
   * FUNCIÓN para catálogos grandes: el Inspector la invoca solo cuando renderiza
   * el campo, así el catálogo no entra al grafo de módulos de quien solo importa
   * el registry (export, servidor, ghost del DnD). Retrocompatible: los
   * componentes con pocas opciones siguen pasando un array literal (docs/34 §2.1).
   */
  options?: { label: string; value: string }[] | (() => { label: string; value: string }[]);
  /**
   * Preview visual opcional por opción del control `searchable-select` (glifo de
   * icono, swatch de marca…). Recibe el `value` de la opción; `null` = sin preview
   * para ese valor (el control cae a un placeholder neutro). No es parte del
   * documento serializado — vive solo en la definición del componente (registry).
   */
  renderOptionPreview?: (value: string) => ReactElement | null;
  /**
   * Para `control: "options-list"`: catálogo opcional de sugerencias para el
   * campo `label` de cada fila (ej. redes sociales reconocidas). Cuando está
   * presente, ese campo se edita con un `searchable-select` (con preview vía
   * `renderLabelPreview`) en vez de texto libre; el usuario igual puede
   * escribir un valor fuera del catálogo (no es una restricción, es ayuda).
   * Acepta array o función lazy para catálogos grandes (docs/34 §2.1).
   */
  labelOptions?: { label: string; value: string }[] | (() => { label: string; value: string }[]);
  /** Preview visual opcional por sugerencia de `labelOptions` (mismo contrato que `renderOptionPreview`). */
  renderLabelPreview?: (value: string) => ReactElement | null;
  placeholder?: string;
  /**
   * Para `control: "numeric"`: unidades válidas para este campo (["px","%","em"…]),
   * mismo control que usa el Inspector de estilo (`NumericUnitInput`,
   * `builder/inspector/controls/NumericUnitInput.tsx`) — pill con número editable +
   * unidad seleccionable (toggle-able solo si `units` tiene más de una entrada) +
   * stepper ▲▼. Se activa/desactiva el selector de unidad según cuántas unidades
   * declare el campo: un solo elemento en `units` = unidad fija sin dropdown.
   */
  units?: string[];
  /**
   * Para `control: "numeric"`: unidad por defecto si el valor entra sin unidad
   * (p. ej. "16" → "16px"). Ausente = valores unitless se respetan tal cual.
   */
  defaultUnit?: string;
  /** Para `control: "numeric"`: incremento del stepper ▲▼ (default 1). */
  step?: number;
  /**
   * Clave i18n (namespace `inspector`) de una descripción detallada del campo.
   * Si está presente, el Inspector muestra un icono de información a la derecha
   * del label; al hacer hover aparece un tooltip con esta explicación (útil para
   * opciones poco obvias, p. ej. la clave de `localStorage` del theme-toggle).
   * Es una CLAVE, no el texto — el consumidor la resuelve con `t()` (P9).
   */
  help?: string;
  /** Agrupa controles en secciones del Inspector. */
  group?: string;
  /**
   * Visibilidad condicional del campo en el Inspector. Recibe el `node` actual y
   * devuelve `true` para mostrarlo, `false` para ocultarlo (o `undefined` para
   * mostrarlo siempre). Mismo espíritu que `BehaviorDefinition.appliesTo`: el
   * componente declara SUS condiciones, el Inspector solo las evalúa contra
   * el nodo (P4: el Inspector no conoce "toggle" ni "icon", solo lee este
   * flag del registry). Útil para campos que solo aplican bajo cierto behavior
   * (p. ej. `pressedName` de `icon` solo si el nodo tiene `toggle`) — evita
   * ensuciar el Inspector con controles que no harían nada en el nodo actual.
   * Cuando un campo se oculta, su valor persiste en `props` (no se borra):
   * si vuelve a cumplirse la condición, reaparece con el valor previo.
   */
  visibleWhen?: (node: BuilderNode) => boolean;
  /**
   * Este campo acepta traducción por idioma (docs/12 §B.5). Solo los campos
   * marcados aparecen en el panel de traducciones del Inspector; el valor por
   * defecto vive en `props`, las traducciones en
   * `page.translations[nodeId][locale][key]`.
   */
  translatable?: boolean;
}

/** Lista de opciones para un campo select/searchable-select (docs/34 §2.1). */
export type OptionList = { label: string; value: string }[];

/**
 * Resuelve el valor de `FieldSchema.options` o `FieldSchema.labelOptions`:
 * si es una función, la invoca; si es un array, lo devuelve tal cual.
 * Los controles del Inspector usan esta función para ser agnósticos del
 * formato (array estático vs. función perezosa, docs/34 §2.1).
 */
export function resolveOptions(
  options: OptionList | (() => OptionList) | undefined,
): OptionList {
  if (options === undefined) return [];
  return typeof options === "function" ? options() : options;
}

export interface PropsSchema {
  fields: FieldSchema[];
}

export interface StyleSchemaOverride {
  /** Grupos de estilo expuestos; por defecto los 4 (docs/03 §9). */
  enabledGroups?: StyleGroup[];
  extraFields?: FieldSchema[];
  /**
   * Estados de interacción editables del nodo (T9, AGENTS.md), con la clase
   * derivada (`classNameForNode(id, suffix)`, `export/cssSerializer.ts`) a la
   * que se ancla el CSS de ESE estado — porque el elemento con ese estado no
   * siempre es la raíz del nodo (p. ej. `tabs` → el botón de cada `tab`, no el
   * contenedor). El propio componente aplica esa clase al elemento correcto
   * en su `render()` cuando `!exportMode` (canvas, vía `resolveStateStyle`) y
   * SIEMPRE en `exportMode` (la clase debe existir en el HTML para que la
   * regla CSS generada le aplique). Ausente = el nodo no admite estados (la
   * mayoría; su estilo es solo `base`/`overrides` normal).
   */
  states?: { state: StyleState; classSuffix: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Contexto de render (PLAN §3)
// ---------------------------------------------------------------------------

export interface RenderContext {
  node: BuilderNode;
  /** Hijos ya resueltos (recursión hecha por el NodeRenderer). */
  children: ReactNode;
  /** true => sin chrome de edición; produce el HTML del export (P8). */
  exportMode: boolean;
  /**
   * En el canvas: true en modo Edit (selección/DnD), false en modo Preview
   * (hidratación real). `undefined` en export. Lo usa un componente para
   * decidir su render de canvas — p. ej. `modal` es un marcador invisible en
   * Edit pero se pinta como `<dialog>` real en Preview (para probar el disparo).
   */
  interactive?: boolean;
  /** Clase generada por el exportador (solo en export). */
  className?: string;
  /** Breakpoint activo del canvas (modo edición). */
  breakpoint: Breakpoint;

  /**
   * Resuelve un `LinkTarget` a un `href` real (docs/07 §4). En export lo
   * inyecta la pipeline (mapa `PageId → path`); en el canvas puede venir
   * undefined (los componentes caen a un fallback inocuo, p. ej. "#").
   */
  resolveLink?: (link: LinkTarget) => string;

  /**
   * Resuelve un `ImageSource` a un `src` usable (docs/07 §4). En el canvas
   * devuelve el data URL del asset (preview en vivo); en export, la ruta
   * `/assets/img/<file>`. Puede venir undefined (fallback a url directa).
   */
  resolveImageSrc?: (source: ImageSource) => string;

  // --- Editor-only: se inyectan para colgar DnD + selección en la raíz -----
  // sin envolver el nodo en un <div> extra (docs/02 §10.3). En exportMode
  // ambos son undefined (spread inocuo).
  rootRef?: Ref<HTMLElement>;
  rootProps?: HTMLAttributes<HTMLElement> & { "data-node-id"?: NodeId };

  /**
   * true cuando el nodo tiene un behavior con `runtime.clipsContentWhenActive`
   * Y estamos en modo Edit (`interactive` en `NodeRenderer`, nunca en
   * `exportMode` ni en Preview — ver `BehaviorRuntimeSpec.clipsContentWhenActive`
   * para el porqué). Un componente que recorta contenido según su propio
   * estilo (hoy solo `Container`, vía `overflow`/`size.height`) debe leer este
   * flag para renderizar en flujo normal en vez de aplicar ese recorte,
   * mientras se edita. El core sigue sin conocer "carousel": solo propaga un
   * booleano genérico calculado por `NodeRenderer` contra el registry.
   */
  suppressClip?: boolean;

  /**
   * true cuando este nodo se está renderizando dentro del OVERLAY de edición
   * del canvas (docs/20 §4.2), no en el flujo de la página. Lo usa un
   * componente no-visible (`editsInOverlay`, hoy `modal`) para pintar su
   * contenido editable (caja + hijos) en vez del placeholder de flujo.
   * `NodeRenderer` lo activa solo para el nodo raíz del overlay.
   */
  overlayEditing?: boolean;

  /**
   * Chrome fantasma de los behaviors activos del nodo, solo en Edit (docs/10
   * §5, feedback de usuario: "que se vean las flechas en las mismas
   * posiciones que en Preview, para decidir si dejarlas"). `NodeRenderer` lo
   * calcula agregando `BehaviorRuntimeSpec.editPreviewChrome(options)` de
   * CADA behavior activo del nodo que lo declare (ausente = ninguno);
   * `undefined` si no hay nada que mostrar. El core no interpreta el
   * contenido: solo lo renderiza donde el `ComponentDefinition` decida
   * (`Container.tsx`, como overlay absoluto dentro de su `position:relative`
   * ya existente). Nunca se calcula en Preview/export.
   */
  editPreviewChrome?: ReactNode;

  /**
   * Estado de interacción que se está EDITANDO en el Inspector (`StyleSection`
   * → selector "Estado"). Solo presente en el canvas para el nodo
   * seleccionado — el core no interpreta el valor: lo PROPAGA al `render()`
   * para que el componente pueda ajustar su salida (p. ej. `icon` pinta el
   * glifo alternativo cuando `previewState === "pressed"` y hay `pressedName`),
   * y `NodeRenderer` lo usa además para fijar `aria-pressed`/`aria-selected` en
   * el `rootProps` del nodo seleccionado y que la regla CSS del estado (`T9`)
   * aplique en vivo sin tocar el documento (P1: UI-state, no entra a zundo).
   * `undefined` en export (P8) y en Preview (ahí el estado lo gobierna el
   * usuario con el runtime real).
   */
  previewState?: StyleState;

  /**
   * Info de localización del sitio (docs/14 §2.5), presente SOLO si el sitio es
   * multilingüe (`site.meta.i18n`). La consumen componentes de navegación como
   * `language-nav` para renderizar enlaces a las versiones localizadas de la
   * página actual. `undefined` en sitios monolingües → el componente muestra un
   * placeholder informativo (nunca crashea). Lo construye el canvas
   * (`NodeRenderer`, desde el store + `editingLocale`) y el export
   * (`renderDocumentHtml`, desde el locale del loop actual) — misma forma en
   * ambos para que WYSIWYG y output coincidan (P3).
   */
  localeInfo?: {
    /** Locales configurados del sitio, en orden. */
    locales: string[];
    /** Locale que se está renderizando (canvas: `editingLocale`; export: el del loop). */
    currentLocale: string;
    /** Locale por defecto del sitio. */
    defaultLocale: string;
    /** href (con basePath) a la MISMA página en otro locale. */
    localizedHref: (targetLocale: string) => string;
  };

  /**
   * Páginas del sitio, en `pageOrder`, con su ruta ya resuelta (docs/16 §12.4,
   * rework del `navbar`). La consume `navbar` (y cualquier componente de
   * navegación futuro) para listar los enlaces del sitio SIN que el usuario
   * tenga que escribir cada `href` a mano: el componente solo decide qué
   * páginas ocultar (`props.hiddenPageIds`), el resto sale directo de aquí.
   * Agregar una página nueva al sitio la hace aparecer automáticamente en
   * cualquier `navbar` existente — el usuario la oculta si no la quiere ahí.
   *
   * Construido por el canvas (`NodeRenderer`, desde `site.pages`/`pageOrder`
   * + `buildPathMap`) y el export (`resolversFor` en `export/site.ts`) con el
   * mismo helper puro (`buildPathMap`/`buildPathMapForLocale`), para que
   * WYSIWYG y output coincidan (P3). Siempre presente (a diferencia de
   * `localeInfo`): todo sitio tiene al menos la home.
   */
  pagesInfo?: {
    pageId: string;
    title: string;
    href: string;
    /** true si es la página que se está renderizando actualmente. */
    isCurrent: boolean;
  }[];

  /**
   * Slots hijo ya renderizadas, en orden (docs/23 §3.2). Presente SOLO para
   * composites con `slots.splitRender` (hoy `tabs`): el padre necesita acceso
   * ESTRUCTURADO a sus slots porque su botón y su panel viven en regiones
   * separadas del DOM (patrón WAI-ARIA tablist → tabpanels). El padre lo usa
   * para armar la tablist (desde `node.props.label` de cada slot) y colocar los
   * paneles (desde `content`), en vez del `children` opaco. Los composites
   * AUTOCONTENIDOS (accordion: la slot pinta su `<details>` completo) NO lo
   * reciben y usan `ctx.children` como cualquier container. `NodeRenderer`
   * (canvas) y `renderDocumentHtml` (export) lo construyen idéntico (P3).
   */
  slots?: readonly SlotChild[];

  /**
   * Afordancia "+ añadir slot" del canvas (docs/23 Fase 5). Chrome de EDICIÓN:
   * un `ReactNode` (botón) que `NodeRenderer` construye SOLO para composites
   * (`def.slots`) en modo Edit, con el handler que llama `addSlot(id)` en el
   * store (el core posee el acceso al store; el componente solo lo COLOCA donde
   * corresponda — la tablist en `tabs`, tras las secciones en `accordion`).
   * `undefined` en export/preview y en no-composites → nunca sale al output
   * (P8). Se oculta al alcanzar `slots.max`.
   */
  slotAffordance?: ReactNode;

  /**
   * Id de la slot ACTIVA en edición de un composite `splitRender` (docs/23 §5,
   * T11). Solo presente en modo Edit (`interactive`) para composites cuyo botón
   * y panel viven en regiones separadas del DOM (hoy `tabs`): permite al usuario
   * "cambiar de pestaña" en el canvas para editar el panel que quiera (sin JS
   * runtime, que en Edit nunca corre). El componente usa este id para marcar la
   * pestaña seleccionada y mostrar SOLO su panel. `undefined` en export (P8) y
   * en Preview (ahí el runtime real gobierna qué panel se ve). Lo calcula
   * `NodeRenderer` desde `activeSlotByComposite` del store, con fallback a la
   * primera slot si no hay ninguna activa o la guardada ya no existe.
   */
  activeSlotId?: NodeId;

  /**
   * Callback para ACTIVAR una slot en edición (docs/23 §5, T11). Lo inyecta
   * `NodeRenderer` SOLO en modo Edit (`interactive`) para composites
   * `splitRender`; llama a `setActiveSlot(compositeId, slotId)` del store (el
   * core posee el acceso al store, el componente solo lo dispara desde el botón
   * de la pestaña — mismo espíritu que `slotAffordance`). `undefined` en
   * export/preview → el botón no cambia ningún estado ahí (P8).
   */
  onActivateSlot?: (slotId: NodeId) => void;
}

/**
 * Una slot hijo ya resuelta para el render de un composite `splitRender`
 * (docs/23 §3.2). `node` permite al padre leer props de la slot (p. ej.
 * `label`); `content` es el nodo de slot ya renderizado (su caja de panel con
 * `rootRef`/`rootProps` para selección/DnD).
 */
export interface SlotChild {
  id: NodeId;
  node: BuilderNode;
  content: ReactNode;
}

export type ComponentCategory = "layout" | "content" | "form" | "navigation";

/**
 * Estructura de slots repetibles de un COMPOSITE (docs/23 §3.1). Declarativa
 * (P4): el core no conoce "tabs", solo lee esto del registry. Un composite es
 * un componente cuyo contenido son slots (regiones repetibles) respaldadas por
 * nodos hijo tipados (`itemType`). Ausente en un `ComponentDefinition` = no es
 * composite.
 */
export interface SlotSpec {
  /** Tipo del nodo que ocupa cada slot repetible (p. ej. "tab", "accordion-item"). */
  itemType: string;
  /** Mínimo de slots; no se puede borrar por debajo. Default 1. */
  min?: number;
  /** Máximo de slots; oculta "+ añadir" al llegar. Default sin límite. */
  max?: number;
  /** Clave i18n (o texto) del botón "+ añadir" en el chrome de edición. */
  addLabel?: string;
  /**
   * ¿El padre necesita acceso estructurado a las slots en el render
   * (`RenderContext.slots`)? true para slots PARTIDAS donde botón y panel van
   * en regiones separadas del DOM (tabs). Las autocontenidas (accordion) no lo
   * necesitan (usan `ctx.children`). Default false.
   */
  splitRender?: boolean;
}

/**
 * Plantilla declarativa de un subárbol de hijos por defecto (docs/23 §7). La usa
 * `createNodeTreeForType` para sembrar el contenido inicial de un composite al
 * crearlo (p. ej. un `tabs` nuevo nace con 3 `tab`, cada uno con un `text`). Es
 * JSON declarativo (P4): tipos + props override + hijos recursivos; los ids se
 * generan frescos al expandir. Ausente = el nodo nace sin hijos sembrados.
 */
export interface DefaultChildSpec {
  type: string;
  /** Overrides sobre los `defaultProps` del tipo (merge superficial). */
  props?: Record<string, unknown>;
  children?: DefaultChildSpec[];
}

export interface ComponentDefinition {
  type: string;
  label: string;
  category: ComponentCategory;
  acceptsChildren: boolean;
  /**
   * Este componente soporta edición inline en el canvas (docs/12 §B.11): un
   * segundo click sobre el nodo ya seleccionado entra en modo edición
   * (`NodeRenderer` llama `startEditingText` en vez de solo `select`) y
   * desactiva el `draggable` de ese nodo mientras edita. Declarativo (P4): el
   * core no conoce el tipo `"text"`, solo consulta este flag del registry.
   * Hoy solo `text` lo usa.
   */
  editableInline?: boolean;
  /**
   * El elemento raíz de este componente contiene un hijo que CAPTURA los
   * eventos de puntero sobre toda su superficie (p. ej. el `<iframe>` de
   * `video`), impidiendo que el click/hover normal del canvas llegue al nodo
   * para seleccionarlo o arrastrarlo — hoy la única vía era el panel de capas,
   * poco descubrible para un usuario no técnico. Declarativo (P4): el core no
   * conoce "video", solo consulta este flag para decidir si debe mostrar el
   * `HoverHandle` (pestaña de agarre atenuada tras un hover sostenido,
   * `dnd/HoverHandle.tsx`) sobre este nodo cuando NO está ya seleccionado
   * (mientras está seleccionado, `SelectionHandle` ya cubre el mismo rol).
   * Ausente = el nodo no necesita esta ayuda (la mayoría; su propia superficie
   * ya es agarrable/seleccionable con normalidad).
   */
  blocksPointerCapture?: boolean;
  /**
   * Este componente NO puede recibir una acción de click (`node.onClick`,
   * docs/20 §3) ni figurar como candidato "disparador" en `ModalTriggersSection`:
   * su click nativo ya tiene un propósito propio que una acción pisaría —
   * entrar en edición inline (`text`, ver `editableInline`) o enfocar/escribir
   * un control de formulario nativo (`input`, `textarea`, `select`). Declarativo
   * (P4): el core no conoce estos tipos, solo consulta este flag. Ausente =
   * el componente puede ser disparador (default, la mayoría: `button`,
   * `container`, `image`…).
   */
  disallowsClickAction?: boolean;
  /**
   * Este componente participa en el micro-runtime `ui.js` (tier 1, docs/15
   * §1.5): su `render` emite `data-pb-ui="<valor>"` y el export incluye
   * `assets/js/ui.js` SOLO si hay ≥1 nodo de un tipo con este campo (tree-shake
   * por uso, cero-JS por defecto). Declarativo (P4): el core detecta el uso
   * consultando el registry, no conoce "select". Hoy solo `select`. El valor
   * coincide con la clave del enhancer en `src/runtime/ui.ts`.
   */
  uiRuntime?: string;
  /**
   * Este componente es un elemento NO-VISIBLE que se edita en un OVERLAY del
   * canvas, no en el flujo de la página (docs/20 §4.2). Declarativo (P4): el
   * store abre el overlay (`editingModalId`) al insertarlo, y el canvas
   * renderiza su contenido editable en una superficie flotante. Hoy solo
   * `modal`. Ausente = se edita en el flujo normal.
   */
  editsInOverlay?: boolean;
  /**
   * COMPOSITE (docs/23): estructura de slots repetibles. Ausente = no es
   * composite. El core lo usa para (a) construir `RenderContext.slots` si
   * `splitRender`, (b) validar que los hijos directos solo sean `slots.itemType`
   * (DnD tipado), y (c) exponer la afordancia "+ añadir slot".
   */
  slots?: SlotSpec;
  /**
   * Este componente es un NODO DE SLOT (docs/23 §3.1) y solo puede ser hijo
   * directo del composite cuyo `type` es este valor (p. ej. `isSlot: "tabs"`
   * para el `tab`). Alimenta el guard de colocación (`canPlaceChild`) y el de
   * mínimos/reorden. Ausente = no es slot (componente normal).
   */
  isSlot?: string;
  /**
   * No listar este componente en la paleta del sidebar (docs/23 §3.1). Los
   * nodos de slot se instancian solo vía la acción "+ añadir slot" del
   * composite, nunca arrastrándolos desde la paleta. Ausente = visible.
   */
  hiddenInPalette?: boolean;
  defaultProps: Record<string, unknown>;
  defaultStyle: NodeStyle;
  /**
   * Behaviors JS opt-in que el nodo trae DE FÁBRICA al crearse (docs/10 §2,
   * Bloque D — docs/16 §12.4). A diferencia del carousel (que el usuario añade
   * a mano sobre un container genérico), los componentes intrínsecamente
   * interactivos (`accordion`, `tabs`, `modal`, `navbar`) necesitan su runtime
   * para funcionar, así que lo declaran aquí y `createNodeForType` lo clona
   * junto con `defaultProps`/`defaultStyle`. Mecanismo genérico dirigido por el
   * registry (P4): el core no conoce estos tipos, solo clona lo declarado. El
   * usuario puede quitar/ajustar el behavior desde el Inspector como cualquier
   * otro (queda en `node.behaviors`, undo-able). Ausente = nodo estático.
   */
  defaultBehaviors?: BehaviorInstance[];
  /**
   * Subárbol de hijos sembrado al CREAR el nodo (docs/23 §7). Lo expande
   * `createNodeTreeForType` (usado por `addComponent`): útil para composites que
   * deben nacer con contenido (p. ej. `tabs` con 3 `tab`). Declarativo (P4);
   * ausente = el nodo nace con `children: []` (si acepta hijos) o sin children.
   */
  defaultChildren?: DefaultChildSpec[];
  /**
   * CSS ESTÁTICO del componente (T10, AGENTS.md): reglas presentacionales del
   * output que dependen del TIPO de componente, no de si tiene un behavior JS
   * adjunto — p. ej. `.pb-tabs__list`/`.pb-tabs__tab` (layout de la lista,
   * truncado, estado `aria-selected`) o `.pb-navbar__menu` (estructura de la
   * barra). Análogo a `BehaviorRuntimeSpec.css`, pero tree-shakeado por USO DEL
   * COMPONENTE (¿existe algún nodo de este `type` en el documento?), no por uso
   * del behavior. Se recolecta con `usedComponentsCssForNodes`
   * (`componentRegistry.ts`) y se emite en los mismos 3 caminos que el CSS de
   * behaviors (export a disco, preview autocontenido, editor en vivo).
   *
   * Motivo (bug real, feedback de usuario): antes de T10 este CSS vivía
   * ENTERO dentro de `BehaviorRuntimeSpec.css` del behavior JS del componente
   * — si el usuario quitaba el behavior desde el Inspector (p. ej. "Pestañas
   * (animadas)"), el componente quedaba sin ningún estilo presentacional
   * (labels sin truncar, sin estados pintados), rompiendo la promesa de
   * degradación de P9 ("degrada sin JS" ≠ "se rompe sin JS"). Migrar esta capa
   * al componente la hace incondicional: existe mientras el NODO exista, JS
   * adjunto o no. Deja en `BehaviorRuntimeSpec.css` solo lo que de verdad
   * depende de la hidratación (si queda algo — hoy, para `tabs`/`accordion`/
   * `navbar`/`modal`, ya no queda nada: todo era presentacional puro).
   * Ausente = el componente no aporta CSS propio (la mayoría; su estilo sale
   * 100% de `NodeStyle` vía `resolveStyle`/`cssSerializer`).
   */
  css?: string;
  propsSchema: PropsSchema;
  styleSchema?: StyleSchemaOverride;
  render: (ctx: RenderContext) => ReactElement;
}

// ---------------------------------------------------------------------------
// Behaviors: runtime JS opt-in del output (docs/10 §3, P4/P9)
// ---------------------------------------------------------------------------

/**
 * Metadata del módulo runtime del OUTPUT (docs/10 §3). NO se importa en el core
 * del builder: solo describe qué emitir en el export (Fase 8.2/8.3). En 8.1 es
 * pura declaración; el `enhance` real y el bundling llegan después.
 */
export interface BehaviorRuntimeSpec {
  /** id del módulo emitido; el export incluye solo los usados (tree-shake por uso). */
  moduleId: string; // "carousel"
  /** dependencia npm a bundlear en el output, si aplica (versión pineada). */
  npm?: { pkg: string; version: string };
  /** nombre del export que hidrata un elemento. Firma: (el, options) => cleanup? */
  enhance: string; // "enhanceCarousel"
  /**
   * CSS mínimo del chrome que el `enhance` inyecta en el DOM (flechas, dots…).
   * Es CSS del OUTPUT (no del editor, no `styles/chrome.css`): el export lo
   * emite en `assets/css/behaviors.css` SOLO si el behavior está en uso
   * (mismo criterio de tree-shake que el JS, docs/10 §4/§11).
   */
  css?: string;
  /**
   * Carga perezosa del `enhance` real para el Preview del EDITOR (docs/10 §5,
   * Fase 8.4). Usa `import()` dinámico apuntando al módulo del runtime
   * (`src/runtime/behaviors/<moduleId>.ts`); Vite lo trata como un chunk
   * propio (code-splitting nativo, sin bundlear el runtime dentro del editor
   * cuando no se usa). Distinto del bundle pre-compilado del export, que se
   * obtiene vía el contrato `RuntimeSourceProvider` (`export/runtimeSource.ts`,
   * docs/33 §2.1) — `runtimeBundles.vite.ts` en el editor, `runtimeBundles.node.ts`
   * en el servidor — que lee `dist/*.js` como texto: en Preview el
   * editor SÍ ejecuta el módulo (interactividad real en vivo), pero eso NO
   * afecta el export (P8 — `exportSite` nunca importa esto).
   */
  loadPreview?: () => Promise<(el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  /**
   * Este behavior recorta visualmente su contenido cuando está hidratado
   * (`overflow:hidden`, altura fija, `clip-path`…) — p. ej. `carousel`, que
   * en Preview/export solo muestra un slide/página a la vez. El runtime real
   * NUNCA corre en modo Edit (docs/10 §5: "pelearía con selección/DnD"), así
   * que ahí no hay recorte de por sí — pero si el usuario fija manualmente en
   * el Inspector el tamaño que ese recorte necesita (p. ej. la altura de un
   * carousel vertical), Edit hereda el mismo `size.height`/`overflow` y
   * termina ocultando visualmente los hijos que no entran, aunque el
   * documento los siga teniendo (P1 intacto: es un problema de VISTA, no de
   * modelo). Declarar `true` aquí (opt-in, ausente = no recorta) le dice al
   * core — vía `behaviorRegistry`, nunca `switch(type)` — que en Edit debe
   * ignorar ese recorte y mostrar todos los hijos en flujo normal para que
   * sigan siendo seleccionables/arrastrables. No afecta Preview (ahí SÍ debe
   * verse el recorte real, es su propósito, docs/10 §5 tabla) ni export
   * (P8). Ver `NodeRenderer.tsx` (`RenderContext.suppressClip`) y
   * `Container.tsx`.
   */
  clipsContentWhenActive?: boolean;
  /**
   * Chrome FANTASMA para el modo Edit (feedback de usuario): un behavior que
   * inyecta elementos de UI propios en runtime (flechas, dots…) los crea
   * fuera del JSON (P1/P8: nunca en `exportToHtml`, es 100% DOM del
   * `enhance`) — en Edit, donde ese `enhance` nunca corre, el usuario no
   * tiene ninguna pista de dónde van a caer esos elementos ni cómo se
   * verían con sus opciones actuales (p. ej. flechas arriba/abajo vs
   * izquierda/derecha según `orientation`). Esta función es puramente
   * declarativa (P4, mismo espíritu que `loadPreview`): recibe las
   * `options` ya resueltas del nodo y devuelve un `ReactNode` de solo-vista
   * (sin handlers reales — un click no navega el carousel, porque no hay
   * ninguna instancia de Embla en Edit) que el core renderiza tal cual,
   * SIN saber qué representa. Reutiliza las mismas clases CSS que
   * `runtime.css` para que la posición sea IDÉNTICA a Preview/export (evita
   * duplicar reglas de posicionamiento en dos lugares). Ausente = el
   * behavior no tiene chrome propio que previsualizar (default seguro).
   * Consumido por `NodeRenderer` → `RenderContext.editPreviewChrome` →
   * `Container.tsx` (hoy el único componente con `acceptsChildren`, por
   * tanto el único que puede alojar un behavior de este tipo).
   */
  editPreviewChrome?: (options: Record<string, unknown>) => ReactNode;
}

/**
 * Definición de un behavior (docs/10 §3). Igual que un componente se agrega
 * registrando su `ComponentDefinition`, un behavior se agrega registrando esto
 * en el `behaviorRegistry` — el core no conoce carousels (P4). El Inspector
 * genera los controles desde `optionsSchema` reutilizando el motor de props.
 */
export type BehaviorCategory = "content" | "motion" | "navigation" | "structure" | "interactive" | "appearance";

export interface BehaviorDefinition {
  type: string; // "carousel"
  label: string; // para el Inspector
  /**
   * Agrupación del catálogo en `BehaviorsSection` (docs/46 §3 Fase 3, H3):
   * hasta 17 behaviors en un solo grid plano superaba el techo de 4 opciones
   * simultáneas del criterio de aceptación #5. Declarativo (P4): el Inspector
   * (`BehaviorsSection.tsx`) solo agrupa por este campo vía un acordeón por
   * categoría (mismo patrón visual que `CategoryAccordion` del `Sidebar`,
   * clases `pbx-style-group*`) — no conoce "carousel" ni "sticky". Con 17
   * behaviors, 4 categorías no bastan para mantener cada grupo en ≤4 (el
   * mínimo matemático son 5 grupos); se usan 6, cada una ≤4:
   * `content` = agrega/transforma contenido visual (carousel, lightbox,
   * marquee, count-up); `motion` = animación disparada por scroll
   * (reveal-on-scroll, parallax, scroll-progress); `navigation` = ayuda a
   * ubicarse/navegar durante el scroll (scroll-spy, sticky); `structure` =
   * componentes compuestos con behavior de fábrica (accordion, modal, tabs,
   * navbar); `interactive` = requiere interacción del visitante para
   * cambiar de estado (toggle, expandable, form-validation); `appearance` =
   * decisión visual del sitio completo (theme-toggle).
   */
  category: BehaviorCategory;
  /** Restringe a qué nodos aplica (p. ej. solo containers). Ausente = todos. */
  appliesTo?: (node: BuilderNode) => boolean;
  /** Schema de opciones → controles del Inspector (mismo motor que props). */
  optionsSchema?: PropsSchema;
  defaultOptions?: Record<string, unknown>;
  /** Módulo runtime del output (declaración; sin runtime en 8.1). */
  runtime: BehaviorRuntimeSpec;
}

// ---------------------------------------------------------------------------
// Actions: acción de click de un nodo (docs/20 §3, docs/44 §2 — Fase 0)
// ---------------------------------------------------------------------------

/**
 * Qué tipo de objetivo pide una acción, para que el Inspector sepa qué picker
 * mostrar (docs/44 §2.2): un modal (`ModalTriggersSection`/selector de
 * modales), un nodo cualquiera del árbol, una página del sitio, o ninguno
 * (`scroll-to-top`, `submit-form`, `dismiss` sin `remember`…).
 */
export type ActionTargetKind = "modal" | "node" | "page" | "none";

/**
 * Definición de una acción de click (docs/44 §2.2). Igual que un behavior se
 * agrega registrando su `BehaviorDefinition` en el `behaviorRegistry`, una
 * acción se agrega registrando esto en el `actionRegistry` — el core
 * (`exportToHtml.ts`, `NodeRenderer.tsx`) no conoce ningún tipo concreto (P4):
 * solo consulta `dataAttributes(action)` para saber qué `data-pb-*` emitir.
 */
export interface ActionDefinition {
  type: string; // "open-modal"
  label: string; // para el Inspector
  /** ¿Esta acción aplica a este nodo? (ej. `close-modal` solo dentro de un `modal`). Ausente = todos. */
  appliesTo?: (node: BuilderNode, doc: BuilderDocument) => boolean;
  /** Qué objetivo pide, para que la UI sepa qué picker mostrar. */
  targetKind: ActionTargetKind;
  /** Params extra → controles del Inspector (mismo motor que props/behaviors). */
  optionsSchema?: PropsSchema;
  defaultParams?: Record<string, unknown>;
  /**
   * Atributos `data-pb-*` que el export/canvas emiten para esta acción. PURA
   * (P7/P8): sin acceso a store ni DOM, solo lee la `NodeAction` recibida.
   */
  dataAttributes: (action: NodeAction) => Record<string, string>;
  /** Módulo runtime que la ejecuta (`undefined` si la resuelve otro runtime, ej. `open-modal` → runtime del `modal`). */
  runtime?: {
    moduleId: string;
    enhance: string;
    css?: string;
    loadPreview?: () => Promise<
      (el: HTMLElement, action: NodeAction) => (() => void) | void
    >;
  };
}
