/**
 * Helper de TEST (no productivo, docs/43) para auditar el **lenguaje visual** de
 * las plantillas de página de negocio real: reglas mobile-first medibles y
 * umbrales mínimos de riqueza visual.
 *
 * Motivo (feedback real del usuario sobre la primera versión de docs/42): las
 * plantillas eran correctas de estructura pero "básicas y sin estilo", y en
 * móvil se rompían. Las reglas de abajo convierten ese juicio en aserciones:
 * si una plantilla vuelve a ser una pila de componentes con estilos por
 * defecto, el test falla.
 *
 * No lo importa nada del bundle productivo — solo archivos `*.test.ts`.
 */

import type { NodeFragment } from "../../model/tree";
import type { BuilderNode, OverrideBreakpoint, StyleValue } from "../../model/types";
import { resolveToken, BASE_TOKENS } from "../../model/tokens";

const OVERRIDE_BPS: OverrideBreakpoint[] = ["sm", "md", "lg", "xl"];

/** Tipos cuyo `width` en px es legítimo (glifos/espaciadores, no layout). */
const FIXED_WIDTH_ALLOWED = new Set(["icon", "avatar", "divider", "spacer", "badge"]);

function rawValue(v: StyleValue | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Valor CSS crudo de un `StyleValue`, resolviendo contra `BASE_TOKENS` si es
 * una referencia a token (docs/48 §5.2: los umbrales móviles deben ver el
 * valor real aunque la plantilla lo exprese como `{ token: "spacing.md" }` en
 * vez de un string plano). Las plantillas de sector de hoy solo referencian
 * tokens BASE (nunca temas de usuario aún inexistentes en esta fase, docs/48
 * F2), así que resolver contra `BASE_TOKENS` es válido para F1.
 */
function resolvedValue(v: StyleValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string") return v;
  return resolveToken(BASE_TOKENS, v.token);
}

/** px de un valor CSS simple (`"48px"` → 48); `undefined` si no es px puro. */
function pxOf(v: StyleValue | undefined): number | undefined {
  const raw = rawValue(v);
  if (!raw) return undefined;
  const m = /^(\d+(?:\.\d+)?)px$/.exec(raw.trim());
  return m ? Number(m[1]) : undefined;
}

function nodes(fragment: NodeFragment): BuilderNode[] {
  return Object.values(fragment.nodes);
}

// ---------------------------------------------------------------------------
// 1. Mobile-first (la queja concreta: "en mobile no se ven bien")
// ---------------------------------------------------------------------------

/**
 * Nodos con un ancho FIJO en px en la capa base: en móvil desbordan el viewport.
 * El ancho de layout se expresa en `%`/`100%`/`auto`/`maxWidth`, no en px.
 */
export function fixedPxWidths(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => !FIXED_WIDTH_ALLOWED.has(n.type))
    .filter((n) => pxOf(n.style.base.size?.width) !== undefined)
    .map((n) => n.id);
}

/**
 * Grids que NO son mobile-first: declaran 2+ columnas explícitas ya en la capa
 * base. Válido en base solo 1 columna, o un patrón fluido
 * (`repeat(auto-fit, minmax(...))`), que colapsa solo.
 */
export function nonMobileFirstGrids(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.style.base.layout?.display === "grid")
    .filter((n) => {
      const cols = n.style.base.layout?.gridTemplateColumns;
      if (!cols) return false;
      if (/auto-fit|auto-fill/.test(cols)) return false; // fluido, colapsa solo
      const repeat = /repeat\(\s*(\d+)/.exec(cols);
      if (repeat) return Number(repeat[1]) > 1;
      // "1fr 1fr", "2fr 1fr", "minmax(0,1fr) minmax(0,1fr)"…
      return cols.trim().split(/\s+(?![^(]*\))/).length > 1;
    })
    .map((n) => n.id);
}

/**
 * Grids de una sola columna en base que nunca escalan: sin override en ningún
 * breakpoint quedan como una lista vertical también en desktop (desaprovechan
 * el modelo responsive del builder).
 */
export function gridsWithoutBreakpointScaling(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.style.base.layout?.display === "grid")
    .filter((n) => {
      const cols = n.style.base.layout?.gridTemplateColumns ?? "";
      if (/auto-fit|auto-fill/.test(cols)) return false; // ya es fluido
      const scales = OVERRIDE_BPS.some(
        (bp) => n.style.overrides?.[bp]?.layout?.gridTemplateColumns !== undefined,
      );
      return !scales;
    })
    .map((n) => n.id);
}

/**
 * Tipografías grandes fijas: a partir de ~32px un tamaño fijo o desborda en
 * móvil o se queda enano en desktop. Deben ser fluidas (`clamp()`) o escalar
 * por breakpoint.
 */
export function nonFluidLargeFonts(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => {
      const px = pxOf(n.style.base.typography?.fontSize);
      if (px === undefined || px < 32) return false;
      const scales = OVERRIDE_BPS.some(
        (bp) => n.style.overrides?.[bp]?.typography?.fontSize !== undefined,
      );
      return !scales;
    })
    .map((n) => n.id);
}

/**
 * ¿El nodo raíz limita su ancho? Debe ser `false`: la raíz es full-bleed (las
 * bandas de color llegan al borde del viewport) y el ancho se limita en los
 * contenedores INTERNOS de cada sección.
 */
export function rootLimitsWidth(fragment: NodeFragment): boolean {
  const root = fragment.nodes[fragment.rootId];
  return root?.style.base.size?.maxWidth !== undefined;
}

/** Todas las reglas mobile-first juntas, como lista de violaciones legibles. */
export function mobileFirstViolations(fragment: NodeFragment): string[] {
  const out: string[] = [];
  for (const id of fixedPxWidths(fragment)) out.push(`ancho fijo en px: ${id}`);
  for (const id of nonMobileFirstGrids(fragment)) out.push(`grid multicolumna en base: ${id}`);
  for (const id of gridsWithoutBreakpointScaling(fragment)) out.push(`grid que no escala: ${id}`);
  for (const id of nonFluidLargeFonts(fragment)) out.push(`tipografía grande no fluida: ${id}`);
  if (rootLimitsWidth(fragment)) out.push("la raíz limita el ancho (impide bandas full-bleed)");
  return out;
}

// ---------------------------------------------------------------------------
// 2. Riqueza visual (la queja concreta: "básicas y sin estilo")
// ---------------------------------------------------------------------------

/** Nodos con estilo de `hover` declarado (feedback de interacción). */
export function hoverStateNodes(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.style.states?.hover !== undefined)
    .map((n) => n.id);
}

/** Nodos con al menos un override por breakpoint (adaptación real al viewport). */
export function responsiveNodes(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => OVERRIDE_BPS.some((bp) => n.style.overrides?.[bp] !== undefined))
    .map((n) => n.id);
}

/** Fondos distintos usados en la página (ritmo de bandas claras/oscuras/acento). */
export function distinctBackgrounds(fragment: NodeFragment): string[] {
  const set = new Set<string>();
  for (const n of nodes(fragment)) {
    const bg = n.style.base.appearance?.background;
    if (bg === undefined) continue;
    set.add(typeof bg === "string" ? bg : `token:${bg.token}`);
  }
  return [...set];
}

/** Nodos con `boxShadow` (elevación / profundidad). */
export function elevatedNodes(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.style.base.appearance?.boxShadow !== undefined)
    .map((n) => n.id);
}

/** Nodos con fondo degradado (`linear-gradient`/`radial-gradient`). */
export function gradientNodes(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => /gradient\(/.test(rawValue(n.style.base.appearance?.background) ?? ""))
    .map((n) => n.id);
}

/** Nodos con radio de borde (formas suaves en vez de rectángulos duros). */
export function roundedNodes(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.style.base.appearance?.borderRadius !== undefined)
    .map((n) => n.id);
}

// ---------------------------------------------------------------------------
// 3. Contraste en bandas oscuras (WCAG AA)
// ---------------------------------------------------------------------------

/**
 * ¿El fondo es "oscuro"? Heurística deliberadamente simple, suficiente para el
 * vocabulario del playbook (docs/43 §3):
 *
 * - `colors.band.dark` — la convención **vigente** (docs/48 §3.2): par semántico
 *   propio para bandas enfáticas, que un tema remapea sin arrastrar el par
 *   `text`/`surface`.
 * - `colors.text` — convención **anterior**, aún en uso por las 6 plantillas de
 *   `docs/42` hasta que se re-tematicen (docs/48 F2). Se sigue reconociendo para
 *   no perder la guarda durante la migración.
 * - un string CSS que referencie cualquiera de las dos, o el scrim neutro de los
 *   heros (`rgba(15,23,42,…)`).
 */
function isDarkBackground(v: StyleValue | undefined): boolean {
  if (v === undefined) return false;
  if (typeof v !== "string") return v.token === "colors.band.dark" || v.token === "colors.text";
  return (
    /var\(--colors-band-dark\)/.test(v) ||
    /var\(--colors-text\)/.test(v) ||
    /rgba?\(\s*15\s*,\s*23\s*,\s*42/.test(v)
  );
}

/**
 * Colores de texto que NO alcanzan 4.5:1 sobre una banda oscura.
 * `colors.band.dark` entra por el mismo motivo que `colors.text`: usado como
 * color de TEXTO sobre la propia banda es el mismo color sobre sí mismo.
 */
const LOW_CONTRAST_ON_DARK = new Set([
  "colors.muted",
  "colors.text",
  "colors.border",
  "colors.band.dark",
]);

/**
 * Textos con color tenue heredando una banda oscura: `colors.muted` (#6b7280)
 * sobre `colors.band.dark` (#1a1a1a) da ~3.6:1, por debajo del 4.5:1 de WCAG AA
 * para texto normal. Sobre banda oscura el texto secundario debe ser
 * `colors.band.on` / `colors.surface.*` (o `colors.primary.on`), no `muted`.
 *
 * Recorre el subárbol de cada banda oscura y deja de descender cuando un
 * descendiente declara su propio fondo NO oscuro (ahí ya no hereda el oscuro).
 */
export function lowContrastOnDarkBands(fragment: NodeFragment): string[] {
  const out: string[] = [];

  const visit = (id: string, darkAncestor: string | null) => {
    const node = fragment.nodes[id];
    if (!node) return;
    const bg = node.style.base.appearance?.background;
    let dark = darkAncestor;
    if (bg !== undefined) dark = isDarkBackground(bg) ? id : null;

    if (dark) {
      const color = node.style.base.appearance?.color;
      if (color !== undefined && typeof color !== "string" && LOW_CONTRAST_ON_DARK.has(color.token)) {
        out.push(`${id} usa ${color.token} sobre la banda oscura ${dark}`);
      }
    }
    for (const child of node.children ?? []) visit(child, dark);
  };

  visit(fragment.rootId, null);
  return out;
}

/**
 * Umbrales mínimos de diseño para una plantilla de PÁGINA (docs/43 §5).
 * Devuelve las carencias como texto legible; vacío = cumple.
 */export function visualRichnessGaps(fragment: NodeFragment): string[] {
  const gaps: string[] = [];
  const total = nodes(fragment).length;
  const hovers = hoverStateNodes(fragment).length;
  const responsive = responsiveNodes(fragment).length;
  const backgrounds = distinctBackgrounds(fragment).length;
  const elevated = elevatedNodes(fragment).length;
  const gradients = gradientNodes(fragment).length;
  const rounded = roundedNodes(fragment).length;

  if (hovers < 3) gaps.push(`hover states: ${hovers} < 3`);
  if (responsive < 8) gaps.push(`nodos con overrides por breakpoint: ${responsive} < 8`);
  if (backgrounds < 4) gaps.push(`fondos distintos: ${backgrounds} < 4`);
  if (elevated < 3) gaps.push(`nodos con boxShadow: ${elevated} < 3`);
  if (gradients < 1) gaps.push("sin ningún fondo con degradado");
  if (rounded < Math.ceil(total * 0.1)) {
    gaps.push(`nodos con borderRadius: ${rounded} < 10% de ${total}`);
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// 4. Reglas móviles adicionales (docs/48 §5.2)
// ---------------------------------------------------------------------------
//
// Extienden `mobileFirstViolations` con umbrales más finos que la primera
// versión (docs/43) no cubría: escalado de imágenes, tamaño mínimo de fuente,
// ancho de párrafo en `ch`, tamaño de target táctil (WCAG 2.5.8), padding
// lateral de banda y `gap` fijo excesivo. Todas devuelven ids de nodo o cadenas
// legibles; vacío = cumple.

/** px de un valor CSS simple (`"48px"` → 48), resolviendo tokens; `undefined` si no aplica. */
function pxOfResolved(v: StyleValue | undefined): number | undefined {
  const raw = resolvedValue(v);
  if (!raw) return undefined;
  const m = /^(\d+(?:\.\d+)?)px$/.exec(raw.trim());
  return m ? Number(m[1]) : undefined;
}

/**
 * Nodos `image` de CONTENIDO (no `icon`/`avatar`) cuya altura base es un valor
 * FIJO en px sin ningún override por breakpoint: en pantallas muy anchas o muy
 * estrechas la imagen no se adapta (se recorta o deja espacio muerto). Debe
 * escalar por breakpoint (`overrides.*.size.height`) o usar `%`/`auto`/`aspect
 * ratio` en vez de un alto fijo.
 */
export function imagesWithoutHeightScaling(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.type === "image")
    .filter((n) => pxOfResolved(n.style.base.size?.height) !== undefined)
    .filter((n) => !OVERRIDE_BPS.some((bp) => n.style.overrides?.[bp]?.size?.height !== undefined))
    .map((n) => n.id);
}

/**
 * Umbral mínimo de legibilidad: ningún texto con `fontSize` base por debajo de
 * 14px (sin excepciones, docs/48 §5.2). Se ignoran nodos sin `fontSize`
 * declarado (heredan del componente/tema, fuera del alcance de esta guarda).
 */
export function tooSmallBaseFontSizes(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => {
      const raw = resolvedValue(n.style.base.typography?.fontSize);
      if (!raw) return false;
      const px = pxOfResolved(n.style.base.typography?.fontSize);
      if (px !== undefined) return px < 14;
      // tamaños en rem/em: 0.875rem = 14px con el root en 16px (convención del sitio).
      const remMatch = /^(\d+(?:\.\d+)?)rem$/.exec(raw.trim());
      if (remMatch) return Number(remMatch[1]) * 16 < 14;
      return false;
    })
    .map((n) => n.id);
}

/**
 * Umbral de "párrafo" (docs/48 §5.2): nodo `text` cuyo `props.content` (HTML)
 * tiene más de 120 caracteres de texto visible. Bloques de texto largo deben
 * limitar su ancho en `ch` (`size.maxWidth` con unidad `ch`) para no producir
 * líneas de lectura demasiado largas en pantallas anchas.
 */
const PARAGRAPH_MIN_CHARS = 120;

function visibleTextLength(html: unknown): number {
  if (typeof html !== "string") return 0;
  return html.replace(/<[^>]*>/g, "").trim().length;
}

function isChMaxWidth(v: StyleValue | undefined): boolean {
  const raw = resolvedValue(v);
  return raw !== undefined && /ch$/.test(raw.trim());
}

/**
 * Ids de los nodos `text` considerados "párrafo largo" (>120 caracteres de
 * texto visible) que NO limitan su ancho en `ch` (ni en base ni en ningún
 * override). Umbral de cobertura: docs/48 §5.2 pide ≥90% de los párrafos —
 * ver `longParagraphsWithoutChMaxWidthRatio` para el cálculo agregado.
 */
export function longParagraphsWithoutChMaxWidth(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => n.type === "text")
    .filter((n) => visibleTextLength(n.props.content) > PARAGRAPH_MIN_CHARS)
    .filter((n) => {
      const hasChBase = isChMaxWidth(n.style.base.size?.maxWidth);
      const hasChOverride = OVERRIDE_BPS.some((bp) => isChMaxWidth(n.style.overrides?.[bp]?.size?.maxWidth));
      return !hasChBase && !hasChOverride;
    })
    .map((n) => n.id);
}

/** Ratio de párrafos largos que SÍ limitan su ancho en `ch` (1 = todos). */
export function longParagraphsWithChMaxWidthRatio(fragment: NodeFragment): number {
  const paragraphs = nodes(fragment)
    .filter((n) => n.type === "text")
    .filter((n) => visibleTextLength(n.props.content) > PARAGRAPH_MIN_CHARS);
  if (paragraphs.length === 0) return 1;
  const withCh = paragraphs.length - longParagraphsWithoutChMaxWidth(fragment).length;
  return withCh / paragraphs.length;
}

/** `[top, right, bottom, left]` en px de un shorthand `padding`, o `undefined` si no se puede resolver. */
function paddingBoxPx(v: StyleValue | undefined): [number, number, number, number] | undefined {
  const raw = resolvedValue(v);
  if (!raw) return undefined;
  const parts = raw.trim().split(/\s+/);
  const px = parts.map((p) => {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(p);
    return m ? Number(m[1]) : undefined;
  });
  if (px.some((n) => n === undefined)) return undefined;
  const [a, b, c, d] = px as number[];
  if (px.length === 1) return [a!, a!, a!, a!];
  if (px.length === 2) return [a!, b!, a!, b!];
  if (px.length === 3) return [a!, b!, c!, b!];
  if (px.length === 4) return [a!, b!, c!, d!];
  return undefined;
}

/** Tipos de nodo tratados como "acción de click" para el umbral de padding (WCAG 2.5.8). */
const ACTION_NODE_TYPES = new Set(["button"]);

/**
 * Botones/CTAs cuyo `padding` base no alcanza `14px 22px` (vertical/
 * horizontal) en ninguno de los 4 lados relevantes — WCAG 2.5.8, target táctil
 * mínimo. Un nodo `button` con un `link` (CTA) o sin él cuenta igual: es el
 * tipo de componente, no el uso, lo que determina el umbral.
 */
export function undersizedActionPadding(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => ACTION_NODE_TYPES.has(n.type))
    .filter((n) => {
      const box = paddingBoxPx(n.style.base.spacing?.padding);
      if (!box) return false; // no resoluble (p. ej. clamp()) — no se penaliza en F1.
      const [top, right, bottom, left] = box;
      const vertical = Math.min(top, bottom);
      const horizontal = Math.min(left, right);
      return vertical < 14 || horizontal < 22;
    })
    .map((n) => n.id);
}

/** Tipos de nodo que representan una "banda" de sección (contenedor de primer nivel). */
function isBandCandidate(n: BuilderNode): boolean {
  return n.type === "container" || n.type === "section";
}

/**
 * Bandas (hijos directos del root, o nodos `section`/`container` de alto nivel)
 * cuyo padding LATERAL base es menor a 20px — en 375px el contenido queda
 * pegado al borde del viewport. Solo mira el padding horizontal resuelto; si
 * no se puede resolver (p. ej. `clamp()`, que ya es fluido por diseño) no se
 * penaliza.
 */
export function bandsWithInsufficientSidePadding(fragment: NodeFragment): string[] {
  const root = fragment.nodes[fragment.rootId];
  const bandIds = root?.children ?? [];
  return bandIds
    .map((id) => fragment.nodes[id])
    .filter((n): n is BuilderNode => n !== undefined && isBandCandidate(n))
    .filter((n) => {
      const box = paddingBoxPx(n.style.base.spacing?.padding);
      if (!box) return false;
      const [, right, , left] = box;
      return Math.min(left, right) < 20;
    })
    .map((n) => n.id);
}

/**
 * Nodos con `gap` fijo (px) > 32px en la capa base: en 375px un gap grande
 * fijo separa demasiado el contenido y no colapsa. Debe expresarse con
 * `clamp()` (fluido) en vez de un px fijo por encima del umbral.
 */
export function oversizedFixedGaps(fragment: NodeFragment): string[] {
  return nodes(fragment)
    .filter((n) => {
      const px = pxOfResolved(n.style.base.layout?.gap);
      return px !== undefined && px > 32;
    })
    .map((n) => n.id);
}

/** Todas las reglas móviles de docs/48 §5.2, como violaciones legibles. */
export function mobileGuardViolationsF1(fragment: NodeFragment): string[] {
  const out: string[] = [];
  for (const id of imagesWithoutHeightScaling(fragment)) {
    out.push(`imagen sin escalado de alto por breakpoint: ${id}`);
  }
  for (const id of tooSmallBaseFontSizes(fragment)) out.push(`fontSize base < 14px: ${id}`);
  const chRatio = longParagraphsWithChMaxWidthRatio(fragment);
  if (chRatio < 0.9) {
    out.push(`párrafos largos con maxWidth en ch: ${Math.round(chRatio * 100)}% < 90%`);
  }
  for (const id of undersizedActionPadding(fragment)) {
    out.push(`padding de botón/CTA < 14px 22px (WCAG 2.5.8): ${id}`);
  }
  for (const id of bandsWithInsufficientSidePadding(fragment)) {
    out.push(`padding lateral de banda < 20px en base: ${id}`);
  }
  for (const id of oversizedFixedGaps(fragment)) out.push(`gap fijo > 32px en base (usar clamp()): ${id}`);
  return out;
}
