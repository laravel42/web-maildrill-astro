import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, type LayoutPageMeta } from "../helpers";

/**
 * Página "Agencia creativa" — plantilla NUEVA de sector (docs/48 §2 fila 13,
 * F5): "Cráter Studio", agencia de branding y producto digital.
 *
 * Arquetipo A8 — Inmersivo oscuro (docs/48 §2): media a sangre, texto mínimo,
 * mucho aire, banda oscura DOMINANTE (no una banda oscura puntual como el
 * footer del resto de plantillas — aquí la mayoría de la página es oscura).
 * Hero con imagen full-bleed y copy corto, `marquee` de clientes, portafolio
 * con `reveal-on-scroll`, `parallax` en la banda de manifiesto.
 *
 * Tema "Studio" (negro/lima, tipografía Space Grotesk): **primer tema
 * `colorScheme: "dark"` real de la galería** (docs/48 §3.2b) — las 10
 * plantillas previas usan paletas oscuras solo como ACENTO
 * (`colors.band.dark`) sobre una base `colorScheme: "light"` (ver Iron,
 * Loft). Aquí la base ENTERA es oscura: `colors.surface.default` es casi
 * negro y `colors.text` es casi blanco (igual criterio que el preset
 * `dark` de `themePresets.ts`). La trampa de docs/48 §3.2b es asumir que
 * `colors.band.dark` puede seguir siendo igual a `colors.text` (como en un
 * tema claro invertido) — con esta base ya oscura, `colors.band.dark` se fija
 * a NEGRO PURO (`#000000`, más oscuro que `colors.surface.default`,
 * `#0a0a0a`) para que una banda "enfática" (hero, manifiesto) siga
 * distinguiéndose visualmente de una banda "regular" del mismo tema — si
 * fueran el mismo valor, el ritmo de bandas de docs/43 §1 (mínimo 4 fondos
 * distintos) colapsaría a un solo negro plano. `colors.band.on` coincide con
 * `colors.text` (ambos casi blancos): es el mismo texto claro que ya usa el
 * resto de la página, no un tercer tono.
 *
 * Showcase funcional: `parallax` en la banda de manifiesto, `marquee` en el
 * muro de clientes (`logo-cloud`), `reveal-on-scroll` en el portafolio.
 *
 * Anatomía: navbar (transparente sobre el hero) · hero oscuro full-bleed con
 * texto mínimo · marquee de clientes · portafolio de proyectos
 * (`reveal-on-scroll`) · manifiesto (`parallax`) · servicios · equipo ·
 * contacto · footer.
 *
 * Todos los ids con prefijo `agency-`.
 */

const INNER_MAX = "1200px";
const BAND_PADDING_BASE = "64px 20px";
const BAND_PADDING_MD = "128px 20px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true, mode: "sequence" } }];

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

function sectionTitle(color: StyleValue = { token: "colors.band.on" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "22ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(2rem, 5vw, 3.25rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.05",
      },
      appearance: { color },
    },
  };
}

function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "56ch"): NodeStyle {
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

function projectCard(n: 1 | 2 | 3 | 4, title: string, tag: string, imageUrl: string, alt: string) {
  return {
    [`agency-project-${n}`]: {
      id: `agency-project-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "0" },
          spacing: { padding: "0" },
          size: { width: "100%" },
          appearance: {
            background: "transparent",
            borderRadius: "4px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          },
        },
        states: { hover: { appearance: { boxShadow: "0 24px 60px rgba(0,0,0,0.6)" } } },
      },
      children: [`agency-project-${n}-img`, `agency-project-${n}-body`],
    },
    [`agency-project-${n}-img`]: {
      id: `agency-project-${n}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover", loading: "lazy" },
      style: {
        base: {
          size: { width: "100%", height: "260px" },
          appearance: { borderRadius: "4px" },
        },
        overrides: { md: { size: { height: "320px" } }, lg: { size: { height: "380px" } } },
      },
    },
    [`agency-project-${n}-body`]: {
      id: `agency-project-${n}-body`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: { token: "spacing.sm" } },
          spacing: { padding: "16px 0" },
        },
      },
      children: [`agency-project-${n}-title`, `agency-project-${n}-tag`],
    },
    [`agency-project-${n}-title`]: {
      id: `agency-project-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.375rem", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`agency-project-${n}-tag`]: {
      id: `agency-project-${n}-tag`,
      type: "text",
      props: { content: tag },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
  };
}

function serviceItem(n: 1 | 2 | 3, title: string, text: string) {
  return {
    [`agency-service-${n}`]: {
      id: `agency-service-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "8px" },
          spacing: { padding: "20px 0" },
          appearance: { borderColor: { token: "colors.border" }, borderStyle: "solid", borderWidth: "0" },
        },
        overrides: { md: { appearance: { borderWidth: "0" }, spacing: { padding: "28px 0" } } },
      },
      children: [`agency-service-${n}-title`, `agency-service-${n}-text`],
    },
    [`agency-service-${n}-title`]: {
      id: `agency-service-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.5rem", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`agency-service-${n}-text`]: {
      id: `agency-service-${n}-text`,
      type: "text",
      props: { content: text },
      style: bodyText(),
    },
  };
}

function teamMember(n: 1 | 2 | 3, name: string, role: string, imageUrl: string, initials: string) {
  return {
    [`agency-team-${n}`]: {
      id: `agency-team-${n}`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "12px" } } },
      children: [`agency-team-${n}-avatar`, `agency-team-${n}-name`, `agency-team-${n}-role`],
    },
    [`agency-team-${n}-avatar`]: {
      id: `agency-team-${n}-avatar`,
      type: "avatar",
      props: { source: { kind: "url", url: imageUrl }, alt: `Retrato de ${name}`, initials },
      style: { base: { size: { width: "96px", height: "96px" }, appearance: { borderRadius: "4px" } } },
    },
    [`agency-team-${n}-name`]: {
      id: `agency-team-${n}-name`,
      type: "text",
      props: { content: `<strong>${name}</strong>` },
      style: { base: { typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.text" } } } },
    },
    [`agency-team-${n}-role`]: {
      id: `agency-team-${n}-role`,
      type: "text",
      props: { content: role },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

export function buildCreativeAgencyPageFragment(): NodeFragment {
  return {
    rootId: "agency-root",
    nodes: {
      "agency-root": {
        id: "agency-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" }, appearance: { background: { token: "colors.surface.default" } } } },
        children: [
          "agency-navbar",
          "agency-hero",
          "agency-clients",
          "agency-work",
          "agency-manifesto",
          "agency-services",
          "agency-team",
          "agency-contact",
          "agency-footer",
        ],
      },

      // --- Navbar (transparente, sobre el hero oscuro) --------------------------
      "agency-navbar": {
        id: "agency-navbar",
        type: "navbar",
        props: { brand: "Cráter Studio", hiddenPageIds: [] },
        style: {
          ...defaultStyleFor("navbar"),
          base: {
            ...defaultStyleFor("navbar").base,
            appearance: { ...defaultStyleFor("navbar").base.appearance, background: { token: "colors.surface.default" }, color: { token: "colors.text" } },
          },
        },
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero oscuro full-bleed, texto mínimo (A8) ----------------------------
      "agency-hero": {
        id: "agency-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start" },
            spacing: { padding: "48px 20px" },
            size: { width: "100%", minHeight: "560px" },
            typography: { fontFamily: { token: "typography.families.display" } },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1558655146-d09347e92766?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.band.on" },
            },
          },
          overrides: { md: { size: { minHeight: "720px" }, spacing: { padding: "96px 20px" } } },
        },
        children: ["agency-hero-title", "agency-hero-cta"],
      },
      "agency-hero-title": {
        id: "agency-hero-title",
        type: "text",
        props: { content: "<strong>Hacemos marcas que se sienten inevitables</strong>" },
        style: {
          base: {
            size: { maxWidth: "18ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2.5rem, 7vw, 5rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.02",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "agency-hero-cta": {
        id: "agency-hero-cta",
        type: "button",
        props: { label: "Ver trabajo", link: { kind: "anchor", nodeId: "agency-work" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "2px",
            },
          },
          states: { hover: { appearance: { background: { token: "colors.band.on" } } } },
        },
      },

      // --- Muro de clientes con marquee ------------------------------------------
      "agency-clients": {
        id: "agency-clients",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }, "32px 0", "56px 0"),
        children: ["agency-clients-cloud"],
      },
      "agency-clients-cloud": {
        id: "agency-clients-cloud",
        type: "logo-cloud",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "32px" },
            spacing: { padding: "0" },
            appearance: { color: { token: "colors.muted" } },
          },
          overrides: { md: { layout: { gap: "64px" } } },
        },
        behaviors: [{ type: "marquee", options: { duration: 26, direction: "left", pauseOnHover: true } }],
        children: [
          "agency-client-1",
          "agency-client-2",
          "agency-client-3",
          "agency-client-4",
          "agency-client-5",
        ],
      },
      "agency-client-1": {
        id: "agency-client-1",
        type: "image",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=240&q=80&auto=format&fit=crop" }, alt: "Logo del cliente Nortek", objectFit: "contain" },
        style: {
          base: { size: { width: "auto", maxWidth: "120px", height: "40px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { md: { size: { height: "44px" } } },
        },
      },
      "agency-client-2": {
        id: "agency-client-2",
        type: "image",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1611162457237-98a67b8be684?w=240&q=80&auto=format&fit=crop" }, alt: "Logo del cliente Fjord Goods", objectFit: "contain" },
        style: {
          base: { size: { width: "auto", maxWidth: "120px", height: "40px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { md: { size: { height: "44px" } } },
        },
      },
      "agency-client-3": {
        id: "agency-client-3",
        type: "image",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=240&q=80&auto=format&fit=crop" }, alt: "Logo del cliente Vantia", objectFit: "contain" },
        style: {
          base: { size: { width: "auto", maxWidth: "120px", height: "40px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { md: { size: { height: "44px" } } },
        },
      },
      "agency-client-4": {
        id: "agency-client-4",
        type: "image",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1611162458324-aae1eb4129a4?w=240&q=80&auto=format&fit=crop" }, alt: "Logo del cliente Bruma Labs", objectFit: "contain" },
        style: {
          base: { size: { width: "auto", maxWidth: "120px", height: "40px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { md: { size: { height: "44px" } } },
        },
      },
      "agency-client-5": {
        id: "agency-client-5",
        type: "image",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1611162457253-813a17d0be08?w=240&q=80&auto=format&fit=crop" }, alt: "Logo del cliente Solano & Co", objectFit: "contain" },
        style: {
          base: { size: { width: "auto", maxWidth: "120px", height: "40px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { md: { size: { height: "44px" } } },
        },
      },

      // --- Portafolio con reveal-on-scroll ---------------------------------------
      "agency-work": {
        id: "agency-work",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["agency-work-inner"],
      },
      "agency-work-inner": {
        id: "agency-work-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["agency-work-title", "agency-work-grid"],
      },
      "agency-work-title": {
        id: "agency-work-title",
        type: "text",
        props: { content: "<strong>Trabajo seleccionado</strong>" },
        style: sectionTitle({ token: "colors.text" }),
      },
      "agency-work-grid": {
        id: "agency-work-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.lg" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } } },
        },
        behaviors: REVEAL,
        children: ["agency-project-1", "agency-project-2", "agency-project-3", "agency-project-4"],
      },
      ...projectCard(
        1,
        "Fjord Goods",
        "Identidad de marca",
        "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=900&q=80&auto=format&fit=crop",
        "Empaque minimalista de Fjord Goods sobre fondo neutro",
      ),
      ...projectCard(
        2,
        "Nortek",
        "Producto digital",
        "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&q=80&auto=format&fit=crop",
        "Pantallas de la app de Nortek en un teléfono",
      ),
      ...projectCard(
        3,
        "Vantia",
        "Sitio web",
        "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=900&q=80&auto=format&fit=crop",
        "Laptop mostrando el sitio web rediseñado de Vantia",
      ),
      ...projectCard(
        4,
        "Bruma Labs",
        "Branding + web",
        "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&q=80&auto=format&fit=crop",
        "Mockups de branding de Bruma Labs sobre una mesa",
      ),

      // --- Manifiesto con parallax, banda MÁS oscura que la base ----------------
      "agency-manifesto": {
        id: "agency-manifesto",
        type: "section",
        props: {},
        style: band({ token: "colors.band.dark" }),
        behaviors: [{ type: "parallax", options: { speed: 0.3, fallback: true } }],
        children: ["agency-manifesto-inner"],
      },
      "agency-manifesto-inner": {
        id: "agency-manifesto-inner",
        type: "container",
        props: {},
        style: { ...inner("820px", "16px", "16px"), base: { ...inner("820px", "16px", "16px").base, layout: { display: "flex", flexDirection: "column", alignItems: "center" } } },
        children: ["agency-manifesto-text"],
      },
      "agency-manifesto-text": {
        id: "agency-manifesto-text",
        type: "text",
        props: {
          content: "No diseñamos para ganar premios. Diseñamos para que tu marca sea la que la gente reconoce sin leer el nombre.",
        },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)",
              lineHeight: "1.25",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },

      // --- Servicios — banda regular ---------------------------------------------
      "agency-services": {
        id: "agency-services",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["agency-services-inner"],
      },
      "agency-services-inner": {
        id: "agency-services-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["agency-services-title", "agency-services-list"],
      },
      "agency-services-title": {
        id: "agency-services-title",
        type: "text",
        props: { content: "<strong>Lo que hacemos</strong>" },
        style: sectionTitle({ token: "colors.text" }),
      },
      "agency-services-list": {
        id: "agency-services-list",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } },
        },
        children: ["agency-service-1", "agency-service-2", "agency-service-3"],
      },
      ...serviceItem(1, "Branding", "Identidad verbal y visual construida desde la estrategia, no desde el logo."),
      ...serviceItem(2, "Producto digital", "Interfaces de producto que se sienten inevitables de usar, desde research hasta shipping."),
      ...serviceItem(3, "Web", "Sitios rápidos y editables, pensados para que el equipo de marketing no dependa de nosotros para cambiar un texto."),

      // --- Equipo — banda regular --------------------------------------------------
      "agency-team": {
        id: "agency-team",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["agency-team-inner"],
      },
      "agency-team-inner": {
        id: "agency-team-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["agency-team-title", "agency-team-grid"],
      },
      "agency-team-title": {
        id: "agency-team-title",
        type: "text",
        props: { content: "<strong>El equipo</strong>" },
        style: sectionTitle({ token: "colors.text" }),
      },
      "agency-team-grid": {
        id: "agency-team-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.lg" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } },
        },
        children: ["agency-team-1", "agency-team-2", "agency-team-3"],
      },
      ...teamMember(
        1,
        "Bruno Salcedo",
        "Director creativo",
        "https://images.unsplash.com/photo-1557862921-37829c790f19?w=200&q=80&auto=format&fit=crop",
        "BS",
      ),
      ...teamMember(
        2,
        "Kenia Farfán",
        "Directora de producto",
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80&auto=format&fit=crop",
        "KF",
      ),
      ...teamMember(
        3,
        "Iker Beltrán",
        "Lead de desarrollo",
        "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&q=80&auto=format&fit=crop",
        "IB",
      ),

      // --- Contacto — banda más oscura --------------------------------------------
      "agency-contact": {
        id: "agency-contact",
        type: "section",
        props: {},
        style: band({ token: "colors.band.dark" }),
        children: ["agency-contact-inner"],
      },
      "agency-contact-inner": {
        id: "agency-contact-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" },
            size: { width: "100%", maxWidth: INNER_MAX },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 360px) 1fr", gap: "40px" } } },
        },
        children: ["agency-contact-info", "agency-contact-card"],
      },
      "agency-contact-info": {
        id: "agency-contact-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["agency-contact-title", "agency-contact-sub"],
      },
      "agency-contact-title": {
        id: "agency-contact-title",
        type: "text",
        props: { content: "<strong>¿Tienes un proyecto en mente?</strong>" },
        style: sectionTitle(),
      },
      "agency-contact-sub": {
        id: "agency-contact-sub",
        type: "text",
        props: { content: "Cuéntanos en dos líneas qué necesitas. Respondemos en menos de 48 horas." },
        style: bodyText({ token: "colors.muted" }),
      },
      "agency-contact-card": {
        id: "agency-contact-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: { background: { token: "colors.surface.alt" }, borderRadius: "8px" },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        children: ["agency-form"],
      },
      "agency-form": {
        id: "agency-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          ...defaultStyleFor("form"),
          base: { ...defaultStyleFor("form").base, appearance: { ...defaultStyleFor("form").base.appearance, color: { token: "colors.band.on" } } },
        },
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["agency-field-name", "agency-field-email", "agency-field-message", "agency-submit"],
      },
      "agency-field-name": {
        id: "agency-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["agency-label-name", "agency-input-name"],
      },
      "agency-label-name": {
        id: "agency-label-name",
        type: "label",
        props: { text: "Nombre", for: "agency-input-name" },
        style: darkBandStyleFor("label"),
      },
      "agency-input-name": {
        id: "agency-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "agency-field-email": {
        id: "agency-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["agency-label-email", "agency-input-email"],
      },
      "agency-label-email": {
        id: "agency-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "agency-input-email" },
        style: darkBandStyleFor("label"),
      },
      "agency-input-email": {
        id: "agency-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "agency-field-message": {
        id: "agency-field-message",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["agency-label-message", "agency-textarea-message"],
      },
      "agency-label-message": {
        id: "agency-label-message",
        type: "label",
        props: { text: "Cuéntanos sobre tu proyecto", for: "agency-textarea-message" },
        style: darkBandStyleFor("label"),
      },
      "agency-textarea-message": {
        id: "agency-textarea-message",
        type: "textarea",
        props: { name: "mensaje", placeholder: "Ej. Necesitamos rediseñar nuestra marca antes de fin de año…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "agency-submit": {
        id: "agency-submit",
        type: "button-submit",
        props: { label: "Enviar mensaje", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "2px",
            },
          },
          states: { hover: { appearance: { background: { token: "colors.band.on" } } } },
        },
      },

      // --- Footer -----------------------------------------------------------------
      "agency-footer": {
        id: "agency-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "56px 40px" } } },
        },
        children: ["agency-footer-address", "agency-footer-social", "agency-footer-copyright"],
      },
      "agency-footer-address": {
        id: "agency-footer-address",
        type: "text",
        props: { content: "Calle Orizaba 142, Roma Norte, Ciudad de México" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "agency-footer-social": {
        id: "agency-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "agency-footer-copyright": {
        id: "agency-footer-copyright",
        type: "text",
        props: { content: "© 2026 Cráter Studio. Todos los derechos reservados." },
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

      t["agency-hero-title"] = {
        en: { content: "<strong>We build brands that feel inevitable</strong>" },
        it: { content: "<strong>Costruiamo marchi che sembrano inevitabili</strong>" },
      };
      t["agency-hero-cta"] = { en: { label: "See our work" }, it: { label: "Guarda il lavoro" } };

      t["agency-client-1"] = { en: { alt: "Nortek client logo" }, it: { alt: "Logo del cliente Nortek" } };
      t["agency-client-2"] = { en: { alt: "Fjord Goods client logo" }, it: { alt: "Logo del cliente Fjord Goods" } };
      t["agency-client-3"] = { en: { alt: "Vantia client logo" }, it: { alt: "Logo del cliente Vantia" } };
      t["agency-client-4"] = { en: { alt: "Bruma Labs client logo" }, it: { alt: "Logo del cliente Bruma Labs" } };
      t["agency-client-5"] = { en: { alt: "Solano & Co client logo" }, it: { alt: "Logo del cliente Solano & Co" } };

      t["agency-work-title"] = { en: { content: "<strong>Selected work</strong>" }, it: { content: "<strong>Progetti selezionati</strong>" } };
      t["agency-project-1-title"] = { en: { content: "<strong>Fjord Goods</strong>" }, it: { content: "<strong>Fjord Goods</strong>" } };
      t["agency-project-1-tag"] = { en: { content: "Brand identity" }, it: { content: "Identità di marca" } };
      t["agency-project-1-img"] = { en: { alt: "Minimalist Fjord Goods packaging on a neutral background" }, it: { alt: "Packaging minimalista di Fjord Goods su sfondo neutro" } };
      t["agency-project-2-title"] = { en: { content: "<strong>Nortek</strong>" }, it: { content: "<strong>Nortek</strong>" } };
      t["agency-project-2-tag"] = { en: { content: "Digital product" }, it: { content: "Prodotto digitale" } };
      t["agency-project-2-img"] = { en: { alt: "Nortek app screens on a phone" }, it: { alt: "Schermate dell'app Nortek su un telefono" } };
      t["agency-project-3-title"] = { en: { content: "<strong>Vantia</strong>" }, it: { content: "<strong>Vantia</strong>" } };
      t["agency-project-3-tag"] = { en: { content: "Website" }, it: { content: "Sito web" } };
      t["agency-project-3-img"] = { en: { alt: "Laptop showing Vantia's redesigned website" }, it: { alt: "Laptop con il sito web ridisegnato di Vantia" } };
      t["agency-project-4-title"] = { en: { content: "<strong>Bruma Labs</strong>" }, it: { content: "<strong>Bruma Labs</strong>" } };
      t["agency-project-4-tag"] = { en: { content: "Branding + web" }, it: { content: "Branding + web" } };
      t["agency-project-4-img"] = { en: { alt: "Bruma Labs branding mockups on a table" }, it: { alt: "Mockup del branding di Bruma Labs su un tavolo" } };

      t["agency-manifesto-text"] = {
        en: {
          content: "We don't design to win awards. We design so your brand is the one people recognize without reading the name.",
        },
        it: {
          content: "Non progettiamo per vincere premi. Progettiamo perché il tuo marchio sia quello che le persone riconoscono senza leggere il nome.",
        },
      };

      t["agency-services-title"] = { en: { content: "<strong>What we do</strong>" }, it: { content: "<strong>Cosa facciamo</strong>" } };
      t["agency-service-1-title"] = { en: { content: "<strong>Branding</strong>" }, it: { content: "<strong>Branding</strong>" } };
      t["agency-service-1-text"] = {
        en: { content: "Verbal and visual identity built from strategy, not from the logo." },
        it: { content: "Identità verbale e visiva costruita partendo dalla strategia, non dal logo." },
      };
      t["agency-service-2-title"] = { en: { content: "<strong>Digital product</strong>" }, it: { content: "<strong>Prodotto digitale</strong>" } };
      t["agency-service-2-text"] = {
        en: { content: "Product interfaces that feel inevitable to use, from research to shipping." },
        it: { content: "Interfacce di prodotto che sembrano inevitabili da usare, dalla ricerca al lancio." },
      };
      t["agency-service-3-title"] = { en: { content: "<strong>Web</strong>" }, it: { content: "<strong>Web</strong>" } };
      t["agency-service-3-text"] = {
        en: { content: "Fast, editable websites, built so your marketing team doesn't depend on us to change a text." },
        it: { content: "Siti web rapidi e modificabili, pensati perché il team marketing non dipenda da noi per cambiare un testo." },
      };

      t["agency-team-title"] = { en: { content: "<strong>The team</strong>" }, it: { content: "<strong>Il team</strong>" } };
      t["agency-team-1-avatar"] = { en: { alt: "Portrait of Bruno Salcedo" }, it: { alt: "Ritratto di Bruno Salcedo" } };
      t["agency-team-1-name"] = { en: { content: "<strong>Bruno Salcedo</strong>" }, it: { content: "<strong>Bruno Salcedo</strong>" } };
      t["agency-team-1-role"] = { en: { content: "Creative director" }, it: { content: "Direttore creativo" } };
      t["agency-team-2-avatar"] = { en: { alt: "Portrait of Kenia Farfán" }, it: { alt: "Ritratto di Kenia Farfán" } };
      t["agency-team-2-name"] = { en: { content: "<strong>Kenia Farfán</strong>" }, it: { content: "<strong>Kenia Farfán</strong>" } };
      t["agency-team-2-role"] = { en: { content: "Head of product" }, it: { content: "Responsabile prodotto" } };
      t["agency-team-3-avatar"] = { en: { alt: "Portrait of Iker Beltrán" }, it: { alt: "Ritratto di Iker Beltrán" } };
      t["agency-team-3-name"] = { en: { content: "<strong>Iker Beltrán</strong>" }, it: { content: "<strong>Iker Beltrán</strong>" } };
      t["agency-team-3-role"] = { en: { content: "Lead developer" }, it: { content: "Lead sviluppo" } };

      t["agency-contact-title"] = { en: { content: "<strong>Got a project in mind?</strong>" }, it: { content: "<strong>Hai un progetto in mente?</strong>" } };
      t["agency-contact-sub"] = {
        en: { content: "Tell us in two lines what you need. We reply within 48 hours." },
        it: { content: "Raccontaci in due righe di cosa hai bisogno. Rispondiamo entro 48 ore." },
      };
      t["agency-label-name"] = { en: { text: "Name" }, it: { text: "Nome" } };
      t["agency-input-name"] = { en: { placeholder: "Your name" }, it: { placeholder: "Il tuo nome" } };
      t["agency-label-email"] = { en: { text: "Email" }, it: { text: "Email" } };
      t["agency-input-email"] = { en: { placeholder: "you@email.com" }, it: { placeholder: "tu@email.com" } };
      t["agency-label-message"] = { en: { text: "Tell us about your project" }, it: { text: "Raccontaci il tuo progetto" } };
      t["agency-textarea-message"] = {
        en: { placeholder: "E.g. We need to rebrand before year end…" },
        it: { placeholder: "Es. Dobbiamo rifare il brand entro fine anno…" },
      };
      t["agency-submit"] = { en: { label: "Send message" }, it: { label: "Invia messaggio" } };

      t["agency-footer-copyright"] = {
        en: { content: "© 2026 Cráter Studio. All rights reserved." },
        it: { content: "© 2026 Cráter Studio. Tutti i diritti riservati." },
      };
      t["agency-footer-address"] = {
        en: { content: "142 Orizaba St, Roma Norte, Mexico City" },
        it: { content: "Calle Orizaba 142, Roma Norte, Città del Messico" },
      };

      return t;
    })(),
  };
}

export const creativeAgencyPageMeta: LayoutPageMeta = {
  title: "Cráter Studio · Branding y producto digital",
  description: "Agencia creativa especializada en branding, producto digital y sitios web para marcas ambiciosas.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Cráter Studio",
      description: "Hacemos marcas que se sienten inevitables. Ve nuestro trabajo.",
      image: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Cráter Studio",
      description: "Hacemos marcas que se sienten inevitables. Ve nuestro trabajo.",
      image: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Cráter Studio · Branding & digital product",
      description: "Creative agency specialized in branding, digital product and websites for ambitious brands.",
      seo: {
        openGraph: { title: "Cráter Studio", description: "We build brands that feel inevitable. See our work." },
        twitter: { title: "Cráter Studio", description: "We build brands that feel inevitable. See our work." },
      },
    },
    it: {
      title: "Cráter Studio · Branding e prodotto digitale",
      description: "Agenzia creativa specializzata in branding, prodotto digitale e siti web per marchi ambiziosi.",
      seo: {
        openGraph: { title: "Cráter Studio", description: "Costruiamo marchi che sembrano inevitabili. Guarda il lavoro." },
        twitter: { title: "Cráter Studio", description: "Costruiamo marchi che sembrano inevitabili. Guarda il lavoro." },
      },
    },
  },
};
