import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, statFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Estudio de arquitectura" — plantilla NUEVA de sector (docs/48 §2
 * fila 16, F6): "Umbral Arquitectos", estudio de diseño arquitectónico y
 * urbanismo (proyectos residenciales, corporativos e institucionales).
 *
 * Arquetipo A10b — variante de A10 (long-form con scroll-spy, ya usado por
 * `law-firm-page` en F5). Difiere de A10 en ≥2/5 rasgos de firma
 * (`layoutSignature.helper.ts`), verificado empíricamente midiendo la firma
 * real de `law-firm-page` con `layoutSignature()` antes de escribir este
 * comentario (misma disciplina que `barbershopPage.ts`/`spaWellnessPage.ts`:
 * no se documenta un rasgo sin haberlo medido). La banda de nav+contenido de
 * A10 (`lawfirm-practices-inner`) mide:
 *   - `display: "grid"`, `gridColumns: { kind: "columns", count: 2,
 *     symmetric: false }` (el par `minmax(220px,260px) minmax(0,1fr)` no es
 *     simétrico por ancho literal, pero SÍ es un grid de exactamente 2
 *     columnas — la condición que activa `orientation` en el helper),
 *     `overrideBreakpoints: ["md"]`, `hasMedia: false` (el aside de nav y la
 *     columna de práctica-áreas son solo texto/botones, sin imagen/video/hero
 *     ni fondo no vacío en ese subárbol), `orientation: "none"` (el nodo de
 *     grid tiene solo 2 hijos directos — `lawfirm-practices-nav` y
 *     `lawfirm-practices-main` — y NINGUNO de los dos contiene media en su
 *     subárbol, así que `firstHasMedia === secondHasMedia === false` cae en
 *     "stacked"→"none" según `orientationOf`, no en "left"/"right").
 *
 * A10b (esta plantilla, banda `archstudio-projects-inner`) difiere en:
 *   1. **`gridColumns` distinto**: en vez de 2 columnas simétricas de ancho
 *      fijo+flexible, el nav+contenido usa un grid de **3 columnas
 *      ASIMÉTRICAS** (`gridTemplateColumns: "minmax(200px,240px) minmax(0,2fr)
 *      minmax(0,1fr)"` — nav lateral + columna principal de proyecto ancho +
 *      columna secundaria angosta de datos del proyecto). `normalizeGridColumns`
 *      lo clasifica como `{ kind: "columns", count: 3, symmetric: false }`:
 *      count distinto (3 vs. 2) es en sí mismo un rasgo distinto del helper.
 *   2. **`overrideBreakpoints` distinto**: A10 cambia de columna en `md`.
 *      A10b cambia en `lg` — el estudio necesita más ancho disponible antes
 *      de partir en 3 columnas que A10 en 2, así que el grid de 3 columnas
 *      solo aparece a partir de `lg`; en `md` sigue apilado (1 columna). El
 *      set de breakpoints con override en ese nodo difiere (`["lg"]` vs.
 *      `["md"]`).
 * Suma un tercer rasgo distinto de facto (no exigido por la regla de ≥2, pero
 * reforzando la distinción): la galería de proyectos destacados usa un
 * **grid FLUIDO asimétrico** (`repeat(auto-fit, minmax(280px, 1fr))` sobre
 * columnas de ancho VARIABLE por tarjeta vía `gridColumn: span N` — el
 * "grid asimétrico" pedido por la especificación de la fila 16, ausente en
 * `law-firm-page`, que no tiene ninguna banda con `gridColumns.kind ===
 * "fluid"`), y el hero es un grid de 2 columnas (copy + imagen real con
 * `parallax`), mientras que el hero de A10/`law-firm-page` es una banda de
 * color plano sin imagen ni behavior de scroll-fx (el componente `hero` no
 * acepta imagen de fondo por prop — su fondo es `appearance.background`,
 * ver `Hero.tsx` — así que el patrón para "hero con imagen + parallax" es
 * aplicar el behavior sobre un `container` con la imagen real como hijo,
 * dentro del hero, no sobre el hero en sí).
 *
 * Tema "Concrete" (gris/naranja, tipografía IBM Plex Sans — sans-serif
 * técnica y neutra en `display` y `sans`, coherente con planos y memoria
 * descriptiva; sin serif que evoque lo institucional de A10/Counsel).
 *
 * Showcase funcional: `scroll-spy` + `sticky` en el aside de navegación de
 * servicios (misma mecánica estructural que A10, aplicada a un contenido de
 * sector distinto), `parallax` en el hero, grid asimétrico (fluido + `span`)
 * en la galería de proyectos destacados.
 *
 * Anatomía: topbar (teléfono + language-nav) · navbar · hero con `parallax` ·
 * servicios (aside `sticky`+`scroll-spy` + 3 bandas ancladas: residencial,
 * corporativo, institucional) · proyectos destacados (grid asimétrico
 * fluido) · equipo (avatares) · proceso (`stat` numerado) · contacto (`form`)
 * · footer oscuro.
 *
 * Todos los ids con prefijo `archstudio-`.
 */

const SHADOW_CARD = "0 12px 32px rgba(30,30,28,0.1)";
const SHADOW_HOVER = "0 18px 40px rgba(30,30,28,0.18)";
const BAND_PADDING = "48px 20px";
const BAND_PADDING_MD = "96px 20px";
const INNER_MAX = "1160px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING, paddingMd: string = BAND_PADDING_MD): NodeStyle {
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

function serviceArea(
  n: 1 | 2 | 3,
  title: string,
  text: string,
  bg: StyleValue,
) {
  return {
    [`archstudio-service-${n}`]: {
      id: `archstudio-service-${n}`,
      type: "section",
      props: {},
      style: band(bg, "40px 20px", "72px 20px"),
      behaviors: REVEAL,
      children: [`archstudio-service-${n}-inner`],
    },
    [`archstudio-service-${n}-inner`]: {
      id: `archstudio-service-${n}-inner`,
      type: "container",
      props: {},
      style: inner("760px", "12px"),
      children: [`archstudio-service-${n}-title`, `archstudio-service-${n}-text`],
    },
    [`archstudio-service-${n}-title`]: {
      id: `archstudio-service-${n}-title`,
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
    [`archstudio-service-${n}-text`]: {
      id: `archstudio-service-${n}-text`,
      type: "text",
      props: { content: text },
      style: bodyText(),
    },
  };
}

function projectCard(
  n: 1 | 2 | 3 | 4 | 5,
  title: string,
  category: string,
  imageUrl: string,
  span: 1 | 2,
) {
  return {
    [`archstudio-project-${n}`]: {
      id: `archstudio-project-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "0" },
          size: { width: "100%" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            borderRadius: "4px",
            boxShadow: SHADOW_CARD,
          },
        },
        // Rasgo de "grid asimétrico" (docs/48 fila 16): las tarjetas ocupan
        // 1 o 2 columnas del grid fluido padre vía `gridColumn: span N` —
        // el ancho efectivo de cada tarjeta varía, no es un catálogo denso
        // uniforme (A4/`clothing-store-page`) ni un grid simétrico fijo.
        overrides: { lg: { layout: { gridColumn: `span ${span}` } } },
        states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
      },
      children: [`archstudio-project-${n}-image`, `archstudio-project-${n}-body`],
    },
    [`archstudio-project-${n}-image`]: {
      id: `archstudio-project-${n}-image`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt: `Proyecto ${title}`, objectFit: "cover" },
      style: { base: { size: { width: "100%", height: "220px" } }, overrides: { lg: { size: { height: span === 2 ? "320px" : "220px" } } } },
    },
    [`archstudio-project-${n}-body`]: {
      id: `archstudio-project-${n}-body`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "4px" }, spacing: { padding: "16px 20px 20px" } } },
      children: [`archstudio-project-${n}-category`, `archstudio-project-${n}-title`],
    },
    [`archstudio-project-${n}-category`]: {
      id: `archstudio-project-${n}-category`,
      type: "text",
      props: { content: category },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
    [`archstudio-project-${n}-title`]: {
      id: `archstudio-project-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.25rem", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
  };
}

function teamCard(n: 1 | 2 | 3, name: string, role: string, imageUrl: string, initials: string) {
  return {
    [`archstudio-team-${n}`]: {
      id: `archstudio-team-${n}`,
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
            borderRadius: "4px",
            boxShadow: SHADOW_CARD,
          },
        },
        overrides: { md: { spacing: { padding: "28px" } } },
        states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
      },
      children: [`archstudio-team-${n}-avatar`, `archstudio-team-${n}-name`, `archstudio-team-${n}-role`],
    },
    [`archstudio-team-${n}-avatar`]: {
      id: `archstudio-team-${n}-avatar`,
      type: "avatar",
      props: { source: { kind: "url", url: imageUrl }, alt: `Retrato de ${name}`, initials },
      style: { base: { size: { width: "88px", height: "88px" } } },
    },
    [`archstudio-team-${n}-name`]: {
      id: `archstudio-team-${n}-name`,
      type: "text",
      props: { content: `<strong>${name}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`archstudio-team-${n}-role`]: {
      id: `archstudio-team-${n}-role`,
      type: "text",
      props: { content: role },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function processStep(n: 1 | 2 | 3, value: string, label: string) {
  return statFragment(`archstudio-process-${n}`, { value, label }, { base: { typography: { textAlign: "center" } } });
}

export function buildArchitectureStudioPageFragment(): NodeFragment {
  return {
    rootId: "archstudio-root",
    nodes: {
      "archstudio-root": {
        id: "archstudio-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "archstudio-topbar",
          "archstudio-navbar",
          "archstudio-hero",
          "archstudio-services",
          "archstudio-projects",
          "archstudio-team",
          "archstudio-process",
          "archstudio-contact",
          "archstudio-footer",
        ],
      },

      // --- Topbar: teléfono + language-nav ------------------------------------
      "archstudio-topbar": {
        id: "archstudio-topbar",
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
        children: ["archstudio-topbar-phone", "archstudio-topbar-lang"],
      },
      "archstudio-topbar-phone": {
        id: "archstudio-topbar-phone",
        type: "text",
        props: { content: "Estudio: +54 11 4789 2233" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "archstudio-topbar-lang": {
        id: "archstudio-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        style: defaultStyleFor("language-nav"),
      },

      // --- Navbar ---------------------------------------------------------------
      "archstudio-navbar": {
        id: "archstudio-navbar",
        type: "navbar",
        props: { brand: "Umbral Arquitectos", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero: banda oscura de texto + columna de imagen con `parallax` ------
      // (el componente `hero` no acepta imagen de fondo — su fondo es
      // `appearance.background`, color/token, docs `Hero.tsx`; el patrón
      // probado de A8/A8b para "imagen con parallax" es aplicar el behavior
      // sobre el CONTENEDOR de la imagen real, no sobre el hero en sí, ver
      // `creativeAgencyPage.ts`/`barbershopPage.ts`).
      "archstudio-hero": {
        id: "archstudio-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "0" },
            spacing: { padding: "0" },
            size: { width: "100%", minHeight: "480px" },
            typography: { fontFamily: { token: "typography.families.display" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }, size: { minHeight: "560px" } } },
        },
        children: ["archstudio-hero-copy", "archstudio-hero-media"],
      },
      "archstudio-hero-copy": {
        id: "archstudio-hero-copy",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "16px" },
            spacing: { padding: "48px 20px" },
          },
          overrides: { md: { spacing: { padding: "96px 48px" } } },
        },
        children: ["archstudio-hero-badge", "archstudio-hero-title", "archstudio-hero-sub", "archstudio-hero-cta"],
      },
      // Columna de imagen real del estudio con `parallax` (showcase funcional
      // de la fila 16). `overflow:hidden` es necesario para que el desplazamiento
      // del parallax no desborde la banda — mismo criterio que un behavior que
      // recorta contenido hidratado (AGENTS.md §5, `clipsContentWhenActive`);
      // como aquí el "contenido recortado" es una única imagen decorativa (no
      // hijos seleccionables/arrastrables), no aplica el mecanismo de
      // `suppressClip` — no hay nada dentro que el usuario necesite alcanzar
      // en modo Edit.
      "archstudio-hero-media": {
        id: "archstudio-hero-media",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { overflowX: "hidden", overflowY: "hidden" },
            size: { width: "100%", minHeight: "260px" },
          },
          overrides: { md: { size: { minHeight: "auto" } } },
        },
        behaviors: [{ type: "parallax", options: { speed: 0.3, fallback: true } }],
        children: ["archstudio-hero-image"],
      },
      "archstudio-hero-image": {
        id: "archstudio-hero-image",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80&auto=format&fit=crop" },
          alt: "Fachada de un edificio contemporáneo diseñado por Umbral Arquitectos",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%", height: "100%" } } },
      },
      "archstudio-hero-badge": {
        id: "archstudio-hero-badge",
        type: "badge",
        props: { label: "22 años proyectando espacios" },
        style: darkBandStyleFor("badge"),
      },
      "archstudio-hero-title": {
        id: "archstudio-hero-title",
        type: "text",
        props: { content: "<strong>Arquitectura con criterio, a escala humana</strong>" },
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
      "archstudio-hero-sub": {
        id: "archstudio-hero-sub",
        type: "text",
        props: {
          content: "Diseñamos proyectos residenciales, corporativos e institucionales que responden al lugar, al presupuesto y a cómo se va a vivir el espacio.",
        },
        style: {
          base: {
            size: { maxWidth: "50ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "archstudio-hero-cta": {
        id: "archstudio-hero-cta",
        type: "button",
        props: { label: "Agendar una reunión", link: { kind: "anchor", nodeId: "archstudio-contact" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "4px",
              boxShadow: "0 12px 32px rgba(30,30,28,0.32)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(30,30,28,0.4)" } } },
        },
      },

      // --- Servicios: A10b (aside nav sticky+scroll-spy, grid de 3 col asimétricas) ---
      "archstudio-services": {
        id: "archstudio-services",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }, "0"),
        children: ["archstudio-services-inner"],
      },
      "archstudio-services-inner": {
        id: "archstudio-services-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "0" },
            size: { width: "100%", maxWidth: INNER_MAX },
            spacing: { margin: "0 auto" },
          },
          // Rasgo distintivo #1 de A10b vs A10: 3 columnas asimétricas (nav +
          // contenido principal ancho + columna secundaria angosta), no 2.
          // Rasgo distintivo #2: el switch ocurre en `lg`, no en `md` — sigue
          // apilado en `md` (el estudio necesita más espacio horizontal antes
          // de partir en 3 columnas que A10 en 2).
          overrides: { lg: { layout: { gridTemplateColumns: "minmax(200px, 240px) minmax(0, 2fr) minmax(0, 1fr)" } } },
        },
        children: ["archstudio-services-nav", "archstudio-services-main", "archstudio-services-side"],
      },
      // Aside de NAVEGACIÓN (misma mecánica estructural que A10: `sticky` +
      // `scroll-spy` gobiernan la lectura de las bandas ancladas). Firma de
      // A10b: 3ra columna adicional (`services-side`) hace que este NO sea
      // el par simétrico de 2 columnas que mide A10.
      "archstudio-services-nav": {
        id: "archstudio-services-nav",
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
          "archstudio-services-nav-title",
          "archstudio-services-nav-1",
          "archstudio-services-nav-2",
          "archstudio-services-nav-3",
        ],
      },
      "archstudio-services-nav-title": {
        id: "archstudio-services-nav-title",
        type: "text",
        props: { content: "<strong>Servicios</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.125rem", fontWeight: { token: "typography.weights.bold" } },
            spacing: { margin: "0 0 8px" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      ...(["archstudio-service-1", "archstudio-service-2", "archstudio-service-3"] as const).reduce(
        (acc, targetId, i) => {
          const n = i + 1;
          const labels = ["Residencial", "Corporativo", "Institucional"];
          acc[`archstudio-services-nav-${n}`] = {
            id: `archstudio-services-nav-${n}`,
            type: "button",
            props: { label: labels[i], link: { kind: "anchor", nodeId: targetId } },
            style: {
              base: {
                layout: { display: "inline-block" },
                spacing: { padding: "14px 22px" },
                typography: { fontFamily: { token: "typography.families.sans" }, textDecoration: "none" },
                appearance: { background: "transparent", color: { token: "colors.muted" }, borderRadius: "4px", cursor: "pointer" },
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
      "archstudio-services-main": {
        id: "archstudio-services-main",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: "0" } } },
        children: ["archstudio-service-1", "archstudio-service-2", "archstudio-service-3"],
      },
      // Columna secundaria angosta — dato de contacto rápido, no navegación
      // (distingue el rol de esta 3ra columna del nav de la 1ra).
      "archstudio-services-side": {
        id: "archstudio-services-side",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        children: ["archstudio-services-side-title", "archstudio-services-side-text"],
      },
      "archstudio-services-side-title": {
        id: "archstudio-services-side-title",
        type: "text",
        props: { content: "<strong>¿No sabes por dónde empezar?</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.125rem", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "archstudio-services-side-text": {
        id: "archstudio-services-side-text",
        type: "text",
        props: { content: "Una primera reunión de diagnóstico, sin costo, para entender el alcance de tu proyecto." },
        style: bodyText(undefined, "32ch"),
      },
      ...serviceArea(
        1,
        "Arquitectura residencial",
        "Casas y ampliaciones que parten del terreno y del modo de vida de quien las habita, no de un catálogo de planos repetidos.",
        { token: "colors.surface.default" },
      ),
      ...serviceArea(
        2,
        "Arquitectura corporativa",
        "Oficinas y locales comerciales que equilibran identidad de marca, eficiencia operativa y normativa vigente.",
        { token: "colors.surface.alt" },
      ),
      ...serviceArea(
        3,
        "Arquitectura institucional",
        "Equipamiento educativo, cultural y de salud, con procesos de gestión de permisos y licitación acompañados de punta a punta.",
        { token: "colors.surface.default" },
      ),

      // --- Proyectos destacados — grid asimétrico fluido (docs/48 fila 16) -----
      "archstudio-projects": {
        id: "archstudio-projects",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["archstudio-projects-inner"],
      },
      "archstudio-projects-inner": {
        id: "archstudio-projects-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["archstudio-projects-title", "archstudio-projects-grid"],
      },
      "archstudio-projects-title": {
        id: "archstudio-projects-title",
        type: "text",
        props: { content: "<strong>Proyectos destacados</strong>" },
        style: sectionTitle(),
      },
      "archstudio-projects-grid": {
        id: "archstudio-projects-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          // Grid FLUIDO (no simétrico de conteo fijo como A4/catálogo denso):
          // cada tarjeta declara su propio `gridColumn: span N` en `lg`, así
          // que el ancho resultante por tarjeta varía (1 o 2 "celdas" de
          // ~280px) — el "grid asimétrico" pedido por la especificación.
          overrides: { lg: { layout: { gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" } } },
        },
        children: [
          "archstudio-project-1",
          "archstudio-project-2",
          "archstudio-project-3",
          "archstudio-project-4",
          "archstudio-project-5",
        ],
      },
      ...projectCard(
        1,
        "Casa Tilo",
        "Residencial · Buenos Aires",
        "https://images.unsplash.com/photo-1524230572899-a752b3835840?w=900&q=80&auto=format&fit=crop",
        2,
      ),
      ...projectCard(
        2,
        "Oficinas Nortex",
        "Corporativo · Rosario",
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&q=80&auto=format&fit=crop",
        1,
      ),
      ...projectCard(
        3,
        "Biblioteca del Puerto",
        "Institucional · Mar del Plata",
        "https://images.unsplash.com/photo-1460574283810-2aab119d8511?w=900&q=80&auto=format&fit=crop",
        1,
      ),
      ...projectCard(
        4,
        "Torre Vidrio",
        "Corporativo · Córdoba",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&q=80&auto=format&fit=crop",
        1,
      ),
      ...projectCard(
        5,
        "Centro Cultural Andén",
        "Institucional · Buenos Aires",
        "https://images.unsplash.com/photo-1481253127861-534498168948?w=900&q=80&auto=format&fit=crop",
        1,
      ),

      // --- Equipo — banda clara ---------------------------------------------------
      "archstudio-team": {
        id: "archstudio-team",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["archstudio-team-inner"],
      },
      "archstudio-team-inner": {
        id: "archstudio-team-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["archstudio-team-title", "archstudio-team-grid"],
      },
      "archstudio-team-title": {
        id: "archstudio-team-title",
        type: "text",
        props: { content: "<strong>El equipo</strong>" },
        style: sectionTitle(),
      },
      "archstudio-team-grid": {
        id: "archstudio-team-grid",
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
        children: ["archstudio-team-1", "archstudio-team-2", "archstudio-team-3"],
      },
      ...teamCard(
        1,
        "Arq. Valentina Riesco",
        "Socia fundadora · Directora de proyecto",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=200&q=80&auto=format&fit=crop",
        "VR",
      ),
      ...teamCard(
        2,
        "Arq. Martín Aldao",
        "Socio · Arquitectura corporativa",
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80&auto=format&fit=crop",
        "MA",
      ),
      ...teamCard(
        3,
        "Arq. Delia Nkomo",
        "Directora técnica · Gestión de obra",
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80&auto=format&fit=crop",
        "DN",
      ),

      // --- Proceso — 3 pasos numerados, banda con degradado ---------------------
      "archstudio-process": {
        id: "archstudio-process",
        type: "section",
        props: {},
        style: {
          ...band("linear-gradient(135deg, var(--colors-surface-alt), var(--colors-surface-default))"),
          overrides: { md: { spacing: { padding: "112px 20px" } } },
        },
        behaviors: REVEAL,
        children: ["archstudio-process-inner"],
      },
      "archstudio-process-inner": {
        id: "archstudio-process-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["archstudio-process-title", "archstudio-process-grid"],
      },
      "archstudio-process-title": {
        id: "archstudio-process-title",
        type: "text",
        props: { content: "<strong>Cómo trabajamos tu proyecto</strong>" },
        style: sectionTitle(),
      },
      "archstudio-process-grid": {
        id: "archstudio-process-grid",
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
        children: ["archstudio-process-1", "archstudio-process-2", "archstudio-process-3"],
      },
      ...processStep(1, "1", "Reunión de diagnóstico y relevamiento del terreno o local"),
      ...processStep(2, "2", "Anteproyecto y presupuesto de obra, con hasta 2 rondas de ajuste"),
      ...processStep(3, "3", "Gestión de permisos y acompañamiento durante toda la obra"),

      // --- Contacto — banda alt ---------------------------------------------------
      "archstudio-contact": {
        id: "archstudio-contact",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["archstudio-contact-inner"],
      },
      "archstudio-contact-inner": {
        id: "archstudio-contact-inner",
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
        children: ["archstudio-contact-info", "archstudio-contact-card"],
      },
      "archstudio-contact-info": {
        id: "archstudio-contact-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["archstudio-contact-title", "archstudio-contact-sub"],
      },
      "archstudio-contact-title": {
        id: "archstudio-contact-title",
        type: "text",
        props: { content: "<strong>Contanos tu proyecto</strong>" },
        style: sectionTitle(),
      },
      "archstudio-contact-sub": {
        id: "archstudio-contact-sub",
        type: "text",
        props: { content: "Describe brevemente el terreno o local, la superficie aproximada y el uso que buscas darle. Te respondemos en menos de 48 horas." },
        style: bodyText(),
      },
      "archstudio-contact-card": {
        id: "archstudio-contact-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: { background: { token: "colors.surface.default" }, borderRadius: "4px", boxShadow: SHADOW_CARD },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        children: ["archstudio-form"],
      },
      "archstudio-form": {
        id: "archstudio-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["archstudio-field-name", "archstudio-field-email", "archstudio-field-type", "archstudio-field-message", "archstudio-submit"],
      },
      "archstudio-field-name": {
        id: "archstudio-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["archstudio-label-name", "archstudio-input-name"],
      },
      "archstudio-label-name": {
        id: "archstudio-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "archstudio-input-name" },
        style: defaultStyleFor("label"),
      },
      "archstudio-input-name": {
        id: "archstudio-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "archstudio-field-email": {
        id: "archstudio-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["archstudio-label-email", "archstudio-input-email"],
      },
      "archstudio-label-email": {
        id: "archstudio-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "archstudio-input-email" },
        style: defaultStyleFor("label"),
      },
      "archstudio-input-email": {
        id: "archstudio-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "archstudio-field-type": {
        id: "archstudio-field-type",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["archstudio-label-type", "archstudio-select-type"],
      },
      "archstudio-label-type": {
        id: "archstudio-label-type",
        type: "label",
        props: { text: "Tipo de proyecto", for: "archstudio-select-type" },
        style: defaultStyleFor("label"),
      },
      "archstudio-select-type": {
        id: "archstudio-select-type",
        type: "select",
        props: {
          name: "tipo",
          placeholder: "Elige una opción…",
          ariaLabel: "Tipo de proyecto",
          options: [
            { label: "Residencial", value: "residencial" },
            { label: "Corporativo", value: "corporativo" },
            { label: "Institucional", value: "institucional" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "archstudio-field-message": {
        id: "archstudio-field-message",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["archstudio-label-message", "archstudio-textarea-message"],
      },
      "archstudio-label-message": {
        id: "archstudio-label-message",
        type: "label",
        props: { text: "Contanos brevemente tu proyecto", for: "archstudio-textarea-message" },
        style: defaultStyleFor("label"),
      },
      "archstudio-textarea-message": {
        id: "archstudio-textarea-message",
        type: "textarea",
        props: { name: "mensaje", placeholder: "Ej. Terreno de 300m² en zona residencial, busco una vivienda de 2 plantas…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "archstudio-submit": {
        id: "archstudio-submit",
        type: "button-submit",
        props: { label: "Enviar consulta", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "4px",
              boxShadow: "0 12px 32px rgba(30,30,28,0.2)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(30,30,28,0.28)" } } },
        },
      },

      // --- Footer — banda oscura ---------------------------------------------------
      "archstudio-footer": {
        id: "archstudio-footer",
        type: "footer",
        props: { copyright: "© 2026 Umbral Arquitectos. Todos los derechos reservados." },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "64px 40px" } } },
        },
        children: ["archstudio-footer-address", "archstudio-footer-hours", "archstudio-footer-social"],
      },
      "archstudio-footer-address": {
        id: "archstudio-footer-address",
        type: "text",
        props: { content: "Av. Del Libertador 4820, Piso 3, Buenos Aires" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "archstudio-footer-hours": {
        id: "archstudio-footer-hours",
        type: "text",
        props: { content: "Lunes a viernes 9:00–18:00" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "archstudio-footer-social": {
        id: "archstudio-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["archstudio-topbar-phone"] = {
        en: { content: "Studio: +54 11 4789 2233" },
        it: { content: "Studio: +54 11 4789 2233" },
      };
      t["archstudio-hero-badge"] = { en: { label: "22 years designing spaces" }, it: { label: "22 anni a progettare spazi" } };
      t["archstudio-hero-title"] = {
        en: { content: "<strong>Architecture with judgment, at human scale</strong>" },
        it: { content: "<strong>Architettura con criterio, a misura d'uomo</strong>" },
      };
      t["archstudio-hero-sub"] = {
        en: {
          content: "We design residential, corporate and institutional projects that respond to the site, the budget and how the space will actually be lived in.",
        },
        it: {
          content: "Progettiamo interventi residenziali, aziendali e istituzionali che rispondono al luogo, al budget e a come lo spazio verrà davvero vissuto.",
        },
      };
      t["archstudio-hero-cta"] = { en: { label: "Schedule a meeting" }, it: { label: "Prenota un incontro" } };
      t["archstudio-hero-image"] = {
        en: { alt: "Façade of a contemporary building designed by Umbral Arquitectos" },
        it: { alt: "Facciata di un edificio contemporaneo progettato da Umbral Arquitectos" },
      };

      t["archstudio-services-nav-title"] = { en: { content: "<strong>Services</strong>" }, it: { content: "<strong>Servizi</strong>" } };
      t["archstudio-services-nav-1"] = { en: { label: "Residential" }, it: { label: "Residenziale" } };
      t["archstudio-services-nav-2"] = { en: { label: "Corporate" }, it: { label: "Aziendale" } };
      t["archstudio-services-nav-3"] = { en: { label: "Institutional" }, it: { label: "Istituzionale" } };

      t["archstudio-services-side-title"] = { en: { content: "<strong>Not sure where to start?</strong>" }, it: { content: "<strong>Non sai da dove iniziare?</strong>" } };
      t["archstudio-services-side-text"] = {
        en: { content: "A free first diagnostic meeting, to understand the scope of your project." },
        it: { content: "Un primo incontro diagnostico gratuito, per capire la portata del tuo progetto." },
      };

      t["archstudio-service-1-title"] = { en: { content: "<strong>Residential architecture</strong>" }, it: { content: "<strong>Architettura residenziale</strong>" } };
      t["archstudio-service-1-text"] = {
        en: { content: "Homes and extensions that start from the site and the way their future occupants actually live, not from a catalog of repeated floor plans." },
        it: { content: "Case e ampliamenti che partono dal terreno e dallo stile di vita di chi li abiterà, non da un catalogo di planimetrie ripetute." },
      };
      t["archstudio-service-2-title"] = { en: { content: "<strong>Corporate architecture</strong>" }, it: { content: "<strong>Architettura aziendale</strong>" } };
      t["archstudio-service-2-text"] = {
        en: { content: "Offices and retail spaces that balance brand identity, operational efficiency and current regulations." },
        it: { content: "Uffici e spazi commerciali che bilanciano identità di marca, efficienza operativa e normative vigenti." },
      };
      t["archstudio-service-3-title"] = { en: { content: "<strong>Institutional architecture</strong>" }, it: { content: "<strong>Architettura istituzionale</strong>" } };
      t["archstudio-service-3-text"] = {
        en: { content: "Educational, cultural and healthcare facilities, with permit management and bidding processes supported end to end." },
        it: { content: "Strutture educative, culturali e sanitarie, con gestione di permessi e gare d'appalto seguite dall'inizio alla fine." },
      };

      t["archstudio-projects-title"] = { en: { content: "<strong>Featured projects</strong>" }, it: { content: "<strong>Progetti in evidenza</strong>" } };
      t["archstudio-project-1-category"] = { en: { content: "Residential · Buenos Aires" }, it: { content: "Residenziale · Buenos Aires" } };
      t["archstudio-project-1-title"] = { en: { content: "<strong>Tilo House</strong>" }, it: { content: "<strong>Casa Tilo</strong>" } };
      t["archstudio-project-1-image"] = { en: { alt: "Project Tilo House" }, it: { alt: "Progetto Casa Tilo" } };
      t["archstudio-project-2-category"] = { en: { content: "Corporate · Rosario" }, it: { content: "Aziendale · Rosario" } };
      t["archstudio-project-2-title"] = { en: { content: "<strong>Nortex Offices</strong>" }, it: { content: "<strong>Uffici Nortex</strong>" } };
      t["archstudio-project-2-image"] = { en: { alt: "Project Nortex Offices" }, it: { alt: "Progetto Uffici Nortex" } };
      t["archstudio-project-3-category"] = { en: { content: "Institutional · Mar del Plata" }, it: { content: "Istituzionale · Mar del Plata" } };
      t["archstudio-project-3-title"] = { en: { content: "<strong>Port Library</strong>" }, it: { content: "<strong>Biblioteca del Porto</strong>" } };
      t["archstudio-project-3-image"] = { en: { alt: "Project Port Library" }, it: { alt: "Progetto Biblioteca del Porto" } };
      t["archstudio-project-4-category"] = { en: { content: "Corporate · Córdoba" }, it: { content: "Aziendale · Córdoba" } };
      t["archstudio-project-4-title"] = { en: { content: "<strong>Glass Tower</strong>" }, it: { content: "<strong>Torre di Vetro</strong>" } };
      t["archstudio-project-4-image"] = { en: { alt: "Project Glass Tower" }, it: { alt: "Progetto Torre di Vetro" } };
      t["archstudio-project-5-category"] = { en: { content: "Institutional · Buenos Aires" }, it: { content: "Istituzionale · Buenos Aires" } };
      t["archstudio-project-5-title"] = { en: { content: "<strong>Pier Cultural Center</strong>" }, it: { content: "<strong>Centro Culturale Molo</strong>" } };
      t["archstudio-project-5-image"] = { en: { alt: "Project Pier Cultural Center" }, it: { alt: "Progetto Centro Culturale Molo" } };

      t["archstudio-team-title"] = { en: { content: "<strong>The team</strong>" }, it: { content: "<strong>Il team</strong>" } };
      t["archstudio-team-1-avatar"] = { en: { alt: "Portrait of Valentina Riesco" }, it: { alt: "Ritratto di Valentina Riesco" } };
      t["archstudio-team-1-name"] = { en: { content: "<strong>Valentina Riesco</strong>" }, it: { content: "<strong>Valentina Riesco</strong>" } };
      t["archstudio-team-1-role"] = { en: { content: "Founding partner · Design director" }, it: { content: "Partner fondatrice · Direttrice di progetto" } };
      t["archstudio-team-2-avatar"] = { en: { alt: "Portrait of Martín Aldao" }, it: { alt: "Ritratto di Martín Aldao" } };
      t["archstudio-team-2-name"] = { en: { content: "<strong>Martín Aldao</strong>" }, it: { content: "<strong>Martín Aldao</strong>" } };
      t["archstudio-team-2-role"] = { en: { content: "Partner · Corporate architecture" }, it: { content: "Partner · Architettura aziendale" } };
      t["archstudio-team-3-avatar"] = { en: { alt: "Portrait of Delia Nkomo" }, it: { alt: "Ritratto di Delia Nkomo" } };
      t["archstudio-team-3-name"] = { en: { content: "<strong>Delia Nkomo</strong>" }, it: { content: "<strong>Delia Nkomo</strong>" } };
      t["archstudio-team-3-role"] = { en: { content: "Technical director · Construction management" }, it: { content: "Direttrice tecnica · Gestione dei lavori" } };

      t["archstudio-process-title"] = { en: { content: "<strong>How we handle your project</strong>" }, it: { content: "<strong>Come gestiamo il tuo progetto</strong>" } };
      t["archstudio-process-1-value"] = { en: { value: "1" }, it: { value: "1" } };
      t["archstudio-process-1-label"] = { en: { content: "Diagnostic meeting and site or space survey" }, it: { content: "Incontro diagnostico e rilievo del terreno o del locale" } };
      t["archstudio-process-2-value"] = { en: { value: "2" }, it: { value: "2" } };
      t["archstudio-process-2-label"] = { en: { content: "Preliminary design and construction budget, up to 2 revision rounds" }, it: { content: "Progetto preliminare e preventivo dei lavori, fino a 2 revisioni" } };
      t["archstudio-process-3-value"] = { en: { value: "3" }, it: { value: "3" } };
      t["archstudio-process-3-label"] = { en: { content: "Permit management and support throughout construction" }, it: { content: "Gestione dei permessi e supporto durante tutti i lavori" } };

      t["archstudio-contact-title"] = { en: { content: "<strong>Tell us about your project</strong>" }, it: { content: "<strong>Raccontaci il tuo progetto</strong>" } };
      t["archstudio-contact-sub"] = {
        en: { content: "Briefly describe the site or space, the approximate area and the intended use. We respond within 48 hours." },
        it: { content: "Descrivi brevemente il terreno o il locale, la superficie approssimativa e l'uso previsto. Rispondiamo entro 48 ore." },
      };
      t["archstudio-label-name"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["archstudio-input-name"] = { en: { placeholder: "Your full name" }, it: { placeholder: "Il tuo nome completo" } };
      t["archstudio-label-email"] = { en: { text: "Email" }, it: { text: "Email" } };
      t["archstudio-input-email"] = { en: { placeholder: "you@email.com" }, it: { placeholder: "tu@email.com" } };
      t["archstudio-label-type"] = { en: { text: "Project type" }, it: { text: "Tipo di progetto" } };
      t["archstudio-select-type"] = {
        en: {
          placeholder: "Choose an option…",
          ariaLabel: "Project type",
          options: [
            { label: "Residential", value: "residencial" },
            { label: "Corporate", value: "corporativo" },
            { label: "Institutional", value: "institucional" },
          ],
        },
        it: {
          placeholder: "Scegli un'opzione…",
          ariaLabel: "Tipo di progetto",
          options: [
            { label: "Residenziale", value: "residencial" },
            { label: "Aziendale", value: "corporativo" },
            { label: "Istituzionale", value: "institucional" },
          ],
        },
      };
      t["archstudio-label-message"] = { en: { text: "Briefly tell us about your project" }, it: { text: "Raccontaci brevemente il tuo progetto" } };
      t["archstudio-textarea-message"] = {
        en: { placeholder: "E.g. 300m² lot in a residential area, looking for a 2-story home…" },
        it: { placeholder: "Es. Terreno di 300m² in zona residenziale, cerco una casa a 2 piani…" },
      };
      t["archstudio-submit"] = { en: { label: "Send inquiry" }, it: { label: "Invia richiesta" } };

      t["archstudio-footer"] = {
        en: { copyright: "© 2026 Umbral Architects. All rights reserved." },
        it: { copyright: "© 2026 Umbral Architetti. Tutti i diritti riservati." },
      };
      t["archstudio-footer-address"] = {
        en: { content: "4820 Del Libertador Ave, 3rd Floor, Buenos Aires" },
        it: { content: "Av. Del Libertador 4820, 3° Piano, Buenos Aires" },
      };
      t["archstudio-footer-hours"] = { en: { content: "Monday to Friday 9:00 AM–6:00 PM" }, it: { content: "Lunedì-venerdì 9:00–18:00" } };

      return t;
    })(),
  };
}

export const architectureStudioPageMeta: LayoutPageMeta = {
  title: "Umbral Arquitectos · Estudio de arquitectura y urbanismo",
  description:
    "Estudio de arquitectura con 22 años de trayectoria en proyectos residenciales, corporativos e institucionales.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Umbral Arquitectos",
      description: "Arquitectura con criterio, a escala humana. Agenda una reunión.",
      image: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Umbral Arquitectos",
      description: "Arquitectura con criterio, a escala humana. Agenda una reunión.",
      image: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Umbral Architects · Architecture and urban design studio",
      description: "Architecture studio with 22 years of experience in residential, corporate and institutional projects.",
      seo: {
        openGraph: { title: "Umbral Architects", description: "Architecture with judgment, at human scale. Schedule a meeting." },
        twitter: { title: "Umbral Architects", description: "Architecture with judgment, at human scale. Schedule a meeting." },
      },
    },
    it: {
      title: "Umbral Architetti · Studio di architettura e urbanistica",
      description: "Studio di architettura con 22 anni di esperienza in progetti residenziali, aziendali e istituzionali.",
      seo: {
        openGraph: { title: "Umbral Architetti", description: "Architettura con criterio, a misura d'uomo. Prenota un incontro." },
        twitter: { title: "Umbral Architetti", description: "Architettura con criterio, a misura d'uomo. Prenota un incontro." },
      },
    },
  },
};
