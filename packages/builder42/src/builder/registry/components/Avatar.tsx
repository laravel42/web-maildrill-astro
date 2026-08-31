/**
 * Avatar — imagen circular de persona con fallback de iniciales (docs/16 §12.1 #8).
 *
 * Componente `content`. Raíz única `<span>` circular (P3): recorta con
 * `overflow:hidden` + `borderRadius:50%` (STYLE por defecto). Dentro pinta un
 * `<img>` si hay fuente, o las iniciales centradas como fallback. La fuente es
 * un `ImageSource` (`props.source`), resuelto por la pipeline vía
 * `ctx.resolveImageSrc` (data URL en canvas, `/assets/img/…` en export), igual
 * que el componente `image`. `alt` e `initials` son PROPS (initials traducible
 * opcionalmente por locale). En `exportMode` sin estilo inline en la raíz
 * (AGENTS.md §5), HTML puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { readImageSource } from "../../model/assets";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const AVATAR_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      overflowX: "hidden",
      overflowY: "hidden",
    },
    size: { width: "48px", height: "48px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontWeight: { token: "typography.weights.bold" },
    },
    appearance: {
      background: { token: "colors.surface.alt" },
      color: { token: "colors.text" },
      borderRadius: "50%",
    },
  },
};

const IMG_STYLE: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

function AvatarRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, resolveImageSrc } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const source = readImageSource(node.props);
  const src = source
    ? (resolveImageSrc?.(source) ?? (source.kind === "url" ? source.url : ""))
    : "";
  const alt = typeof node.props.alt === "string" ? node.props.alt : "";
  const initials = typeof node.props.initials === "string" && node.props.initials !== "" ? node.props.initials : "?";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <span
      ref={rootRef as Ref<HTMLSpanElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {src !== "" ? <img src={src} alt={alt} style={IMG_STYLE} loading="lazy" /> : <span>{initials}</span>}
    </span>
  );
}

export const avatarDefinition: ComponentDefinition = {
  type: "avatar",
  label: "Avatar",
  category: "content",
  acceptsChildren: false,
  defaultProps: { source: { kind: "url", url: "" }, alt: "", initials: "AB" },
  defaultStyle: structuredClone(AVATAR_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "source", label: "Imagen", control: "image-src", group: "Contenido" },
      { key: "alt", label: "Texto alternativo", control: "text", group: "Contenido", translatable: true },
      { key: "initials", label: "Iniciales (fallback)", control: "text", group: "Contenido" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "size", "appearance", "spacing"] },
  render: AvatarRender,
};
