import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Encabezado de página interior con miga de pan (docs/37 §3.1 #8): primer uso
 * de `breadcrumb` en la galería de layouts (hueco real, docs/37 §1). Título +
 * `breadcrumb` sobre fondo de superficie alterna.
 */
export function buildBreadcrumbHeaderFragment(): NodeFragment {
  return {
    rootId: "breadcrumb-header-root",
    nodes: {
      "breadcrumb-header-root": {
        id: "breadcrumb-header-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } },
            spacing: { padding: { token: "spacing.md" } },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["breadcrumb-header-crumb", "breadcrumb-header-title"],
      },
      "breadcrumb-header-crumb": {
        id: "breadcrumb-header-crumb",
        type: "breadcrumb",
        props: {
          items: [
            { label: "Inicio", value: "/" },
            { label: "Blog", value: "/blog" },
            { label: "Artículo actual", value: "" },
          ],
          separator: "/",
        },
        style: defaultStyleFor("breadcrumb"),
      },
      "breadcrumb-header-title": {
        id: "breadcrumb-header-title",
        type: "text",
        props: { content: "<strong>Título del artículo o sección</strong>" },
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
    },
  };
}
