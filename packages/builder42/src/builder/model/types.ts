/**
 * Modelo de datos — fuente única de verdad del builder (PLAN §2, docs/01).
 *
 * Un documento es un ÁRBOL NORMALIZADO: `Record<id, node>` + `children: id[]`
 * (P2). El canvas, el preview y el HTML exportado son proyecciones de este
 * árbol; ninguna vista guarda estado propio que no derive de aquí (P1).
 *
 * El estilo es responsive DESDE EL DÍA UNO (P5): `NodeStyle = { base, overrides }`
 * mobile-first (docs/01 §1). El estilo es "cómo se ve"; las props son "qué hace /
 * qué contiene" — nunca se mezclan (P6).
 */

export type NodeId = string;

export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";

/** Breakpoints con override (todos menos `base`). */
export type OverrideBreakpoint = Exclude<Breakpoint, "base">;

// ---------------------------------------------------------------------------
// Valor de estilo — crudo o referencia a token (docs/08 §2)
// ---------------------------------------------------------------------------

/**
 * Un valor de estilo es un **string CSS crudo** (`"#2563eb"`, `"16px"`) o una
 * **referencia a un design token** del sitio (`{ token: "colors.brand.primary" }`).
 *
 * El widening es RETROCOMPATIBLE: `string` sigue siendo válido, así que los
 * documentos existentes no se rompen (docs/08 §2). La resolución del token a su
 * valor real (canvas) o a `var(--…)` (export) se hace en el borde de
 * serialización con `styleValueToCss` (`model/tokens.ts`), no en el modelo:
 * `resolveStyle` es token-agnóstico y propaga el `StyleValue` tal cual.
 *
 * Solo los campos "de valor" (espaciado, tamaño, apariencia, `gap`) aceptan
 * tokens. Los campos estructurales/enum de `layout` (`display`, `flexDirection`,
 * `gridTemplateColumns`, `overflow*`…) NO: no tiene sentido tokenizarlos.
 */
export type StyleValue = string | { token: string };

// ---------------------------------------------------------------------------
// Propiedades de estilo (docs/01 §1, PLAN §2.1)
// ---------------------------------------------------------------------------

export interface LayoutStyle {
  // `none` = ocultar el nodo en esa capa/breakpoint (docs/01 §5, docs/04 Fase 3).
  // `revert` = mostrar con el display NATURAL del tag; lo usa `computeShowAction`
  // para desocultar en un breakpoint cuando se hereda `none` de una capa inferior
  // y el componente no tiene display propio (docs/01 §8.1). El widening es
  // retrocompatible; `resolveStyle` cascada `display` como cualquier otro campo
  // y el export/canvas serializan el valor verbatim. `inline-block` es el
  // display natural declarado por componentes tipo `button` (docs/04 Fase 3
  // bugfix): antes se aplicaba fijo en el `render()` incluso en export, con lo
  // que un `<a style="display:inline-block">` inline pisaba por especificidad
  // el `.n-id { display:none }` del `@media` generado al ocultarlo en un
  // breakpoint. Ahora viaja por `defaultStyle` como cualquier otro valor, así
  // que la cascada mobile-first (canvas inline / export por clase+@media) lo
  // resuelve igual que el resto de las propiedades de layout.
  display?: "flex" | "grid" | "block" | "inline-block" | "none" | "revert";
  // flex
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  justifyContent?: string;
  alignItems?: string;
  gap?: StyleValue; // acepta token de spacing (docs/08 §2)
  // grid
  gridTemplateColumns?: string; // acepta "repeat(3, 1fr)"
  gridTemplateRows?: string;
  gridAutoFlow?: string;
  justifyItems?: string;
  placeItems?: string;
  // grid item (colocación explícita del hijo dentro del grid del padre)
  gridColumn?: string; // "2", "1 / 3", "span 2"
  gridRow?: string; // "1", "span 2"
  // overflow (slider horizontal, etc.)
  overflowX?: "visible" | "hidden" | "auto" | "scroll" | "clip";
  overflowY?: "visible" | "hidden" | "auto" | "scroll" | "clip";
  /** CSS `appearance` — `none` quita el estilo nativo del browser (inputs, selects). */
  appearance?: "none" | "auto";
}

export interface SpacingStyle {
  padding?: StyleValue;
  margin?: StyleValue;
}

export interface SizeStyle {
  width?: StyleValue;
  height?: StyleValue;
  minHeight?: StyleValue;
  maxWidth?: StyleValue;
}

export interface AppearanceStyle {
  background?: StyleValue;
  border?: StyleValue;
  /**
   * Sub-propiedades de borde: permiten ligar el COLOR del borde a un token
   * (`{ token: "colors.border" }`), algo imposible con el shorthand `border`
   * (que resolvería a `border: var(--…)`, sin ancho ni estilo). Úsalas juntas
   * (`borderWidth` + `borderStyle` + `borderColor`) para un borde token-coherente.
   */
  borderColor?: StyleValue;
  borderWidth?: StyleValue;
  borderStyle?: StyleValue;
  borderRadius?: StyleValue;
  color?: StyleValue;
  /** cursor CSS (pointer, default, not-allowed…). */
  cursor?: StyleValue;
  /** outline CSS (útil para inputs/selects). */
  outline?: StyleValue;
  /** boxShadow CSS (sombras, anillos de foco). */
  boxShadow?: StyleValue;
}

/**
 * Estilo tipográfico (docs/08 §6). Los valores aceptan tokens: `fontFamily` →
 * `typography.families`, `fontSize` → `typography.sizes`, `fontWeight` →
 * `typography.weights`, `lineHeight` → `typography.lineHeights`. `textAlign` es
 * un enum, no se tokeniza.
 */
export interface TypographyStyle {
  fontFamily?: StyleValue;
  fontSize?: StyleValue;
  fontWeight?: StyleValue;
  lineHeight?: StyleValue;
  textAlign?: string;
  textDecoration?: string;
}

/** Grupos de estilo. El merge responsive es por grupo, campo a campo (docs/01 §2). */
export interface StyleProperties {
  layout?: LayoutStyle;
  spacing?: SpacingStyle;
  size?: SizeStyle;
  appearance?: AppearanceStyle;
  typography?: TypographyStyle;
}

/** Nombre de un grupo de estilo (para recorrer/habilitar en el Inspector). */
export type StyleGroup = keyof StyleProperties;

// ---------------------------------------------------------------------------
// NodeStyle responsive (mobile-first) — docs/01 §1
// ---------------------------------------------------------------------------

export interface NodeStyle {
  /** Capa base: aplica a TODOS los tamaños (mobile-first). */
  base: StyleProperties;
  /**
   * Overrides por breakpoint. Cada uno aplica a partir del `min-width` del
   * breakpoint y solo declara lo que cambia (ej: `{ md: { layout: { flexDirection: "row" } } }`).
   */
  overrides?: Partial<Record<OverrideBreakpoint, Partial<StyleProperties>>>;
  /**
   * Estilo por ESTADO de interacción (T9, AGENTS.md), ortogonal a los
   * breakpoints: aplica sobre la capa base independientemente del tamaño de
   * pantalla (sin variante por breakpoint por ahora — si se necesita "hover
   * distinto en mobile" en el futuro, se extiende sin romper esto). Ausente =
   * comportamiento actual (retrocompat total). Cada componente declara en su
   * `styleSchema.states` qué estados admite editar (p. ej. `tabs` → `selected`)
   * y qué SELECTOR CSS le corresponde (`export/cssSerializer.ts#STATE_SELECTORS`).
   */
  states?: Partial<Record<StyleState, Partial<StyleProperties>>>;
}

/**
 * Estado de interacción/UI editable por el Inspector (T9). Extensible: hoy
 * `hover` (pseudo-clase CSS nativa, cualquier componente), `selected`
 * (estado ARIA de un componente compuesto, hoy solo el botón de `tab` dentro
 * de `tabs`) y `pressed` (estado ARIA `aria-pressed`, escrito por el behavior
 * genérico `toggle` sobre el propio nodo — cualquier tipo de componente, ver
 * `registry/behaviors/toggle.ts`). El mapeo estado → selector CSS vive en
 * `export/cssSerializer.ts#STATE_SELECTORS`, no aquí (el modelo no conoce CSS).
 */
export type StyleState = "hover" | "selected" | "pressed";

// ---------------------------------------------------------------------------
// Nodo y documento — PLAN §2
// ---------------------------------------------------------------------------

export interface BuilderNode {
  id: NodeId;
  /** Tipo resuelto contra el componentRegistry (P4: el core no hace switch(type)). */
  type: string;
  /** Props funcionales (src, href, content, columns, …). Nunca estilo (P6). */
  props: Record<string, unknown>;
  /** Estilo responsive (P5). Nunca props funcionales (P6). */
  style: NodeStyle;
  /** Solo componentes container-like. IDs, no nodos anidados (P2). */
  children?: NodeId[];
  /**
   * Behaviors JS opt-in del OUTPUT (docs/10 §2, P9). Tercer eje ortogonal a
   * `style`/`props`: interactividad que necesita runtime en el sitio publicado
   * (carousel, lightbox…). Ausente = nodo estático (default cero-JS). `options`
   * es JSON plano serializable (P1); nunca funciones ni referencias.
   */
  behaviors?: BehaviorInstance[];
  /**
   * Acción al hacer click (docs/20 §3, docs/44 §2/§8.1). Eje ortogonal a
   * props/style/behaviors, disponible en CUALQUIER nodo: el export la emite
   * centralmente vía el `actionRegistry` (sin tocar el `render` de cada
   * componente — P4). Ausente = sin acción.
   *
   * Cardinalidad 1 por decisión de producto, no por limitación de diseño
   * (docs/44 §8.1 D1): un nodo tiene a lo sumo UNA acción de click. El día que
   * se necesite más de una, el cambio es el tipo de este campo (a
   * `NodeAction[]`) + el helper `nodeActions()` (`model/nodeAction.ts`, ya
   * devuelve una lista) + la UI — los consumidores (export, `NodeRenderer`)
   * ya leen a través del helper y no notan el cambio.
   *
   * Otros eventos (`onHover`, `onLoad`, `onVisible`): fuera de alcance por
   * ahora (docs/44 §8.3). Reevaluar solo ante un caso concreto, no en
   * abstracto.
   */
  onClick?: NodeAction;
}

/**
 * Acción de click de un nodo (docs/20 §3, docs/44 §2.1). JSON plano
 * serializable (P1); el código que la ejecuta vive en el runtime del output
 * (registrado en `registry/actionRegistry.ts`), nunca en el documento.
 *
 * `type` es la clave en el `actionRegistry` (antes un literal único
 * `"open-modal"`, ahora `string` — ensanchamiento de tipo retrocompatible,
 * sin migración: todo documento existente con `{ type: "open-modal", target }`
 * sigue siendo válido). `target` pasa a opcional: acciones como
 * `scroll-to-top` o `submit-form` no necesitan uno.
 */
export interface NodeAction {
  /** Tipo de acción; clave en el `actionRegistry` (ej. "open-modal", "close-modal", "scroll-to"…). */
  type: string;
  /** Objetivo interno de la acción (modal, nodo, ancla…), si `targetKind` de su definición lo pide. */
  target?: NodeId;
  /** Parámetros adicionales, validados por el `optionsSchema` de su `ActionDefinition`. */
  params?: Record<string, unknown>;
}

/**
 * Instancia de un behavior sobre un nodo (docs/10 §2). `type` es la clave en el
 * `behaviorRegistry`; `options` (JSON plano, validado por el `optionsSchema` del
 * behavior) parametriza el runtime. El código del runtime NO vive aquí (P4/P9):
 * el documento solo guarda `type` + `options`.
 */
export interface BehaviorInstance {
  type: string; // "carousel"
  options?: Record<string, unknown>;
}

export interface BreakpointConfig {
  /** Orden mobile-first de la cascada. */
  order: Breakpoint[];
  /** `min-width` en px de cada breakpoint con override. */
  minWidth: Record<OverrideBreakpoint, number>;
}

export interface DocumentMeta {
  version: number;
}

export interface BuilderDocument {
  rootId: NodeId;
  /** Árbol normalizado, NO anidado (P2). */
  nodes: Record<NodeId, BuilderNode>;
  meta: DocumentMeta;
}

// ---------------------------------------------------------------------------
// Config de breakpoints por defecto — docs/01 §1
// ---------------------------------------------------------------------------

export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  order: ["base", "sm", "md", "lg", "xl"],
  minWidth: { sm: 640, md: 768, lg: 1024, xl: 1280 },
};

// ---------------------------------------------------------------------------
// Nivel sitio: N páginas (docs/06)
// ---------------------------------------------------------------------------

export type PageId = string;

export type AssetId = string;

/**
 * Recurso binario del sitio (imagen subida). Se guarda como data URL para que
 * el sitio siga siendo **un solo JSON autocontenido** (docs/06 §8). En export
 * se materializa a `assets/img/<fileName>` y el `src` se reescribe a esa ruta.
 */
export interface Asset {
  id: AssetId;
  fileName: string; // "hero.png"
  mimeType: string; // "image/png"
  dataUrl: string; // "data:image/png;base64,…"
  /**
   * Metadata de atribución cuando el asset proviene de un banco de imágenes
   * (docs/35 §2 Fase D). Opcional — ausente en assets subidos manualmente.
   */
  attribution?: AssetAttribution;
}

/** Atribución de un asset importado desde un proveedor externo (docs/35). */
export interface AssetAttribution {
  source: "unsplash";
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
}

/**
 * Fuente de una imagen: una URL externa o una referencia a un asset gestionado
 * del sitio (docs/07 §4). La referencia es estable (P1): el asset se resuelve a
 * su data URL en el canvas y a `/assets/img/<file>` en export.
 */
export type ImageSource =
  | { kind: "url"; url: string }
  | { kind: "asset"; assetId: AssetId };

/** Destino de un enlace. Un enlace interno referencia un `PageId` estable (NO una
 * URL): renombrar el slug no rompe enlaces (P1, docs/06 §4). La URL se resuelve
 * en export (docs/07 §4).
 */
export type LinkTarget =
  | { kind: "internal"; pageId: PageId; anchor?: NodeId }
  | { kind: "external"; href: string }
  | { kind: "anchor"; nodeId: NodeId };

// ---------------------------------------------------------------------------
// Contenido multilingüe (docs/12 §B) — Dimensión B: idiomas del sitio publicado.
// Independiente de la Dimensión A (i18n del editor, src/i18n/). Additive al
// schema existente: `props` no cambia de forma, `translations`/`i18n` son `?`.
// ---------------------------------------------------------------------------

/**
 * Idiomas configurados para el sitio (docs/12 §B.4). `undefined`/ausente en
 * `SiteMeta.i18n` significa sitio monolingüe (retrocompat total).
 */
export interface I18nConfig {
  /** Idiomas habilitados. Debe incluir `defaultLocale`. */
  locales: string[]; // ["es", "en", "it"]
  /** Idioma por defecto del sitio (coincide con `SiteMeta.defaultLang`). */
  defaultLocale: string; // "es"
  /** Estrategia de rutas en el export estático (docs/12 §B.7). */
  routeStrategy: "prefix-except-default" | "prefix-all";
  // "prefix-except-default": /about/ (es), /en/about/, /it/about/
  // "prefix-all": /es/about/, /en/about/, /it/about/
}

/**
 * Traducciones de props de UN nodo, por idioma (docs/12 §B.4). Cada entrada
 * mapea `propKey -> valor traducido`; solo los campos marcados
 * `translatable: true` en el `propsSchema` del componente participan.
 */
export type NodeTranslations = Record<string, Record<string, unknown>>;
// { "en": { "content": "<p>Hello</p>" }, "it": { "content": "<p>Ciao</p>" } }
// El idioma default NO necesita entrada aquí: usa el valor de `props` tal cual.

/**
 * Metadata SEO traducible de una página, por idioma (docs/12 §B.9). Cada
 * entrada es un subconjunto parcial de los campos SEO de `PageMeta`; los
 * campos ausentes caen al valor del idioma default (`PageMeta` tal cual) —
 * mismo criterio de fallback que `NodeTranslations` (docs/12 §B.4). El `slug`
 * NO se traduce a propósito (docs/12 §B.9): las rutas usan el locale como
 * prefijo, no slugs distintos por idioma.
 */
export interface PageMetaTranslation {
  title?: string;
  description?: string;
  seo?: {
    canonical?: string;
    robots?: string;
    openGraph?: {
      title?: string;
      description?: string;
      image?: string;
      type?: string;
    };
    twitter?: {
      card?: string;
      title?: string;
      description?: string;
      image?: string;
    };
  };
}

/** Metadata SEO de una página (docs/06 §2.1). */
export interface PageMeta {
  title: string; // <title>
  slug: string; // ruta: "" (home), "about", "blog/post"
  description?: string;
  lang?: string; // override del idioma del sitio
  seo?: {
    canonical?: string;
    robots?: string;
    openGraph?: {
      title?: string;
      description?: string;
      image?: string;
      type?: string;
    };
    twitter?: {
      card?: string;
      title?: string;
      description?: string;
      image?: string;
    };
  };
  /**
   * Traducciones de metadata SEO, por idioma (docs/12 §B.9). Omitido si el
   * sitio es monolingüe o si ningún locale tiene traducción propia. El
   * idioma default NO necesita entrada aquí: usa los campos de arriba
   * directamente. Se resuelve con `resolveMetaForLocale` (`model/i18nContent.ts`),
   * el mismo criterio de fallback campo-a-campo que `resolvePropsForLocale`.
   */
  metaTranslations?: Record<string, PageMetaTranslation>;
  /**
   * Override de tema por página (docs/11 §2). Ausente → la página hereda el
   * tema por defecto del sitio (`site.meta.defaultThemeId`). Debe ser una clave
   * de `site.meta.themes`.
   */
  themeId?: ThemeId;
}

/** Una página = su metadata + su árbol (el `BuilderDocument` de siempre). */
export interface BuilderPage {
  id: PageId;
  meta: PageMeta;
  document: BuilderDocument;
  /**
   * Traducciones de `props`, por nodo, por idioma (docs/12 §B.4). Omitido si
   * el sitio es monolingüe (retrocompat). `props` en el documento SIEMPRE
   * contiene el contenido en `site.meta.defaultLang`; las traducciones a otros
   * idiomas viven aquí y solo cubren los campos marcados
   * `propsSchema.field.translatable` (docs/12 §B.5). Si un campo no tiene
   * traducción, se usa el valor de `props` como fallback (docs/12 §B.7).
   */
  translations?: Record<NodeId, NodeTranslations>;
}

/** Familia tipográfica como token (docs/08 §1). */
export interface TokenFontFamily {
  stack: string;
  webFont?: {
    provider: "google";
    family: string;
    weights?: string[];
  };
}

/**
 * Valor de un token escalar de tipografía, con overrides opcionales por
 * breakpoint (docs/49). Mismo `Breakpoint`/mobile-first que `NodeStyle.overrides`
 * (docs/01 §2), pero a nivel de TOKEN (sitio) en vez de nodo: un cambio en
 * `base` o en un breakpoint propaga a todos los nodos que referencian el
 * token, sin tocar el `overrides` de cada nodo por separado.
 *
 * Un token SIN variación por breakpoint sigue siendo un `string` plano
 * (unión de tipos): retrocompat total, ningún sitio guardado antes de esta
 * feature necesita migración. Solo `typography.sizes`/`typography.lineHeights`
 * usan este tipo (docs/49 §1) — los demás grupos de tokens siguen siendo
 * `string` puro.
 */
export type ResponsiveTokenValue =
  | string
  | {
      base: string;
      overrides?: Partial<Record<OverrideBreakpoint, string>>;
    };

/** `true` si el valor de un token escalar de tipografía varía por breakpoint. */
export function isResponsiveTokenValue(
  value: ResponsiveTokenValue,
): value is { base: string; overrides?: Partial<Record<OverrideBreakpoint, string>> } {
  return typeof value === "object" && value !== null;
}

/**
 * Árbol de tokens de un grupo (docs/08 §1): valores anidables. Una hoja es un
 * `string` (el valor CSS); una rama es otro `TokenGroupTree`. Así los tokens se
 * agrupan jerárquicamente (`colors.surface.default`, `colors.surface.alt`) en
 * vez de claves planas. `flattenTokens` lo aplana a rutas con puntos. Una clave
 * con puntos y valor string (`{ "brand.primary": "#…" }`) también es válida y
 * equivale a la forma anidada (retrocompat).
 */
export type TokenGroupTree = { [key: string]: string | TokenGroupTree };

/**
 * Design tokens del sitio (docs/08 §1). Fuente única de los valores de diseño;
 * en export se emiten como CSS custom properties (`var(--…)`). El tipo se
 * declara aquí (junto con `StyleValue`); la resolución/picker son fase propia.
 */
export interface DesignTokens {
  colors?: TokenGroupTree;
  spacing?: TokenGroupTree;
  radii?: TokenGroupTree;
  shadows?: TokenGroupTree;
  /**
   * Anchos de contenedor/contenido (docs/08 §1, ej. `sizes.container = 1200px`).
   * Grupo separado de `spacing`: semánticamente son anchos máximos de layout,
   * no espaciados — evita que un token de padding (`spacing.sm = 8px`) aparezca
   * como opción al fijar el `max-width` de un contenedor raíz.
   */
  sizes?: TokenGroupTree;
  typography?: {
    families?: Record<string, TokenFontFamily>;
    /** Tamaños de texto (docs/49): valor plano o responsive por breakpoint. */
    sizes?: Record<string, ResponsiveTokenValue>;
    weights?: Record<string, string>;
    /** Interlineados (docs/49): valor plano o responsive por breakpoint. */
    lineHeights?: Record<string, ResponsiveTokenValue>;
  };
}

/** Identificador de tema (docs/11 §2). */
export type ThemeId = string;

/**
 * Referencia a otro token (`{ token: "colors.blue.500" }`). Es la misma forma
 * de objeto que la variante no-string de `StyleValue`; se nombra aparte para
 * expresar intención en la capa semántica de temas: un token **semántico**
 * (`colors.primary`) apunta a un **primitivo** (`colors.blue.500`) (docs/11 §1).
 */
export type TokenRef = { token: string };

/**
 * Tema: conjunto nombrado de valores de token intercambiable (docs/11 §2).
 * Remapea/añade tokens sobre los del sitio (`site.meta.tokens`) y opcionalmente
 * hereda de otro tema (`extends`, base + override). Todo es JSON serializable
 * (P1/P2): un tema no tiene código, solo valores o referencias de token. Los
 * componentes referencian **semánticos**, así que cambiar de tema es remapear
 * alias, no tocar cada nodo — también es el mecanismo de claro/oscuro y de
 * branding de empresa (docs/11 §1).
 */
export interface Theme {
  id: ThemeId;
  name: string;
  /** Herencia: el tema hijo redefine solo deltas y hereda el resto del base. */
  extends?: ThemeId;
  /**
   * Remapea/añade tokens por ruta jerárquica (`colors.primary`,
   * `typography.families.sans`…). El valor puede ser crudo (`"#2563eb"`) o una
   * referencia a otro token (`{ token: "colors.blue.500" }`), permitiendo que
   * un semántico apunte a un primitivo (capa semántica, docs/11 §1).
   */
  tokens: Partial<Record<string, StyleValue>>;
  /** Pista para `<meta name="color-scheme">` y `prefers-color-scheme`. */
  colorScheme?: "light" | "dark";
}

/** Metadata compartida del sitio (docs/06 §2.2). Breakpoints y tokens viven aquí. */
export interface SiteMeta {
  name: string;
  defaultLang: string;
  baseUrl?: string;
  basePath?: string;
  favicon?: string;
  breakpoints: BreakpointConfig; // subido desde la página (docs/06 §3)
  tokens?: DesignTokens; // docs/08
  /**
   * Temas del sitio (docs/11 §2). Ausente o vacío = sin sistema de temas
   * (retrocompat total: el sitio usa solo `tokens`). Cada clave es un `ThemeId`.
   */
  themes?: Record<ThemeId, Theme>;
  /**
   * Tema por defecto del sitio (docs/11 §2). Si está presente debe ser una
   * clave de `themes`. Una página puede sobrescribirlo con `page.meta.themeId`.
   */
  defaultThemeId?: ThemeId;
  /** Contenido multilingüe (docs/12 §B.4). Ausente = sitio monolingüe. */
  i18n?: I18nConfig;
  /**
   * Identificador estable de publicación (docs/36 D5/F2, B1). Ausente hasta la
   * primera publicación — se genera entonces (`slugifySiteId(meta.name)`, con
   * sufijo aleatorio corto si queda vacío o el servidor reporta colisión) y se
   * persiste EN EL SITIO (no en `localStorage`): republicar tras
   * guardar/cargar el `.json` en otra máquina debe apuntar al mismo destino.
   * Campo opcional, sin migración ni bump de `version`.
   */
  siteId?: string;
  version: number;
}

/**
 * Un sitio: `Record<PageId, BuilderPage>` normalizado (P2 un nivel arriba) +
 * `pageOrder` + `homePageId`. Un JSON = un `BuilderSite` completo (docs/06 §8).
 */
export interface BuilderSite {
  meta: SiteMeta;
  pages: Record<PageId, BuilderPage>;
  pageOrder: PageId[];
  homePageId: PageId;
  /** Recursos binarios del sitio (imágenes), normalizados por id (docs/07 §4). */
  assets?: Record<AssetId, Asset>;
}
