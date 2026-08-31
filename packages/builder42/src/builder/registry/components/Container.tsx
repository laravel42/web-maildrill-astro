/**
 * Container — el componente base del sistema (PLAN §4).
 *
 * Es el único bloque con `children`, así que hace posible el anidamiento
 * arbitrario. Tiene dos modos de layout (flex / grid) según
 * `style.layout.display`. Su `render` es PURO (sin hooks, P3): traduce el estilo
 * resuelto a CSS inline en el canvas y aplica `rootRef`/`rootProps` inyectados
 * por el NodeRenderer para el DnD + selección, SIN wrapper extra (docs/02 §10.3).
 *
 * En `exportMode` no aplica estilo inline (el CSS sale del serializer con
 * `@media`, docs/01 §5) y `rootRef`/`rootProps` vienen undefined (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

function ContainerRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps, suppressClip, editPreviewChrome } =
    ctx;

  const resolved = resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS);
  // En canvas, `position:relative` ancla el overlay del indicador de drop
  // (absolute) sin mover la caja. Solo chrome de edición: el export no lo lleva
  // (P8). Si el usuario fija su propia `position`, la suya gana (spread después).
  //
  // `suppressClip` (docs/10 §5, feedback de usuario): un behavior como
  // `carousel` recorta su contenido cuando está hidratado, y el usuario suele
  // fijar en el Inspector el tamaño/overflow que ese recorte necesita (p. ej.
  // `size.height` de un carousel vertical). El runtime real NUNCA corre en
  // Edit, así que ahí ese mismo tamaño solo ocultaría hijos sin ningún
  // beneficio — se anulan `overflow`/`maxHeight`/`height` para que TODOS los
  // hijos queden en flujo normal y sigan seleccionables/arrastrables; el resto
  // del estilo (padding, background, flexDirection…) se respeta igual, así
  // que un carousel vertical (`flexDirection: column`) se sigue viendo en
  // columna, solo que sin recortar. `!important`-like vía orden de spread: se
  // aplican DESPUÉS de `stylePropertiesToCSSObject` para ganarles a esos tres
  // campos puntuales sin tocar los demás.
  //
  // El alto/ancho REAL que tendrá el recorte una vez hidratado (Preview/export)
  // se pierde de vista al pasar a `auto` — sin ninguna pista, el usuario no
  // sabe dónde caerá el límite mientras edita. `sizeGuideHeight` guarda ese
  // valor (antes de anularlo) para pintar un overlay de chrome (`.pbx-size-guide`
  // abajo) que lo marca con un borde punteado, sin recortar nada debajo.
  const declaredHeight = resolved.size?.height;
  const sizeGuideHeight =
    !exportMode && suppressClip && typeof declaredHeight === "string" && declaredHeight !== ""
      ? declaredHeight
      : undefined;

  const style: CSSProperties | undefined = exportMode
    ? undefined
    : {
        position: "relative",
        ...stylePropertiesToCSSObject(resolved),
        ...(suppressClip
          ? { overflow: "visible", overflowX: "visible", overflowY: "visible", maxHeight: "none", height: "auto" }
          : null),
      };

  const isEmpty = !node.children || node.children.length === 0;

  // En canvas, un slider (overflow-x auto/scroll) necesita hijos no-encogibles.
  // El export lo resuelve con la regla `.n-id > *` del serializer; en canvas se
  // aplica con la clase `pbx-scroll-x` (chrome.css) resuelta al breakpoint activo.
  // Con `suppressClip` no hay overflow real que scrollear (arriba lo anulamos),
  // así que tampoco aplica la clase del slider.
  const overflowX = resolved.layout?.overflowX;
  const scrollActive = !exportMode && !suppressClip && (overflowX === "auto" || overflowX === "scroll");

  // rootProps trae className (estado de edición) que, spread al final, pisaría
  // a `className`. Lo fusionamos manualmente para no perder ninguna clase.
  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName =
    [className, rootClassName, scrollActive ? "pbx-scroll-x" : ""].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Contenedor vacío — suelta componentes aquí
        </span>
      ) : null}
      {sizeGuideHeight ? (
        <span className="pbx-size-guide" data-size-guide aria-hidden="true" style={{ height: sizeGuideHeight }}>
          <span className="pbx-size-guide__label">Alto real al publicar</span>
        </span>
      ) : null}
      {/* Chrome fantasma de behaviors en Edit (docs/10 §5, feedback de
          usuario): `NodeRenderer` ya agregó el chrome de todos los behaviors
          activos del nodo (p. ej. las flechas del carousel en su posición
          real); `Container` solo lo renderiza dentro de su `position:relative`
          existente, SIN interpretar qué es — nunca en `exportMode` (P8, ya
          viene `undefined` ahí, pero se guarda explícito por defensividad). */}
      {!exportMode ? editPreviewChrome : null}
    </div>
  );
}

export const containerDefinition: ComponentDefinition = {
  type: "container",
  label: "Contenedor",
  category: "layout",
  acceptsChildren: true,
  defaultProps: { gridPlacement: "auto" },
  defaultStyle: {
    base: {
      layout: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "stretch",
      },
      spacing: { padding: "16px" },
      size: { minHeight: "48px" },
      appearance: {
        background: { token: "colors.surface.alt" },
        borderRadius: { token: "radii.md" },
      },
    },
  },
  propsSchema: { fields: [
    {
      key: "gridPlacement",
      label: "Colocación en grid",
      control: "select",
      group: "Grid",
      options: [
        { label: "Automática (orden)", value: "auto" },
        { label: "Explícita (celda)", value: "explicit" },
      ],
    },
  ] },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: ContainerRender,
};
