import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, pricingCardFragment, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Equipo" — REESCRITA (docs/48 §2 fila 10, F4) como plantilla de
 * sector: coworking / espacio de trabajo compartido ("Muelle 12", Guadalajara).
 * Conserva su `id` ("team-page") — un sitio guardado que la referencie sigue
 * funcionando — pero el contenido, el arquetipo y el tema son enteramente
 * nuevos.
 *
 * Arquetipo A7b (docs/48 §2) — variante de A7 (aside + main, ya usado por
 * `real-estate-page`). Difiere de A7 en ≥2/5 rasgos de firma
 * (`layoutSignature.helper.ts`):
 *   1. **Densidad de grid distinta**: A7 usa 2 columnas asimétricas
 *      (`minmax(0, 320px) 1fr`, aside estrecho de filtro + listado largo). A7b
 *      usa `minmax(280px, 320px) minmax(0, 1fr)` en la banda de planes, pero la
 *      firma real que la distingue es la banda de instalaciones: un grid FLUIDO
 *      (`repeat(auto-fit, minmax(260px, 1fr))`) que A7 no tiene en ninguna banda.
 *   2. **Orientación**: en A7 el aside (filtro) va a la IZQUIERDA del listado
 *      principal. En A7b el aside (resumen de planes + CTA) va a la DERECHA de
 *      la columna de contenido (`team-page-plans-main` primero,
 *      `team-page-plans-aside` después en `children`) — orientación "left"
 *      (contenido) en vez de "right" en el `orientationOf` del helper, porque
 *      el media (imagen del espacio) vive en `main`, no en el aside.
 * Suma un tercer rasgo distinto de facto: A7b usa `tabs` (planes) + `pricing-card`
 * dentro del `main`, algo que A7 no usa.
 *
 * Tema "Loft" (teal/blanco, docs/48 §2): tipografía DM Sans — geométrica y
 * limpia, coherente con un espacio de coworking industrial-moderno.
 *
 * Showcase funcional: `tabs` de planes de membresía (flex desk / dedicated
 * desk / oficina privada), `pricing-card` dentro de cada tab, `scroll-spy` en
 * el nav de anclas del hero (Planes / Instalaciones / Comunidad / Ubicación).
 *
 * Anatomía: navbar · hero con nav de anclas (`scroll-spy`) · aside + main de
 * planes de membresía (`tabs` + `pricing-card`, A7b) · galería de
 * instalaciones (grid fluido) · comunidad y eventos · testimonios de
 * miembros · ubicación/contacto (`form`) · footer oscuro.
 *
 * Todos los ids con prefijo `team-page-` (se conserva el prefijo original de
 * la plantilla genérica, aunque el contenido sea nuevo — consistente con el
 * id de la plantilla).
 */

const SHADOW_CARD = "0 12px 32px rgba(15,42,40,0.10)";
const SHADOW_HOVER = "0 20px 44px rgba(15,42,40,0.18)";
const BAND_PADDING_BASE = "56px 20px";
const BAND_PADDING_MD = "112px 20px";
const INNER_MAX = "1160px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, paddingBase: string = BAND_PADDING_BASE, paddingMd: string = BAND_PADDING_MD): NodeStyle {
  return {
    base: { spacing: { padding: paddingBase }, appearance: { background } },
    overrides: { md: { spacing: { padding: paddingMd } } },
  };
}

function inner(maxWidth: string = INNER_MAX, gapBase = "24px", gapMd = "40px"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap: gapBase },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
    overrides: { md: { layout: { gap: gapMd } } },
  };
}

function sectionTitle(color: StyleValue = { token: "colors.text" }, align: "left" | "center" = "left"): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.15",
        textAlign: align,
      },
      appearance: { color },
    },
  };
}

function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "60ch"): NodeStyle {
  return {
    base: {
      size: { maxWidth },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
        lineHeight: { token: "typography.lineHeights.normal" },
      },
      appearance: { color },
    },
  };
}

function cardStyle(radius = "16px", shadow = SHADOW_CARD): NodeStyle {
  return {
    base: {
      appearance: {
        background: { token: "colors.surface.default" },
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: { token: "colors.border" },
        borderRadius: radius,
        boxShadow: shadow,
      },
    },
  };
}

function anchorLink(n: 1 | 2 | 3 | 4, label: string, targetId: string) {
  return {
    [`team-page-hero-nav-${n}`]: {
      id: `team-page-hero-nav-${n}`,
      type: "button",
      props: { label, link: { kind: "anchor", nodeId: targetId }, newTab: false },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "14px 22px" },
          typography: { fontWeight: { token: "typography.weights.bold" }, textDecoration: "none" },
          appearance: { background: "transparent", color: { token: "colors.surface.default" }, cursor: "pointer" },
        },
      },
    },
  };
}

function facilityCard(n: 1 | 2 | 3 | 4, title: string, text: string, imageUrl: string, alt: string) {
  return {
    [`team-page-facility-${n}`]: {
      id: `team-page-facility-${n}`,
      type: "card",
      props: {},
      style: {
        ...cardStyle(),
        base: { ...cardStyle().base, layout: { display: "flex", flexDirection: "column", gap: "0" }, spacing: { padding: "0" } },
        states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
      },
      children: [`team-page-facility-${n}-img`, `team-page-facility-${n}-body`],
    },
    [`team-page-facility-${n}-img`]: {
      id: `team-page-facility-${n}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover", loading: "lazy" },
      style: {
        base: {
          size: { width: "100%", height: "200px" },
          appearance: { borderRadius: "16px 16px 0 0" },
        },
        overrides: { md: { size: { height: "220px" } } },
      },
    },
    [`team-page-facility-${n}-body`]: {
      id: `team-page-facility-${n}-body`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "8px" }, spacing: { padding: "20px" } } },
      children: [`team-page-facility-${n}-title`, `team-page-facility-${n}-text`],
    },
    [`team-page-facility-${n}-title`]: {
      id: `team-page-facility-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: { base: { typography: { fontSize: "1.125rem", lineHeight: "1.3", fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.text" } } } },
    },
    [`team-page-facility-${n}-text`]: {
      id: `team-page-facility-${n}-text`,
      type: "text",
      props: { content: text },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function memberTestimonial(n: 1 | 2 | 3, quote: string, name: string, role: string, initials: string) {
  return testimonialFragment(`team-page-testimonial-${n}`, { quote, name, role, initials }, {
    base: { ...cardStyle().base, spacing: { padding: "20px" } },
    overrides: { md: { spacing: { padding: "28px" } } },
  });
}

export function buildTeamPageFragment(): NodeFragment {
  return {
    rootId: "team-page-root",
    nodes: {
      "team-page-root": {
        id: "team-page-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "team-page-navbar",
          "team-page-hero",
          "team-page-plans",
          "team-page-facilities",
          "team-page-community",
          "team-page-testimonials",
          "team-page-location",
          "team-page-footer",
        ],
      },

      // --- Navbar --------------------------------------------------------------
      "team-page-navbar": {
        id: "team-page-navbar",
        type: "navbar",
        props: { brand: "Muelle 12", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero con nav de anclas (scroll-spy) ----------------------------------
      "team-page-hero": {
        id: "team-page-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px" },
            spacing: { padding: "64px 20px" },
            size: { width: "100%", minHeight: "460px" },
            typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(9,38,36,0.74), rgba(9,38,36,0.42)), url('https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "128px 20px" } } },
        },
        behaviors: [{ type: "scroll-spy", options: { rootMargin: "-20% 0px -60% 0px" } }],
        children: [
          "team-page-hero-badge",
          "team-page-hero-title",
          "team-page-hero-sub",
          "team-page-hero-cta",
          "team-page-hero-nav",
        ],
      },
      "team-page-hero-badge": {
        id: "team-page-hero-badge",
        type: "badge",
        props: { label: "Escritorios disponibles esta semana" },
        style: defaultStyleFor("badge"),
      },
      "team-page-hero-title": {
        id: "team-page-hero-title",
        type: "text",
        props: { content: "<strong>Tu próximo lugar de trabajo, sin ataduras</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.05",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "team-page-hero-sub": {
        id: "team-page-hero-sub",
        type: "text",
        props: {
          content:
            "Escritorios flexibles, oficinas privadas y una comunidad activa de equipos remotos y freelancers en el corazón de Guadalajara.",
        },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "team-page-hero-cta": {
        id: "team-page-hero-cta",
        type: "button",
        props: { label: "Ver planes de membresía", link: { kind: "anchor", nodeId: "team-page-plans" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(9,38,36,0.32)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(9,38,36,0.4)" } } },
        },
      },
      "team-page-hero-nav": {
        id: "team-page-hero-nav",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" },
            spacing: { margin: "12px 0 0" },
          },
          overrides: { sm: { layout: { flexDirection: "row", gap: "16px" } }, md: { layout: { gap: "28px" } } },
        },
        children: ["team-page-hero-nav-1", "team-page-hero-nav-2", "team-page-hero-nav-3", "team-page-hero-nav-4"],
      },
      ...anchorLink(1, "Planes", "team-page-plans"),
      ...anchorLink(2, "Instalaciones", "team-page-facilities"),
      ...anchorLink(3, "Comunidad", "team-page-community"),
      ...anchorLink(4, "Ubicación", "team-page-location"),

      // --- Planes de membresía — aside + main (A7b) -----------------------------
      "team-page-plans": {
        id: "team-page-plans",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["team-page-plans-inner"],
      },
      "team-page-plans-inner": {
        id: "team-page-plans-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["team-page-plans-title", "team-page-plans-sub", "team-page-plans-layout"],
      },
      "team-page-plans-title": {
        id: "team-page-plans-title",
        type: "text",
        props: { content: "<strong>Planes de membresía</strong>" },
        style: sectionTitle(),
      },
      "team-page-plans-sub": {
        id: "team-page-plans-sub",
        type: "text",
        props: { content: "Desde un escritorio para un día hasta tu propia oficina privada. Cambia de plan cuando lo necesites." },
        style: bodyText(),
      },
      // A7b: 2 columnas asimétricas (main con tabs+pricing primero, aside de
      // resumen después) — orientación distinta de A7 (aside-filtro primero,
      // listado-main después en real-estate-page).
      "team-page-plans-layout": {
        id: "team-page-plans-layout",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" } },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 300px)", gap: "40px" } } },
        },
        children: ["team-page-plans-main", "team-page-plans-aside"],
      },
      "team-page-plans-main": {
        id: "team-page-plans-main",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } } } },
        children: ["team-page-plans-tabs"],
      },
      "team-page-plans-tabs": {
        id: "team-page-plans-tabs",
        type: "tabs",
        props: {},
        style: { ...defaultStyleFor("tabs"), overrides: { md: { spacing: { padding: "0" } } } },
        behaviors: [{ type: "tabs", options: { duration: 220 } }],
        children: ["team-page-tab-flex", "team-page-tab-dedicated", "team-page-tab-private"],
      },
      "team-page-tab-flex": {
        id: "team-page-tab-flex",
        type: "tab",
        props: { label: "Flex desk" },
        style: defaultStyleFor("tab"),
        children: ["team-page-plan-flex"],
      },
      ...pricingCardFragment(
        "team-page-plan-flex",
        {
          planName: "Flex desk",
          price: "$1,450",
          period: "/mes",
          features: [
            "Cualquier escritorio disponible",
            "Acceso 9:00–20:00",
            "Wifi de alta velocidad",
            "2h de sala de juntas al mes",
          ],
          ctaLabel: "Reservar flex desk",
          ctaLink: { kind: "anchor", nodeId: "team-page-location" },
          popular: false,
          popularLabel: "Más elegido",
        },
        {
          ...defaultStyleFor("pricing-card"),
          base: { ...defaultStyleFor("pricing-card").base, size: { minHeight: "64px", maxWidth: "420px", width: "100%" } },
          states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
        },
      ),
      "team-page-tab-dedicated": {
        id: "team-page-tab-dedicated",
        type: "tab",
        props: { label: "Dedicated desk" },
        style: defaultStyleFor("tab"),
        children: ["team-page-plan-dedicated"],
      },
      ...pricingCardFragment(
        "team-page-plan-dedicated",
        {
          planName: "Dedicated desk",
          price: "$2,200",
          period: "/mes",
          features: [
            "Escritorio fijo asignado",
            "Acceso 24/7",
            "Casillero personal",
            "6h de sala de juntas al mes",
            "Correo con dirección del espacio",
          ],
          ctaLabel: "Reservar dedicated desk",
          ctaLink: { kind: "anchor", nodeId: "team-page-location" },
          popular: true,
          popularLabel: "Más elegido",
        },
        {
          ...defaultStyleFor("pricing-card"),
          base: {
            ...defaultStyleFor("pricing-card").base,
            size: { minHeight: "64px", maxWidth: "420px", width: "100%" },
            appearance: { ...defaultStyleFor("pricing-card").base.appearance, borderColor: { token: "colors.primary.default" }, borderWidth: "2px", boxShadow: SHADOW_HOVER },
          },
          states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
        },
      ),
      "team-page-tab-private": {
        id: "team-page-tab-private",
        type: "tab",
        props: { label: "Oficina privada" },
        style: defaultStyleFor("tab"),
        children: ["team-page-plan-private"],
      },
      ...pricingCardFragment(
        "team-page-plan-private",
        {
          planName: "Oficina privada",
          price: "$5,900",
          period: "/mes",
          features: [
            "Oficina cerrada para hasta 4 personas",
            "Acceso 24/7",
            "Sala de juntas ilimitada",
            "Rotulación con tu marca",
            "Factura y contrato flexible",
          ],
          ctaLabel: "Agendar visita",
          ctaLink: { kind: "anchor", nodeId: "team-page-location" },
          popular: false,
          popularLabel: "Más elegido",
        },
        {
          ...defaultStyleFor("pricing-card"),
          base: { ...defaultStyleFor("pricing-card").base, size: { minHeight: "64px", maxWidth: "420px", width: "100%" } },
          states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
        },
      ),
      "team-page-plans-aside": {
        id: "team-page-plans-aside",
        type: "card",
        props: {},
        style: {
          ...cardStyle(),
          base: {
            ...cardStyle().base,
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "24px" },
            size: { width: "100%" },
          },
        },
        behaviors: [{ type: "sticky", options: { position: "top", scrolledThreshold: 8 } }],
        children: ["team-page-plans-aside-title", "team-page-plans-aside-text", "team-page-plans-aside-cta"],
      },
      "team-page-plans-aside-title": {
        id: "team-page-plans-aside-title",
        type: "text",
        props: { content: "<strong>¿No sabes qué plan elegir?</strong>" },
        style: { base: { typography: { fontSize: "1.125rem", fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.text" } } } },
      },
      "team-page-plans-aside-text": {
        id: "team-page-plans-aside-text",
        type: "text",
        props: { content: "Agenda un recorrido de 20 minutos y te ayudamos a encontrar el plan que se ajusta a tu equipo." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "team-page-plans-aside-cta": {
        id: "team-page-plans-aside-cta",
        type: "button",
        props: { label: "Agendar recorrido", link: { kind: "anchor", nodeId: "team-page-location" } },
        style: {
          base: {
            spacing: { padding: "14px 22px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
            },
          },
          states: { hover: { appearance: { background: { token: "colors.text" } } } },
        },
      },

      // --- Galería de instalaciones — grid FLUIDO (rasgo distinto de A7) ------
      "team-page-facilities": {
        id: "team-page-facilities",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["team-page-facilities-inner"],
      },
      "team-page-facilities-inner": {
        id: "team-page-facilities-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["team-page-facilities-title", "team-page-facilities-grid"],
      },
      "team-page-facilities-title": {
        id: "team-page-facilities-title",
        type: "text",
        props: { content: "<strong>Instalaciones pensadas para trabajar bien</strong>" },
        style: sectionTitle(),
      },
      "team-page-facilities-grid": {
        id: "team-page-facilities-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" } },
          overrides: { md: { layout: { gap: "24px" } } },
        },
        children: ["team-page-facility-1", "team-page-facility-2", "team-page-facility-3", "team-page-facility-4"],
      },
      ...facilityCard(
        1,
        "Sala de juntas",
        "Dos salas equipadas con pantalla y videoconferencia, reservables por hora.",
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&auto=format&fit=crop",
        "Sala de juntas con pantalla y mesa larga",
      ),
      ...facilityCard(
        2,
        "Área de café",
        "Café de especialidad ilimitado y una cocina compartida para el almuerzo.",
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80&auto=format&fit=crop",
        "Área de café con barra y taburetes",
      ),
      ...facilityCard(
        3,
        "Cabinas telefónicas",
        "Cabinas insonorizadas para llamadas y videollamadas sin interrumpir a nadie.",
        "https://images.unsplash.com/photo-1600508773949-d0fd9226ffd8?w=800&q=80&auto=format&fit=crop",
        "Cabina telefónica insonorizada",
      ),
      ...facilityCard(
        4,
        "Terraza",
        "Espacio al aire libre con wifi para trabajar o hacer una pausa.",
        "https://images.unsplash.com/photo-1522071901873-411886a10004?w=800&q=80&auto=format&fit=crop",
        "Terraza con mesas y plantas",
      ),

      // --- Comunidad y eventos — banda oscura -----------------------------------
      "team-page-community": {
        id: "team-page-community",
        type: "section",
        props: {},
        style: band({ token: "colors.band.dark" }),
        behaviors: REVEAL,
        children: ["team-page-community-inner"],
      },
      "team-page-community-inner": {
        id: "team-page-community-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["team-page-community-title", "team-page-community-text", "team-page-community-events"],
      },
      "team-page-community-title": {
        id: "team-page-community-title",
        type: "text",
        props: { content: "<strong>Una comunidad, no solo un escritorio</strong>" },
        style: sectionTitle({ token: "colors.band.on" }),
      },
      "team-page-community-text": {
        id: "team-page-community-text",
        type: "text",
        props: {
          content:
            "Organizamos eventos mensuales de networking, talleres y desayunos de comunidad para que conozcas a otros equipos del espacio.",
        },
        style: { ...bodyText({ token: "colors.band.on" }), base: { ...bodyText({ token: "colors.band.on" }).base } },
      },
      "team-page-community-events": {
        id: "team-page-community-events",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "24px" } } },
        },
        children: ["team-page-event-1", "team-page-event-2", "team-page-event-3"],
      },
      "team-page-event-1": {
        id: "team-page-event-1",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "6px" },
            spacing: { padding: "16px" },
            appearance: {
              borderRadius: "12px",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.band.on" },
            },
          },
        },
        children: ["team-page-event-1-title", "team-page-event-1-text"],
      },
      "team-page-event-1-title": {
        id: "team-page-event-1-title",
        type: "text",
        props: { content: "<strong>Desayuno de comunidad</strong>" },
        style: { base: { typography: { fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.band.on" } } } },
      },
      "team-page-event-1-text": {
        id: "team-page-event-1-text",
        type: "text",
        props: { content: "Primer jueves de cada mes, 9:00 AM" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "team-page-event-2": {
        id: "team-page-event-2",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "6px" },
            spacing: { padding: "16px" },
            appearance: {
              borderRadius: "12px",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.band.on" },
            },
          },
        },
        children: ["team-page-event-2-title", "team-page-event-2-text"],
      },
      "team-page-event-2-title": {
        id: "team-page-event-2-title",
        type: "text",
        props: { content: "<strong>Taller de productividad</strong>" },
        style: { base: { typography: { fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.band.on" } } } },
      },
      "team-page-event-2-text": {
        id: "team-page-event-2-text",
        type: "text",
        props: { content: "Tercer miércoles de cada mes, 5:00 PM" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "team-page-event-3": {
        id: "team-page-event-3",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "6px" },
            spacing: { padding: "16px" },
            appearance: {
              borderRadius: "12px",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.band.on" },
            },
          },
        },
        children: ["team-page-event-3-title", "team-page-event-3-text"],
      },
      "team-page-event-3-title": {
        id: "team-page-event-3-title",
        type: "text",
        props: { content: "<strong>Networking de fin de mes</strong>" },
        style: { base: { typography: { fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.band.on" } } } },
      },
      "team-page-event-3-text": {
        id: "team-page-event-3-text",
        type: "text",
        props: { content: "Último viernes de cada mes, 6:30 PM" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },

      // --- Testimonios de miembros — banda clara --------------------------------
      "team-page-testimonials": {
        id: "team-page-testimonials",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["team-page-testimonials-inner"],
      },
      "team-page-testimonials-inner": {
        id: "team-page-testimonials-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["team-page-testimonials-title", "team-page-testimonials-grid"],
      },
      "team-page-testimonials-title": {
        id: "team-page-testimonials-title",
        type: "text",
        props: { content: "<strong>Lo que dicen nuestros miembros</strong>" },
        style: sectionTitle(),
      },
      "team-page-testimonials-grid": {
        id: "team-page-testimonials-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "28px" } } },
        },
        children: ["team-page-testimonial-1", "team-page-testimonial-2", "team-page-testimonial-3"],
      },
      ...memberTestimonial(
        1,
        "Cambié mi departamento por Muelle 12 hace un año y no lo cambio por nada: internet estable, café bueno y gente con quien colaborar de verdad.",
        "Renata Cortés",
        "Diseñadora freelance",
        "RC",
      ),
      ...memberTestimonial(
        2,
        "Nuestro equipo remoto necesitaba un punto de encuentro semanal. La oficina privada nos dio flexibilidad sin firmar un contrato de años.",
        "Julián Torres",
        "Fundador, estudio de software",
        "JT",
      ),
      ...memberTestimonial(
        3,
        "Los eventos de comunidad me conectaron con dos clientes en mi primer mes. El espacio se paga solo.",
        "Mariana Vega",
        "Consultora de marketing",
        "MV",
      ),

      // --- Ubicación y contacto — banda alt --------------------------------------
      "team-page-location": {
        id: "team-page-location",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["team-page-location-inner"],
      },
      "team-page-location-inner": {
        id: "team-page-location-inner",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" }, spacing: { margin: "0 auto" }, size: { width: "100%", maxWidth: INNER_MAX } },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 320px) 1fr", gap: "40px" } } },
        },
        children: ["team-page-location-info", "team-page-location-card"],
      },
      "team-page-location-info": {
        id: "team-page-location-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["team-page-location-title", "team-page-location-sub", "team-page-location-address"],
      },
      "team-page-location-title": {
        id: "team-page-location-title",
        type: "text",
        props: { content: "<strong>Ven a conocer el espacio</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "team-page-location-sub": {
        id: "team-page-location-sub",
        type: "text",
        props: { content: "Agenda un recorrido gratuito o escríbenos si tienes dudas sobre planes y disponibilidad." },
        style: { base: { typography: { fontSize: "clamp(1rem, 1.6vw, 1.125rem)" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "team-page-location-address": {
        id: "team-page-location-address",
        type: "text",
        props: { content: "Av. Chapultepec 480, Col. Americana, Guadalajara, Jalisco" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "team-page-location-card": {
        id: "team-page-location-card",
        type: "card",
        props: {},
        style: {
          ...cardStyle(),
          base: { ...cardStyle().base, layout: { display: "flex", flexDirection: "column", gap: "12px" }, spacing: { padding: "24px" } },
        },
        children: ["team-page-form"],
      },
      "team-page-form": {
        id: "team-page-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["team-page-field-name", "team-page-field-email", "team-page-field-message", "team-page-submit"],
      },
      "team-page-field-name": {
        id: "team-page-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["team-page-label-name", "team-page-input-name"],
      },
      "team-page-label-name": {
        id: "team-page-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "team-page-input-name" },
        style: defaultStyleFor("label"),
      },
      "team-page-input-name": {
        id: "team-page-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "team-page-field-email": {
        id: "team-page-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["team-page-label-email", "team-page-input-email"],
      },
      "team-page-label-email": {
        id: "team-page-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "team-page-input-email" },
        style: defaultStyleFor("label"),
      },
      "team-page-input-email": {
        id: "team-page-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "team-page-field-message": {
        id: "team-page-field-message",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["team-page-label-message", "team-page-textarea-message"],
      },
      "team-page-label-message": {
        id: "team-page-label-message",
        type: "label",
        props: { text: "¿En qué podemos ayudarte?", for: "team-page-textarea-message" },
        style: defaultStyleFor("label"),
      },
      "team-page-textarea-message": {
        id: "team-page-textarea-message",
        type: "textarea",
        props: { name: "mensaje", placeholder: "Ej. Quiero agendar un recorrido la próxima semana…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "team-page-submit": {
        id: "team-page-submit",
        type: "button-submit",
        props: { label: "Agendar recorrido", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,42,40,0.2)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(15,42,40,0.28)" } } },
        },
      },

      // --- Footer — banda oscura -------------------------------------------------
      "team-page-footer": {
        id: "team-page-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            size: { width: "100%" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "64px 40px" } } },
        },
        children: ["team-page-footer-address", "team-page-footer-social", "team-page-footer-copyright"],
      },
      "team-page-footer-address": {
        id: "team-page-footer-address",
        type: "text",
        props: { content: "Av. Chapultepec 480, Col. Americana, Guadalajara, Jalisco" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "team-page-footer-social": {
        id: "team-page-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "team-page-footer-copyright": {
        id: "team-page-footer-copyright",
        type: "text",
        props: { content: "© 2026 Muelle 12 Coworking. Todos los derechos reservados." },
        style: {
          base: {
            size: { width: "100%" },
            spacing: { padding: "16px 0 0 0" },
            typography: { textAlign: "center", fontSize: { token: "typography.sizes.sm" } },
            appearance: {
              color: "inherit",
              borderColor: "rgba(255,255,255,0.16)",
              borderWidth: "1px 0 0 0",
              borderStyle: "solid",
            },
          },
        },
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["team-page-hero-nav-1"] = { en: { label: "Plans" }, it: { label: "Piani" } };
      t["team-page-hero-nav-2"] = { en: { label: "Facilities" }, it: { label: "Servizi" } };
      t["team-page-hero-nav-3"] = { en: { label: "Community" }, it: { label: "Community" } };
      t["team-page-hero-nav-4"] = { en: { label: "Location" }, it: { label: "Posizione" } };

      t["team-page-hero-badge"] = { en: { label: "Desks available this week" }, it: { label: "Scrivanie disponibili questa settimana" } };
      t["team-page-hero-title"] = {
        en: { content: "<strong>Your next workplace, with no strings attached</strong>" },
        it: { content: "<strong>Il tuo prossimo posto di lavoro, senza vincoli</strong>" },
      };
      t["team-page-hero-sub"] = {
        en: {
          content:
            "Flexible desks, private offices and an active community of remote teams and freelancers in the heart of Guadalajara.",
        },
        it: {
          content:
            "Scrivanie flessibili, uffici privati e una community attiva di team remoti e freelance nel cuore di Guadalajara.",
        },
      };
      t["team-page-hero-cta"] = { en: { label: "See membership plans" }, it: { label: "Vedi i piani di abbonamento" } };

      t["team-page-plans-title"] = { en: { content: "<strong>Membership plans</strong>" }, it: { content: "<strong>Piani di abbonamento</strong>" } };
      t["team-page-plans-sub"] = {
        en: { content: "From a single day desk to your own private office. Change plans whenever you need to." },
        it: { content: "Da una scrivania per un giorno al tuo ufficio privato. Cambia piano quando vuoi." },
      };

      t["team-page-tab-flex"] = { en: { label: "Flex desk" }, it: { label: "Flex desk" } };
      t["team-page-plan-flex-plan"] = { en: { content: "Flex desk" }, it: { content: "Flex desk" } };
      t["team-page-plan-flex-price"] = { en: { content: "$1,450" }, it: { content: "$1.450" } };
      t["team-page-plan-flex-period"] = { en: { content: "/mo" }, it: { content: "/mese" } };
      t["team-page-plan-flex-feature-0-text"] = { en: { content: "✓ Any available desk" }, it: { content: "✓ Qualsiasi scrivania disponibile" } };
      t["team-page-plan-flex-feature-1-text"] = { en: { content: "✓ Access 9:00 AM–8:00 PM" }, it: { content: "✓ Accesso 9:00–20:00" } };
      t["team-page-plan-flex-feature-2-text"] = { en: { content: "✓ High-speed wifi" }, it: { content: "✓ Wifi ad alta velocità" } };
      t["team-page-plan-flex-feature-3-text"] = { en: { content: "✓ 2h of meeting room per month" }, it: { content: "✓ 2h di sala riunioni al mese" } };
      t["team-page-plan-flex-cta"] = { en: { label: "Book flex desk" }, it: { label: "Prenota flex desk" } };
      t["team-page-tab-dedicated"] = { en: { label: "Dedicated desk" }, it: { label: "Dedicated desk" } };
      t["team-page-plan-dedicated-badge"] = { en: { content: "Most chosen" }, it: { content: "Più scelto" } };
      t["team-page-plan-dedicated-plan"] = { en: { content: "Dedicated desk" }, it: { content: "Dedicated desk" } };
      t["team-page-plan-dedicated-price"] = { en: { content: "$2,200" }, it: { content: "$2.200" } };
      t["team-page-plan-dedicated-period"] = { en: { content: "/mo" }, it: { content: "/mese" } };
      t["team-page-plan-dedicated-feature-0-text"] = { en: { content: "✓ Assigned fixed desk" }, it: { content: "✓ Scrivania fissa assegnata" } };
      t["team-page-plan-dedicated-feature-1-text"] = { en: { content: "✓ 24/7 access" }, it: { content: "✓ Accesso 24/7" } };
      t["team-page-plan-dedicated-feature-2-text"] = { en: { content: "✓ Personal locker" }, it: { content: "✓ Armadietto personale" } };
      t["team-page-plan-dedicated-feature-3-text"] = { en: { content: "✓ 6h of meeting room per month" }, it: { content: "✓ 6h di sala riunioni al mese" } };
      t["team-page-plan-dedicated-feature-4-text"] = { en: { content: "✓ Mail with the space's address" }, it: { content: "✓ Posta con indirizzo dello spazio" } };
      t["team-page-plan-dedicated-cta"] = { en: { label: "Book dedicated desk" }, it: { label: "Prenota dedicated desk" } };
      t["team-page-tab-private"] = { en: { label: "Private office" }, it: { label: "Ufficio privato" } };
      t["team-page-plan-private-plan"] = { en: { content: "Private office" }, it: { content: "Ufficio privato" } };
      t["team-page-plan-private-price"] = { en: { content: "$5,900" }, it: { content: "$5.900" } };
      t["team-page-plan-private-period"] = { en: { content: "/mo" }, it: { content: "/mese" } };
      t["team-page-plan-private-feature-0-text"] = { en: { content: "✓ Closed office for up to 4 people" }, it: { content: "✓ Ufficio chiuso per fino a 4 persone" } };
      t["team-page-plan-private-feature-1-text"] = { en: { content: "✓ 24/7 access" }, it: { content: "✓ Accesso 24/7" } };
      t["team-page-plan-private-feature-2-text"] = { en: { content: "✓ Unlimited meeting room" }, it: { content: "✓ Sala riunioni illimitata" } };
      t["team-page-plan-private-feature-3-text"] = { en: { content: "✓ Branding with your logo" }, it: { content: "✓ Branding con il tuo logo" } };
      t["team-page-plan-private-feature-4-text"] = { en: { content: "✓ Flexible invoicing and contract" }, it: { content: "✓ Fatturazione e contratto flessibili" } };
      t["team-page-plan-private-cta"] = { en: { label: "Schedule a visit" }, it: { label: "Prenota una visita" } };

      t["team-page-plans-aside-title"] = { en: { content: "<strong>Not sure which plan to pick?</strong>" }, it: { content: "<strong>Non sai quale piano scegliere?</strong>" } };
      t["team-page-plans-aside-text"] = {
        en: { content: "Book a 20-minute tour and we'll help you find the plan that fits your team." },
        it: { content: "Prenota un tour di 20 minuti e ti aiutiamo a trovare il piano giusto per il tuo team." },
      };
      t["team-page-plans-aside-cta"] = { en: { label: "Book a tour" }, it: { label: "Prenota un tour" } };

      t["team-page-facilities-title"] = { en: { content: "<strong>Facilities designed to work well</strong>" }, it: { content: "<strong>Spazi pensati per lavorare bene</strong>" } };

      t["team-page-facility-1-title"] = { en: { content: "<strong>Meeting room</strong>" }, it: { content: "<strong>Sala riunioni</strong>" } };
      t["team-page-facility-1-text"] = {
        en: { content: "Two rooms equipped with screen and videoconferencing, bookable by the hour." },
        it: { content: "Due sale equipaggiate con schermo e videoconferenza, prenotabili a ore." },
      };
      t["team-page-facility-1-img"] = { en: { alt: "Meeting room with screen and long table" }, it: { alt: "Sala riunioni con schermo e tavolo lungo" } };
      t["team-page-facility-2-title"] = { en: { content: "<strong>Coffee area</strong>" }, it: { content: "<strong>Area caffè</strong>" } };
      t["team-page-facility-2-text"] = {
        en: { content: "Unlimited specialty coffee and a shared kitchen for lunch." },
        it: { content: "Caffè di specialità illimitato e una cucina condivisa per il pranzo." },
      };
      t["team-page-facility-2-img"] = { en: { alt: "Coffee area with bar and stools" }, it: { alt: "Area caffè con bancone e sgabelli" } };
      t["team-page-facility-3-title"] = { en: { content: "<strong>Phone booths</strong>" }, it: { content: "<strong>Cabine telefoniche</strong>" } };
      t["team-page-facility-3-text"] = {
        en: { content: "Soundproof booths for calls and video calls without disturbing anyone." },
        it: { content: "Cabine insonorizzate per chiamate e videochiamate senza disturbare nessuno." },
      };
      t["team-page-facility-3-img"] = { en: { alt: "Soundproof phone booth" }, it: { alt: "Cabina telefonica insonorizzata" } };
      t["team-page-facility-4-title"] = { en: { content: "<strong>Terrace</strong>" }, it: { content: "<strong>Terrazza</strong>" } };
      t["team-page-facility-4-text"] = {
        en: { content: "Outdoor space with wifi to work or take a break." },
        it: { content: "Spazio all'aperto con wifi per lavorare o fare una pausa." },
      };
      t["team-page-facility-4-img"] = { en: { alt: "Terrace with tables and plants" }, it: { alt: "Terrazza con tavoli e piante" } };

      t["team-page-community-title"] = { en: { content: "<strong>A community, not just a desk</strong>" }, it: { content: "<strong>Una community, non solo una scrivania</strong>" } };
      t["team-page-community-text"] = {
        en: {
          content:
            "We host monthly networking events, workshops and community breakfasts so you can meet other teams in the space.",
        },
        it: {
          content:
            "Organizziamo eventi di networking mensili, workshop e colazioni di community per conoscere altri team dello spazio.",
        },
      };
      t["team-page-event-1-title"] = { en: { content: "<strong>Community breakfast</strong>" }, it: { content: "<strong>Colazione di community</strong>" } };
      t["team-page-event-1-text"] = { en: { content: "First Thursday of every month, 9:00 AM" }, it: { content: "Primo giovedì del mese, ore 9:00" } };
      t["team-page-event-2-title"] = { en: { content: "<strong>Productivity workshop</strong>" }, it: { content: "<strong>Workshop di produttività</strong>" } };
      t["team-page-event-2-text"] = { en: { content: "Third Wednesday of every month, 5:00 PM" }, it: { content: "Terzo mercoledì del mese, ore 17:00" } };
      t["team-page-event-3-title"] = { en: { content: "<strong>End-of-month networking</strong>" }, it: { content: "<strong>Networking di fine mese</strong>" } };
      t["team-page-event-3-text"] = { en: { content: "Last Friday of every month, 6:30 PM" }, it: { content: "Ultimo venerdì del mese, ore 18:30" } };

      t["team-page-testimonials-title"] = { en: { content: "<strong>What our members say</strong>" }, it: { content: "<strong>Cosa dicono i nostri membri</strong>" } };
      t["team-page-testimonial-1-quote"] = {
        en: {
          content:
            "<p>I traded my apartment for Muelle 12 a year ago and I wouldn't change it for anything: stable internet, good coffee and people to really collaborate with.</p>",
        },
        it: {
          content:
            "<p>Ho lasciato il mio appartamento per Muelle 12 un anno fa e non lo cambierei con nulla: internet stabile, buon caffè e persone con cui collaborare davvero.</p>",
        },
      };
      t["team-page-testimonial-1-name"] = {
        en: { content: "<strong>Renata Cortés</strong>" },
        it: { content: "<strong>Renata Cortés</strong>" },
      };
      t["team-page-testimonial-1-role"] = {
        en: { content: "Freelance designer" },
        it: { content: "Designer freelance" },
      };
      t["team-page-testimonial-2-quote"] = {
        en: {
          content:
            "<p>Our remote team needed a weekly meeting point. The private office gave us flexibility without signing a years-long lease.</p>",
        },
        it: {
          content:
            "<p>Il nostro team remoto aveva bisogno di un punto di incontro settimanale. L'ufficio privato ci ha dato flessibilità senza firmare un contratto pluriennale.</p>",
        },
      };
      t["team-page-testimonial-2-name"] = {
        en: { content: "<strong>Julián Torres</strong>" },
        it: { content: "<strong>Julián Torres</strong>" },
      };
      t["team-page-testimonial-2-role"] = {
        en: { content: "Founder, software studio" },
        it: { content: "Fondatore, studio software" },
      };
      t["team-page-testimonial-3-quote"] = {
        en: {
          content:
            "<p>The community events connected me with two clients in my first month. The space pays for itself.</p>",
        },
        it: {
          content:
            "<p>Gli eventi della community mi hanno fatto conoscere due clienti nel primo mese. Lo spazio si ripaga da solo.</p>",
        },
      };
      t["team-page-testimonial-3-name"] = {
        en: { content: "<strong>Mariana Vega</strong>" },
        it: { content: "<strong>Mariana Vega</strong>" },
      };
      t["team-page-testimonial-3-role"] = {
        en: { content: "Marketing consultant" },
        it: { content: "Consulente marketing" },
      };

      t["team-page-location-title"] = { en: { content: "<strong>Come see the space</strong>" }, it: { content: "<strong>Vieni a vedere lo spazio</strong>" } };
      t["team-page-location-sub"] = {
        en: { content: "Book a free tour or write to us if you have questions about plans and availability." },
        it: { content: "Prenota un tour gratuito o scrivici se hai domande su piani e disponibilità." },
      };
      t["team-page-location-address"] = {
        en: { content: "480 Chapultepec Ave, Americana, Guadalajara, Jalisco" },
        it: { content: "Av. Chapultepec 480, Americana, Guadalajara, Jalisco" },
      };

      t["team-page-label-name"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["team-page-input-name"] = { en: { placeholder: "Your full name" }, it: { placeholder: "Il tuo nome completo" } };
      t["team-page-label-email"] = { en: { text: "Email" }, it: { text: "Email" } };
      t["team-page-input-email"] = { en: { placeholder: "you@email.com" }, it: { placeholder: "tu@email.com" } };
      t["team-page-label-message"] = { en: { text: "How can we help?" }, it: { text: "Come possiamo aiutarti?" } };
      t["team-page-textarea-message"] = {
        en: { placeholder: "E.g. I'd like to book a tour next week…" },
        it: { placeholder: "Es. Vorrei prenotare un tour la prossima settimana…" },
      };
      t["team-page-submit"] = { en: { label: "Book a tour" }, it: { label: "Prenota un tour" } };

      t["team-page-footer-copyright"] = {
        en: { content: "© 2026 Muelle 12 Coworking. All rights reserved." },
        it: { content: "© 2026 Muelle 12 Coworking. Tutti i diritti riservati." },
      };
      t["team-page-footer-address"] = {
        en: { content: "480 Chapultepec Ave, Americana, Guadalajara, Jalisco" },
        it: { content: "Av. Chapultepec 480, Americana, Guadalajara, Jalisco" },
      };

      return t;
    })(),
  };
}

export const teamPagePageMeta: LayoutPageMeta = {
  title: "Muelle 12 · Coworking en Guadalajara",
  description:
    "Espacios flexibles, oficinas privadas y una comunidad activa de equipos remotos y freelancers en el corazón de Guadalajara.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Muelle 12 · Coworking en Guadalajara",
      description: "Escritorios flexibles, oficinas privadas y comunidad activa. Agenda tu recorrido.",
      image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Muelle 12 · Coworking en Guadalajara",
      description: "Escritorios flexibles, oficinas privadas y comunidad activa. Agenda tu recorrido.",
      image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Muelle 12 · Coworking in Guadalajara",
      description: "Flexible desks, private offices and an active community of remote teams and freelancers in Guadalajara.",
      seo: {
        openGraph: { title: "Muelle 12 · Coworking in Guadalajara", description: "Flexible desks, private offices and an active community. Book your tour." },
        twitter: { title: "Muelle 12 · Coworking in Guadalajara", description: "Flexible desks, private offices and an active community. Book your tour." },
      },
    },
    it: {
      title: "Muelle 12 · Coworking a Guadalajara",
      description: "Scrivanie flessibili, uffici privati e una community attiva di team remoti e freelance a Guadalajara.",
      seo: {
        openGraph: { title: "Muelle 12 · Coworking a Guadalajara", description: "Scrivanie flessibili, uffici privati e una community attiva. Prenota il tuo tour." },
        twitter: { title: "Muelle 12 · Coworking a Guadalajara", description: "Scrivanie flessibili, uffici privati e una community attiva. Prenota il tuo tour." },
      },
    },
  },
};
