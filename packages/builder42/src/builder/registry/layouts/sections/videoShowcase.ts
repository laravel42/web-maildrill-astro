import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Vitrina de producto con video (docs/37 §3.1 #1): primer uso de `video` en
 * la galería de layouts (hueco real, docs/37 §1). Grid 2 columnas en `md`:
 * video embebido a un lado, copy + CTA al otro.
 */
export function buildVideoShowcaseFragment(): NodeFragment {
  return {
    rootId: "video-showcase-root",
    nodes: {
      "video-showcase-root": {
        id: "video-showcase-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" }, alignItems: "center" },
            spacing: { padding: { token: "spacing.md" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "1fr 1fr" } } },
        },
        children: ["video-showcase-video", "video-showcase-copy"],
      },
      "video-showcase-video": {
        id: "video-showcase-video",
        type: "video",
        props: {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          aspectRatio: "16:9",
          title: "Demostración del producto",
        },
        style: defaultStyleFor("video"),
      },
      "video-showcase-copy": {
        id: "video-showcase-copy",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } },
        },
        children: ["video-showcase-title", "video-showcase-body", "video-showcase-cta"],
      },
      "video-showcase-title": {
        id: "video-showcase-title",
        type: "text",
        props: { content: "<strong>Míralo en acción</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: { token: "typography.sizes.lg" },
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "video-showcase-body": {
        id: "video-showcase-body",
        type: "text",
        props: { content: "Dos minutos para ver cómo tu equipo pasa de idea a sitio publicado." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "video-showcase-cta": {
        id: "video-showcase-cta",
        type: "button",
        props: { label: "Ver más ejemplos", link: { kind: "external", href: "#" } },
        style: defaultStyleFor("button"),
      },
    },
  };
}
