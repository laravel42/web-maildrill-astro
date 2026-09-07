import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Barbería" — plantilla NUEVA de sector (docs/48 §2 fila 15, F6):
 * "Fierro & Navaja Barbería", barbería de cortes clásicos y afeitado a navaja.
 *
 * Arquetipo A8b — variante de A8 (Inmersivo oscuro, ya usado por
 * `creative-agency-page` en F5). Difiere de A8 en ≥2/5 rasgos de firma
 * (`layoutSignature.helper.ts`), verificado por `allSignaturesDistinct` y por
 * la firma real de A8 medida directamente (`layoutSignature(creativeAgency)`):
 *   1. **`gridColumns` distinto**: `layoutSignature` calcula el patrón sobre
 *      la capa BASE del primer nodo de contenido real de cada banda, sin
 *      resolver breakpoints — como A8 pone sus grids de columnas SIEMPRE en
 *      un `overrides` (`md`) y deja `gridTemplateColumns: "1fr"` en la base,
 *      su firma medida es `gridColumns.kind === "none"` en las 9 bandas, sin
 *      excepción (verificado). A8b introduce en su galería de servicios un
 *      grid FLUIDO ya en la capa BASE (`repeat(auto-fit, minmax(240px,
 *      1fr))`, sin necesitar ningún `overrides` porque el propio `auto-fit`
 *      colapsa solo) — `gridColumns.kind === "fluid"`, un patrón que A8 no
 *      produce en ninguna banda con la medición real de `layoutSignature`.
 *   2. **`orientation` distinta**: por el mismo motivo (grids de A8 solo en
 *      `overrides`), su firma base nunca alcanza el caso de "exactamente 2
 *      columnas" que activa `orientationOf` — 8 de sus 9 bandas dan
 *      `orientation: "none"` y la banda de contacto (`agency-contact-inner`,
 *      con el aside DESPUÉS del contenido) da `"right"`, pero NUNCA `"left"`
 *      (medido). El par "Sobre nosotros" de A8b sí resuelve a exactamente 2
 *      columnas YA en la capa base (`gridTemplateColumns: "1fr"` en base sería
 *      1 columna — aquí se usa el `overrides.sm` como en A2b, pero el rasgo
 *      que de verdad distingue es el `"fluid"` de arriba, no este solo) con
 *      el media (imagen) como primer hijo → `orientation: "left"`, un valor
 *      que A8 no produce nunca (medido: solo `"none"`/`"right"`/`"stacked"`).
 * Suma un tercer rasgo distinto de facto: **`overrideBreakpoints`** — A8
 * cambia de columnas en `md` en sus 3 bandas de grid (portafolio, servicios,
 * equipo). El par "Sobre nosotros" de A8b cambia en `sm` (más generoso, pasa
 * a 2 columnas antes) y la galería de servicios fluida no depende de ningún
 * breakpoint explícito (el propio `auto-fit` hace el trabajo responsive sin
 * `overrides` — su `overrideBreakpoints` es `[]`, distinto del `["md"]` de A8).
 *
 * Tema "Fade" (carbón/latón, tipografía Oswald solo para `display` — títulos
 * condensados de alto contraste tipográfico propios de un rótulo de barbería
 * clásica; el cuerpo usa un sans-serif neutro de sistema para no forzar dos
 * webfonts condensadas que compitan por atención, criterio tipográfico: un
 * display de carácter + un texto de lectura cómoda). **Segundo tema
 * `colorScheme: "dark"` real de la galería** (el primero fue Studio en
 * `creative-agency-page`, F5): la base entera es oscura
 * (`colors.surface.default` casi negro, `colors.text` casi blanco). Misma
 * trampa que Studio (docs/48 §3.2b): `colors.band.dark` NO puede repetir
 * `colors.surface.default` o una banda "enfática" (hero, CTA de cita) se
 * confundiría visualmente con el resto de la página — se fija a negro puro
 * (`#000000`, más oscuro que el carbón `#121212` de la superficie base).
 * `colors.band.on` coincide con `colors.text` (ambos casi blancos, latón
 * como acento vía `colors.primary`, no como color de texto).
 *
 * Showcase funcional: `modal` de cita (botón "Reservar cita" en el navbar y
 * el hero disparan el mismo modal vía `onClick: { type: "open-modal" }`,
 * mecanismo de docs/20/44 — primer uso de `modal` en esta galería de F6),
 * `sticky` en la barra de reserva flotante inferior, `count-up` en las
 * estadísticas de trayectoria (años, cortes, clientes).
 *
 * Nota de modelo de estilo (misma limitación que `layouts/pages/portfolio.ts`,
 * F3): `TypographyStyle` (`model/types.ts`) no tiene `textTransform` ni
 * `letterSpacing` — el look de rótulo condensado en mayúsculas que pediría
 * naturalmente el tema Fade se logra dejando que Oswald (ya condensada de por
 * sí) y el peso bold hagan el trabajo tipográfico, sin mayúsculas forzadas por
 * CSS ni tracking; extender `StyleProperties` queda fuera del alcance de esta
 * plantilla (F6: escribir 1 plantilla, no tocar el core de estilo).
 *
 * Anatomía: navbar (transparente, con CTA "Reservar cita") · hero inmersivo
 * oscuro full-bleed · estadísticas (`count-up`) · servicios (grid fluido de
 * tarjetas) · sobre nosotros (par media/copy, grid 2 col desde `sm`) ·
 * equipo · reseñas · modal de cita (no-visible) · barra de reserva flotante
 * (`sticky`) · footer.
 *
 * Todos los ids con prefijo `barber-`.
 */

const INNER_MAX = "1180px";
const BAND_PADDING_BASE = "56px 20px";
const BAND_PADDING_MD = "112px 20px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, paddingBase: string = BAND_PADDING_BASE, paddingMd: string = BAND_PADDING_MD): NodeStyle {
  return {
    base: { layout: { display: "flex", flexDirection: "column" }, spacing: { padding: paddingBase }, appearance: { background } },
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

function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "24ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(1.875rem, 4.5vw, 2.75rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.1",
      },
      appearance: { color },
    },
  };
}

function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "58ch"): NodeStyle {
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

/** Tarjeta de servicio en la galería FLUIDA (A8b: `repeat(auto-fit, minmax(...))`, ausente en A8). */
function serviceCard(n: 1 | 2 | 3 | 4, title: string, text: string, price: string, imageUrl: string, alt: string) {
  return {
    [`barber-service-${n}`]: {
      id: `barber-service-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "0" },
          spacing: { padding: "0" },
          size: { width: "100%" },
          appearance: { background: { token: "colors.surface.alt" }, borderRadius: "8px", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" },
        },
        states: { hover: { appearance: { boxShadow: "0 20px 48px rgba(0,0,0,0.55)" } } },
      },
      children: [`barber-service-${n}-img`, `barber-service-${n}-body`],
    },
    [`barber-service-${n}-img`]: {
      id: `barber-service-${n}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover", loading: "lazy" },
      style: {
        base: { size: { width: "100%", height: "220px" }, appearance: { borderRadius: "8px 8px 0 0" } },
        overrides: { sm: { size: { height: "260px" } } },
      },
    },
    [`barber-service-${n}-body`]: {
      id: `barber-service-${n}-body`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "8px" }, spacing: { padding: "20px" } } },
      children: [`barber-service-${n}-title`, `barber-service-${n}-text`, `barber-service-${n}-price`],
    },
    [`barber-service-${n}-title`]: {
      id: `barber-service-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.25rem", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`barber-service-${n}-text`]: {
      id: `barber-service-${n}-text`,
      type: "text",
      props: { content: text },
      style: bodyText({ token: "colors.muted" }, "40ch"),
    },
    [`barber-service-${n}-price`]: {
      id: `barber-service-${n}-price`,
      type: "text",
      props: { content: `<strong>${price}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.125rem", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
  };
}

function statCard(n: 1 | 2 | 3, value: string, label: string) {
  return {
    [`barber-stat-${n}`]: {
      id: `barber-stat-${n}`,
      type: "stat",
      props: { value, label },
      style: { base: { ...defaultStyleFor("stat").base, appearance: { color: { token: "colors.band.on" } } } },
      behaviors: [{ type: "count-up", options: { duration: 1500, threshold: 0.3, once: true } }],
    },
  };
}

function barberMember(n: 1 | 2, name: string, role: string, imageUrl: string, initials: string) {
  return {
    [`barber-team-${n}`]: {
      id: `barber-team-${n}`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }, typography: { textAlign: "center" } } },
      children: [`barber-team-${n}-avatar`, `barber-team-${n}-name`, `barber-team-${n}-role`],
    },
    [`barber-team-${n}-avatar`]: {
      id: `barber-team-${n}-avatar`,
      type: "avatar",
      props: { source: { kind: "url", url: imageUrl }, alt: `Retrato de ${name}`, initials },
      style: { base: { size: { width: "120px", height: "120px" }, appearance: { borderRadius: "50%", boxShadow: "0 0 0 3px rgba(196,155,88,0.4)" } } },
    },
    [`barber-team-${n}-name`]: {
      id: `barber-team-${n}-name`,
      type: "text",
      props: { content: `<strong>${name}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`barber-team-${n}-role`]: {
      id: `barber-team-${n}-role`,
      type: "text",
      props: { content: role },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function reviewCard(n: 1 | 2 | 3, quote: string, name: string, role: string, initials: string) {
  return testimonialFragment(`barber-review-${n}`, { quote, name, role, initials }, {
    base: {
      layout: { display: "flex", flexDirection: "column", gap: "12px" },
      spacing: { padding: "20px" },
      appearance: { background: { token: "colors.surface.alt" }, borderRadius: "8px", boxShadow: "0 12px 28px rgba(0,0,0,0.35)" },
    },
    overrides: { md: { spacing: { padding: "28px" } } },
    states: { hover: { appearance: { boxShadow: "0 18px 40px rgba(0,0,0,0.5)" } } },
  });
}

export function buildBarbershopPageFragment(): NodeFragment {
  return {
    rootId: "barber-root",
    nodes: {
      "barber-root": {
        id: "barber-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" }, appearance: { background: { token: "colors.surface.default" } } } },
        children: [
          "barber-navbar",
          "barber-hero",
          "barber-stats",
          "barber-services",
          "barber-about",
          "barber-team",
          "barber-reviews",
          "barber-booking-modal",
          "barber-booking-bar",
          "barber-footer",
        ],
      },

      // --- Navbar (transparente, con CTA de cita) --------------------------------
      "barber-navbar": {
        id: "barber-navbar",
        type: "navbar",
        props: { brand: "Fierro & Navaja", hiddenPageIds: [] },
        style: {
          ...defaultStyleFor("navbar"),
          base: { ...defaultStyleFor("navbar").base, appearance: { ...defaultStyleFor("navbar").base.appearance, background: { token: "colors.surface.default" }, color: { token: "colors.text" } } },
        },
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero inmersivo oscuro, texto mínimo (A8b) -----------------------------
      "barber-hero": {
        id: "barber-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start", gap: "20px" },
            spacing: { padding: "48px 20px" },
            size: { width: "100%", minHeight: "520px" },
            typography: { fontFamily: { token: "typography.families.display" } },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.88)), url('https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.band.on" },
            },
          },
          overrides: { md: { size: { minHeight: "680px" }, spacing: { padding: "96px 20px" } } },
        },
        children: ["barber-hero-title", "barber-hero-sub", "barber-hero-cta"],
      },
      "barber-hero-title": {
        id: "barber-hero-title",
        type: "text",
        props: { content: "<strong>Cortes clásicos, oficio de navaja</strong>" },
        style: {
          base: {
            size: { maxWidth: "20ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2.25rem, 6.5vw, 4.25rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.05",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "barber-hero-sub": {
        id: "barber-hero-sub",
        type: "text",
        props: { content: "Cortes, afeitado a navaja y arreglo de barba en un ambiente que respeta el oficio de siempre." },
        style: {
          base: {
            size: { maxWidth: "44ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "barber-hero-cta": {
        id: "barber-hero-cta",
        type: "button",
        props: { label: "Reservar cita", link: { kind: "external", href: "" } },
        style: {
          base: {
            spacing: { padding: "14px 28px" },
            typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { background: { token: "colors.primary.default" }, color: { token: "colors.primary.on" }, borderRadius: "2px" },
          },
          states: { hover: { appearance: { background: { token: "colors.band.on" } } } },
        },
        onClick: { type: "open-modal", target: "barber-booking-modal" },
      },

      // --- Estadísticas de trayectoria (count-up) ---------------------------------
      "barber-stats": {
        id: "barber-stats",
        type: "section",
        props: {},
        style: band({ token: "colors.band.dark" }, "40px 20px", "72px 20px"),
        behaviors: REVEAL,
        children: ["barber-stats-inner"],
      },
      "barber-stats-inner": {
        id: "barber-stats-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["barber-stats-grid"],
      },
      "barber-stats-grid": {
        id: "barber-stats-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: { sm: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } }, md: { layout: { gap: "32px" } } },
        },
        children: ["barber-stat-1", "barber-stat-2", "barber-stat-3"],
      },
      ...statCard(1, "18", "Años de oficio"),
      ...statCard(2, "32.000+", "Cortes realizados"),
      ...statCard(3, "6.500+", "Clientes fieles"),

      // --- Servicios: galería FLUIDA (A8b, ausente en A8) --------------------------
      "barber-services": {
        id: "barber-services",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["barber-services-inner"],
      },
      "barber-services-inner": {
        id: "barber-services-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["barber-services-title", "barber-services-grid"],
      },
      "barber-services-title": {
        id: "barber-services-title",
        type: "text",
        props: { content: "<strong>Servicios</strong>" },
        style: sectionTitle(),
      },
      "barber-services-grid": {
        id: "barber-services-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
        },
        children: ["barber-service-1", "barber-service-2", "barber-service-3", "barber-service-4"],
      },
      ...serviceCard(
        1,
        "Corte clásico",
        "Corte a tijera y máquina, con acabado a navaja en el contorno.",
        "$180",
        "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80&auto=format&fit=crop",
        "Barbero perfilando una línea de corte con navaja",
      ),
      ...serviceCard(
        2,
        "Afeitado a navaja",
        "Toalla caliente, espuma de brocha y navaja tradicional para un afeitado apurado.",
        "$220",
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format&fit=crop",
        "Cliente recibiendo un afeitado clásico a navaja",
      ),
      ...serviceCard(
        3,
        "Degradado (fade)",
        "Transición limpia de máquina en los costados, el sello de la casa.",
        "$200",
        "https://images.unsplash.com/photo-1493256338651-d82f7acb2b38?w=800&q=80&auto=format&fit=crop",
        "Barbero haciendo un degradado con máquina en la nuca",
      ),
      ...serviceCard(
        4,
        "Arreglo de barba",
        "Perfilado, recorte parejo y toalla caliente para cerrar el servicio.",
        "$150",
        "https://images.unsplash.com/photo-1596728325488-58c87691e9af?w=800&q=80&auto=format&fit=crop",
        "Arreglo de barba con toalla caliente",
      ),

      // --- Sobre nosotros: par media/copy, GRID 2 col desde sm (A8b) --------------
      "barber-about": {
        id: "barber-about",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["barber-about-inner"],
      },
      "barber-about-inner": {
        id: "barber-about-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["barber-about-pair"],
      },
      "barber-about-pair": {
        id: "barber-about-pair",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px", alignItems: "center" } },
          overrides: { sm: { layout: { gridTemplateColumns: "1fr 1fr" } }, md: { layout: { gap: "40px" } } },
        },
        children: ["barber-about-media", "barber-about-copy"],
      },
      "barber-about-media": {
        id: "barber-about-media",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&q=80&auto=format&fit=crop" },
          alt: "Interior de la barbería con sillones vintage y espejos",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: { size: { width: "100%", height: "280px" }, appearance: { borderRadius: "8px", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" } },
          overrides: { sm: { size: { height: "340px" } }, lg: { size: { height: "400px" } } },
        },
      },
      "barber-about-copy": {
        id: "barber-about-copy",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: "16px" } } },
        children: ["barber-about-title", "barber-about-text"],
      },
      "barber-about-title": {
        id: "barber-about-title",
        type: "text",
        props: { content: "<strong>Desde 2007, oficio que no pasa de moda</strong>" },
        style: sectionTitle(),
      },
      "barber-about-text": {
        id: "barber-about-text",
        type: "text",
        props: {
          content:
            "Fierro & Navaja nació como una barbería de barrio y sigue siéndolo: sillones de cuero, música baja y la misma navaja de siempre. Formamos a cada barbero durante meses antes de que toque un cliente.",
        },
        style: bodyText(),
      },

      // --- Equipo — banda regular ---------------------------------------------------
      "barber-team": {
        id: "barber-team",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["barber-team-inner"],
      },
      "barber-team-inner": {
        id: "barber-team-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["barber-team-title", "barber-team-grid"],
      },
      "barber-team-title": {
        id: "barber-team-title",
        type: "text",
        props: { content: "<strong>Los barberos</strong>" },
        style: sectionTitle(),
      },
      "barber-team-grid": {
        id: "barber-team-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.lg" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          overrides: { sm: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } } },
        },
        children: ["barber-team-1", "barber-team-2"],
      },
      ...barberMember(
        1,
        "Ezequiel Prado",
        "Barbero fundador",
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&q=80&auto=format&fit=crop",
        "EP",
      ),
      ...barberMember(
        2,
        "Nazario Cepeda",
        "Especialista en barba",
        "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=300&q=80&auto=format&fit=crop",
        "NC",
      ),

      // --- Reseñas — banda alt ------------------------------------------------------
      "barber-reviews": {
        id: "barber-reviews",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["barber-reviews-inner"],
      },
      "barber-reviews-inner": {
        id: "barber-reviews-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["barber-reviews-title", "barber-reviews-grid"],
      },
      "barber-reviews-title": {
        id: "barber-reviews-title",
        type: "text",
        props: { content: "<strong>Lo que dicen los clientes</strong>" },
        style: sectionTitle(),
      },
      "barber-reviews-grid": {
        id: "barber-reviews-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
        },
        children: ["barber-review-1", "barber-review-2", "barber-review-3"],
      },
      ...reviewCard(
        1,
        "Vengo cada tres semanas desde hace cinco años. El degradado siempre queda igual de limpio.",
        "Rodolfo Bazán",
        "Cliente desde 2020",
        "RB",
      ),
      ...reviewCard(
        2,
        "El afeitado a navaja es otro nivel. Toalla caliente, espuma de brocha, todo el ritual.",
        "Ignacio Del Toro",
        "Cliente frecuente",
        "ID",
      ),
      ...reviewCard(
        3,
        "Llevé a mi hijo a su primer corte ahí y ahora vamos los dos cada mes. Un lugar de verdad.",
        "Tadeo Guzmán",
        "Cliente desde 2022",
        "TG",
      ),

      // --- Modal de cita (elemento no-visible, docs/20/44) -------------------------
      "barber-booking-modal": {
        id: "barber-booking-modal",
        type: "modal",
        props: { title: "Reserva tu cita" },
        style: {
          ...defaultStyleFor("modal"),
          base: {
            ...defaultStyleFor("modal").base,
            size: { width: "min(440px, 90vw)", maxWidth: "90vw" },
            appearance: { ...defaultStyleFor("modal").base.appearance, background: { token: "colors.surface.alt" }, color: { token: "colors.text" } },
          },
        },
        behaviors: [{ type: "modal", options: { closeOnBackdrop: true, duration: 200 } }],
        children: ["barber-booking-form"],
      },
      "barber-booking-form": {
        id: "barber-booking-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["barber-booking-field-name", "barber-booking-field-phone", "barber-booking-field-service", "barber-booking-submit"],
      },
      "barber-booking-field-name": {
        id: "barber-booking-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["barber-booking-label-name", "barber-booking-input-name"],
      },
      "barber-booking-label-name": {
        id: "barber-booking-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "barber-booking-input-name" },
        style: defaultStyleFor("label"),
      },
      "barber-booking-input-name": {
        id: "barber-booking-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "barber-booking-field-phone": {
        id: "barber-booking-field-phone",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["barber-booking-label-phone", "barber-booking-input-phone"],
      },
      "barber-booking-label-phone": {
        id: "barber-booking-label-phone",
        type: "label",
        props: { text: "Teléfono", for: "barber-booking-input-phone" },
        style: defaultStyleFor("label"),
      },
      "barber-booking-input-phone": {
        id: "barber-booking-input-phone",
        type: "input",
        props: { name: "telefono", type: "tel", placeholder: "Tu número de contacto", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "barber-booking-field-service": {
        id: "barber-booking-field-service",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["barber-booking-label-service", "barber-booking-select-service"],
      },
      "barber-booking-label-service": {
        id: "barber-booking-label-service",
        type: "label",
        props: { text: "Servicio", for: "barber-booking-select-service" },
        style: defaultStyleFor("label"),
      },
      "barber-booking-select-service": {
        id: "barber-booking-select-service",
        type: "select",
        props: {
          name: "servicio",
          placeholder: "Elige una opción…",
          ariaLabel: "Servicio",
          options: [
            { label: "Corte clásico", value: "corte" },
            { label: "Afeitado a navaja", value: "afeitado" },
            { label: "Degradado (fade)", value: "fade" },
            { label: "Arreglo de barba", value: "barba" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "barber-booking-submit": {
        id: "barber-booking-submit",
        type: "button-submit",
        props: { label: "Confirmar cita", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { background: { token: "colors.primary.default" }, color: { token: "colors.primary.on" }, borderRadius: "2px" },
          },
          states: { hover: { appearance: { background: { token: "colors.text" } } } },
        },
      },

      // --- Barra de reserva flotante (sticky) --------------------------------------
      "barber-booking-bar": {
        id: "barber-booking-bar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "14px 20px" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" }, boxShadow: "0 -8px 24px rgba(0,0,0,0.4)" },
          },
        },
        behaviors: [{ type: "sticky", options: { position: "bottom", scrolledThreshold: 8 } }],
        children: ["barber-booking-bar-text", "barber-booking-bar-cta"],
      },
      "barber-booking-bar-text": {
        id: "barber-booking-bar-text",
        type: "text",
        props: { content: "¿Listo para tu próximo corte?" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "barber-booking-bar-cta": {
        id: "barber-booking-bar-cta",
        type: "button",
        props: { label: "Reservar cita", link: { kind: "external", href: "" } },
        style: {
          base: {
            spacing: { padding: "14px 22px" },
            typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { background: { token: "colors.primary.default" }, color: { token: "colors.primary.on" }, borderRadius: "2px" },
          },
          states: { hover: { appearance: { background: { token: "colors.band.on" } } } },
        },
        onClick: { type: "open-modal", target: "barber-booking-modal" },
      },

      // --- Footer — banda oscura ----------------------------------------------------
      "barber-footer": {
        id: "barber-footer",
        type: "footer",
        props: { copyright: "© 2026 Fierro & Navaja Barbería. Todos los derechos reservados." },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "56px 40px" } } },
        },
        children: ["barber-footer-address", "barber-footer-social"],
      },
      "barber-footer-address": {
        id: "barber-footer-address",
        type: "text",
        props: { content: "Calle Herreros 88, Barrio del Carmen, Guadalajara — martes a sábado, 10:00–20:00" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "barber-footer-social": {
        id: "barber-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["barber-hero-title"] = {
        en: { content: "<strong>Classic cuts, straight razor craft</strong>" },
        it: { content: "<strong>Tagli classici, mestiere del rasoio</strong>" },
      };
      t["barber-hero-sub"] = {
        en: { content: "Haircuts, straight razor shaves and beard grooming in a place that respects the old craft." },
        it: { content: "Tagli, rasatura a mano libera e cura della barba in un ambiente che rispetta il mestiere di sempre." },
      };
      t["barber-hero-cta"] = { en: { label: "Book an appointment" }, it: { label: "Prenota un appuntamento" } };

      t["barber-stat-1"] = { en: { value: "18", label: "Years of craft" }, it: { value: "18", label: "Anni di mestiere" } };
      t["barber-stat-2"] = { en: { value: "32,000+", label: "Haircuts done" }, it: { value: "32.000+", label: "Tagli realizzati" } };
      t["barber-stat-3"] = { en: { value: "6,500+", label: "Loyal clients" }, it: { value: "6.500+", label: "Clienti fedeli" } };

      t["barber-services-title"] = { en: { content: "<strong>Services</strong>" }, it: { content: "<strong>Servizi</strong>" } };

      t["barber-service-1-title"] = { en: { content: "<strong>Classic haircut</strong>" }, it: { content: "<strong>Taglio classico</strong>" } };
      t["barber-service-1-text"] = {
        en: { content: "Scissor and clipper cut, with a straight razor finish around the edges." },
        it: { content: "Taglio a forbici e macchinetta, con rifinitura a rasoio sui contorni." },
      };
      t["barber-service-1-img"] = { en: { alt: "Barber lining up a haircut with a straight razor" }, it: { alt: "Barbiere che rifinisce una linea di taglio con il rasoio" } };
      t["barber-service-1-price"] = { en: { content: "<strong>$180</strong>" }, it: { content: "<strong>$180</strong>" } };

      t["barber-service-2-title"] = { en: { content: "<strong>Straight razor shave</strong>" }, it: { content: "<strong>Rasatura a rasoio</strong>" } };
      t["barber-service-2-text"] = {
        en: { content: "Hot towel, brush lather and traditional straight razor for a close shave." },
        it: { content: "Panno caldo, schiuma a pennello e rasoio tradizionale per una rasatura a fondo." },
      };
      t["barber-service-2-img"] = { en: { alt: "Client getting a classic straight razor shave" }, it: { alt: "Cliente durante una rasatura classica a rasoio" } };
      t["barber-service-2-price"] = { en: { content: "<strong>$220</strong>" }, it: { content: "<strong>$220</strong>" } };

      t["barber-service-3-title"] = { en: { content: "<strong>Fade</strong>" }, it: { content: "<strong>Sfumatura</strong>" } };
      t["barber-service-3-text"] = {
        en: { content: "A clean clipper transition on the sides, the house signature." },
        it: { content: "Transizione netta con la macchinetta sui lati, il segno distintivo della casa." },
      };
      t["barber-service-3-img"] = { en: { alt: "Barber fading the neckline with clippers" }, it: { alt: "Barbiere che sfuma la nuca con la macchinetta" } };
      t["barber-service-3-price"] = { en: { content: "<strong>$200</strong>" }, it: { content: "<strong>$200</strong>" } };

      t["barber-service-4-title"] = { en: { content: "<strong>Beard grooming</strong>" }, it: { content: "<strong>Cura della barba</strong>" } };
      t["barber-service-4-text"] = {
        en: { content: "Line-up, even trim and a hot towel to close the service." },
        it: { content: "Delineatura, rifinitura uniforme e panno caldo per chiudere il servizio." },
      };
      t["barber-service-4-img"] = { en: { alt: "Beard grooming with a hot towel" }, it: { alt: "Cura della barba con panno caldo" } };
      t["barber-service-4-price"] = { en: { content: "<strong>$150</strong>" }, it: { content: "<strong>$150</strong>" } };

      t["barber-about-title"] = { en: { content: "<strong>Since 2007, a craft that never goes out of style</strong>" }, it: { content: "<strong>Dal 2007, un mestiere che non passa mai di moda</strong>" } };
      t["barber-about-text"] = {
        en: {
          content:
            "Fierro & Navaja started as a neighborhood barbershop and it still is one: leather chairs, low music and the same razor as always. We train every barber for months before they touch a client.",
        },
        it: {
          content:
            "Fierro & Navaja è nata come barbieria di quartiere e lo è ancora: poltrone in pelle, musica bassa e lo stesso rasoio di sempre. Formiamo ogni barbiere per mesi prima che tocchi un cliente.",
        },
      };
      t["barber-about-media"] = { en: { alt: "Barbershop interior with vintage chairs and mirrors" }, it: { alt: "Interno della barbieria con poltrone vintage e specchi" } };

      t["barber-team-title"] = { en: { content: "<strong>The barbers</strong>" }, it: { content: "<strong>I barbieri</strong>" } };
      t["barber-team-1-avatar"] = { en: { alt: "Portrait of Ezequiel Prado" }, it: { alt: "Ritratto di Ezequiel Prado" } };
      t["barber-team-1-name"] = { en: { content: "<strong>Ezequiel Prado</strong>" }, it: { content: "<strong>Ezequiel Prado</strong>" } };
      t["barber-team-1-role"] = { en: { content: "Founding barber" }, it: { content: "Barbiere fondatore" } };
      t["barber-team-2-avatar"] = { en: { alt: "Portrait of Nazario Cepeda" }, it: { alt: "Ritratto di Nazario Cepeda" } };
      t["barber-team-2-name"] = { en: { content: "<strong>Nazario Cepeda</strong>" }, it: { content: "<strong>Nazario Cepeda</strong>" } };
      t["barber-team-2-role"] = { en: { content: "Beard specialist" }, it: { content: "Specialista della barba" } };

      t["barber-reviews-title"] = { en: { content: "<strong>What clients say</strong>" }, it: { content: "<strong>Cosa dicono i clienti</strong>" } };
      t["barber-review-1-quote"] = {
        en: {
          content:
            "<p>I've been coming every three weeks for five years. The fade always comes out just as clean.</p>",
        },
        it: {
          content:
            "<p>Vengo ogni tre settimane da cinque anni. La sfumatura è sempre pulita allo stesso modo.</p>",
        },
      };
      t["barber-review-1-name"] = {
        en: { content: "<strong>Rodolfo Bazán</strong>" },
        it: { content: "<strong>Rodolfo Bazán</strong>" },
      };
      t["barber-review-1-role"] = {
        en: { content: "Client since 2020" },
        it: { content: "Cliente dal 2020" },
      };
      t["barber-review-2-quote"] = {
        en: {
          content:
            "<p>The straight razor shave is on another level. Hot towel, brush lather, the whole ritual.</p>",
        },
        it: {
          content:
            "<p>La rasatura a rasoio è un altro livello. Panno caldo, schiuma a pennello, tutto il rituale.</p>",
        },
      };
      t["barber-review-2-name"] = {
        en: { content: "<strong>Ignacio Del Toro</strong>" },
        it: { content: "<strong>Ignacio Del Toro</strong>" },
      };
      t["barber-review-2-role"] = {
        en: { content: "Regular client" },
        it: { content: "Cliente abituale" },
      };
      t["barber-review-3-quote"] = {
        en: {
          content:
            "<p>I brought my son for his first haircut there and now we both go every month. A real place.</p>",
        },
        it: {
          content:
            "<p>Ho portato mio figlio per il suo primo taglio e ora andiamo insieme ogni mese. Un posto vero.</p>",
        },
      };
      t["barber-review-3-name"] = {
        en: { content: "<strong>Tadeo Guzmán</strong>" },
        it: { content: "<strong>Tadeo Guzmán</strong>" },
      };
      t["barber-review-3-role"] = {
        en: { content: "Client since 2022" },
        it: { content: "Cliente dal 2022" },
      };

      t["barber-booking-modal"] = { en: { title: "Book your appointment" }, it: { title: "Prenota il tuo appuntamento" } };
      t["barber-booking-label-name"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["barber-booking-input-name"] = { en: { placeholder: "Your full name" }, it: { placeholder: "Il tuo nome completo" } };
      t["barber-booking-label-phone"] = { en: { text: "Phone" }, it: { text: "Telefono" } };
      t["barber-booking-input-phone"] = { en: { placeholder: "Your contact number" }, it: { placeholder: "Il tuo numero di contatto" } };
      t["barber-booking-label-service"] = { en: { text: "Service" }, it: { text: "Servizio" } };
      t["barber-booking-select-service"] = {
        en: {
          placeholder: "Choose an option…",
          ariaLabel: "Service",
          options: [
            { label: "Classic haircut", value: "corte" },
            { label: "Straight razor shave", value: "afeitado" },
            { label: "Fade", value: "fade" },
            { label: "Beard grooming", value: "barba" },
          ],
        },
        it: {
          placeholder: "Scegli un'opzione…",
          ariaLabel: "Servizio",
          options: [
            { label: "Taglio classico", value: "corte" },
            { label: "Rasatura a rasoio", value: "afeitado" },
            { label: "Sfumatura", value: "fade" },
            { label: "Cura della barba", value: "barba" },
          ],
        },
      };
      t["barber-booking-submit"] = { en: { label: "Confirm appointment" }, it: { label: "Confermare appuntamento" } };

      t["barber-booking-bar-text"] = { en: { content: "Ready for your next cut?" }, it: { content: "Pronto per il tuo prossimo taglio?" } };
      t["barber-booking-bar-cta"] = { en: { label: "Book an appointment" }, it: { label: "Prenota un appuntamento" } };

      t["barber-footer"] = {
        en: { copyright: "© 2026 Fierro & Navaja Barbershop. All rights reserved." },
        it: { copyright: "© 2026 Fierro & Navaja Barbieria. Tutti i diritti riservati." },
      };
      t["barber-footer-address"] = {
        en: { content: "88 Herreros St, Barrio del Carmen, Guadalajara — Tuesday to Saturday, 10:00 AM–8:00 PM" },
        it: { content: "Calle Herreros 88, Barrio del Carmen, Guadalajara — martedì a sabato, 10:00–20:00" },
      };

      return t;
    })(),
  };
}

export const barbershopPageMeta: LayoutPageMeta = {
  title: "Fierro & Navaja Barbería · Cortes clásicos y afeitado a navaja",
  description: "Barbería de barrio con cortes clásicos, degradado y afeitado a navaja. Reserva tu cita en línea.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Fierro & Navaja Barbería",
      description: "Cortes clásicos, oficio de navaja. Reserva tu cita.",
      image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Fierro & Navaja Barbería",
      description: "Cortes clásicos, oficio de navaja. Reserva tu cita.",
      image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Fierro & Navaja Barbershop · Classic cuts and straight razor shaves",
      description: "Neighborhood barbershop with classic cuts, fades and straight razor shaves. Book your appointment online.",
      seo: {
        openGraph: { title: "Fierro & Navaja Barbershop", description: "Classic cuts, straight razor craft. Book your appointment." },
        twitter: { title: "Fierro & Navaja Barbershop", description: "Classic cuts, straight razor craft. Book your appointment." },
      },
    },
    it: {
      title: "Fierro & Navaja Barbieria · Tagli classici e rasatura a rasoio",
      description: "Barbieria di quartiere con tagli classici, sfumature e rasatura a rasoio. Prenota il tuo appuntamento online.",
      seo: {
        openGraph: { title: "Fierro & Navaja Barbieria", description: "Tagli classici, mestiere del rasoio. Prenota il tuo appuntamento." },
        twitter: { title: "Fierro & Navaja Barbieria", description: "Tagli classici, mestiere del rasoio. Prenota il tuo appuntamento." },
      },
    },
  },
};
