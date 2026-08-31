/**
 * Image — componente real (PLAN §3, docs/07 §4). Render puro (P3): aplica
 * `rootRef`/`rootProps` en su raíz sin wrapper (docs/02 §10.3).
 *
 * La fuente es un `ImageSource` (`props.source`) — URL externa o referencia a un
 * asset del sitio — con fallback al `props.src` legacy. El `src` real lo resuelve
 * la pipeline vía `ctx.resolveImageSrc`: data URL en el canvas, `/assets/img/…`
 * en export (model/assets.ts). Sin fuente muestra un placeholder en el canvas.
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { readImageSource } from "../../model/assets";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

const OBJECT_FITS = ["cover", "contain", "fill", "none", "scale-down"] as const;

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
        control: "text",
        group: "Contenido",
        placeholder: "center · top left · 50% 20%",
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
