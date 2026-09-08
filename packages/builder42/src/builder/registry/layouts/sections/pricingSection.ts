import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { pricingCardFragment } from "../helpers";

/**
 * Sección de pricing reutilizable, con contenido propio (no un recorte de
 * `example-home` — ver deuda cerrada en docs/16 §13.1). Dos `pricing-card`
 * en grid responsive, escrito exclusivamente con `BASE_TOKENS`. Planes de
 * mensajería multicanal (contactos, campañas, canales, soporte).
 *
 * Ronda de mejora visual (mismo objetivo que hero/videoShowcase/features3Col/
 * teamGrid/ctaBanner en la ronda anterior — docs/37 §3.1, catálogo completo):
 *
 *  - `defaultStyleFor("pricing-card")` (`PRICING_DEFAULT_STYLE` en
 *    `PricingCard.tsx`) YA trae `boxShadow: shadows.sm` (1px, prácticamente
 *    invisible) + `borderWidth: 1px` + `borderRadius: radii.md`. Se
 *    verificó antes de tocar nada (no sobreescribir con algo peor, pedido
 *    explícito): ambas cards ahora reciben un `boxShadow` con blur real de 2
 *    capas en vez del `shadows.sm` plano, y `radii.lg` en vez de `radii.md`
 *    para el mismo lenguaje visual "card elevada" que `statsStrip`/
 *    `features3Col`/`teamGrid`.
 *  - Plan **no-popular** (Starter): sombra difusa estándar + borde neutro
 *    (`colors.border`), mismo tratamiento que cualquier card de contenido.
 *  - Plan **popular** (Growth): antes solo tenía el badge "Popular" como
 *    señal visual — el `rootStyle` del `pricing-card` en sí no se distinguía
 *    del plan no-popular. Ahora gana:
 *      · `borderColor: colors.primary.default` + `borderWidth: 2px` (borde de
 *        acento, no solo el borde neutro de 1px del otro plan).
 *      · `boxShadow` más pronunciado que el del plan Starter (blur mayor +
 *        una tercera capa con un tinte del color primario en vez de negro
 *        puro) — comunica jerarquía ("este es el plan recomendado") sin
 *        depender solo del badge. No se usa `transform: scale(...)` (el
 *        modelo de estilo del builder no tiene un campo `transform` en
 *        `StyleProperties` — solo `layout`/`spacing`/`size`/`appearance`/
 *        `typography`, ver `model/types.ts`); el énfasis viene solo de
 *        borde + sombra + badge, suficiente contraste frente al plan
 *        Starter sin introducir un campo de estilo inexistente.
 *
 * Breakpoints (docs/01 §1, `DEFAULT_BREAKPOINTS`: `base/sm 640/md 768/lg
 * 1024`) — mismo bug corregido que en el hero: valores pensados solo para
 * desktop sin ajuste explícito para `base`. Aquí:
 *  - Grid de la sección: `base` = 1 columna (cards a ancho completo — 2
 *    columnas en un viewport de 320-375px dejaría cada card en ~150px,
 *    ilegible con el precio grande + lista de features). `md` (≥768px) = 2
 *    columnas `minmax(0, 360px)` (ya existía, se mantiene: es el punto donde
 *    2 cards de 360px + gap caben con margen). No se añade un salto en `sm`
 *    porque a 640-767px una tercera columna no aplica (solo hay 2 planes) y
 *    2 columnas a ese ancho (~300px cada una) siguen quedando algo
 *    apretadas para el precio + 4 features — se prefiere mantener 1 columna
 *    hasta `md`, mismo criterio que el propio código anterior ya aplicaba,
 *    ahora confirmado explícitamente en vez de "por accidente".
 *  - Padding interno de cada card (`rootStyle`): `spacing.md` (16px) en
 *    `base` en vez del `24px` fijo del default — en 320px, 24px de padding a
 *    cada lado de una card a ancho completo (que además vive dentro del
 *    `spacing.md` de padding de la sección) resultaba excesivo, dejando
 *    ~270px de ancho útil para el precio grande (`2.25em`) y las features.
 *    Crece a `spacing.lg` (24px) desde `md`, donde la card ya tiene más aire
 *    horizontal disponible (ancho fijo de hasta 360px, no todo el viewport).
 *  - Padding de la sección: `spacing.sm` en `base` → `spacing.md` en `sm` →
 *    `spacing.lg` en `md`, mismo patrón que `statsStrip`.
 */
export function buildPricingSectionFragment(): NodeFragment {
  const basicCardStyle = (): NodeFragment["nodes"][string]["style"] => {
    const base = defaultStyleFor("pricing-card");
    return {
      ...base,
      base: {
        ...base.base,
        spacing: { padding: { token: "spacing.md" } },
        appearance: {
          ...base.base.appearance,
          borderRadius: { token: "radii.lg" },
          boxShadow: "0 12px 24px -10px rgba(15,23,42,0.12), 0 2px 6px -1px rgba(15,23,42,0.06)",
        },
      },
      overrides: {
        md: { spacing: { padding: { token: "spacing.lg" } } },
      },
    };
  };

  const premiumCardStyle = (): NodeFragment["nodes"][string]["style"] => {
    const base = defaultStyleFor("pricing-card");
    return {
      ...base,
      base: {
        ...base.base,
        spacing: { padding: { token: "spacing.md" } },
        appearance: {
          ...base.base.appearance,
          borderColor: { token: "colors.primary.default" },
          borderWidth: "2px",
          borderRadius: { token: "radii.lg" },
          boxShadow: "0 20px 40px -14px rgba(37,99,235,0.28), 0 6px 12px -3px rgba(37,99,235,0.16)",
        },
      },
      overrides: {
        md: { spacing: { padding: { token: "spacing.lg" } } },
      },
    };
  };

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
              layout: { gridTemplateColumns: "repeat(2, minmax(0, 360px))" },
              spacing: { padding: { token: "spacing.lg" } },
            },
          },
        },
        children: ["pricing-section-basic", "pricing-section-premium"],
      },
      ...pricingCardFragment(
        "pricing-section-basic",
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
        basicCardStyle(),
      ),
      ...pricingCardFragment(
        "pricing-section-premium",
        {
          planName: "Growth",
          price: "$99",
          period: "/mes",
          features: ["Contactos ilimitados", "Campañas ilimitadas", "Canales: email, SMS, WhatsApp y voz", "Soporte prioritario 24/7"],
          ctaLabel: "Elegir Growth",
          ctaLink: { kind: "external", href: "#" },
          popular: true,
          popularLabel: "Popular",
        },
        premiumCardStyle(),
      ),
    },
  };
}
