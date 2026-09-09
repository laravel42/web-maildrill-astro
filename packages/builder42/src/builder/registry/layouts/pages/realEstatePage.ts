import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeTranslations } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, quoteFragment, statFragment } from "../helpers";

/**
 * Página "Inmobiliaria" — plantilla de negocio real (una sola página,
 * multilingüe es/en/it). Topbar (teléfono + `language-nav`), navbar, hero con
 * foto + buscador de propiedades como tarjeta elevada, listado de
 * propiedades destacadas con filtro lateral, franja de stats en banda de
 * acento, bloque del asesor, FAQ (`accordion`), formulario de contacto y
 * footer en banda oscura.
 *
 * Arquetipo A7 — Aside + main (docs/48 §2, re-tematizado en F2): la sección
 * de propiedades pasa de un grid de 3 tarjetas iguales a 2 columnas
 * asimétricas desde `md` — un aside de filtro (`sticky`, behavior de
 * docs/44) + una columna principal con el listado largo (tarjetas en fila
 * imagen/detalle desde `md`, no en grid). Tema "Estate" (grafito/oro,
 * tipografía Libre Baskerville).
 *
 * Reestilizado (docs/43): bandas full-bleed con ritmo de fondos (claro / alt /
 * degradado de acento / oscuro), tipografía fluida con `clamp()`, tarjetas con
 * sombra + hover, mobile-first real (buscador en columna en base y fila desde
 * `md`). El contenido, ids, copy y traducciones originales NO cambian — solo
 * `style` y la envoltura estructural (`inner`/`aside`/`main` por banda). Todos
 * los ids con prefijo `realestate-` (sin colisión con otras plantillas).
 */
export function buildRealEstatePageFragment(): NodeFragment {
  const property = (
    n: 1 | 2 | 3,
    title: string,
    zone: string,
    price: string,
    m2: string,
    beds: string,
    imageUrl: string,
  ): Record<string, BuilderNode> => ({
    [`realestate-property-${n}`]: {
      id: `realestate-property-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column" },
          size: { width: "100%" },
          spacing: { padding: "0" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderRadius: { token: "radii.lg" },
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          },
        },
        // Listado largo en la columna `main` (A7): desde `md` la tarjeta pasa
        // de apilada a fila (imagen a la izquierda, detalle a la derecha) —
        // más legible en una lista vertical larga que un grid de tarjetas.
        overrides: { md: { layout: { flexDirection: "row" } } },
        states: {
          hover: {
            appearance: {
              boxShadow: "0 20px 40px rgba(15,23,42,0.16)",
              borderColor: { token: "colors.primary.default" },
            },
          },
        },
      },
      children: [
        `realestate-property-${n}-img`,
        `realestate-property-${n}-body`,
      ],
    },
    [`realestate-property-${n}-img`]: {
      id: `realestate-property-${n}-img`,
      type: "image",
      props: {
        source: { kind: "url", url: imageUrl },
        alt: `Front of the ${title}`,
        objectFit: "cover",
      },
      style: {
        base: {
          size: { width: "100%", height: "220px" },
          appearance: {
            borderRadius: { token: "radii.lg" },
          },
        },
        overrides: { md: { size: { width: "42%", height: "260px" } } },
      },
    },
    [`realestate-property-${n}-body`]: {
      id: `realestate-property-${n}-body`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
          spacing: { padding: "16px" },
        },
        overrides: { md: { spacing: { padding: "24px" } } },
      },
      children: [
        `realestate-property-${n}-price`,
        `realestate-property-${n}-title`,
        `realestate-property-${n}-zone`,
        `realestate-property-${n}-stats`,
      ],
    },
    [`realestate-property-${n}-price`]: {
      id: `realestate-property-${n}-price`,
      type: "badge",
      props: { label: price },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "6px 12px" },
          typography: {
            fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: {
            background: { token: "colors.primary.default" },
            color: { token: "colors.surface.default" },
            borderRadius: { token: "radii.md" },
          },
        },
      },
    },
    [`realestate-property-${n}-title`]: {
      id: `realestate-property-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "1.25rem",
            lineHeight: "1.3",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`realestate-property-${n}-zone`]: {
      id: `realestate-property-${n}-zone`,
      type: "text",
      props: { content: zone },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
    [`realestate-property-${n}-stats`]: {
      id: `realestate-property-${n}-stats`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", gap: { token: "spacing.md" } } },
      },
      children: [`realestate-property-${n}-m2`, `realestate-property-${n}-beds`],
    },
    ...statFragment(`realestate-property-${n}-m2`, { value: m2, label: "m² built" }, defaultStyleFor("stat")),
    ...statFragment(`realestate-property-${n}-beds`, { value: beds, label: "bedrooms" }, defaultStyleFor("stat")),
  });

  return {
    rootId: "realestate-root",
    nodes: {
      // Raíz full-bleed: SIN maxWidth (docs/43 §1) — cada banda pinta su propio
      // fondo hasta el borde del viewport y limita el ancho en su `inner`.
      "realestate-root": {
        id: "realestate-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
          },
        },
        children: [
          "realestate-topbar",
          "realestate-navbar",
          "realestate-hero",
          "realestate-properties",
          "realestate-stats",
          "realestate-advisor",
          "realestate-faq",
          "realestate-contact",
          "realestate-footer",
        ],
      },

      // --- Topbar: teléfono + language-nav a la derecha ----------------------
      "realestate-topbar": {
        id: "realestate-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "10px 20px" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["realestate-topbar-phone", "realestate-topbar-lang"],
      },
      "realestate-topbar-phone": {
        id: "realestate-topbar-phone",
        type: "text",
        props: { content: "📞 Call us: +52 33 1234 5678" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "realestate-topbar-lang": {
        id: "realestate-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "icon", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        style: {
          base: { appearance: { color: { token: "colors.muted" } } },
        },
      },

      // --- Navbar --------------------------------------------------------------
      "realestate-navbar": {
        id: "realestate-navbar",
        type: "navbar",
        props: { brand: "Vista Sur Inmobiliaria", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero con foto + buscador como tarjeta elevada ------------------------
      "realestate-hero": {
        id: "realestate-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch" },
            spacing: { padding: "0" },
            size: { width: "100%", minHeight: "420px" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.40)), url('https://images.unsplash.com/photo-1721815693498-cc28507c0ba2?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
            },
          },
          overrides: {
            md: { size: { minHeight: "520px" } },
          },
        },
        children: ["realestate-hero-inner"],
      },
      "realestate-hero-inner": {
        id: "realestate-hero-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" }, alignItems: "flex-start" },
            spacing: { padding: "48px 20px" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: {
            md: { spacing: { padding: "96px 20px", margin: "0 auto" } },
          },
        },
        children: ["realestate-hero-title", "realestate-hero-sub", "realestate-hero-search"],
      },
      "realestate-hero-title": {
        id: "realestate-hero-title",
        type: "text",
        props: { content: "<strong>Find your next home in Guadalajara</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              lineHeight: "1.05",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "realestate-hero-sub": {
        id: "realestate-hero-sub",
        type: "text",
        props: { content: "15 years connecting families with the right house or apartment, in the best neighborhoods of the city." },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "realestate-hero-search": {
        id: "realestate-hero-search",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderRadius: { token: "radii.lg" },
              boxShadow: "0 20px 48px rgba(15,23,42,0.24)",
            },
          },
          overrides: { md: { layout: { flexDirection: "row", alignItems: "flex-end" }, spacing: { padding: "28px" } } },
        },
        children: ["realestate-hero-search-zone", "realestate-hero-search-budget", "realestate-hero-search-btn"],
      },
      "realestate-hero-search-zone": {
        id: "realestate-hero-search-zone",
        type: "select",
        props: {
          options: [
            { label: "All zones", value: "all" },
            { label: "Providencia", value: "providencia" },
            { label: "Chapalita", value: "chapalita" },
            { label: "Zapopan Centro", value: "zapopan-centro" },
            { label: "Puerta de Hierro", value: "puerta-de-hierro" },
          ],
          name: "zone",
          placeholder: "Zona",
          ariaLabel: "Search area",
        },
        style: defaultStyleFor("select"),
      },
      "realestate-hero-search-budget": {
        id: "realestate-hero-search-budget",
        type: "input",
        props: { name: "budget", type: "number", placeholder: "Max budget (USD)", required: false, disabled: false },
        style: defaultStyleFor("input"),
      },
      "realestate-hero-search-btn": {
        id: "realestate-hero-search-btn",
        type: "button",
        props: { label: "Search", link: { kind: "anchor", nodeId: "realestate-properties" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
              textDecoration: "none",
            },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.surface.default" },
              borderRadius: { token: "radii.md" },
              cursor: "pointer",
            },
          },
          states: {
            hover: {
              appearance: { background: { token: "colors.text" } },
            },
          },
        },
      },

      // --- Banda: grid de propiedades destacadas (fondo claro) -----------------
      "realestate-properties": {
        id: "realestate-properties",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: ["realestate-properties-inner"],
      },
      "realestate-properties-inner": {
        id: "realestate-properties-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          // Arquetipo A7 (docs/48 §2) — Aside + main: 2 columnas asimétricas
          // desde `md` (aside angosto + contenido largo), 1 columna en base.
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr)", alignItems: "start" }, spacing: { padding: "96px 20px" } } },
        },
        children: ["realestate-properties-aside", "realestate-properties-main"],
      },
      // Aside de filtro: `sticky` (docs/44, behavior `sticky` — `position:
      // sticky` funciona sin runtime JS, ver `behaviors/sticky.ts`) para que
      // el filtro acompañe el scroll de la lista larga de propiedades.
      "realestate-properties-aside": {
        id: "realestate-properties-aside",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: { token: "radii.lg" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
            },
          },
          overrides: { md: { spacing: { padding: "28px 24px" } } },
        },
        behaviors: [{ type: "sticky", options: { position: "top", scrolledThreshold: 8 } }],
        children: [
          "realestate-properties-aside-title",
          "realestate-properties-aside-zone",
          "realestate-properties-aside-type",
          "realestate-properties-aside-budget",
          "realestate-properties-aside-btn",
        ],
      },
      "realestate-properties-aside-title": {
        id: "realestate-properties-aside-title",
        type: "text",
        props: { content: "<strong>Filter properties</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "1.125rem",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "realestate-properties-aside-zone": {
        id: "realestate-properties-aside-zone",
        type: "select",
        props: {
          options: [
            { label: "All zones", value: "all" },
            { label: "Providencia", value: "providencia" },
            { label: "Chapalita", value: "chapalita" },
            { label: "Puerta de Hierro", value: "puerta-de-hierro" },
          ],
          name: "aside-zone",
          placeholder: "Zona",
          ariaLabel: "Filtrar por zona",
        },
        style: defaultStyleFor("select"),
      },
      "realestate-properties-aside-type": {
        id: "realestate-properties-aside-type",
        type: "select",
        props: {
          options: [
            { label: "Casa o departamento", value: "all" },
            { label: "Casa", value: "house" },
            { label: "Departamento", value: "apartment" },
          ],
          name: "aside-type",
          placeholder: "Tipo de propiedad",
          ariaLabel: "Filtrar por tipo de propiedad",
        },
        style: defaultStyleFor("select"),
      },
      "realestate-properties-aside-budget": {
        id: "realestate-properties-aside-budget",
        type: "input",
        props: { name: "aside-budget", type: "number", placeholder: "Max budget (USD)", required: false, disabled: false },
        style: defaultStyleFor("input"),
      },
      "realestate-properties-aside-btn": {
        id: "realestate-properties-aside-btn",
        type: "button",
        props: { label: "Apply filter", link: { kind: "anchor", nodeId: "realestate-properties-main" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
              textDecoration: "none",
            },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.surface.default" },
              borderRadius: { token: "radii.md" },
              cursor: "pointer",
            },
          },
          states: { hover: { appearance: { background: { token: "colors.text" } } } },
        },
      },
      "realestate-properties-main": {
        id: "realestate-properties-main",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } },
          },
        },
        children: ["realestate-properties-title", "realestate-properties-grid"],
      },
      "realestate-properties-title": {
        id: "realestate-properties-title",
        type: "text",
        props: { content: "<strong>Featured properties</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "realestate-properties-grid": {
        id: "realestate-properties-grid",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } },
          },
        },
        children: ["realestate-property-1", "realestate-property-2", "realestate-property-3"],
      },
      ...property(
        1,
        "House in Providencia",
        "Providencia, Guadalajara",
        "$265,000 USD",
        "210",
        "3",
        "https://images.unsplash.com/photo-1721815693498-cc28507c0ba2?w=800&q=80&auto=format&fit=crop",
      ),
      ...property(
        2,
        "Apartment in Puerta de Hierro",
        "Puerta de Hierro, Zapopan",
        "$175,000 USD",
        "125",
        "2",
        "https://images.unsplash.com/photo-1628012209120-d9db7abf7eab?w=800&q=80&auto=format&fit=crop",
      ),
      ...property(
        3,
        "House in Chapalita",
        "Chapalita, Guadalajara",
        "$306,000 USD",
        "260",
        "4",
        "https://images.unsplash.com/photo-1698994705178-d244d73ea573?w=800&q=80&auto=format&fit=crop",
      ),

      // --- Banda: stats globales (fondo alt) ------------------------------------
      "realestate-stats": {
        id: "realestate-stats",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["realestate-stats-inner"],
      },
      "realestate-stats-inner": {
        id: "realestate-stats-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: {
            md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, spacing: { padding: "96px 20px" } },
          },
        },
        children: ["realestate-stats-sold", "realestate-stats-years", "realestate-stats-cities"],
      },
      ...statFragment("realestate-stats-sold", { value: "+850", label: "properties sold" }, { base: { typography: { textAlign: "center" } } }),
      ...statFragment("realestate-stats-years", { value: "15", label: "years of experience" }, { base: { typography: { textAlign: "center" } } }),
      ...statFragment("realestate-stats-cities", { value: "6", label: "cities covered" }, { base: { typography: { textAlign: "center" } } }),

      // --- Banda: asesor, degradado de acento -----------------------------------
      "realestate-advisor": {
        id: "realestate-advisor",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: {
              background: "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))",
            },
          },
        },
        children: ["realestate-advisor-inner"],
      },
      "realestate-advisor-inner": {
        id: "realestate-advisor-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" }, alignItems: "center" },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { layout: { flexDirection: "row", alignItems: "center" }, spacing: { padding: "96px 20px" } } },
        },
        children: ["realestate-advisor-avatar", "realestate-advisor-quote"],
      },
      "realestate-advisor-avatar": {
        id: "realestate-advisor-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&q=80&auto=format&fit=crop" }, alt: "Portrait of Ricardo Mendoza, real estate advisor", initials: "RM" },
        style: {
          base: {
            size: { width: "96px", height: "96px" },
            appearance: { boxShadow: "0 12px 24px rgba(15,23,42,0.24)" },
          },
        },
      },
      ...quoteFragment(
        "realestate-advisor-quote",
        {
          content: "Every family has a different story; my job is to find the home that fits theirs, with no rush and no fine print.",
          attribution: "Ricardo Mendoza, Senior advisor",
        },
        {
          base: {
            typography: {
              fontSize: "clamp(1.125rem, 2.2vw, 1.375rem)",
              lineHeight: "1.4",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      ),

      // --- Banda: FAQ (fondo claro) ----------------------------------------------
      "realestate-faq": {
        id: "realestate-faq",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: ["realestate-faq-inner"],
      },
      "realestate-faq-inner": {
        id: "realestate-faq-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["realestate-faq-title", "realestate-faq-list"],
      },
      "realestate-faq-title": {
        id: "realestate-faq-title",
        type: "text",
        props: { content: "<strong>Frequently asked questions</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "realestate-faq-list": {
        id: "realestate-faq-list",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["realestate-faq-item-1", "realestate-faq-item-2", "realestate-faq-item-3"],
      },
      "realestate-faq-item-1": {
        id: "realestate-faq-item-1",
        type: "accordion-item",
        props: { label: "What financing options do you offer?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["realestate-faq-item-1-body"],
      },
      "realestate-faq-item-1-body": {
        id: "realestate-faq-item-1-body",
        type: "text",
        props: { content: "We work with Infonavit, Fovissste and bank credit from major national banks; we advise you at no cost to choose the best option." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "realestate-faq-item-2": {
        id: "realestate-faq-item-2",
        type: "accordion-item",
        props: { label: "What is the commission for selling my property?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["realestate-faq-item-2-body"],
      },
      "realestate-faq-item-2-body": {
        id: "realestate-faq-item-2-body",
        type: "text",
        props: { content: "The standard commission is 5% of the sale value, with no hidden fees or upfront payments before signing." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "realestate-faq-item-3": {
        id: "realestate-faq-item-3",
        type: "accordion-item",
        props: { label: "Do you handle the deed transfer process?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["realestate-faq-item-3-body"],
      },
      "realestate-faq-item-3-body": {
        id: "realestate-faq-item-3-body",
        type: "text",
        props: { content: "Yes, we coordinate with the notary public, review the paperwork and support you through the final signing." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Banda: contacto (fondo alt) -------------------------------------------
      "realestate-contact": {
        id: "realestate-contact",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["realestate-contact-inner"],
      },
      "realestate-contact-inner": {
        id: "realestate-contact-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["realestate-contact-title", "realestate-contact-form"],
      },
      "realestate-contact-title": {
        id: "realestate-contact-title",
        type: "text",
        props: { content: "<strong>Schedule a visit</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "realestate-contact-form": {
        id: "realestate-contact-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            size: { width: "100%", maxWidth: "560px" },
            spacing: { padding: "20px" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderRadius: { token: "radii.lg" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        behaviors: [{ type: "form-validation", options: {} }],
        children: [
          "realestate-contact-name-label",
          "realestate-contact-name",
          "realestate-contact-email-label",
          "realestate-contact-email",
          "realestate-contact-message-label",
          "realestate-contact-message",
          "realestate-contact-submit",
        ],
      },
      "realestate-contact-name-label": {
        id: "realestate-contact-name-label",
        type: "label",
        props: { text: "Full name", for: "realestate-contact-name" },
        style: defaultStyleFor("label"),
      },
      "realestate-contact-name": {
        id: "realestate-contact-name",
        type: "input",
        props: { name: "name", type: "text", placeholder: "E.g. Maria Torres", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "realestate-contact-email-label": {
        id: "realestate-contact-email-label",
        type: "label",
        props: { text: "Email address", for: "realestate-contact-email" },
        style: defaultStyleFor("label"),
      },
      "realestate-contact-email": {
        id: "realestate-contact-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "maria@email.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "realestate-contact-message-label": {
        id: "realestate-contact-message-label",
        type: "label",
        props: { text: "Which property interests you?", for: "realestate-contact-message" },
        style: defaultStyleFor("label"),
      },
      "realestate-contact-message": {
        id: "realestate-contact-message",
        type: "textarea",
        props: { name: "message", placeholder: "Tell us the area, budget and type of property you're looking for…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "realestate-contact-submit": {
        id: "realestate-contact-submit",
        type: "button-submit",
        props: { label: "Request information", disabled: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.surface.default" },
              borderRadius: { token: "radii.md" },
              cursor: "pointer",
            },
          },
          states: {
            hover: {
              appearance: { background: { token: "colors.text" } },
            },
          },
        },
      },

      // --- Footer: banda oscura ---------------------------------------------------
      "realestate-footer": {
        id: "realestate-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: {
              background: { token: "colors.text" },
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        children: ["realestate-footer-social", "realestate-footer-copyright"],
      },
      "realestate-footer-social": {
        id: "realestate-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "realestate-footer-copyright": {
        id: "realestate-footer-copyright",
        type: "text",
        props: { content: "© 2026 Vista Sur Real Estate. All rights reserved." },
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

    // -------------------------------------------------------------------------
    // Traducciones (en/it) — cubren TODAS las props translatable con valor.
    // -------------------------------------------------------------------------
    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["realestate-hero-title"] = { es: { content: "<strong>Encuentra tu próximo hogar en Guadalajara</strong>" }, it: { content: "<strong>Trova la tua prossima casa a Guadalajara</strong>" } };
      t["realestate-hero-sub"] = { es: { content: "15 años conectando familias con la casa o departamento correcto, en las mejores zonas de la ciudad." }, it: { content: "15 anni a connettere famiglie con la casa o l'appartamento giusto, nei quartieri migliori della città." } };
      t["realestate-hero-search-btn"] = { es: { label: "Buscar" }, it: { label: "Cerca" } };
      t["realestate-hero-search-budget"] = { es: { placeholder: "Presupuesto máx. (MXN)" }, it: { placeholder: "Budget massimo (EUR)" } };

      t["realestate-properties-title"] = { es: { content: "<strong>Propiedades destacadas</strong>" }, it: { content: "<strong>Immobili in evidenza</strong>" } };

      t["realestate-properties-aside-title"] = { es: { content: "<strong>Filtrar propiedades</strong>" }, it: { content: "<strong>Filtra gli immobili</strong>" } };
      t["realestate-properties-aside-btn"] = { es: { label: "Aplicar filtro" }, it: { label: "Applica filtro" } };
      t["realestate-properties-aside-budget"] = { es: { placeholder: "Presupuesto máx. (MXN)" }, it: { placeholder: "Budget massimo (EUR)" } };

      t["realestate-property-1-price"] = { es: { label: "$4,850,000 MXN" }, it: { label: "€245.000" } };
      t["realestate-property-1-title"] = { es: { content: "<strong>Casa en Providencia</strong>" }, it: { content: "<strong>Casa a Providencia</strong>" } };
      t["realestate-property-1-zone"] = { es: { content: "Providencia, Guadalajara" }, it: { content: "Providencia, Guadalajara" } };
      t["realestate-property-1-img"] = { es: { alt: "Fachada de la casa en Providencia" }, it: { alt: "Facciata della casa a Providencia" } };
      t["realestate-property-1-m2-value"] = { es: { value: "210" }, it: { value: "210" } };
      t["realestate-property-1-m2-label"] = { es: { content: "m² de construcción" }, it: { content: "m² costruiti" } };
      t["realestate-property-1-beds-value"] = { es: { value: "3" }, it: { value: "3" } };
      t["realestate-property-1-beds-label"] = { es: { content: "recámaras" }, it: { content: "camere" } };

      t["realestate-property-2-price"] = { es: { label: "$3,200,000 MXN" }, it: { label: "€162.000" } };
      t["realestate-property-2-title"] = { es: { content: "<strong>Depto en Puerta de Hierro</strong>" }, it: { content: "<strong>Appartamento a Puerta de Hierro</strong>" } };
      t["realestate-property-2-zone"] = { es: { content: "Puerta de Hierro, Zapopan" }, it: { content: "Puerta de Hierro, Zapopan" } };
      t["realestate-property-2-img"] = { es: { alt: "Fachada del departamento en Puerta de Hierro" }, it: { alt: "Facciata dell'appartamento a Puerta de Hierro" } };
      t["realestate-property-2-m2-value"] = { es: { value: "125" }, it: { value: "125" } };
      t["realestate-property-2-m2-label"] = { es: { content: "m² de construcción" }, it: { content: "m² costruiti" } };
      t["realestate-property-2-beds-value"] = { es: { value: "2" }, it: { value: "2" } };
      t["realestate-property-2-beds-label"] = { es: { content: "recámaras" }, it: { content: "camere" } };

      t["realestate-property-3-price"] = { es: { label: "$5,600,000 MXN" }, it: { label: "€283.000" } };
      t["realestate-property-3-title"] = { es: { content: "<strong>Casa en Chapalita</strong>" }, it: { content: "<strong>Casa a Chapalita</strong>" } };
      t["realestate-property-3-zone"] = { es: { content: "Chapalita, Guadalajara" }, it: { content: "Chapalita, Guadalajara" } };
      t["realestate-property-3-img"] = { es: { alt: "Fachada de la casa en Chapalita" }, it: { alt: "Facciata della casa a Chapalita" } };
      t["realestate-property-3-m2-value"] = { es: { value: "260" }, it: { value: "260" } };
      t["realestate-property-3-m2-label"] = { es: { content: "m² de construcción" }, it: { content: "m² costruiti" } };
      t["realestate-property-3-beds-value"] = { es: { value: "4" }, it: { value: "4" } };
      t["realestate-property-3-beds-label"] = { es: { content: "recámaras" }, it: { content: "camere" } };

      t["realestate-stats-sold-value"] = { es: { value: "+850" }, it: { value: "+850" } };
      t["realestate-stats-sold-label"] = { es: { content: "propiedades vendidas" }, it: { content: "immobili venduti" } };
      t["realestate-stats-years-value"] = { es: { value: "15" }, it: { value: "15" } };
      t["realestate-stats-years-label"] = { es: { content: "años de experiencia" }, it: { content: "anni di esperienza" } };
      t["realestate-stats-cities-value"] = { es: { value: "6" }, it: { value: "6" } };
      t["realestate-stats-cities-label"] = { es: { content: "ciudades con cobertura" }, it: { content: "città coperte" } };

      t["realestate-advisor-avatar"] = { es: { alt: "Retrato de Ricardo Mendoza, asesor inmobiliario" }, it: { alt: "Ritratto di Ricardo Mendoza, consulente immobiliare" } };
      t["realestate-advisor-quote-content"] = { es: { content: "Cada familia tiene una historia distinta; mi trabajo es encontrar la casa que encaje con la suya, sin prisas y sin letras pequeñas." }, it: { content: "Ogni famiglia ha una storia diversa; il mio lavoro è trovare la casa che si adatta alla loro, senza fretta e senza clausole nascoste." } };
      t["realestate-advisor-quote-attribution"] = { es: { content: "<cite>— Ricardo Mendoza, Asesor senior</cite>" }, it: { content: "<cite>— Ricardo Mendoza, Consulente senior</cite>" } };

      t["realestate-faq-title"] = { es: { content: "<strong>Preguntas frecuentes</strong>" }, it: { content: "<strong>Domande frequenti</strong>" } };
      t["realestate-faq-item-1"] = { es: { label: "¿Qué opciones de financiamiento tienen?" }, it: { label: "Quali opzioni di finanziamento offrite?" } };
      t["realestate-faq-item-1-body"] = { es: { content: "Trabajamos con Infonavit, Fovissste y crédito bancario de los principales bancos del país; te asesoramos sin costo para elegir la mejor opción." }, it: { content: "Collaboriamo con Infonavit, Fovissste e credito bancario delle principali banche nazionali; ti consigliamo gratuitamente la scelta migliore." } };
      t["realestate-faq-item-2"] = { es: { label: "¿Cuál es la comisión por vender mi propiedad?" }, it: { label: "Qual è la commissione per vendere il mio immobile?" } };
      t["realestate-faq-item-2-body"] = { es: { content: "La comisión estándar es del 5% sobre el valor de venta, sin costos ocultos ni anticipos previos a la firma." }, it: { content: "La commissione standard è del 5% sul valore di vendita, senza costi nascosti né anticipi prima della firma." } };
      t["realestate-faq-item-3"] = { es: { label: "¿Ustedes gestionan la escrituración?" }, it: { label: "Gestite voi il processo di rogito?" } };
      t["realestate-faq-item-3-body"] = { es: { content: "Sí, coordinamos con el notario público, revisamos la documentación y te acompañamos hasta la firma final." }, it: { content: "Sì, coordiniamo con il notaio, verifichiamo la documentazione e ti accompagniamo fino alla firma finale." } };

      t["realestate-contact-title"] = { es: { content: "<strong>Agenda una visita</strong>" }, it: { content: "<strong>Prenota una visita</strong>" } };
      t["realestate-contact-name-label"] = { es: { text: "Nombre completo" }, it: { text: "Nome completo" } };
      t["realestate-contact-name"] = { es: { placeholder: "Ej. María Torres" }, it: { placeholder: "Es. Maria Torres" } };
      t["realestate-contact-email-label"] = { es: { text: "Correo electrónico" }, it: { text: "Indirizzo email" } };
      t["realestate-contact-email"] = { es: { placeholder: "maria@correo.com" }, it: { placeholder: "maria@email.com" } };
      t["realestate-contact-message-label"] = { es: { text: "¿Qué propiedad te interesa?" }, it: { text: "Quale immobile ti interessa?" } };
      t["realestate-contact-message"] = { es: { placeholder: "Cuéntanos qué zona, presupuesto y tipo de propiedad buscas…" }, it: { placeholder: "Raccontaci la zona, il budget e il tipo di immobile che cerchi…" } };
      t["realestate-contact-submit"] = { es: { label: "Solicitar información" }, it: { label: "Richiedi informazioni" } };

      t["realestate-footer-copyright"] = { es: { content: "© 2026 Vista Sur Inmobiliaria. Todos los derechos reservados." }, it: { content: "© 2026 Vista Sur Immobiliare. Tutti i diritti riservati." } };

      t["realestate-topbar-phone"] = { es: { content: "📞 Llámanos: +52 33 1234 5678" }, it: { content: "📞 Chiamaci: +52 33 1234 5678" } };

      return t;
    })(),
  };
}
