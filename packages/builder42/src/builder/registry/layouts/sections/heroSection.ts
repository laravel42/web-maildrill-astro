import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Sección "hero" reutilizable, con contenido propio (no un recorte del hero
 * de `example-home` — ver deuda cerrada en docs/16 §13.1). Usa el componente
 * `hero` del catálogo (contenedor semántico `<section>`, docs/16 §12.1 #11)
 * relleno con `text` + `button`, escrito exclusivamente con `BASE_TOKENS`.
 */
export function buildHeroSectionFragment(): NodeFragment {
  return {
    rootId: "hero-section-root",
    nodes: {
      "hero-section-root": {
        id: "hero-section-root",
        type: "hero",
        props: {},
        style: defaultStyleFor("hero"),
        children: ["hero-section-title", "hero-section-sub", "hero-section-cta"],
      },
      "hero-section-title": {
        id: "hero-section-title",
        type: "text",
        props: { content: "<strong>Diseña tu página en minutos</strong>" },
        style: {
          base: {
            size: { maxWidth: "34ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: { token: "typography.sizes.lg" },
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "hero-section-sub": {
        id: "hero-section-sub",
        type: "text",
        props: { content: "Combina componentes listos y ajusta cada detalle desde el Inspector." },
        style: {
          base: {
            size: { maxWidth: "42ch" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "hero-section-cta": {
        id: "hero-section-cta",
        type: "button",
        props: { label: "Probar ahora", link: { kind: "external", href: "#" } },
        style: defaultStyleFor("button"),
      },
    },
  };
}
