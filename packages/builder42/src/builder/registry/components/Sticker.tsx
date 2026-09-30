/**
 * Sticker — pegatina superpuesta (contenedor) que se ancla a una esquina de su
 * nodo padre, sale rotada y, con el behavior `sticker-drag` adjunto, el
 * VISITANTE del sitio publicado puede arrastrarla con el ratón o el dedo.
 *
 * Es CONTENEDOR (como `container`/`card`): acepta cualquier hijo — texto,
 * icono, imagen, un `container` con varios — en vez de un único texto fijo.
 * La raíz es un `<div>` (no un `<span>`) precisamente por eso: un hijo con su
 * propio layout de bloque (p. ej. un `icon` con `size`) necesita una caja de
 * bloque que lo contenga, no una línea inline. `text-align`/`text-wrap` de
 * `STICKER_CSS` se conservan porque siguen siendo útiles cuando el contenido
 * es texto, y son inertes para cualquier otro tipo de hijo.
 *
 * ## Por qué la geometría va inline y no por el modelo de estilos
 *
 * El modelo (`model/types.ts`) no declara `position`, `zIndex` ni `transform`,
 * a propósito: todo el posicionamiento del usuario se resuelve con flujo normal
 * y flexbox (ver el comentario de `layouts/sections/heroSection.ts`). Una
 * pegatina es justo el caso contrario — existe PARA salirse del flujo y taparle
 * un trozo a la foto de un hero.
 *
 * La salida a ese conflicto no es abrir `position` en el Inspector (eso rompe
 * la garantía de que cualquier árbol maqueta bien en cualquier viewport), sino
 * la vía que ya usan otros componentes: **geometría propia del componente**,
 * emitida por su `render` y su `css`, fuera del alcance del usuario. El
 * precedente exacto es `Video.tsx`, cuyo wrapper lleva
 * `{ position: "relative", width: "100%", aspectRatio }` inline en los DOS
 * modos, export incluido. Aquí:
 *
 * - `position: absolute`, `z-index` y `max-width` viven en `STICKER_CSS`
 *   (una clase, no estilo inline — son iguales para todas las pegatinas);
 * - los offsets del anclaje y la rotación van inline, porque son valores POR
 *   NODO que ninguna clase compartida puede llevar;
 * - la regla que convierte al padre en bloque contenedor (`position: relative`)
 *   también vive en `STICKER_CSS`, vía `:has()`, para no necesitar que el nodo
 *   padre colabore ni que el usuario sepa nada de bloques contenedores.
 *
 * Esto NO contradice la regla "en `exportMode` el estilo sale por clase"
 * (AGENTS.md §5): esa regla protege contra elegir en `render` algo que el
 * `cssSerializer` también podría emitir — un color, un padding — porque
 * entonces el canvas y el export discrepan. `transform` y `position` no están
 * en el modelo de estilos, así que ninguna clase puede declararlos nunca y no
 * hay dos fuentes de verdad que puedan divergir.
 *
 * ## Sin JavaScript
 *
 * La pegatina se ve, anclada y rotada, sin ejecutar una línea de JS: todo lo
 * anterior es CSS y estilo inline. El arrastre es el único tier 1, y vive en el
 * behavior `sticker-drag` (mismo reparto que `sticky`: la posición es CSS puro,
 * el JS solo añade la interacción).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

/** Esquinas donde puede anclarse, más el centro. */
const ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
type Anchor = (typeof ANCHORS)[number];

function isAnchor(value: unknown): value is Anchor {
  return typeof value === "string" && (ANCHORS as readonly string[]).includes(value);
}

export const STICKER_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
    },
    spacing: { padding: "8px 14px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.sm" },
      fontWeight: { token: "typography.weights.bold" },
      lineHeight: { token: "typography.lineHeights.tight" },
      // F23a: la pegatina es el caso de uso canónico de estos dos campos.
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
    appearance: {
      background: { token: "colors.primary.default" },
      color: { token: "colors.primary.on" },
      borderRadius: { token: "radii.lg" },
    },
  },
};

/**
 * CSS de salida del componente (`ComponentDefinition.css`, precedente
 * `Navbar.tsx`/`Accordion.tsx`). Se emite una sola vez por sitio, no por nodo.
 *
 * La segunda regla es la que hace posible la superposición: `:has()` marca como
 * bloque contenedor a cualquier ancestro DIRECTO de una pegatina, así que el
 * `hero`/`section`/`container` que la contiene no necesita declarar nada. Se
 * limita con `:where(...)` a los contenedores reales del árbol para no tocar
 * elementos donde `position: relative` sí tendría efectos colaterales (una
 * celda de tabla, un `<summary>`), y `:where()` además mantiene la
 * especificidad en 0, de modo que cualquier regla del usuario gana.
 */
const STICKER_CSS = [
  ".pb-sticker { position: absolute; z-index: 5; max-width: min(60%, 320px); text-align: center; text-wrap: balance; }",
  ":where(div, section, header, footer, main, article, aside, nav, figure):has(> .pb-sticker) { position: relative; }",
].join("\n");

/** Extrae la parte numérica de un valor de prop que puede llegar como número
 * (compatibilidad con `defaultProps`) o como string CSS con unidad — el
 * control `numeric` (`NumericUnitInput`) siempre commitea un string
 * (`"5deg"`, `"24px"`), nunca un número puro. */
export function numericPropValue(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function StickerRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;

  const userStyle: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const anchor: Anchor = isAnchor(node.props.anchor) ? node.props.anchor : "top-right";
  const rotation = numericPropValue(node.props.rotation, -8);
  const offset = numericPropValue(node.props.offset, 24);

  // Anclaje: dos bordes por esquina. El centro se resuelve con 50% + un
  // `translate(-50%, -50%)` que precede al resto de la cadena de transform.
  const inset: CSSProperties =
    anchor === "center"
      ? { top: "50%", left: "50%" }
      : {
          [anchor.startsWith("top") ? "top" : "bottom"]: `${offset}px`,
          [anchor.endsWith("left") ? "left" : "right"]: `${offset}px`,
        };

  // `--pb-sticker-dx/dy` las escribe el runtime de `sticker-drag` al arrastrar.
  // Sin JS quedan sin definir y el fallback `0px` deja la pegatina en su sitio,
  // así que la misma cadena de transform sirve para los dos casos y el runtime
  // nunca tiene que reconstruir (ni parsear) la rotación.
  const transform = [
    anchor === "center" ? "translate(-50%, -50%)" : null,
    "translate(var(--pb-sticker-dx, 0px), var(--pb-sticker-dy, 0px))",
    rotation !== 0 ? `rotate(${rotation}deg)` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = ["pb-sticker", className, rootClassName].filter(Boolean).join(" ");
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={{ ...userStyle, ...inset, transform }}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty sticker — drop text, an icon, or an image
        </span>
      ) : null}
    </div>
  );
}

export const stickerDefinition: ComponentDefinition = {
  type: "sticker",
  label: "Pegatina",
  category: "content",
  acceptsChildren: true,
  defaultProps: { anchor: "top-right", rotation: -8, offset: 24 },
  defaultStyle: structuredClone(STICKER_DEFAULT_STYLE),
  defaultChildren: [{ type: "text", props: { content: "drag me" } }],
  propsSchema: {
    fields: [
      {
        key: "anchor",
        label: "Anclaje",
        control: "select",
        group: "Apariencia",
        options: [
          { label: "Arriba izquierda", value: "top-left" },
          { label: "Arriba derecha", value: "top-right" },
          { label: "Abajo izquierda", value: "bottom-left" },
          { label: "Abajo derecha", value: "bottom-right" },
          { label: "Centro", value: "center" },
        ],
      },
      {
        key: "rotation",
        label: "Rotación",
        control: "numeric",
        group: "Apariencia",
        units: ["deg"],
        defaultUnit: "deg",
        step: 1,
      },
      {
        key: "offset",
        label: "Separación del borde",
        control: "numeric",
        group: "Apariencia",
        units: ["px"],
        defaultUnit: "px",
        step: 1,
      },
    ],
  },
  styleSchema: { enabledGroups: ["layout", "typography", "spacing", "appearance"] },
  css: STICKER_CSS,
  render: StickerRender,
};
