import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { pricingCardFragment } from "../helpers";

/**
 * Sección de pricing reutilizable, con contenido propio (no un recorte de
 * `example-home` — ver deuda cerrada en docs/16 §13.1). Grid responsive de
 * `pricing-card`, escrito exclusivamente con `BASE_TOKENS`. Planes de
 * mensajería multicanal (contactos, campañas, canales, soporte).
 *
 * Rediseño estructural (impeccable — bolder; la ronda anterior solo cambió
 * de 2 a 3 planes con borde/sombra distintos, pero las 3 cards seguían
 * siendo el mismo scaffold "icono ausente + texto" repetido 3 veces — el
 * craft floor de este proyecto marca explícitamente las cards del mismo
 * tamaño como el scaffold perezoso por defecto si no rompen la simetría de
 * verdad):
 *
 *  - **Icono por plan** (`Zap`/`Rocket`/`Building2`, mismo componente
 *    `icon` + halo circular que `features3Col`/`statsStrip` ya usan) sobre
 *    el nombre de cada plan — un punto de entrada visual real en vez de
 *    "3 cajas de texto con borde distinto".
 *  - **Growth (medio) rompe la simetría con más que borde/sombra**: su
 *    icono va en halo `colors.primary.default` (vs. `surface.alt` de los
 *    otros dos, mismo contraste que `features3Col-2`), su `badge` (de
 *    fábrica un `text` con fondo de acento) se sobreescribe a un
 *    **ribbon con icono `Star` inline** en vez de un chip de texto plano,
 *    y su **precio crece un paso de escala** (`fontSize` explícito por
 *    encima del default `2.25em`) — la jerarquía "este es el plan
 *    recomendado" ahora se lee en tamaño real, no solo en color de borde.
 *  - `defaultStyleFor("pricing-card")` (`PRICING_DEFAULT_STYLE` en
 *    `PricingCard.tsx`) ya trae `boxShadow: shadows.sm` (1px, casi
 *    invisible) + `borderWidth: 1px` + `borderRadius: radii.md`; se
 *    verificó antes de tocar nada (no sobreescribir con algo peor): las 3
 *    cards reciben `boxShadow` con blur real de 2 capas y `radii.lg`, mismo
 *    lenguaje "card elevada" que el resto del catálogo.
 *
 * Breakpoints (docs/01 §1, `DEFAULT_BREAKPOINTS`: `base/sm 640/md 768/lg
 * 1024`): `base` = 1 columna. `md` (≥768px) = 2 columnas `minmax(0, 340px)`.
 * `lg` (≥1024px) = 3 columnas `minmax(0, 340px)`, layout final — a
 * 768-1023px, 3 columnas de 340px + gaps no caben con margen cómodo.
 */
export function buildPricingSectionFragment(): NodeFragment {
  type PlanTone = "neutral" | "popular";

  const cardStyle = (tone: PlanTone): NodeFragment["nodes"][string]["style"] => {
    const base = defaultStyleFor("pricing-card");
    const neutralShadow = "0 12px 24px -10px rgba(15,23,42,0.12), 0 2px 6px -1px rgba(15,23,42,0.06)";
    const popularShadow = "0 20px 40px -14px rgba(37,99,235,0.28), 0 6px 12px -3px rgba(37,99,235,0.16)";
    return {
      ...base,
      base: {
        ...base.base,
        layout: { display: "flex", flexDirection: "column" },
        spacing: { padding: { token: "spacing.md" } },
        appearance: {
          ...base.base.appearance,
          ...(tone === "popular"
            ? { borderColor: { token: "colors.primary.default" }, borderWidth: "2px" }
            : {}),
          borderRadius: { token: "radii.lg" },
          boxShadow: tone === "popular" ? popularShadow : neutralShadow,
        },
      },
      overrides: {
        md: { spacing: { padding: { token: "spacing.lg" } } },
      },
    };
  };

  const planIconWrapStyle = (tone: PlanTone): NodeFragment["nodes"][string]["style"] => ({
    base: {
      layout: { display: "flex", justifyContent: "center", alignItems: "center" },
      size: { width: "44px", height: "44px" },
      spacing: { margin: "0 0 12px 0" },
      appearance: {
        background: tone === "popular" ? { token: "colors.primary.default" } : { token: "colors.surface.alt" },
        borderRadius: "50%",
      },
    },
  });

  const planIconGlyphStyle = (tone: PlanTone): NodeFragment["nodes"][string]["style"] => ({
    base: {
      size: { width: "20px", height: "20px" },
      appearance: { color: tone === "popular" ? { token: "colors.primary.on" } : { token: "colors.primary.default" } },
    },
  });

  /** Ribbon del plan popular: icono `Star` + texto, en vez del chip `text` plano de fábrica. */
  const applyRibbonBadge = (nodes: Record<string, BuilderNode>, id: string, label: string) => {
    const badgeId = `${id}-badge`;
    const badgeNode = nodes[badgeId];
    if (!badgeNode) return;
    badgeNode.type = "container";
    badgeNode.props = {};
    badgeNode.children = [`${badgeId}-icon`, `${badgeId}-text`];
    badgeNode.style = {
      base: {
        layout: { display: "flex", alignItems: "center", gap: "6px" },
        spacing: { padding: "4px 10px", margin: "0" },
        appearance: { background: { token: "colors.primary.default" }, borderRadius: { token: "radii.sm" } },
      },
    };
    nodes[`${badgeId}-icon`] = {
      id: `${badgeId}-icon`,
      type: "icon",
      props: { name: "Star", title: "" },
      style: { base: { size: { width: "14px", height: "14px" }, appearance: { color: { token: "colors.primary.on" } } } },
    };
    nodes[`${badgeId}-text`] = {
      id: `${badgeId}-text`,
      type: "text",
      props: { content: label },
      style: {
        base: {
          typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.primary.on" } },
        },
      },
    };
  };

  /** Precio del plan popular un paso de escala por encima del default (`2.25em`). */
  const applyLargerPrice = (nodes: Record<string, BuilderNode>, id: string) => {
    const priceId = `${id}-price`;
    const priceNode = nodes[priceId];
    if (!priceNode) return;
    priceNode.style = {
      ...priceNode.style,
      base: {
        ...priceNode.style.base,
        typography: { ...priceNode.style.base.typography, fontSize: "2.75em" },
      },
    };
  };

  const withPlanIcon = (
    nodes: Record<string, BuilderNode>,
    cardId: string,
    iconName: string,
    tone: PlanTone,
  ): Record<string, BuilderNode> => {
    const iconWrapId = `${cardId}-plan-icon-wrap`;
    const iconId = `${cardId}-plan-icon`;
    nodes[iconWrapId] = { id: iconWrapId, type: "container", props: {}, style: planIconWrapStyle(tone), children: [iconId] };
    nodes[iconId] = { id: iconId, type: "icon", props: { name: iconName, title: "" }, style: planIconGlyphStyle(tone) };
    const card = nodes[cardId];
    if (card) card.children = [iconWrapId, ...(card.children ?? [])];
    return nodes;
  };

  const starterNodes = pricingCardFragment(
    "pricing-section-starter",
    {
      planName: "Starter",
      price: "$29",
      period: "/mes",
      features: ["Hasta 2,500 contactos", "10 campañas al mes", "Canales: email + SMS", "Soporte por email"],
      ctaLabel: "Elegir Starter",
      ctaLink: { kind: "external", href: "#" },
      popular: false,
      popularLabel: "Popular",
    },
    cardStyle("neutral"),
  );
  withPlanIcon(starterNodes, "pricing-section-starter", "Zap", "neutral");

  const growthNodes = pricingCardFragment(
    "pricing-section-growth",
    {
      planName: "Growth",
      price: "$99",
      period: "/mes",
      features: ["Hasta 25,000 contactos", "Campañas ilimitadas", "Canales: email, SMS, WhatsApp y voz", "Soporte prioritario 24/7"],
      ctaLabel: "Elegir Growth",
      ctaLink: { kind: "external", href: "#" },
      popular: true,
      popularLabel: "Más elegido",
    },
    cardStyle("popular"),
  );
  withPlanIcon(growthNodes, "pricing-section-growth", "Rocket", "popular");
  applyRibbonBadge(growthNodes, "pricing-section-growth", "Más elegido");
  applyLargerPrice(growthNodes, "pricing-section-growth");

  const enterpriseNodes = pricingCardFragment(
    "pricing-section-enterprise",
    {
      planName: "Enterprise",
      price: "$299",
      period: "/mes",
      features: [
        "Contactos ilimitados",
        "Campañas y automatizaciones ilimitadas",
        "Canales: email, SMS, WhatsApp y voz",
        "Soporte dedicado + SLA garantizado",
      ],
      ctaLabel: "Elegir Enterprise",
      ctaLink: { kind: "external", href: "#" },
      popular: false,
      popularLabel: "Popular",
    },
    cardStyle("neutral"),
  );
  withPlanIcon(enterpriseNodes, "pricing-section-enterprise", "Building2", "neutral");

  return {
    rootId: "pricing-section-root",
    nodes: {
      "pricing-section-root": {
        id: "pricing-section-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" }, justifyContent: "center" },
            spacing: { padding: { token: "spacing.sm" } },
          },
          overrides: {
            sm: { spacing: { padding: { token: "spacing.md" } } },
            md: {
              layout: { gridTemplateColumns: "repeat(2, minmax(0, 340px))" },
              spacing: { padding: { token: "spacing.lg" } },
            },
            lg: {
              layout: { gridTemplateColumns: "repeat(3, minmax(0, 340px))" },
            },
          },
        },
        children: ["pricing-section-starter", "pricing-section-growth", "pricing-section-enterprise"],
      },
      ...starterNodes,
      ...growthNodes,
      ...enterpriseNodes,
    },
  };
}
