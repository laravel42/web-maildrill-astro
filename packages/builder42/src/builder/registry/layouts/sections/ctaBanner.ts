import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Banda de llamada a la acción: título + subtítulo + botón, cerrada con un
 * `divider` (docs/37 §3.1 #4 — primer uso de `divider` en la galería de
 * layouts). Fondo con foto real de Unsplash + overlay oscuro en gradiente
 * para legibilidad (mismo patrón de sintaxis que el hero de
 * `creativeAgencyPage.ts`, ver `agency-hero`). Copy de conversión de
 * mensajería multicanal. Escrita exclusivamente con `BASE_TOKENS` salvo el
 * fondo con imagen.
 *
 * Pulido de diseño (feedback: título con tamaño de texto default, botón sin
 * hover): el título pasa de tipografía default (`~16px`, se perdía contra la
 * foto de fondo) a `clamp(1.75rem, 4.5vw, 3rem)` con peso bold y line-height
 * ajustado — mismo patrón que `sectionTitle()`/`agency-hero-title` en
 * `creativeAgencyPage.ts`: fluido entre mobile y desktop en vez de un tamaño
 * fijo, para que el título domine la banda con imagen igual que un hero. El
 * botón gana `states: { hover: {...} }` (patrón `agency-hero-cta`): fondo que
 * pasa a `colors.band.on` (blanco) en hover, mismo criterio de contraste que
 * ya usaba el estado base.
 */
export function buildCtaBannerFragment(): NodeFragment {
  return {
    rootId: "cta-banner-root",
    nodes: {
      "cta-banner-root": {
        id: "cta-banner-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.75)), url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              borderRadius: { token: "radii.md" },
            },
          },
        },
        children: ["cta-banner-title", "cta-banner-sub", "cta-banner-btn", "cta-banner-divider"],
      },
      "cta-banner-title": {
        id: "cta-banner-title",
        type: "text",
        props: { content: "<strong>Empieza tu primera campaña hoy</strong>" },
        style: {
          base: {
            size: { maxWidth: "20ch" },
            typography: {
              fontSize: "clamp(1.75rem, 4.5vw, 3rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.1",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "cta-banner-sub": {
        id: "cta-banner-sub",
        type: "text",
        props: { content: "Sin tarjeta de crédito, cancela cuando quieras." },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "cta-banner-btn": {
        id: "cta-banner-btn",
        type: "button",
        props: { label: "Crear cuenta gratis", link: { kind: "external", href: "#" } },
        style: {
          base: {
            appearance: {
              background: { token: "colors.primary.on" },
              color: { token: "colors.primary.default" },
              borderRadius: { token: "radii.md" },
            },
          },
          states: {
            hover: {
              appearance: {
                background: { token: "colors.band.on" },
                color: { token: "colors.primary.default" },
              },
            },
          },
        },
      },
      "cta-banner-divider": {
        id: "cta-banner-divider",
        type: "divider",
        props: {},
        style: defaultStyleFor("divider"),
      },
    },
  };
}
