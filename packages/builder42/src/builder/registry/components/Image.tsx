/**
 * Image — componente real (PLAN §3, docs/07 §4). Render puro (P3): aplica
 * `rootRef`/`rootProps` en su raíz sin wrapper (docs/02 §10.3).
 *
 * La fuente es un `ImageSource` (`props.source`) — URL externa o referencia a un
 * asset del sitio — con fallback al `props.src` legacy. El `src` real lo resuelve
 * la pipeline vía `ctx.resolveImageSrc`: data URL en el canvas, `/assets/img/…`
 * en export (model/assets.ts). Sin fuente muestra un placeholder en el canvas.
 */

import type { CSSProperties, ReactElement, Ref } from "react";
import { DEFAULT_BREAKPOINTS } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { readImageSource } from "../../model/assets";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

const OBJECT_FITS = ["cover", "contain", "fill", "none", "scale-down"] as const;

/**
 * Coordenadas (0/1/2 por eje) de cada valor de `object-position` dentro de
 * una grilla 3×3 — usado para dibujar el punto marcador en
 * `renderPositionOptionPreview`.
 */
const POSITION_COORDS: Record<string, [x: 0 | 1 | 2, y: 0 | 1 | 2]> = {
  "left top": [0, 0],
  top: [1, 0],
  "right top": [2, 0],
  left: [0, 1],
  center: [1, 1],
  right: [2, 1],
  "left bottom": [0, 2],
  bottom: [1, 2],
  "right bottom": [2, 2],
};

/** Mini-diagrama 3×3: marco + un punto en la posición seleccionada. */
function renderPositionOptionPreview(value: string): ReactElement | null {
  const coords = POSITION_COORDS[value];
  if (!coords) return null;
  const [gx, gy] = coords;
  const cx = 3 + gx * 4;
  const cy = 3 + gy * 4;
  return (
    <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true">
      <rect
        x={0.75}
        y={0.75}
        width={12.5}
        height={12.5}
        rx={2}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      <circle cx={cx} cy={cy} r={1.6} fill="currentColor" />
    </svg>
  );
}

function ImageRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, resolveImageSrc } = ctx;

  const source = readImageSource(node.props);
  const src = source
    ? (resolveImageSrc?.(source) ?? (source.kind === "url" ? source.url : ""))
    : "";
  const alt = typeof node.props.alt === "string" ? node.props.alt : "";
  const objectFit =
    typeof node.props.objectFit === "string" &&
    (OBJECT_FITS as readonly string[]).includes(node.props.objectFit)
      ? (node.props.objectFit as CSSProperties["objectFit"])
      : "cover";
  const objectPosition =
    typeof node.props.objectPosition === "string" && node.props.objectPosition !== ""
      ? node.props.objectPosition
      : undefined;
  // Estrategia de carga (docs/07): `lazy` por defecto; `eager` para imágenes
  // "above the fold" (hero) que no deben diferirse.
  const loading = node.props.loading === "eager" ? "eager" : "lazy";

  const hasSrc = src !== "";
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : {
        objectFit,
        ...(objectPosition ? { objectPosition } : {}),
        ...stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS)),
        // Placeholder visible en el canvas cuando aún no hay fuente.
        ...(hasSrc ? {} : { background: "#e5e7eb", minHeight: "80px" }),
      };

  return (
    <img
      ref={rootRef as Ref<HTMLImageElement> | undefined}
      className={className}
      style={style}
      src={hasSrc ? src : undefined}
      alt={alt}
      loading={loading}
      {...rootProps}
    />
  );
}

export const imageDefinition: ComponentDefinition = {
  type: "image",
  label: "Imagen",
  category: "content",
  acceptsChildren: false,
  defaultProps: { source: { kind: "url", url: "https://placehold.co/300x160" }, alt: "", objectFit: "cover", loading: "lazy" },
  defaultStyle: { base: { size: { width: "100%" } } },
  propsSchema: {
    fields: [
      { key: "source", label: "Imagen", control: "image-src", group: "Contenido" },
      { key: "alt", label: "Texto alternativo", control: "text", group: "Contenido", translatable: true },
      {
        key: "objectFit",
        label: "Ajuste",
        control: "select",
        group: "Contenido",
        options: [
          { label: "cover", value: "cover" },
          { label: "contain", value: "contain" },
          { label: "fill", value: "fill" },
          { label: "none", value: "none" },
          { label: "scale-down", value: "scale-down" },
        ],
      },
      {
        key: "objectPosition",
        label: "Posición",
        control: "searchable-select",
        group: "Contenido",
        placeholder: "Centro",
        options: [
          { label: "Centro", value: "center" },
          { label: "Arriba izquierda", value: "left top" },
          { label: "Arriba centro", value: "top" },
          { label: "Arriba derecha", value: "right top" },
          { label: "Centro izquierda", value: "left" },
          { label: "Centro derecha", value: "right" },
          { label: "Abajo izquierda", value: "left bottom" },
          { label: "Abajo centro", value: "bottom" },
          { label: "Abajo derecha", value: "right bottom" },
        ],
        renderOptionPreview: renderPositionOptionPreview,
      },
      {
        key: "loading",
        label: "Carga",
        control: "select",
        group: "Contenido",
        options: [
          { label: "perezosa (lazy)", value: "lazy" },
          { label: "inmediata (eager)", value: "eager" },
        ],
      },
    ],
  },
  styleSchema: { enabledGroups: ["spacing", "size", "appearance"] },
  render: ImageRender,
};
