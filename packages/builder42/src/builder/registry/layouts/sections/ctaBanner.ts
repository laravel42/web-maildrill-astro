import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Banda de llamada a la acción: dos columnas sobre foto real de fondo con
 * overlay oscuro en gradiente (mismo patrón de sintaxis que el hero de
 * `creativeAgencyPage.ts`, ver `agency-hero`, y que `hero-section-root`).
 * Cerrada con un `divider` (docs/37 §3.1 #4 — primer uso de `divider` en la
 * galería de layouts). Copy de conversión de mensajería multicanal. Escrita
 * exclusivamente con `BASE_TOKENS` salvo el fondo con imagen.
 *
 * Rediseño estructural (impeccable — bolder; el pulido anterior solo subía
 * tamaños de fuente/sombra, sin mover la estructura, y se sintió plano):
 * el "movimiento decisivo" de esta sección es pasar de una columna centrada
 * (título + subtítulo + botón apilados, igual que cualquier banner) a
 * **dos columnas asimétricas** — texto+CTA a la izquierda (`flex: 2`),
 * franja vertical de **4 iconos de canal** a la derecha (`flex: 1`,
 * `Mail`/`MessageSquare`/`Phone`/`Mic`, mismo componente `icon` ya usado en
 * `features3Col`/`statsStrip`, NO un kicker de texto). La franja de iconos
 * es el mismo tipo de evidencia visual que el hero usa con la foto: mostrar
 * en vez de anunciar "somos multicanal" con una etiqueta. Se colapsa a una
 * fila horizontal debajo del texto en `base`/`sm` (el layout de 2 columnas
 * solo tiene aire suficiente desde `md`).
 *
 * Nota sobre el eyebrow retirado: una ronda anterior de esta sección probó
 * un rótulo "OFERTA DE LANZAMIENTO" sobre el título — es exactamente el
 * patrón de kicker que el craft floor de este proyecto prohíbe sin
 * excepción (el encabezado ya carga su propio peso). Se elimina en esta
 * ronda; el titular vuelve a ser el primer elemento.
 */
export function buildCtaBannerFragment(): NodeFragment {
  const channelIconStyle = (): NodeFragment["nodes"][string]["style"] => ({
    base: {
      layout: { display: "flex", justifyContent: "center", alignItems: "center" },
      size: { width: "44px", height: "44px" },
      appearance: { background: "rgba(255,255,255,0.14)", borderRadius: "50%" },
    },
  });

  const channelGlyphStyle = (): NodeFragment["nodes"][string]["style"] => ({
    base: { size: { width: "20px", height: "20px" }, appearance: { color: { token: "colors.band.on" } } },
  });

  return {
    rootId: "cta-banner-root",
    nodes: {
      "cta-banner-root": {
        id: "cta-banner-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            appearance: {
              background:
                "linear-gradient(120deg, rgba(0,0,0,0.35), rgba(0,0,0,0.82)), url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              borderRadius: { token: "radii.md" },
            },
          },
          overrides: {
            sm: { spacing: { padding: "56px 32px" } },
            md: {
              layout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
              spacing: { padding: "72px 48px" },
            },
          },
        },
        children: ["cta-banner-copy", "cta-banner-channels", "cta-banner-divider"],
      },

      // --- Columna 1: título + subtítulo + botón (flex: 2 desde md) --------
      "cta-banner-copy": {
        id: "cta-banner-copy",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", alignItems: "flex-start" } },
          overrides: { md: { size: { maxWidth: "56ch" } } },
        },
        children: ["cta-banner-title", "cta-banner-sub", "cta-banner-btn"],
      },
      "cta-banner-title": {
        id: "cta-banner-title",
        type: "text",
        props: { content: "<strong>Start your first campaign today</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.75rem, 5vw, 3.25rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.08",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "cta-banner-sub": {
        id: "cta-banner-sub",
        type: "text",
        props: { content: "No credit card required. Cancel anytime." },
        style: {
          base: {
            spacing: { margin: "12px 0 0 0" },
            typography: { fontSize: { token: "typography.sizes.lg" } },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "cta-banner-btn": {
        id: "cta-banner-btn",
        type: "button",
        props: { label: "Create a free account", link: { kind: "external", href: "#" } },
        style: {
          base: {
            spacing: { padding: "16px 32px", margin: "28px 0 0 0" },
            typography: { fontSize: { token: "typography.sizes.lg" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.on" },
              color: { token: "colors.primary.default" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 16px 32px -12px rgba(0,0,0,0.45)",
            },
          },
          states: {
            hover: {
              appearance: {
                background: { token: "colors.band.on" },
                color: { token: "colors.primary.default" },
                boxShadow: "0 20px 40px -12px rgba(0,0,0,0.55)",
              },
            },
          },
        },
      },

      // --- Columna 2: 4 iconos de canal (flex: 1 desde md) ------------------
      "cta-banner-channels": {
        id: "cta-banner-channels",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", gap: { token: "spacing.md" }, alignItems: "center" } },
          overrides: { md: { layout: { flexDirection: "column", gap: { token: "spacing.sm" } } } },
        },
        children: [
          "cta-banner-channel-email",
          "cta-banner-channel-sms",
          "cta-banner-channel-whatsapp",
          "cta-banner-channel-voice",
        ],
      },
      "cta-banner-channel-email": {
        id: "cta-banner-channel-email",
        type: "container",
        props: {},
        style: channelIconStyle(),
        children: ["cta-banner-channel-email-icon"],
      },
      "cta-banner-channel-email-icon": {
        id: "cta-banner-channel-email-icon",
        type: "icon",
        props: { name: "Mail", title: "Email" },
        style: channelGlyphStyle(),
      },
      "cta-banner-channel-sms": {
        id: "cta-banner-channel-sms",
        type: "container",
        props: {},
        style: channelIconStyle(),
        children: ["cta-banner-channel-sms-icon"],
      },
      "cta-banner-channel-sms-icon": {
        id: "cta-banner-channel-sms-icon",
        type: "icon",
        props: { name: "MessageSquare", title: "SMS" },
        style: channelGlyphStyle(),
      },
      "cta-banner-channel-whatsapp": {
        id: "cta-banner-channel-whatsapp",
        type: "container",
        props: {},
        style: channelIconStyle(),
        children: ["cta-banner-channel-whatsapp-icon"],
      },
      "cta-banner-channel-whatsapp-icon": {
        id: "cta-banner-channel-whatsapp-icon",
        type: "icon",
        props: { name: "MessageCircle", title: "WhatsApp" },
        style: channelGlyphStyle(),
      },
      "cta-banner-channel-voice": {
        id: "cta-banner-channel-voice",
        type: "container",
        props: {},
        style: channelIconStyle(),
        children: ["cta-banner-channel-voice-icon"],
      },
      "cta-banner-channel-voice-icon": {
        id: "cta-banner-channel-voice-icon",
        type: "icon",
        props: { name: "Phone", title: "Voz" },
        style: channelGlyphStyle(),
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
