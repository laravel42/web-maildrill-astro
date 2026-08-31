/**
 * Video — embed responsive de video (docs/16 §12.1 #9).
 *
 * Componente `content`. Raíz `<div>` themeable (ancho, radio, overflow por
 * tokens en `defaultStyle`); dentro, un wrapper con `aspect-ratio` fijo (prop
 * `aspectRatio`) y un `<iframe>` que lo llena. El aspect-ratio va como estilo
 * inline de un SUB-elemento (no la raíz) para que se emita igual en canvas y
 * export — la raíz no emite estilo inline en `exportMode` (AGENTS.md §5), así
 * que un aspect-ratio en la raíz se perdería al exportar (no está en el schema
 * de estilo). HTML puro sin runtime (P8): es un `<iframe>` estándar.
 *
 * `normalizeEmbedUrl` (puro) convierte URLs comunes de YouTube/Vimeo "de ver" a
 * su forma de embed; cualquier otra URL se usa tal cual.
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

const RATIOS: Record<string, string> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "21:9": "21 / 9",
};

/** Normaliza URLs de YouTube/Vimeo a su forma embebible. Pura. Usa la API `URL`
 * (robusta ante query params en cualquier orden, p. ej. `?feature=shared&v=…`). */
export function normalizeEmbedUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${parsed.pathname}`;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      if (videoId && /^\d+$/.test(videoId)) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    // URL inválida (o sin protocolo): se usa tal cual como fallback.
  }
  return trimmed;
}

const VIDEO_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block", overflowX: "hidden", overflowY: "hidden" },
    size: { width: "100%" },
    appearance: {
      background: { token: "colors.surface.alt" },
      borderRadius: { token: "radii.md" },
    },
  },
};

const IFRAME_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: 0,
};

function VideoRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const src = normalizeEmbedUrl(typeof node.props.url === "string" ? node.props.url : "");
  const ratioKey = typeof node.props.aspectRatio === "string" && node.props.aspectRatio in RATIOS
    ? node.props.aspectRatio
    : "16:9";
  const title = typeof node.props.title === "string" && node.props.title !== "" ? node.props.title : "Video";

  const frameWrapStyle: CSSProperties = { position: "relative", width: "100%", aspectRatio: RATIOS[ratioKey] };

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      <div style={frameWrapStyle}>
        {src !== "" ? (
          <iframe
            src={src}
            title={title}
            style={IFRAME_STYLE}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
      </div>
    </div>
  );
}

export const videoDefinition: ComponentDefinition = {
  type: "video",
  label: "Video",
  category: "content",
  acceptsChildren: false,
  // El `<iframe>` interno capta el 100% del hover/click (§HoverHandle):
  // sin este flag, el usuario solo podía seleccionar el nodo desde el panel
  // de capas (poco descubrible para alguien no técnico).
  blocksPointerCapture: true,
  defaultProps: {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    aspectRatio: "16:9",
    title: "Video",
  },
  defaultStyle: structuredClone(VIDEO_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "url", label: "URL del video", control: "url", group: "Contenido", placeholder: "YouTube / Vimeo / embed" },
      {
        key: "aspectRatio",
        label: "Proporción",
        control: "select",
        group: "Contenido",
        options: Object.keys(RATIOS).map((r) => ({ label: r, value: r })),
      },
      { key: "title", label: "Título accesible", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["size", "spacing", "appearance"] },
  render: VideoRender,
};
