import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { pricingCardFragment } from "../helpers";

/**
 * Sección de pricing reutilizable, con contenido propio (no un recorte de
 * `example-home` — ver deuda cerrada en docs/16 §13.1). Dos `pricing-card`
 * en grid responsive, escrito exclusivamente con `BASE_TOKENS`.
 */
export function buildPricingSectionFragment(): NodeFragment {
  return {
    rootId: "pricing-section-root",
    nodes: {
      "pricing-section-root": {
        id: "pricing-section-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" }, justifyContent: "center" },
            spacing: { padding: { token: "spacing.md" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 360px))" } } },
        },
        children: ["pricing-section-basic", "pricing-section-premium"],
      },
      ...pricingCardFragment(
        "pricing-section-basic",
        {
          planName: "Básico",
          price: "$9",
          period: "/mes",
          features: ["1 usuario", "Export ilimitado", "Soporte por email"],
          ctaLabel: "Elegir Básico",
          ctaLink: { kind: "external", href: "#" },
          popular: false,
          popularLabel: "Popular",
        },
        defaultStyleFor("pricing-card"),
      ),
      ...pricingCardFragment(
        "pricing-section-premium",
        {
          planName: "Premium",
          price: "$39",
          period: "/mes",
          features: ["Usuarios ilimitados", "Dominios propios", "Soporte prioritario 24/7"],
          ctaLabel: "Elegir Premium",
          ctaLink: { kind: "external", href: "#" },
          popular: true,
          popularLabel: "Popular",
        },
        defaultStyleFor("pricing-card"),
      ),
    },
  };
}
