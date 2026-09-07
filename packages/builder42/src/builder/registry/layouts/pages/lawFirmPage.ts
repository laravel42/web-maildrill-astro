import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, type LayoutPageMeta } from "../helpers";

/**
 * Página "Bufete de abogados" — plantilla NUEVA de sector (docs/48 §2 fila
 * 12, F5): "Zaldívar & Ochoa Abogados", bufete institucional (corporativo,
 * litigios, familia, inmobiliario).
 *
 * Arquetipo A10 — Long-form con scroll-spy (docs/48 §2): un nav LATERAL
 * `sticky` (no un nav de anclas horizontal en el hero, a diferencia de
 * `team-page`/A7b) acompaña una columna de contenido larga con 4 secciones
 * ancladas (áreas de práctica). El nav vive en un `aside` a la IZQUIERDA con
 * `position: sticky` (behavior `sticky`) y usa `scroll-spy` para resaltar el
 * área visible; cada área de práctica es una banda propia con su propio
 * `id` (anclada vía `LinkTarget.kind:"anchor"`). Es la firma que distingue a
 * A10 de A7 (real-estate-page: aside de FILTRO, no de NAVEGACIÓN dentro de un
 * grid de 2 columnas) y de A7b (team-page: aside de RESUMEN/CTA a la derecha
 * de un grid, no un nav vertical fijo a la izquierda que gobierna la
 * navegación de toda la sección).
 *
 * Tema "Counsel" (navy/marfil, tipografía Source Serif 4): sobrio, sin
 * degradados de acento saturados — coherente con el tono profesional pedido.
 *
 * Showcase funcional: `scroll-spy` + `sticky` en el aside de navegación,
 * `quote` para el caso de éxito destacado.
 *
 * Anatomía: topbar (teléfono + language-nav) · navbar · hero institucional ·
 * áreas de práctica (aside `sticky`+`scroll-spy` + 4 bandas ancladas:
 * corporativo, litigios, familia, inmobiliario) · perfil de socios · caso de
 * éxito (`quote`) · proceso de consulta (`stat` numerado) · contacto
 * (`form`) · footer oscuro.
 *
 * Todos los ids con prefijo `lawfirm-`.
 */

const SHADOW_CARD = "0 12px 32px rgba(15,23,42,0.08)";
const SHADOW_HOVER = "0 18px 40px rgba(15,23,42,0.16)";
const BAND_PADDING = "48px 20px";
const INNER_MAX = "1160px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING, paddingMd: string = "96px 20px"): NodeStyle {
  return {
    base: { layout: { display: "flex", flexDirection: "column" }, spacing: { padding }, appearance: { background } },
    overrides: { md: { spacing: { padding: paddingMd } } },
  };
}

function inner(maxWidth: string = INNER_MAX, gap = "24px", gapMd = "40px"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
    overrides: { md: { layout: { gap: gapMd } } },
  };
}

function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.15",
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

function practiceArea(
  n: 1 | 2 | 3 | 4,
  title: string,
  text: string,
  bg: StyleValue,
) {
  return {
    [`lawfirm-practice-${n}`]: {
      id: `lawfirm-practice-${n}`,
      type: "section",
      props: {},
      style: band(bg, "40px 20px", "72px 20px"),
      behaviors: REVEAL,
      children: [`lawfirm-practice-${n}-inner`],
    },
    [`lawfirm-practice-${n}-inner`]: {
      id: `lawfirm-practice-${n}-inner`,
      type: "container",
      props: {},
      style: inner("760px", "12px", "12px"),
      children: [`lawfirm-practice-${n}-title`, `lawfirm-practice-${n}-text`],
    },
    [`lawfirm-practice-${n}-title`]: {
      id: `lawfirm-practice-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "clamp(1.5rem, 3vw, 2rem)",
            fontWeight: { token: "typography.weights.bold" },
            lineHeight: "1.2",
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`lawfirm-practice-${n}-text`]: {
      id: `lawfirm-practice-${n}-text`,
      type: "text",
      props: { content: text },
      style: bodyText(),
    },
  };
}

function partnerCard(n: 1 | 2 | 3, name: string, role: string, imageUrl: string, initials: string) {
  return {
    [`lawfirm-partner-${n}`]: {
      id: `lawfirm-partner-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" },
          spacing: { padding: "20px" },
          size: { width: "100%" },
          typography: { textAlign: "center" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            borderRadius: "12px",
            boxShadow: SHADOW_CARD,
          },
        },
        overrides: { md: { spacing: { padding: "28px" } } },
        states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
      },
      children: [`lawfirm-partner-${n}-avatar`, `lawfirm-partner-${n}-name`, `lawfirm-partner-${n}-role`],
    },
    [`lawfirm-partner-${n}-avatar`]: {
      id: `lawfirm-partner-${n}-avatar`,
      type: "avatar",
      props: { source: { kind: "url", url: imageUrl }, alt: `Retrato de ${name}`, initials },
      style: { base: { size: { width: "88px", height: "88px" } } },
    },
    [`lawfirm-partner-${n}-name`]: {
      id: `lawfirm-partner-${n}-name`,
      type: "text",
      props: { content: `<strong>${name}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`lawfirm-partner-${n}-role`]: {
      id: `lawfirm-partner-${n}-role`,
      type: "text",
      props: { content: role },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function processStep(n: 1 | 2 | 3, value: string, label: string) {
  return {
    [`lawfirm-process-${n}`]: {
      id: `lawfirm-process-${n}`,
      type: "stat",
      props: { value, label },
      style: { base: { typography: { textAlign: "center" } } },
    },
  };
}

export function buildLawFirmPageFragment(): NodeFragment {
  return {
    rootId: "lawfirm-root",
    nodes: {
      "lawfirm-root": {
        id: "lawfirm-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "lawfirm-topbar",
          "lawfirm-navbar",
          "lawfirm-hero",
          "lawfirm-practices",
          "lawfirm-partners",
          "lawfirm-case",
          "lawfirm-process",
          "lawfirm-contact",
          "lawfirm-footer",
        ],
      },

      // --- Topbar: teléfono + language-nav ------------------------------------
      "lawfirm-topbar": {
        id: "lawfirm-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "8px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.muted" }, background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "10px 24px" } } },
        },
        children: ["lawfirm-topbar-phone", "lawfirm-topbar-lang"],
      },
      "lawfirm-topbar-phone": {
        id: "lawfirm-topbar-phone",
        type: "text",
        props: { content: "Consulta inicial: +52 55 4321 0987" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "lawfirm-topbar-lang": {
        id: "lawfirm-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        style: defaultStyleFor("language-nav"),
      },

      // --- Navbar ---------------------------------------------------------------
      "lawfirm-navbar": {
        id: "lawfirm-navbar",
        type: "navbar",
        props: { brand: "Zaldívar & Ochoa Abogados", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero institucional, sobrio (sin foto a sangre, banda navy) ----------
      "lawfirm-hero": {
        id: "lawfirm-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px" },
            spacing: { padding: "64px 20px" },
            size: { width: "100%", minHeight: "420px" },
            typography: { fontFamily: { token: "typography.families.display" }, textAlign: "center" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { size: { minHeight: "480px" }, spacing: { padding: "128px 20px" } } },
        },
        children: ["lawfirm-hero-badge", "lawfirm-hero-title", "lawfirm-hero-sub", "lawfirm-hero-cta"],
      },
      "lawfirm-hero-badge": {
        id: "lawfirm-hero-badge",
        type: "badge",
        props: { label: "35 años de trayectoria" },
        style: darkBandStyleFor("badge"),
      },
      "lawfirm-hero-title": {
        id: "lawfirm-hero-title",
        type: "text",
        props: { content: "<strong>Asesoría legal con criterio y discreción</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.1",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "lawfirm-hero-sub": {
        id: "lawfirm-hero-sub",
        type: "text",
        props: {
          content: "Acompañamos a empresas y familias en decisiones legales complejas, con un equipo que responde directamente, sin intermediarios.",
        },
        style: {
          base: {
            size: { maxWidth: "50ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "lawfirm-hero-cta": {
        id: "lawfirm-hero-cta",
        type: "button",
        props: { label: "Agendar consulta", link: { kind: "anchor", nodeId: "lawfirm-contact" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "8px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.28)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(15,23,42,0.36)" } } },
        },
      },

      // --- Áreas de práctica: A10 (aside nav sticky+scroll-spy + long-form) ---
      "lawfirm-practices": {
        id: "lawfirm-practices",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }, "0"),
        children: ["lawfirm-practices-inner"],
      },
      "lawfirm-practices-inner": {
        id: "lawfirm-practices-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "0" },
            size: { width: "100%", maxWidth: INNER_MAX },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)" } } },
        },
        children: ["lawfirm-practices-nav", "lawfirm-practices-main"],
      },
      // Aside de NAVEGACIÓN (no de filtro como A7, no de resumen/CTA como
      // A7b): `sticky` + `scroll-spy` gobiernan la lectura de las 4 bandas
      // ancladas que siguen. Firma distintiva de A10.
      "lawfirm-practices-nav": {
        id: "lawfirm-practices-nav",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "4px" },
            spacing: { padding: "32px 20px" },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        behaviors: [
          { type: "sticky", options: { position: "top", scrolledThreshold: 8 } },
          { type: "scroll-spy", options: { rootMargin: "-20% 0px -60% 0px" } },
        ],
        children: [
          "lawfirm-practices-nav-title",
          "lawfirm-practices-nav-1",
          "lawfirm-practices-nav-2",
          "lawfirm-practices-nav-3",
          "lawfirm-practices-nav-4",
        ],
      },
      "lawfirm-practices-nav-title": {
        id: "lawfirm-practices-nav-title",
        type: "text",
        props: { content: "<strong>Áreas de práctica</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.125rem", fontWeight: { token: "typography.weights.bold" } },
            spacing: { margin: "0 0 8px" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      ...(["lawfirm-practice-1", "lawfirm-practice-2", "lawfirm-practice-3", "lawfirm-practice-4"] as const).reduce(
        (acc, targetId, i) => {
          const n = i + 1;
          const labels = ["Corporativo", "Litigios", "Familia", "Inmobiliario"];
          acc[`lawfirm-practices-nav-${n}`] = {
            id: `lawfirm-practices-nav-${n}`,
            type: "button",
            props: { label: labels[i], link: { kind: "anchor", nodeId: targetId } },
            style: {
              base: {
                layout: { display: "inline-block" },
                spacing: { padding: "14px 22px" },
                typography: { fontFamily: { token: "typography.families.sans" }, textDecoration: "none" },
                appearance: { background: "transparent", color: { token: "colors.muted" }, borderRadius: "6px", cursor: "pointer" },
              },
              states: {
                hover: { appearance: { background: { token: "colors.surface.alt" }, color: { token: "colors.text" } } },
              },
            },
          };
          return acc;
        },
        {} as Record<string, BuilderNode>,
      ),
      "lawfirm-practices-main": {
        id: "lawfirm-practices-main",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: "0" } } },
        children: ["lawfirm-practice-1", "lawfirm-practice-2", "lawfirm-practice-3", "lawfirm-practice-4"],
      },
      ...practiceArea(
        1,
        "Derecho corporativo",
        "Constitución de sociedades, contratos comerciales, gobierno corporativo y fusiones y adquisiciones para empresas de todos los tamaños.",
        { token: "colors.surface.default" },
      ),
      ...practiceArea(
        2,
        "Litigios civiles y mercantiles",
        "Representación en juicios civiles, mercantiles y arbitrajes, con una estrategia clara desde la primera consulta.",
        { token: "colors.surface.alt" },
      ),
      ...practiceArea(
        3,
        "Derecho familiar",
        "Divorcios, pensiones, custodia y sucesiones, con un acompañamiento cercano en momentos personales difíciles.",
        { token: "colors.surface.default" },
      ),
      ...practiceArea(
        4,
        "Derecho inmobiliario",
        "Compraventa, arrendamiento y regularización de propiedades, revisando cada documento antes de firmar.",
        { token: "colors.surface.alt" },
      ),

      // --- Perfil de socios — banda clara ----------------------------------------
      "lawfirm-partners": {
        id: "lawfirm-partners",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["lawfirm-partners-inner"],
      },
      "lawfirm-partners-inner": {
        id: "lawfirm-partners-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["lawfirm-partners-title", "lawfirm-partners-grid"],
      },
      "lawfirm-partners-title": {
        id: "lawfirm-partners-title",
        type: "text",
        props: { content: "<strong>Nuestros socios</strong>" },
        style: sectionTitle(),
      },
      "lawfirm-partners-grid": {
        id: "lawfirm-partners-grid",
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
        children: ["lawfirm-partner-1", "lawfirm-partner-2", "lawfirm-partner-3"],
      },
      ...partnerCard(
        1,
        "Lic. Renato Zaldívar",
        "Socio fundador · Derecho corporativo",
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80&auto=format&fit=crop",
        "RZ",
      ),
      ...partnerCard(
        2,
        "Lic. Ivonne Ochoa",
        "Socia fundadora · Litigios",
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80&auto=format&fit=crop",
        "IO",
      ),
      ...partnerCard(
        3,
        "Lic. Daniel Puente",
        "Socio · Derecho familiar e inmobiliario",
        "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=200&q=80&auto=format&fit=crop",
        "DP",
      ),

      // --- Caso de éxito — quote destacado, banda oscura ------------------------
      "lawfirm-case": {
        id: "lawfirm-case",
        type: "section",
        props: {},
        style: band({ token: "colors.band.dark" }),
        behaviors: REVEAL,
        children: ["lawfirm-case-inner"],
      },
      "lawfirm-case-inner": {
        id: "lawfirm-case-inner",
        type: "container",
        props: {},
        style: { ...inner("820px", "16px"), base: { ...inner("820px", "16px").base, layout: { display: "flex", flexDirection: "column", alignItems: "center" } } },
        children: ["lawfirm-case-quote"],
      },
      "lawfirm-case-quote": {
        id: "lawfirm-case-quote",
        type: "quote",
        props: {
          content:
            "Su equipo resolvió en ocho meses un litigio societario que llevaba tres años estancado con otro despacho. La claridad de su estrategia hizo toda la diferencia.",
          attribution: "Dirección General, grupo empresarial del sector logístico",
        },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(1.25rem, 2.4vw, 1.625rem)",
              lineHeight: "1.4",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },

      // --- Proceso de consulta — 3 pasos numerados, banda con degradado ---------
      "lawfirm-process": {
        id: "lawfirm-process",
        type: "section",
        props: {},
        style: {
          ...band("linear-gradient(135deg, var(--colors-surface-alt), var(--colors-surface-default))"),
          overrides: { md: { spacing: { padding: "112px 20px" } } },
        },
        behaviors: REVEAL,
        children: ["lawfirm-process-inner"],
      },
      "lawfirm-process-inner": {
        id: "lawfirm-process-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["lawfirm-process-title", "lawfirm-process-grid"],
      },
      "lawfirm-process-title": {
        id: "lawfirm-process-title",
        type: "text",
        props: { content: "<strong>Cómo trabajamos tu consulta</strong>" },
        style: sectionTitle(),
      },
      "lawfirm-process-grid": {
        id: "lawfirm-process-grid",
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
        children: ["lawfirm-process-1", "lawfirm-process-2", "lawfirm-process-3"],
      },
      ...processStep(1, "1", "Consulta inicial sin costo, para entender tu caso"),
      ...processStep(2, "2", "Propuesta de estrategia y honorarios claros por escrito"),
      ...processStep(3, "3", "Seguimiento directo con tu abogado responsable"),

      // --- Contacto — banda alt ---------------------------------------------------
      "lawfirm-contact": {
        id: "lawfirm-contact",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["lawfirm-contact-inner"],
      },
      "lawfirm-contact-inner": {
        id: "lawfirm-contact-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" },
            size: { width: "100%", maxWidth: INNER_MAX },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 320px) 1fr", gap: "40px" } } },
        },
        children: ["lawfirm-contact-info", "lawfirm-contact-card"],
      },
      "lawfirm-contact-info": {
        id: "lawfirm-contact-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["lawfirm-contact-title", "lawfirm-contact-sub"],
      },
      "lawfirm-contact-title": {
        id: "lawfirm-contact-title",
        type: "text",
        props: { content: "<strong>Agenda tu consulta</strong>" },
        style: sectionTitle(),
      },
      "lawfirm-contact-sub": {
        id: "lawfirm-contact-sub",
        type: "text",
        props: { content: "Describe brevemente tu caso y un abogado del área correspondiente te contactará en menos de 24 horas." },
        style: bodyText(),
      },
      "lawfirm-contact-card": {
        id: "lawfirm-contact-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: { background: { token: "colors.surface.default" }, borderRadius: "12px", boxShadow: SHADOW_CARD },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        children: ["lawfirm-form"],
      },
      "lawfirm-form": {
        id: "lawfirm-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["lawfirm-field-name", "lawfirm-field-email", "lawfirm-field-area", "lawfirm-field-message", "lawfirm-submit"],
      },
      "lawfirm-field-name": {
        id: "lawfirm-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["lawfirm-label-name", "lawfirm-input-name"],
      },
      "lawfirm-label-name": {
        id: "lawfirm-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "lawfirm-input-name" },
        style: defaultStyleFor("label"),
      },
      "lawfirm-input-name": {
        id: "lawfirm-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "lawfirm-field-email": {
        id: "lawfirm-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["lawfirm-label-email", "lawfirm-input-email"],
      },
      "lawfirm-label-email": {
        id: "lawfirm-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "lawfirm-input-email" },
        style: defaultStyleFor("label"),
      },
      "lawfirm-input-email": {
        id: "lawfirm-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "lawfirm-field-area": {
        id: "lawfirm-field-area",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["lawfirm-label-area", "lawfirm-select-area"],
      },
      "lawfirm-label-area": {
        id: "lawfirm-label-area",
        type: "label",
        props: { text: "Área de interés", for: "lawfirm-select-area" },
        style: defaultStyleFor("label"),
      },
      "lawfirm-select-area": {
        id: "lawfirm-select-area",
        type: "select",
        props: {
          name: "area",
          placeholder: "Elige una opción…",
          ariaLabel: "Área de interés",
          options: [
            { label: "Corporativo", value: "corporativo" },
            { label: "Litigios", value: "litigios" },
            { label: "Familia", value: "familia" },
            { label: "Inmobiliario", value: "inmobiliario" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "lawfirm-field-message": {
        id: "lawfirm-field-message",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["lawfirm-label-message", "lawfirm-textarea-message"],
      },
      "lawfirm-label-message": {
        id: "lawfirm-label-message",
        type: "label",
        props: { text: "Cuéntanos brevemente tu caso", for: "lawfirm-textarea-message" },
        style: defaultStyleFor("label"),
      },
      "lawfirm-textarea-message": {
        id: "lawfirm-textarea-message",
        type: "textarea",
        props: { name: "mensaje", placeholder: "Ej. Necesito revisar un contrato de arrendamiento…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "lawfirm-submit": {
        id: "lawfirm-submit",
        type: "button-submit",
        props: { label: "Enviar consulta", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "8px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.2)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(15,23,42,0.28)" } } },
        },
      },

      // --- Footer — banda oscura ---------------------------------------------------
      "lawfirm-footer": {
        id: "lawfirm-footer",
        type: "footer",
        props: { copyright: "© 2026 Zaldívar & Ochoa Abogados. Todos los derechos reservados." },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "64px 40px" } } },
        },
        children: ["lawfirm-footer-address", "lawfirm-footer-hours", "lawfirm-footer-social"],
      },
      "lawfirm-footer-address": {
        id: "lawfirm-footer-address",
        type: "text",
        props: { content: "Paseo de la Reforma 250, Piso 12, Ciudad de México" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "lawfirm-footer-hours": {
        id: "lawfirm-footer-hours",
        type: "text",
        props: { content: "Lunes a viernes 9:00–18:30" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "lawfirm-footer-social": {
        id: "lawfirm-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["lawfirm-topbar-phone"] = {
        en: { content: "Initial consultation: +52 55 4321 0987" },
        it: { content: "Prima consulenza: +52 55 4321 0987" },
      };
      t["lawfirm-hero-badge"] = { en: { label: "35 years of experience" }, it: { label: "35 anni di esperienza" } };
      t["lawfirm-hero-title"] = {
        en: { content: "<strong>Legal counsel with judgment and discretion</strong>" },
        it: { content: "<strong>Consulenza legale con criterio e discrezione</strong>" },
      };
      t["lawfirm-hero-sub"] = {
        en: {
          content: "We guide companies and families through complex legal decisions, with a team that answers directly, with no intermediaries.",
        },
        it: {
          content: "Accompagniamo aziende e famiglie in decisioni legali complesse, con un team che risponde direttamente, senza intermediari.",
        },
      };
      t["lawfirm-hero-cta"] = { en: { label: "Schedule a consultation" }, it: { label: "Prenota una consulenza" } };

      t["lawfirm-practices-nav-title"] = { en: { content: "<strong>Practice areas</strong>" }, it: { content: "<strong>Aree di pratica</strong>" } };
      t["lawfirm-practices-nav-1"] = { en: { label: "Corporate" }, it: { label: "Societario" } };
      t["lawfirm-practices-nav-2"] = { en: { label: "Litigation" }, it: { label: "Contenzioso" } };
      t["lawfirm-practices-nav-3"] = { en: { label: "Family" }, it: { label: "Famiglia" } };
      t["lawfirm-practices-nav-4"] = { en: { label: "Real estate" }, it: { label: "Immobiliare" } };

      t["lawfirm-practice-1-title"] = { en: { content: "<strong>Corporate law</strong>" }, it: { content: "<strong>Diritto societario</strong>" } };
      t["lawfirm-practice-1-text"] = {
        en: { content: "Company formation, commercial contracts, corporate governance, and mergers and acquisitions for businesses of every size." },
        it: { content: "Costituzione di società, contratti commerciali, corporate governance e fusioni e acquisizioni per aziende di ogni dimensione." },
      };
      t["lawfirm-practice-2-title"] = { en: { content: "<strong>Civil & commercial litigation</strong>" }, it: { content: "<strong>Contenzioso civile e commerciale</strong>" } };
      t["lawfirm-practice-2-text"] = {
        en: { content: "Representation in civil, commercial and arbitration proceedings, with a clear strategy from the very first consultation." },
        it: { content: "Rappresentanza in procedimenti civili, commerciali e arbitrali, con una strategia chiara dalla prima consulenza." },
      };
      t["lawfirm-practice-3-title"] = { en: { content: "<strong>Family law</strong>" }, it: { content: "<strong>Diritto di famiglia</strong>" } };
      t["lawfirm-practice-3-text"] = {
        en: { content: "Divorce, alimony, custody and inheritance, with close support through difficult personal moments." },
        it: { content: "Divorzi, alimenti, affidamento e successioni, con un accompagnamento vicino nei momenti personali difficili." },
      };
      t["lawfirm-practice-4-title"] = { en: { content: "<strong>Real estate law</strong>" }, it: { content: "<strong>Diritto immobiliare</strong>" } };
      t["lawfirm-practice-4-text"] = {
        en: { content: "Sale, lease and title regularization of properties, reviewing every document before you sign." },
        it: { content: "Compravendita, locazione e regolarizzazione di immobili, verificando ogni documento prima della firma." },
      };

      t["lawfirm-partners-title"] = { en: { content: "<strong>Our partners</strong>" }, it: { content: "<strong>I nostri partner</strong>" } };
      t["lawfirm-partner-1-avatar"] = { en: { alt: "Portrait of Renato Zaldívar" }, it: { alt: "Ritratto di Renato Zaldívar" } };
      t["lawfirm-partner-1-name"] = { en: { content: "<strong>Renato Zaldívar</strong>" }, it: { content: "<strong>Renato Zaldívar</strong>" } };
      t["lawfirm-partner-1-role"] = { en: { content: "Founding partner · Corporate law" }, it: { content: "Partner fondatore · Diritto societario" } };
      t["lawfirm-partner-2-avatar"] = { en: { alt: "Portrait of Ivonne Ochoa" }, it: { alt: "Ritratto di Ivonne Ochoa" } };
      t["lawfirm-partner-2-name"] = { en: { content: "<strong>Ivonne Ochoa</strong>" }, it: { content: "<strong>Ivonne Ochoa</strong>" } };
      t["lawfirm-partner-2-role"] = { en: { content: "Founding partner · Litigation" }, it: { content: "Partner fondatrice · Contenzioso" } };
      t["lawfirm-partner-3-avatar"] = { en: { alt: "Portrait of Daniel Puente" }, it: { alt: "Ritratto di Daniel Puente" } };
      t["lawfirm-partner-3-name"] = { en: { content: "<strong>Daniel Puente</strong>" }, it: { content: "<strong>Daniel Puente</strong>" } };
      t["lawfirm-partner-3-role"] = { en: { content: "Partner · Family & real estate law" }, it: { content: "Partner · Diritto di famiglia e immobiliare" } };

      t["lawfirm-case-quote"] = {
        en: {
          content: "Their team resolved in eight months a corporate dispute that had been stalled for three years with another firm. Their strategic clarity made all the difference.",
          attribution: "General Management, logistics-sector business group",
        },
        it: {
          content: "Il loro team ha risolto in otto mesi una controversia societaria bloccata da tre anni con un altro studio. La chiarezza della loro strategia ha fatto la differenza.",
          attribution: "Direzione Generale, gruppo aziendale del settore logistico",
        },
      };

      t["lawfirm-process-title"] = { en: { content: "<strong>How we handle your consultation</strong>" }, it: { content: "<strong>Come gestiamo la tua consulenza</strong>" } };
      t["lawfirm-process-1"] = { en: { value: "1", label: "Free initial consultation, to understand your case" }, it: { value: "1", label: "Prima consulenza gratuita, per capire il tuo caso" } };
      t["lawfirm-process-2"] = { en: { value: "2", label: "Clear strategy and fee proposal in writing" }, it: { value: "2", label: "Proposta di strategia e onorari chiari per iscritto" } };
      t["lawfirm-process-3"] = { en: { value: "3", label: "Direct follow-up with your assigned attorney" }, it: { value: "3", label: "Seguimento diretto con il tuo avvocato di riferimento" } };

      t["lawfirm-contact-title"] = { en: { content: "<strong>Schedule your consultation</strong>" }, it: { content: "<strong>Prenota la tua consulenza</strong>" } };
      t["lawfirm-contact-sub"] = {
        en: { content: "Briefly describe your case and an attorney from the relevant area will contact you within 24 hours." },
        it: { content: "Descrivi brevemente il tuo caso e un avvocato dell'area competente ti contatterà entro 24 ore." },
      };
      t["lawfirm-label-name"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["lawfirm-input-name"] = { en: { placeholder: "Your full name" }, it: { placeholder: "Il tuo nome completo" } };
      t["lawfirm-label-email"] = { en: { text: "Email" }, it: { text: "Email" } };
      t["lawfirm-input-email"] = { en: { placeholder: "you@email.com" }, it: { placeholder: "tu@email.com" } };
      t["lawfirm-label-area"] = { en: { text: "Area of interest" }, it: { text: "Area di interesse" } };
      t["lawfirm-select-area"] = {
        en: {
          placeholder: "Choose an option…",
          ariaLabel: "Area of interest",
          options: [
            { label: "Corporate", value: "corporativo" },
            { label: "Litigation", value: "litigios" },
            { label: "Family", value: "familia" },
            { label: "Real estate", value: "inmobiliario" },
          ],
        },
        it: {
          placeholder: "Scegli un'opzione…",
          ariaLabel: "Area di interesse",
          options: [
            { label: "Societario", value: "corporativo" },
            { label: "Contenzioso", value: "litigios" },
            { label: "Famiglia", value: "familia" },
            { label: "Immobiliare", value: "inmobiliario" },
          ],
        },
      };
      t["lawfirm-label-message"] = { en: { text: "Briefly tell us about your case" }, it: { text: "Raccontaci brevemente il tuo caso" } };
      t["lawfirm-textarea-message"] = {
        en: { placeholder: "E.g. I need to review a lease agreement…" },
        it: { placeholder: "Es. Devo revisionare un contratto di locazione…" },
      };
      t["lawfirm-submit"] = { en: { label: "Send inquiry" }, it: { label: "Invia richiesta" } };

      t["lawfirm-footer"] = {
        en: { copyright: "© 2026 Zaldívar & Ochoa Attorneys. All rights reserved." },
        it: { copyright: "© 2026 Zaldívar & Ochoa Avvocati. Tutti i diritti riservati." },
      };
      t["lawfirm-footer-address"] = {
        en: { content: "250 Reforma Ave, 12th Floor, Mexico City" },
        it: { content: "Paseo de la Reforma 250, 12° Piano, Città del Messico" },
      };
      t["lawfirm-footer-hours"] = { en: { content: "Monday to Friday 9:00 AM–6:30 PM" }, it: { content: "Lunedì-venerdì 9:00–18:30" } };

      return t;
    })(),
  };
}

export const lawFirmPageMeta: LayoutPageMeta = {
  title: "Zaldívar & Ochoa Abogados · Asesoría legal institucional",
  description:
    "Bufete de abogados con 35 años de trayectoria en derecho corporativo, litigios, familia e inmobiliario.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Zaldívar & Ochoa Abogados",
      description: "Asesoría legal con criterio y discreción. Agenda tu consulta.",
      image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Zaldívar & Ochoa Abogados",
      description: "Asesoría legal con criterio y discreción. Agenda tu consulta.",
      image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Zaldívar & Ochoa Attorneys · Institutional legal counsel",
      description: "Law firm with 35 years of experience in corporate, litigation, family and real estate law.",
      seo: {
        openGraph: { title: "Zaldívar & Ochoa Attorneys", description: "Legal counsel with judgment and discretion. Schedule your consultation." },
        twitter: { title: "Zaldívar & Ochoa Attorneys", description: "Legal counsel with judgment and discretion. Schedule your consultation." },
      },
    },
    it: {
      title: "Zaldívar & Ochoa Avvocati · Consulenza legale istituzionale",
      description: "Studio legale con 35 anni di esperienza in diritto societario, contenzioso, famiglia e immobiliare.",
      seo: {
        openGraph: { title: "Zaldívar & Ochoa Avvocati", description: "Consulenza legale con criterio e discrezione. Prenota la tua consulenza." },
        twitter: { title: "Zaldívar & Ochoa Avvocati", description: "Consulenza legale con criterio e discrezione. Prenota la tua consulenza." },
      },
    },
  },
};
