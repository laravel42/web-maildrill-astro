import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { getStylePresetDefinition } from "../../stylePresetRegistry";
import { mergeLayer } from "../../../model/style";
import { NAVBAR_BRAND_STYLE } from "../../components/Navbar";
import { darkBandStyleFor, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Pizzería" — plantilla de página completa, **solo inglés** (encargo:
 * foco 100% visual, sin las 3 traducciones de las demás plantillas de negocio
 * real — no lleva bloque `translations` ni `metaTranslations`).
 *
 * Referencia visual: una pizzería casual de horno de leña, en el mismo
 * espíritu "landing con UI rica" que las plantillas de fast-casual del
 * mercado (carruseles reales, overlays de foto, feed social en loop,
 * reviews en video) — sube el techo de detalle por encima de `restaurant-
 * page` (Casa Almendro, fine dining) apoyándose en piezas del registry que
 * esa plantilla no usa: `carousel` (Embla) como eje de dos secciones,
 * `lightbox` en la galería, `logo-cloud` + `marquee` para el feed social, y
 * `video` dentro de un `testimonial` para las reseñas.
 *
 * Anatomía (bandas full-bleed, cada una con su `inner` centrado):
 *   navbar de chips sobre papel rayado · hero en TRES bandas (titular en
 *   minúsculas sobre el papel · foto full-bleed con las pegatinas encima ·
 *   segunda línea serif + CTA y teléfono) ·
 *   pizzas más vendidas (grid con foto+precio) · proceso del horno de leña
 *   en `carousel` horizontal · especiales del mes en `carousel` de tarjetas
 *   verticales foto+leyenda debajo · reseñas en video (`carousel` de
 *   `testimonial` con
 *   `video` en vez de avatar+cita) · feed social en loop (`logo-cloud` +
 *   `marquee`) · blog/noticias (3 `card`) · FAQ (`accordion`) · pedido/
 *   reserva (formulario) · footer oscuro en 3 columnas.
 *
 * Detalles que existen a propósito para demostrar el builder:
 *   - `sticker` + behavior `sticker-drag` en el hero (arrastrable por el
 *     visitante final, tier 1 real).
 *   - `carousel` (Embla) como eje estructural de DOS secciones distintas
 *     (proceso y especiales), cada una con `slideSize`/`gap` propios.
 *   - `lightbox` en cada foto de la galería del proceso.
 *   - `logo-cloud` + `marquee` reutilizado con fotos cuadradas (no logos)
 *     para el feed social en loop infinito, sin runtime obligatorio (tier 0).
 *   - `testimonial` composite con un `video` como hijo en vez de
 *     avatar+texto — reseñas en video real (YouTube/Vimeo embed).
 *   - tarjetas verticales foto+leyenda (leyenda debajo, no superpuesta) en
 *     cada slide de "especiales del mes".
 *   - `pageMeta` (abajo): `<head>` SEO listo, solo en inglés.
 */

// --- Vocabulario visual compartido (mismo lenguaje que restaurantPage) ----

// The reference has no blurred drop shadows on its cards; `SHADOW_FLOAT` is kept
// only for the one thing that genuinely floats over a photo — the hero sticker.
const SHADOW_CARD = "none";
const SHADOW_HOVER = "none";
const SHADOW_FLOAT = "0 28px 64px rgba(15,23,42,0.22)";
const BAND_PADDING = "56px 20px";
const BAND_PADDING_MD = "112px 20px";
const INNER_MAX = "1200px";
const ACCENT_GRADIENT = "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

// Two textured-band devices (reference: ruled hairlines on one band, a fine dot
// grid on the next, alternating down the page, alpha capped at 0.10 so it reads
// as paper grain rather than a pattern). Layered *over* the band's flat colour —
// `background` takes the full CSS shorthand, so the texture is just another
// layer stacked before the solid token, same trick the hero already uses with
// its two gradients over a `url()`.
const TEXTURE_RULED = "repeating-linear-gradient(90deg, rgba(36,18,8,0.08) 0px, rgba(36,18,8,0.08) 1px, transparent 1px, transparent 56px)";
const TEXTURE_DOTS = "radial-gradient(circle at 1px 1px, rgba(36,18,8,0.10) 1px, transparent 1.6px) 0 0/24px 24px";

/**
 * The reference's signature paper: a 1px vertical rule every 44px in the accent
 * at 20% alpha, running behind the header and both halves of the hero (measured
 * off the reference — `repeating-linear-gradient(90deg, oklch(0.47 0.19 27 /
 * 0.2) 0 1px, transparent 1px 44px)`). Literal rgba rather than a token because
 * a token cannot carry alpha; the colour is `colors.primary.default` (#b3311c)
 * of the `forno` theme, and `CHIP_BORDER` is the same idea for the pill
 * outlines, at 22% so a hairline still reads over a photo.
 */
const TEXTURE_PINSTRIPE = "repeating-linear-gradient(90deg, rgba(179,49,28,0.20) 0px, rgba(179,49,28,0.20) 1px, transparent 1px, transparent 44px)";
const CHIP_BORDER = "rgba(179,49,28,0.22)";

/** Full-bleed band: own background + vertical rhythm. `texture` layers a subtle
 * ruled/dot device over the flat colour (reference §5) — omit it for the dark
 * bands and the accent band, which stay flat. Textured callers pass the
 * background as the `var(--colors-*)` CSS string (same convention the accent
 * band already uses below) so the texture can be prepended as another
 * `background` layer; untextured callers keep passing a token object. */
function band(
  background: StyleValue,
  padding: string = BAND_PADDING,
  paddingMd: string = BAND_PADDING_MD,
  texture?: "ruled" | "dots",
): NodeStyle {
  const resolvedBackground: StyleValue =
    texture === "ruled"
      ? `${TEXTURE_RULED}, ${background as string}`
      : texture === "dots"
        ? `${TEXTURE_DOTS}, ${background as string}`
        : background;
  return {
    base: { spacing: { padding }, appearance: { background: resolvedBackground } },
    overrides: { md: { spacing: { padding: paddingMd } } },
  };
}

/** Inner wrapper of a band: centers and caps the width. */
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

/**
 * F27 (T6-T8): la receta de la etiqueta (sans 0.75rem, bold, uppercase,
 * tracking 0.16em) ahora vive en `eyebrow-on-light`/`eyebrow-on-dark` de
 * `stylePresetRegistry.ts`, reachable desde el Inspector por cualquier nodo
 * `text`. Este helper es un thin wrapper: elige la entrada según el color
 * pedido — los dos únicos valores que esta plantilla usó en toda su vida
 * (`colors.primary.default` sobre papel claro, `colors.surface.alt` sobre la
 * banda oscura del proceso) — y lee su `style(node)`. Un color arbitrario
 * fuera de esos dos cae al preset "on-light" con el color reemplazado a mano
 * (mismo patrón que el `restRotate` de `chipButton`: el preset no admite un
 * tercer color porque su firma es `style: (node) => NodeStyle`, sin
 * argumentos — dos entradas cubren los casos reales, un fallback cubre el
 * resto sin bifurcar la firma).
 */
function eyebrow(color: StyleValue = { token: "colors.primary.default" }): NodeStyle {
  const isOnDark = typeof color === "object" && "token" in color && color.token === "colors.surface.alt";
  const preset = getStylePresetDefinition(isOnDark ? "eyebrow-on-dark" : "eyebrow-on-light")!;
  const placeholder: BuilderNode = { id: "eyebrow-preview", type: "text", props: {}, style: { base: {} } };
  const presetStyle = preset.style(placeholder);
  if (isOnDark) return presetStyle;
  // Fallback para un color que no sea ninguno de los dos registrados: se
  // parte de la entrada "on-light" y se sustituye solo `appearance.color`.
  return { base: mergeLayer(presetStyle.base, { appearance: { color } }) };
}

/**
 * Reference §header: every nav item is its own pill on the paper — hairline
 * accent outline, uppercase 12px micro-label at wide tracking, and exactly one
 * filled chip for the order CTA (`solid`). Measured on the reference: radius
 * 41.6px, 12px, 1.2px tracking.
 *
 * The reference also rests every pill a degree or two off true and
 * straightens it under the cursor (measured: `rotate: 0deg`, `scale: 1.05` at
 * 720ms into a hover). `restRotate` carries the per-chip resting angle — it
 * cannot be a constant inside this helper because the reference alternates
 * sign chip by chip — and defaults to `"0deg"` so any other caller keeps
 * today's upright pill.
 *
 * F27 (T4): the recipe itself — pill radius, micro-label, hairline, the
 * hover that straightens and grows — now lives in the `chip-outline`/
 * `chip-solid` entries of `stylePresetRegistry.ts`, reachable from the
 * Inspector by any `button`/`badge` node, not only from inside this file.
 * This helper is now a thin wrapper: it reads the registered preset's style
 * for the node about to be created (`getStylePresetDefinition(...).style`)
 * and layers `restRotate` on top with `mergeLayer` — the same merge-by-
 * group/field primitive the preset's own merge uses — because the preset's
 * base always rests at `rotate: "0deg"` (a preset does not know which
 * position in a chip row it will land on; the alternating sign is this
 * layout's own composition, not the preset's). Proves the registry is a
 * real substitute for the private recipe it replaces (T4 gate), not merely
 * a parallel copy of it.
 */
function chipButton(solid = false, restRotate: StyleValue = "0deg"): NodeStyle {
  const preset = getStylePresetDefinition(solid ? "chip-solid" : "chip-outline")!;
  // The preset's `style(node)` only reads `node.type`/`node.style.states` in
  // today's two chip entries (see `chipStyle` in `stylePresetRegistry.ts`),
  // so a minimal placeholder node is enough here — this helper runs at
  // module load, long before any real `BuilderNode` for this chip exists.
  const placeholder: BuilderNode = { id: "chip-preview", type: "button", props: {}, style: { base: {} } };
  const presetStyle = preset.style(placeholder);
  return {
    base: mergeLayer(presetStyle.base, { appearance: { rotate: restRotate } }),
    states: presetStyle.states,
  };
}

/**
 * The two sticker shapes the reference scatters over its hero photo: a round
 * badge holding a line glyph, and a flat ribbon holding a micro-label.
 * `mdOnly` hides one until the `md` breakpoint — see the note on
 * `pizzeria-hero-photo` for why that is the only lever available (H103).
 */
/**
 * F27 (T9): la forma redonda ahora vive en `sticker-badge` del registro.
 * `mdOnly` (ocultar hasta `md`) sigue siendo composición de ESTE layout, no
 * del preset — el mismo argumento que ya dejó `restRotate` fuera de
 * `chipStyle` (T4): el preset no sabe si su instancia debe ocultarse en
 * móvil, eso lo decide quién arma la página.
 */
function stickerBadge(mdOnly = true): NodeStyle {
  const preset = getStylePresetDefinition("sticker-badge")!;
  const placeholder: BuilderNode = { id: "sticker-badge-preview", type: "sticker", props: {}, style: { base: {} } };
  const presetStyle = preset.style(placeholder);
  if (!mdOnly) return presetStyle;
  return {
    base: mergeLayer(presetStyle.base, { layout: { display: "none" } }),
    overrides: { md: { layout: { display: "flex" } } },
  };
}

/**
 * F27 (T9): las dos formas de cinta ahora viven en
 * `sticker-ribbon-outline`/`sticker-ribbon-solid` del registro. `mdOnly`
 * sigue siendo del layout, igual que en `stickerBadge` arriba.
 */
function stickerRibbon(solid: boolean, mdOnly = false): NodeStyle {
  const preset = getStylePresetDefinition(solid ? "sticker-ribbon-solid" : "sticker-ribbon-outline")!;
  const placeholder: BuilderNode = { id: "sticker-ribbon-preview", type: "sticker", props: {}, style: { base: {} } };
  const presetStyle = preset.style(placeholder);
  if (!mdOnly) return presetStyle;
  return {
    base: mergeLayer(presetStyle.base, { layout: { display: "none" } }),
    overrides: { md: { layout: { display: "flex" } } },
  };
}

/**
 * F27 (T7): la receta del título de sección ahora vive en
 * `section-title-on-light`/`section-title-on-dark` del registro. Mismo
 * patrón de fallback que `eyebrow` arriba: los dos colores reales que esta
 * plantilla usó (`colors.text` sobre papel, `colors.surface.default` sobre
 * la banda oscura) seleccionan la entrada; cualquier otro color cae al
 * preset "on-light" con `appearance.color` sustituido.
 */
function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  const isOnDark = typeof color === "object" && "token" in color && color.token === "colors.surface.default";
  const preset = getStylePresetDefinition(isOnDark ? "section-title-on-dark" : "section-title-on-light")!;
  const placeholder: BuilderNode = { id: "section-title-preview", type: "text", props: {}, style: { base: {} } };
  const presetStyle = preset.style(placeholder);
  if (isOnDark) return presetStyle;
  return { base: mergeLayer(presetStyle.base, { appearance: { color } }) };
}

/**
 * F27 (T8): la receta del texto de cuerpo ahora vive en `body-text` del
 * registro. A diferencia de `eyebrow`/`sectionTitle`, el helper original
 * nunca se llamó con un `color`/`maxWidth` distinto del default en toda la
 * plantilla, así que no hace falta el fallback de merge — solo se lee el
 * preset y, si algún día alguien pasa argumentos distintos, se fusionan
 * igual que arriba.
 */
function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "62ch"): NodeStyle {
  const preset = getStylePresetDefinition("body-text")!;
  const placeholder: BuilderNode = { id: "body-text-preview", type: "text", props: {}, style: { base: {} } };
  const presetStyle = preset.style(placeholder);
  const isDefault =
    typeof color === "object" && "token" in color && color.token === "colors.muted" && maxWidth === "62ch";
  if (isDefault) return presetStyle;
  return { base: mergeLayer(presetStyle.base, { appearance: { color }, size: { maxWidth } }) };
}

function card(radius = "0", shadow = SHADOW_CARD): NodeStyle {
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

/** Menu list row: a two-digit index, the name, a hairline leader rule and the
 * price at the far right, with the description underneath and a hairline
 * border separating this row from the next. The row itself is a CSS grid
 * (`auto auto 1fr auto`) rather than a flex row: the style model has no
 * `flex`/`flexGrow`/`flexShrink`, so a flex row's default shrink applies to
 * every child equally and squeezes a long name below its content width
 * instead of only collapsing the leader. Grid's `auto` tracks size to their
 * content and are never squeezed by the `1fr` sibling, which is exactly
 * where the leader's free space needs to come from. */
function menuItem(
  id: string,
  index: string,
  content: { name: string; desc: string; price: string; imageUrl: string },
): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "10px" },
          spacing: { padding: "18px 0" },
          appearance: {
            borderWidth: "0 0 1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
          },
        },
        overrides: { md: { spacing: { padding: "22px 0" } } },
      },
      children: [`${id}-row`, `${id}-desc`],
    },
    [`${id}-row`]: {
      id: `${id}-row`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "auto auto 1fr auto", alignItems: "center", gap: "14px" },
        },
      },
      children: [`${id}-index`, `${id}-name`, `${id}-rule`, `${id}-price`],
    },
    [`${id}-index`]: {
      id: `${id}-index`,
      type: "text",
      props: { content: index },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "0.9375rem",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
    [`${id}-name`]: {
      id: `${id}-name`,
      type: "text",
      props: { content: content.name },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "2.25rem",
            fontWeight: { token: "typography.weights.regular" },
            lineHeight: "1.0",
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`${id}-rule`]: {
      id: `${id}-rule`,
      type: "container",
      props: {},
      style: {
        base: {
          spacing: { padding: "0" },
          appearance: {
            borderWidth: "0 0 1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
          },
        },
      },
    },
    [`${id}-price`]: {
      id: `${id}-price`,
      type: "text",
      props: { content: content.price },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.5rem",
            fontWeight: { token: "typography.weights.regular" },
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`${id}-desc`]: {
      id: `${id}-desc`,
      type: "text",
      props: { content: content.desc },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "0.9375rem",
            lineHeight: { token: "typography.lineHeights.normal" },
          },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  };
}

/** Featured menu photo: the reference's left column — a single tall photo
 * with a dark-to-accent gradient stacked over its bottom edge (same
 * `background` shorthand trick the hero uses — no `position`/`transform` in
 * the style model, so the gradient and the `url()` are layered in one
 * declaration on the container itself, and the name/price/badge are ordinary
 * flow children pushed to the bottom by `justifyContent: "flex-end"`). */
function menuFeatured(
  id: string,
  content: { name: string; price: string; imageUrl: string; tag: string },
): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start", gap: "10px" },
          spacing: { padding: "20px" },
          size: { width: "100%", height: "360px" },
          appearance: {
            background: `linear-gradient(180deg, rgba(20,10,6,0) 45%, rgba(20,10,6,0.82) 100%), url('${content.imageUrl}') center/cover no-repeat`,
            borderRadius: "0",
          },
        },
        overrides: { md: { size: { height: "480px" }, spacing: { padding: "28px" } } },
      },
      children: [`${id}-tag`, `${id}-foot`],
    },
    [`${id}-tag`]: {
      id: `${id}-tag`,
      type: "badge",
      props: { label: content.tag },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "4px 10px" },
          typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: {
            background: { token: "colors.primary.default" },
            borderRadius: "999px",
            color: { token: "colors.primary.on" },
          },
        },
      },
    },
    [`${id}-foot`]: {
      id: `${id}-foot`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: "12px" },
          size: { width: "100%" },
        },
      },
      children: [`${id}-name`, `${id}-price`],
    },
    [`${id}-name`]: {
      id: `${id}-name`,
      type: "text",
      props: { content: content.name },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "2.25rem",
            fontWeight: { token: "typography.weights.regular" },
            lineHeight: "1.0",
          },
          appearance: { color: { token: "colors.surface.default" } },
        },
      },
    },
    [`${id}-price`]: {
      id: `${id}-price`,
      type: "text",
      props: { content: content.price },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.5rem",
            fontWeight: { token: "typography.weights.regular" },
          },
          appearance: { color: { token: "colors.surface.default" } },
        },
      },
    },
  };
}

/** Process step card for the wood-fired-oven carousel: numbered + photo + title + note.
 * The carousel runtime stretches the slide itself to `height: 100%` inline
 * (Embla's cross-axis sizing), which overrides any `height` declared on the
 * slide node's own CSS — so equalising the five slides has to happen on the
 * fixed-height *content* inside the slide instead: the image already has a
 * fixed height, and the step+title+note block below it gets one too, so
 * every slide's natural (min-content) height converges on the same number
 * regardless of how long each note happens to run. */
function processStep(
  id: string,
  content: { step: string; title: string; note: string; imageUrl: string },
): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "14px" },
          size: { width: "78%", maxWidth: "320px" },
        },
        overrides: { md: { size: { width: "auto" } } },
      },
      children: [`${id}-img`, `${id}-text`],
    },
    [`${id}-img`]: {
      id: `${id}-img`,
      type: "image",
      props: { source: { kind: "url", url: content.imageUrl }, alt: content.title, objectFit: "cover", loading: "lazy" },
      style: {
        base: {
          size: { width: "100%", height: "220px" },
          appearance: { borderRadius: "0" },
        },
        overrides: { md: { size: { height: "260px" } } },
      },
      behaviors: [{ type: "lightbox", options: { duration: 180 } }],
    },
    [`${id}-text`]: {
      id: `${id}-text`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "14px" },
          size: { width: "100%", height: "160px" },
        },
        overrides: { md: { size: { height: "180px" } } },
      },
      children: [`${id}-step`, `${id}-title`, `${id}-note`],
    },
    [`${id}-step`]: {
      id: `${id}-step`,
      type: "text",
      props: { content: content.step },
      style: eyebrow(),
    },
    [`${id}-title`]: {
      id: `${id}-title`,
      type: "text",
      props: { content: `<strong>${content.title}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.75rem",
            fontWeight: { token: "typography.weights.regular" },
            lineHeight: "1.05",
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`${id}-note`]: {
      id: `${id}-note`,
      type: "text",
      props: { content: content.note },
      style: {
        base: {
          typography: { fontSize: { token: "typography.sizes.sm" }, lineHeight: { token: "typography.lineHeights.normal" } },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  };
}

/** Special-of-the-month slide: tall portrait photo with the name captioned
 * underneath it (not overlaid) — the caption sits below the image box, in
 * the display serif, the way the reference rail does it. */
function specialSlide(
  id: string,
  content: { name: string; imageUrl: string },
): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "14px" },
          size: { width: "58%", maxWidth: "260px" },
        },
        overrides: { md: { size: { width: "auto" } } },
      },
      children: [`${id}-img`, `${id}-name`],
    },
    [`${id}-img`]: {
      id: `${id}-img`,
      type: "image",
      props: { source: { kind: "url", url: content.imageUrl }, alt: content.name, objectFit: "cover", loading: "lazy" },
      style: {
        base: {
          size: { width: "100%", height: "360px" },
          appearance: {
            borderRadius: "0",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
          },
        },
        overrides: { md: { size: { height: "400px" } } },
        states: { hover: { appearance: { borderColor: { token: "colors.primary.default" } } } },
      },
    },
    [`${id}-name`]: {
      id: `${id}-name`,
      type: "text",
      props: { content: content.name },
      style: {
        base: {
          size: { height: "58px" },
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.5rem",
            fontWeight: { token: "typography.weights.regular" },
            lineHeight: "1.05",
          },
          appearance: { color: { token: "colors.surface.default" } },
        },
      },
    },
  };
}

/** Square social feed photo with a small caption underneath (used inside the
 * `logo-cloud` + `marquee` loop, two counter-scrolling rows). Every photo in
 * both rows gets this same fixed square box and `objectFit: "cover"`, so
 * nothing is letterboxed regardless of the source image's own aspect ratio —
 * the ragged single-row version this replaces let that vary per photo.
 * 250px at `md`+ (down from an earlier 600px, which read as two giant photos
 * sliding past rather than a feed — at 1440 a 600px tile leaves barely two
 * and a half visible at once). The marquee behavior duplicates a row's
 * children once for its seamless loop, so the track's `scrollWidth` is
 * inherently 2× one row's own (single-copy) width regardless of tile size —
 * that ratio does not depend on the 600→250 change. 130px at base keeps the
 * mobile row proportionate. */
function socialPhoto(id: string, alt: string, imageUrl: string, label: string): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "12px" },
          size: { width: "130px" },
        },
        overrides: { md: { size: { width: "250px" } } },
      },
      children: [`${id}-img`, `${id}-label`],
    },
    [`${id}-img`]: {
      id: `${id}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover", loading: "lazy" },
      style: {
        base: {
          size: { width: "130px", height: "130px" },
          appearance: { borderRadius: "0" },
        },
        overrides: { md: { size: { width: "250px", height: "250px" } } },
      },
    },
    [`${id}-label`]: {
      id: `${id}-label`,
      type: "text",
      props: { content: label },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "0.75rem",
            fontWeight: { token: "typography.weights.bold" },
            letterSpacing: "0.05em",
          },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  };
}

/** Blog/news card: image + category badge + date + title. */
function newsCard(
  id: string,
  content: { category: string; date: string; title: string; imageUrl: string },
): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "card",
      props: {},
      style: {
        base: {
          ...card("0").base,
          layout: { display: "flex", flexDirection: "column" },
          spacing: { padding: "0" },
        },
        states: { hover: { appearance: { borderColor: { token: "colors.primary.default" } } } },
      },
      children: [`${id}-img`, `${id}-body`],
    },
    [`${id}-img`]: {
      id: `${id}-img`,
      type: "image",
      props: { source: { kind: "url", url: content.imageUrl }, alt: content.title, objectFit: "cover", loading: "lazy" },
      style: {
        base: { size: { width: "100%", height: "180px" }, appearance: { borderRadius: "0" } },
      },
    },
    [`${id}-body`]: {
      id: `${id}-body`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "column", gap: "10px" }, spacing: { padding: "18px" } },
      },
      children: [`${id}-meta`, `${id}-title`],
    },
    [`${id}-meta`]: {
      id: `${id}-meta`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" } },
      },
      children: [`${id}-category`, `${id}-date`],
    },
    [`${id}-category`]: {
      id: `${id}-category`,
      type: "badge",
      props: { label: content.category },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "4px 10px" },
          typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: {
            background: { token: "colors.primary.default" },
            borderRadius: "999px",
            color: { token: "colors.primary.on" },
          },
        },
      },
    },
    [`${id}-date`]: {
      id: `${id}-date`,
      type: "text",
      props: { content: content.date },
      style: {
        base: {
          typography: { fontSize: { token: "typography.sizes.sm" } },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
    [`${id}-title`]: {
      id: `${id}-title`,
      type: "text",
      props: { content: `<strong>${content.title}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.75rem",
            fontWeight: { token: "typography.weights.regular" },
            lineHeight: "1.1",
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
  };
}

/** Video review: a `testimonial` composite whose child is a `video`, not the default avatar+quote. */
function videoReview(
  id: string,
  content: { videoUrl: string; name: string; role: string },
): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "testimonial",
      props: {},
      style: {
        base: {
          ...defaultStyleFor("testimonial").base,
          layout: { display: "flex", flexDirection: "column", gap: "0", overflowX: "hidden", overflowY: "hidden" },
          spacing: { padding: "0" },
          size: { width: "78%", maxWidth: "340px" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderRadius: "0",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
          },
        },
        overrides: { md: { size: { width: "auto" } } },
      },
      children: [`${id}-video`, `${id}-caption`],
    },
    [`${id}-video`]: {
      id: `${id}-video`,
      type: "video",
      props: { url: content.videoUrl, aspectRatio: "1:1", title: `${content.name} review` },
      style: {
        base: {
          size: { width: "100%" },
          appearance: { background: { token: "colors.surface.alt" }, borderRadius: "0" },
        },
      },
    },
    [`${id}-caption`]: {
      id: `${id}-caption`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "column", gap: "2px" }, spacing: { padding: "16px" } },
      },
      children: [`${id}-name`, `${id}-role`],
    },
    [`${id}-name`]: {
      id: `${id}-name`,
      type: "text",
      props: { content: `<strong>${content.name}</strong>` },
      style: { base: { typography: { fontWeight: { token: "typography.weights.bold" } } }, appearance: { color: { token: "colors.text" } } } as NodeStyle,
    },
    [`${id}-role`]: {
      id: `${id}-role`,
      type: "text",
      props: { content: content.role },
      style: {
        base: {
          typography: { fontSize: { token: "typography.sizes.sm" } },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  };
}

export const pizzeriaPageMeta: LayoutPageMeta = {
  title: "Forno Rosso · Wood-Fired Pizza",
  description:
    "Neapolitan-style wood-fired pizza, a weekly special and online table booking. Open until midnight.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Forno Rosso · Wood-Fired Pizza",
      description: "Wood-fired pizza, a weekly special that changes every Monday and table booking in two clicks.",
      image: "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Forno Rosso · Wood-Fired Pizza",
      description: "Wood-fired pizza and table booking, open until midnight.",
      image: "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=1200&q=80&auto=format&fit=crop",
    },
  },
};

export function buildPizzeriaPageFragment(): NodeFragment {
  return {
    rootId: "pizzeria-root",
    nodes: {
      "pizzeria-root": {
        id: "pizzeria-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: [
          "pizzeria-navbar",
          "pizzeria-hero",
          "pizzeria-hero-photo",
          "pizzeria-hero-actions",
          "pizzeria-ghost",
          "pizzeria-menu",
          "pizzeria-process",
          "pizzeria-specials",
          "pizzeria-reviews",
          "pizzeria-social",
          "pizzeria-news",
          "pizzeria-faq",
          "pizzeria-order",
          "pizzeria-footer",
        ],
      },

      // --- Navbar: the reference's pill-chip bar on ruled paper -------------
      // Measured on the reference at 1440x900: eight pills at radius 41.6px on
      // a bar with no background of its own, floating over the pinstriped
      // paper — brand pill in the display serif at 20px, five 12px uppercase
      // anchors at 1.2px tracking, one filled accent pill for the order CTA.
      //
      // The bar here paints the pinstripes itself. The reference's header is
      // `position: fixed` and the ruled band belongs to the hero underneath
      // it; `position` is not in this style model (see the note at the top of
      // `Sticker.tsx`), so the expressible equivalent is a static bar carrying
      // the same texture, which keeps the ruling continuous from the top of
      // the document down through the headline band.
      //
      // The anchor chips live inside the brand slot because that is where a
      // `navbar` node's children go (`Navbar.tsx` renders `{children}` inside
      // `.pb-navbar__brand`); the `<ul>` on the right is generated from the
      // site's own pages and is not ours to arrange — it inherits this node's
      // typography, which is why it reads as a 12px uppercase item instead of
      // a 16px sentence. The chips are `display: none` until `md`, which is
      // what the reference does too: at 390px its five nav pills are gone and
      // the bar is the brand plus the toggle, here the hamburger that the
      // `navbar` behavior owns.
      "pizzeria-navbar": {
        id: "pizzeria-navbar",
        type: "navbar",
        props: { hiddenPageIds: [] },
        style: {
          base: {
            ...defaultStyleFor("navbar").base,
            spacing: { padding: "12px 16px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "0.75rem",
              fontWeight: { token: "typography.weights.bold" },
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            },
            appearance: {
              ...defaultStyleFor("navbar").base.appearance,
              background: `${TEXTURE_PINSTRIPE}, var(--colors-surface-default)`,
              color: { token: "colors.primary.default" },
            },
          },
          overrides: { md: { spacing: { padding: "18px 16px" } } },
        },
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
        children: ["pizzeria-navbar-brand"],
      },
      "pizzeria-navbar-brand": {
        id: "pizzeria-navbar-brand",
        type: "container",
        props: {},
        style: {
          base: {
            ...NAVBAR_BRAND_STYLE.base,
            layout: { display: "flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: "8px" },
          },
          overrides: { md: { layout: { gap: "10px" } } },
        },
        children: ["pizzeria-navbar-brand-chip", "pizzeria-navbar-links"],
      },
      "pizzeria-navbar-brand-chip": {
        id: "pizzeria-navbar-brand-chip",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" },
            spacing: { padding: "7px 16px" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: CHIP_BORDER,
              borderRadius: "999px",
              // Reference tilt: this chip is a `container`, not a `button`,
              // so it has no hover state of its own — it just rests off true
              // like every other pill (contract: -2deg for this one).
              rotate: "-2deg",
            },
          },
        },
        children: ["pizzeria-navbar-brand-icon", "pizzeria-navbar-brand-text"],
      },
      "pizzeria-navbar-brand-icon": {
        id: "pizzeria-navbar-brand-icon",
        type: "icon",
        props: { name: "Pizza", pressedName: "", title: "" },
        style: {
          base: {
            layout: { display: "inline-block" },
            size: { width: "18px", height: "18px" },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },
      "pizzeria-navbar-brand-text": {
        id: "pizzeria-navbar-brand-text",
        type: "text",
        props: { content: "Forno Rosso" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "1.25rem",
              fontWeight: { token: "typography.weights.regular" },
              lineHeight: "1.1",
              letterSpacing: "normal",
              textTransform: "none",
            },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },
      "pizzeria-navbar-links": {
        id: "pizzeria-navbar-links",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "none" },
            spacing: { padding: "0" },
            appearance: { background: "transparent" },
          },
          overrides: {
            md: {
              layout: { display: "flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: "8px" },
            },
          },
        },
        children: [
          "pizzeria-navbar-link-menu",
          "pizzeria-navbar-link-oven",
          "pizzeria-navbar-link-specials",
          "pizzeria-navbar-link-news",
          "pizzeria-navbar-cta",
        ],
      },
      "pizzeria-navbar-link-menu": {
        id: "pizzeria-navbar-link-menu",
        type: "button",
        props: { label: "menu", link: { kind: "anchor", nodeId: "pizzeria-menu" } },
        style: chipButton(false, "2deg"),
      },
      "pizzeria-navbar-link-oven": {
        id: "pizzeria-navbar-link-oven",
        type: "button",
        props: { label: "the oven", link: { kind: "anchor", nodeId: "pizzeria-process" } },
        style: chipButton(false, "-1deg"),
      },
      "pizzeria-navbar-link-specials": {
        id: "pizzeria-navbar-link-specials",
        type: "button",
        props: { label: "specials", link: { kind: "anchor", nodeId: "pizzeria-specials" } },
        style: chipButton(false, "1deg"),
      },
      "pizzeria-navbar-link-news": {
        id: "pizzeria-navbar-link-news",
        type: "button",
        props: { label: "news", link: { kind: "anchor", nodeId: "pizzeria-news" } },
        style: chipButton(false, "2deg"),
      },
      "pizzeria-navbar-cta": {
        id: "pizzeria-navbar-cta",
        type: "button",
        props: { label: "order online", link: { kind: "anchor", nodeId: "pizzeria-order" } },
        style: chipButton(true, "-2deg"),
      },

      // --- Hero, band 1: the headline alone on the ruled paper --------------
      // The reference does not stack its hero over a photo: the headline sits
      // on the paper in the accent colour (115px at 1440, 48px at 390, lower
      // case, display serif, centred) and the photo is the band underneath.
      // `clamp(3rem, 8vw, 7.25rem)` lands on both of those measured numbers
      // exactly — 8vw of 1440 is 115.2px, and at 390px the 3rem floor wins.
      //
      // No eyebrow, no sub-headline, no rating chip up here: everything that
      // used to be stacked on top of the photo moved to band 3, below it. The
      // sub-headline's two facts are not lost — the 48-hour ferment is a step
      // in the process carousel and San Marzano is in the menu copy.
      "pizzeria-hero": {
        id: "pizzeria-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0" },
            spacing: { padding: "18px 16px 18px" },
            size: { width: "100%", minHeight: "0" },
            appearance: {
              background: `${TEXTURE_PINSTRIPE}, var(--colors-surface-default)`,
              color: { token: "colors.primary.default" },
            },
          },
          overrides: { md: { spacing: { padding: "28px 16px 24px" } } },
        },
        children: ["pizzeria-hero-title"],
      },
      "pizzeria-hero-title": {
        id: "pizzeria-hero-title",
        type: "text",
        props: { content: "wood-fired pizza" },
        style: {
          base: {
            size: { width: "100%" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(3rem, 8vw, 7.25rem)",
              fontWeight: { token: "typography.weights.regular" },
              lineHeight: "1.0",
              letterSpacing: "normal",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },

      // --- Hero, band 2: the photo, full-bleed, stickers on it --------------
      // Reference geometry, measured: 1440x564 at desktop and 390x714 at
      // mobile — the band is allowed to go portrait-tall on a phone. Nothing
      // darkens it, because no text sits on top of it any more; the three-stop
      // gradient the old hero needed is gone with the overlay.
      //
      // The stickers are DIRECT children, which is what makes this container
      // their containing block (`STICKER_CSS`'s `:has(> .pb-sticker)` rule).
      // Two of the four are `display: none` until `md`, which is both what the
      // reference does (three of its five stickers and its drag label measure
      // 0x0 at 390px) and the structural answer to H103: a sticker's anchor,
      // offset and rotation are props and props have no per-breakpoint
      // override, so the only way to keep four of them off each other on a
      // 390px-wide photo is to show two.
      "pizzeria-hero-photo": {
        id: "pizzeria-hero-photo",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", alignItems: "stretch", overflowX: "hidden" },
            spacing: { padding: "0" },
            size: { width: "100%", height: "520px" },
            appearance: { background: { token: "colors.band.dark" } },
          },
          overrides: { md: { size: { height: "564px" } } },
        },
        children: [
          "pizzeria-hero-photo-img",
          "pizzeria-hero-sticker",
          "pizzeria-hero-sticker-2",
          "pizzeria-hero-sticker-3",
          "pizzeria-hero-sticker-4",
        ],
      },
      "pizzeria-hero-photo-img": {
        id: "pizzeria-hero-photo-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=1600&q=80&auto=format&fit=crop",
          },
          alt: "A hand lifting a pepperoni slice out of the pizza box",
          objectFit: "cover",
          loading: "eager",
        },
        style: {
          base: {
            size: { width: "100%", height: "100%" },
            appearance: { borderRadius: "0" },
          },
        },
      },
      // The draggable one. Stays a ribbon rather than a badge because it is
      // the only sticker that carries a fact the page does not repeat in this
      // screen, and because the drag affordance needs something to grab.
      "pizzeria-hero-sticker": {
        id: "pizzeria-hero-sticker",
        type: "sticker",
        props: { anchor: "bottom-left", rotation: -7, offset: 24 },
        style: stickerRibbon(true),
        behaviors: [{ type: "sticker-drag", options: { axis: "both", bounded: true } }],
        children: ["pizzeria-hero-sticker-text"],
      },
      "pizzeria-hero-sticker-text": {
        id: "pizzeria-hero-sticker-text",
        type: "text",
        props: { content: "48hr dough" },
        style: { base: { typography: { textAlign: "center" } } },
      },
      "pizzeria-hero-sticker-2": {
        id: "pizzeria-hero-sticker-2",
        type: "sticker",
        props: { anchor: "top-left", rotation: 8, offset: 20 },
        style: stickerBadge(),
        children: ["pizzeria-hero-sticker-2-icon"],
      },
      "pizzeria-hero-sticker-2-icon": {
        id: "pizzeria-hero-sticker-2-icon",
        type: "icon",
        props: { name: "Flame", pressedName: "", title: "Wood fire" },
        style: {
          base: {
            layout: { display: "inline-block" },
            size: { width: "34px", height: "34px" },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },
      "pizzeria-hero-sticker-3": {
        id: "pizzeria-hero-sticker-3",
        type: "sticker",
        props: { anchor: "top-right", rotation: -6, offset: 20 },
        style: stickerBadge(),
        children: ["pizzeria-hero-sticker-3-icon"],
      },
      "pizzeria-hero-sticker-3-icon": {
        id: "pizzeria-hero-sticker-3-icon",
        type: "icon",
        props: { name: "Pizza", pressedName: "", title: "Neapolitan style" },
        style: {
          base: {
            layout: { display: "inline-block" },
            size: { width: "34px", height: "34px" },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },
      "pizzeria-hero-sticker-4": {
        id: "pizzeria-hero-sticker-4",
        type: "sticker",
        props: { anchor: "bottom-right", rotation: 10, offset: 24 },
        style: stickerRibbon(false, true),
        children: ["pizzeria-hero-sticker-4-text"],
      },
      "pizzeria-hero-sticker-4-text": {
        id: "pizzeria-hero-sticker-4-text",
        type: "text",
        props: { content: "oak wood only" },
        style: { base: { typography: { textAlign: "center" } } },
      },

      // --- Hero, band 3: the second serif line and the two CTAs ------------
      // The reference's first screen ends with a second line at the same
      // 115px in the same accent ("till 2 am.") and then two pills: the
      // filled order CTA and the phone number as a ghost pill. Same shape
      // here, and this is where the opening hours claim lives now that the
      // dark topbar is gone — the footer still carries `Daily: 12:00 – 00:00`
      // verbatim, and the phone number is a real `tel:` link instead of the
      // plain text the topbar had.
      "pizzeria-hero-actions": {
        id: "pizzeria-hero-actions",
        type: "section",
        props: {},
        style: {
          base: {
            spacing: { padding: "24px 20px 44px" },
            appearance: { background: `${TEXTURE_PINSTRIPE}, var(--colors-surface-default)` },
          },
          overrides: { md: { spacing: { padding: "36px 20px 72px" } } },
        },
        children: ["pizzeria-hero-actions-inner"],
      },
      "pizzeria-hero-actions-inner": {
        id: "pizzeria-hero-actions-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
            typography: { textAlign: "center" },
          },
          overrides: { md: { layout: { gap: "22px" } } },
        },
        children: ["pizzeria-hero-line", "pizzeria-hero-cta-row", "pizzeria-hero-badges"],
      },
      "pizzeria-hero-line": {
        id: "pizzeria-hero-line",
        type: "text",
        props: { content: "till midnight." },
        style: {
          base: {
            size: { width: "100%" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(3rem, 8vw, 7.25rem)",
              fontWeight: { token: "typography.weights.regular" },
              lineHeight: "1.0",
              letterSpacing: "normal",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },
      "pizzeria-hero-cta-row": {
        id: "pizzeria-hero-cta-row",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: { token: "spacing.sm" } },
            size: { width: "100%", maxWidth: "420px" },
          },
          overrides: {
            sm: { layout: { flexDirection: "row", justifyContent: "center", alignItems: "center" }, size: { maxWidth: "none" } },
          },
        },
        children: ["pizzeria-hero-cta", "pizzeria-hero-phone"],
      },
      "pizzeria-hero-cta": {
        id: "pizzeria-hero-cta",
        type: "button",
        props: { label: "order online", link: { kind: "anchor", nodeId: "pizzeria-order" } },
        style: {
          base: {
            ...defaultStyleFor("button").base,
            spacing: { padding: "17px 30px" },
            typography: {
              ...defaultStyleFor("button").base.typography,
              fontSize: "1rem",
              fontWeight: { token: "typography.weights.bold" },
              letterSpacing: "0.02em",
              textAlign: "center",
            },
            appearance: {
              ...defaultStyleFor("button").base.appearance,
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "999px",
              boxShadow: SHADOW_CARD,
            },
          },
          states: { hover: { appearance: { background: { token: "colors.text" }, boxShadow: SHADOW_HOVER } } },
        },
      },
      "pizzeria-hero-phone": {
        id: "pizzeria-hero-phone",
        type: "button",
        props: { label: "+1 (512) 555-0177", link: { kind: "external", href: "tel:+15125550177" } },
        style: {
          base: {
            ...defaultStyleFor("button").base,
            spacing: { padding: "14px 26px" },
            typography: {
              ...defaultStyleFor("button").base.typography,
              fontSize: "0.9375rem",
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: {
              ...defaultStyleFor("button").base.appearance,
              background: "transparent",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: CHIP_BORDER,
              borderRadius: "999px",
              color: { token: "colors.primary.default" },
              boxShadow: SHADOW_CARD,
            },
          },
          states: {
            hover: { appearance: { background: { token: "colors.primary.default" }, color: { token: "colors.primary.on" } } },
          },
        },
      },
      "pizzeria-hero-badges": {
        id: "pizzeria-hero-badges",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: { token: "spacing.sm" } },
          },
        },
        children: ["pizzeria-hero-rating", "pizzeria-hero-rating-text"],
      },
      "pizzeria-hero-rating": {
        id: "pizzeria-hero-rating",
        type: "badge",
        props: { label: "★ 4.9 / 5" },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "5px 13px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "0.75rem",
              fontWeight: { token: "typography.weights.bold" },
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            },
            appearance: {
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: CHIP_BORDER,
              borderRadius: "999px",
              color: { token: "colors.primary.default" },
            },
          },
        },
      },
      "pizzeria-hero-rating-text": {
        id: "pizzeria-hero-rating-text",
        type: "text",
        props: { content: "3,100+ reviews · 12 years in the neighborhood" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "0.8125rem",
              letterSpacing: "0.04em",
            },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      // --- Ghost-type marquee band (full-bleed divider, not a section) ------
      // Reuses `logo-cloud` + `marquee` (the only combination that loops
      // sideways forever without runtime JS, tier 0 — see `socialPhoto`
      // above and `registry/behaviors/marquee.ts`), but with a single giant
      // `text` child instead of photos. The phrase repeats the page's own
      // established facts (900°F, oak) rather than inventing a new claim —
      // both already appear in the hero title and process step 05. Colour is
      // `colors.border` (#e6d0a8) against the band's own `colors.surface.alt`
      // (#f4e4c8): both warm tans a few points apart in luminance, so the
      // type reads as grain/texture rather than a headline, same intent as
      // the `TEXTURE_RULED`/`TEXTURE_DOTS` devices above. Vertical rhythm is
      // its own tight constant, not `BAND_PADDING` — a divider, not a
      // content band.
      "pizzeria-ghost": {
        id: "pizzeria-ghost",
        type: "section",
        props: {},
        style: {
          ...band("var(--colors-surface-alt)", "20px 0", "48px 0"),
          base: {
            ...band("var(--colors-surface-alt)", "20px 0", "48px 0").base,
            // The marquee track sizes itself to `max-content` (see the note
            // on `pizzeria-ghost-track` below) so its six repeats never wrap
            // — but that makes the track's own box wider than the viewport,
            // and unlike the marquee's internal `overflow: hidden` (which
            // only clips within the marquee element's OWN box), nothing
            // stops that oversized box from widening the band itself and,
            // through it, the whole page (`document.scrollWidth` grew past
            // `clientWidth` — measured before this line: real horizontal
            // scroll on every route, not just this band). `overflowX:
            // "hidden"` on the band is what actually contains it.
            layout: { overflowX: "hidden" },
          },
        },
        children: ["pizzeria-ghost-track"],
      },
      "pizzeria-ghost-track": {
        id: "pizzeria-ghost-track",
        type: "logo-cloud",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("logo-cloud").base,
            layout: { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "0.6em" },
            spacing: { padding: "0" },
            // `width: "max-content"` here (not `"100%"`) is what actually
            // stops the six repeats from wrapping: this flex row DOES have a
            // real box (unlike the marquee's `[data-pb-marquee-track]` span,
            // which the behavior forces to `display: contents` and so has no
            // box to size at all). Pinning the row itself to `100%` handed
            // the flex-shrink algorithm a 1440px budget for six ~800px-wide
            // phrases, so each one shrank below its own text and wrapped
            // (measured: 292px computed width, 389px tall, three lines) —
            // `width: "max-content"` on `text`'s own `size` group (also
            // tried) cannot fix that from the child side, because the shrink
            // target is the ROW's content-box, not any one child's preferred
            // width. Sizing the row itself to its content's total width
            // removes the budget the shrink algorithm was enforcing.
            size: { width: "max-content", minHeight: "0" },
          },
        },
        behaviors: [{ type: "marquee", options: { duration: 26, direction: "left", pauseOnHover: false } }],
        children: [
          "pizzeria-ghost-1",
          "pizzeria-ghost-2",
          "pizzeria-ghost-3",
          "pizzeria-ghost-4",
          "pizzeria-ghost-5",
          "pizzeria-ghost-6",
        ],
      },
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((n) => [
          `pizzeria-ghost-${n}`,
          {
            id: `pizzeria-ghost-${n}`,
            type: "text",
            props: { content: "900°F OAK FIRE ·" },
            style: {
              base: {
                size: { width: "max-content" },
                typography: {
                  fontFamily: { token: "typography.families.display" },
                  fontSize: "clamp(4rem, 9vw, 8.5rem)",
                  fontWeight: { token: "typography.weights.regular" },
                  lineHeight: "1.0",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                },
                appearance: { color: { token: "colors.border" } },
              },
            },
          } satisfies BuilderNode,
        ]),
      ),

      // --- Best sellers menu (featured photo + numbered price list) ---------
      "pizzeria-menu": {
        id: "pizzeria-menu",
        type: "section",
        props: {},
        style: band("var(--colors-surface-default)", BAND_PADDING, BAND_PADDING_MD, "ruled"),
        behaviors: REVEAL,
        children: ["pizzeria-menu-inner"],
      },
      "pizzeria-menu-inner": {
        id: "pizzeria-menu-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["pizzeria-menu-head", "pizzeria-menu-split", "pizzeria-menu-note"],
      },
      "pizzeria-menu-head": {
        id: "pizzeria-menu-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-menu-eyebrow", "pizzeria-menu-title", "pizzeria-menu-sub"],
      },
      "pizzeria-menu-eyebrow": { id: "pizzeria-menu-eyebrow", type: "text", props: { content: "THE MENU" }, style: eyebrow() },
      "pizzeria-menu-title": {
        id: "pizzeria-menu-title",
        type: "text",
        props: { content: "<strong>The six we sell most</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-menu-sub": {
        id: "pizzeria-menu-sub",
        type: "text",
        props: { content: "The full list is on the printed menu — this is what leaves the oven the fastest." },
        style: bodyText(),
      },
      // Two columns at `md` and up (~43/57, the reference's split), stacked
      // (photo first) at `base` — this template's existing mobile-first
      // pattern, no new breakpoint introduced.
      "pizzeria-menu-split": {
        id: "pizzeria-menu-split",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "28px" } },
          overrides: { md: { layout: { flexDirection: "row", alignItems: "stretch", gap: "40px" } } },
        },
        children: ["pizzeria-menu-featured", "pizzeria-menu-list"],
      },
      "pizzeria-menu-featured": {
        id: "pizzeria-menu-featured",
        type: "container",
        props: {},
        style: {
          base: { size: { width: "100%" } },
          overrides: { md: { size: { width: "43%" } } },
        },
        children: ["pizzeria-menu-featured-photo"],
      },
      ...menuFeatured("pizzeria-menu-featured-photo", {
        name: "Margherita",
        price: "$14",
        tag: "Chef's pick",
        imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80&auto=format&fit=crop",
      }),
      "pizzeria-menu-list": {
        id: "pizzeria-menu-list",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "0" }, size: { width: "100%" } },
          overrides: { md: { size: { width: "57%" } } },
        },
        children: ["pizzeria-menu-1", "pizzeria-menu-2", "pizzeria-menu-3", "pizzeria-menu-4", "pizzeria-menu-5", "pizzeria-menu-6"],
      },
      ...menuItem("pizzeria-menu-1", "01", {
        name: "Margherita",
        desc: "San Marzano tomato, fresh mozzarella, basil, olive oil.",
        price: "$14",
        imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80&auto=format&fit=crop",
      }),
      ...menuItem("pizzeria-menu-2", "02", {
        name: "Diavola",
        desc: "Spicy salami, mozzarella, chili oil, oregano.",
        price: "$16",
        imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80&auto=format&fit=crop",
      }),
      ...menuItem("pizzeria-menu-3", "03", {
        name: "Quattro Formaggi",
        desc: "Mozzarella, gorgonzola, fontina, parmesan.",
        price: "$17",
        imageUrl: "https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=800&q=80&auto=format&fit=crop",
      }),
      ...menuItem("pizzeria-menu-4", "04", {
        name: "Funghi e Tartufo",
        desc: "Wild mushrooms, truffle cream, taleggio, thyme.",
        price: "$19",
        imageUrl: "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?w=800&q=80&auto=format&fit=crop",
      }),
      ...menuItem("pizzeria-menu-5", "05", {
        name: "Prosciutto e Rucola",
        desc: "Prosciutto crudo, arugula, shaved parmesan, lemon.",
        price: "$18",
        imageUrl: "https://images.unsplash.com/photo-1584782930656-e2bc1e803fc7?w=800&q=80&auto=format&fit=crop",
      }),
      ...menuItem("pizzeria-menu-6", "06", {
        name: "Ortolana",
        desc: "Grilled seasonal vegetables, mozzarella, pesto.",
        price: "$16",
        imageUrl: "https://images.unsplash.com/photo-1511689660979-10d2b1aada49?w=800&q=80&auto=format&fit=crop",
      }),
      "pizzeria-menu-note": {
        id: "pizzeria-menu-note",
        type: "text",
        props: { content: "Gluten-free crust available on any pizza for $3." },
        style: { base: { typography: { fontSize: { token: "typography.sizes.sm" } }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Process carousel (wood-fired oven) --------------------------------
      "pizzeria-process": {
        id: "pizzeria-process",
        type: "section",
        props: {},
        style: band("var(--colors-surface-alt)", BAND_PADDING, BAND_PADDING_MD, "dots"),
        behaviors: REVEAL,
        children: ["pizzeria-process-inner"],
      },
      "pizzeria-process-inner": {
        id: "pizzeria-process-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["pizzeria-process-head", "pizzeria-process-track"],
      },
      "pizzeria-process-head": {
        id: "pizzeria-process-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-process-eyebrow", "pizzeria-process-title", "pizzeria-process-sub"],
      },
      "pizzeria-process-eyebrow": { id: "pizzeria-process-eyebrow", type: "text", props: { content: "/ HOW IT'S MADE" }, style: eyebrow() },
      "pizzeria-process-title": {
        id: "pizzeria-process-title",
        type: "text",
        props: { content: "<strong>From dough to fire in five steps</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-process-sub": {
        id: "pizzeria-process-sub",
        type: "text",
        props: { content: "The dough rests for two days before it ever sees the oven." },
        style: bodyText(),
      },
      // `carousel` (Embla) as the structural axis of the process — same
      // pattern as `hotel-rooms-grid` in hotelBoutiquePage.ts.
      "pizzeria-process-track": {
        id: "pizzeria-process-track",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", gap: { token: "spacing.md" }, overflowX: "auto" } },
        },
        behaviors: [
          { type: "carousel", options: { orientation: "horizontal", loop: false, autoplay: false, gap: "24px", slideSize: "80%", showArrows: true } },
        ],
        children: ["pizzeria-process-1", "pizzeria-process-2", "pizzeria-process-3", "pizzeria-process-4", "pizzeria-process-5"],
      },
      ...processStep("pizzeria-process-1", {
        step: "01 · MIX",
        title: "Flour, water, salt",
        note: "Just four ingredients, no shortcuts, no additives.",
        imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80&auto=format&fit=crop",
      }),
      ...processStep("pizzeria-process-2", {
        step: "02 · REST",
        title: "48-hour ferment",
        note: "Slow fermentation at cold temperature for flavor and a light crumb.",
        imageUrl: "https://images.unsplash.com/photo-1590759668572-8de3b2052908?w=800&q=80&auto=format&fit=crop",
      }),
      ...processStep("pizzeria-process-3", {
        step: "03 · STRETCH",
        title: "Hand-stretched, no roller",
        note: "Pressed from the center out, never rolled — keeps the air in the crust.",
        imageUrl: "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=800&q=80&auto=format&fit=crop",
      }),
      ...processStep("pizzeria-process-4", {
        step: "04 · TOP",
        title: "San Marzano and fresh mozzarella",
        note: "Crushed by hand, never blended — you can still see the tomato.",
        imageUrl: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=800&q=80&auto=format&fit=crop",
      }),
      ...processStep("pizzeria-process-5", {
        step: "05 · FIRE",
        title: "900°F, 90 seconds",
        note: "Oak wood only. One turn of the peel, then it's out.",
        imageUrl: "https://images.unsplash.com/photo-1721797480125-a1bdf7aa523a?w=800&q=80&auto=format&fit=crop",
      }),

      // --- Specials of the month carousel (photo overlay slides) ------------
      "pizzeria-specials": {
        id: "pizzeria-specials",
        type: "section",
        props: {},
        style: band("linear-gradient(120deg, var(--colors-text), var(--colors-primary-default))"),
        behaviors: REVEAL,
        children: ["pizzeria-specials-inner"],
      },
      "pizzeria-specials-inner": {
        id: "pizzeria-specials-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["pizzeria-specials-head", "pizzeria-specials-track"],
      },
      "pizzeria-specials-head": {
        id: "pizzeria-specials-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-specials-eyebrow", "pizzeria-specials-title"],
      },
      "pizzeria-specials-eyebrow": {
        id: "pizzeria-specials-eyebrow",
        type: "text",
        props: { content: "/ SPECIALS" },
        style: eyebrow({ token: "colors.surface.alt" }),
      },
      "pizzeria-specials-title": {
        id: "pizzeria-specials-title",
        type: "text",
        props: { content: "<strong>This month on the wood fire</strong>" },
        style: sectionTitle({ token: "colors.surface.default" }),
      },
      "pizzeria-specials-track": {
        id: "pizzeria-specials-track",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", gap: { token: "spacing.md" }, overflowX: "auto" } },
        },
        behaviors: [
          { type: "carousel", options: { orientation: "horizontal", loop: true, autoplay: false, gap: "20px", slideSize: "58%", showArrows: true } },
        ],
        children: ["pizzeria-special-1", "pizzeria-special-2", "pizzeria-special-3", "pizzeria-special-4", "pizzeria-special-5", "pizzeria-special-6"],
      },
      ...specialSlide("pizzeria-special-1", {
        name: "Nduja & Honey",
        imageUrl: "https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=800&q=80&auto=format&fit=crop",
      }),
      ...specialSlide("pizzeria-special-2", {
        name: "Burrata & Prosciutto",
        imageUrl: "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=800&q=80&auto=format&fit=crop",
      }),
      ...specialSlide("pizzeria-special-3", {
        name: "Black Truffle Cream",
        imageUrl: "https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=800&q=80&auto=format&fit=crop",
      }),
      ...specialSlide("pizzeria-special-4", {
        name: "Fig & Gorgonzola",
        imageUrl: "https://images.unsplash.com/photo-1548369937-47519962c11a?w=800&q=80&auto=format&fit=crop",
      }),
      ...specialSlide("pizzeria-special-5", {
        name: "Wild Mushroom & Taleggio",
        imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80&auto=format&fit=crop",
      }),
      ...specialSlide("pizzeria-special-6", {
        name: "Spicy Salami & Honey",
        imageUrl: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800&q=80&auto=format&fit=crop",
      }),

      // --- Video reviews carousel ---------------------------------------------
      "pizzeria-reviews": {
        id: "pizzeria-reviews",
        type: "section",
        props: {},
        style: band("var(--colors-surface-default)", BAND_PADDING, BAND_PADDING_MD, "ruled"),
        behaviors: REVEAL,
        children: ["pizzeria-reviews-inner"],
      },
      "pizzeria-reviews-inner": {
        id: "pizzeria-reviews-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["pizzeria-reviews-head", "pizzeria-reviews-track"],
      },
      "pizzeria-reviews-head": {
        id: "pizzeria-reviews-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-reviews-eyebrow", "pizzeria-reviews-title"],
      },
      "pizzeria-reviews-eyebrow": { id: "pizzeria-reviews-eyebrow", type: "text", props: { content: "/ IN THEIR OWN WORDS" }, style: eyebrow() },
      "pizzeria-reviews-title": {
        id: "pizzeria-reviews-title",
        type: "text",
        props: { content: "<strong>What people say about us</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-reviews-track": {
        id: "pizzeria-reviews-track",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", gap: { token: "spacing.md" }, overflowX: "auto" } },
        },
        behaviors: [
          { type: "carousel", options: { orientation: "horizontal", loop: false, autoplay: false, gap: "20px", slideSize: "78%", showArrows: true } },
        ],
        children: ["pizzeria-review-1", "pizzeria-review-2", "pizzeria-review-3"],
      },
      ...videoReview("pizzeria-review-1", {
        videoUrl: "https://www.youtube.com/watch?v=0Lc3frxlTR0",
        name: "Marco Silva",
        role: "Regular, table by the window",
      }),
      ...videoReview("pizzeria-review-2", {
        videoUrl: "https://www.youtube.com/watch?v=oTSbSbB6S3s",
        name: "Priya Nair",
        role: "First visit, Friday night",
      }),
      ...videoReview("pizzeria-review-3", {
        videoUrl: "https://www.youtube.com/watch?v=-EXs97_Orco",
        name: "Dana Kowalski",
        role: "Weekly takeout order",
      }),

      // --- Social feed loop (logo-cloud + marquee, square photos) ------------
      "pizzeria-social": {
        id: "pizzeria-social",
        type: "section",
        props: {},
        style: {
          ...band("var(--colors-surface-alt)", "72px 0", "220px 0", "dots"),
          base: {
            ...band("var(--colors-surface-alt)", "72px 0", "220px 0", "dots").base,
            // Same containment the ghost band needs (see its own comment):
            // both rows below size themselves to `max-content` so their
            // twelve-photo tracks never get flex-shrunk into ragged widths,
            // which makes each row's box wider than the viewport on
            // purpose — `overflowX: "hidden"` here is what stops that from
            // widening the page itself.
            layout: { overflowX: "hidden" },
          },
        },
        children: ["pizzeria-social-inner"],
      },
      "pizzeria-social-inner": {
        id: "pizzeria-social-inner",
        type: "container",
        props: {},
        style: {
          ...inner(),
          base: { ...inner().base, layout: { ...inner().base.layout, gap: "36px" }, size: { width: "100%", maxWidth: "none" } },
          overrides: { md: { layout: { gap: "56px" } } },
        },
        children: ["pizzeria-social-head", "pizzeria-social-track", "pizzeria-social-track-b"],
      },
      "pizzeria-social-head": {
        id: "pizzeria-social-head",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } },
            spacing: { margin: "0 auto", padding: "0 20px" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
        },
        children: ["pizzeria-social-eyebrow", "pizzeria-social-title"],
      },
      "pizzeria-social-eyebrow": { id: "pizzeria-social-eyebrow", type: "text", props: { content: "/ @FORNOROSSO" }, style: eyebrow() },
      "pizzeria-social-title": {
        id: "pizzeria-social-title",
        type: "text",
        props: { content: "<strong>Every pie, every night</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-social-track": {
        id: "pizzeria-social-track",
        type: "logo-cloud",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("logo-cloud").base,
            layout: { display: "flex", flexWrap: "nowrap", alignItems: "flex-start", gap: "16px" },
            spacing: { padding: "0" },
            // `max-content`, not `100%` — same reasoning as the ghost band's
            // track: pinning the row to the viewport hands the flex-shrink
            // algorithm a budget smaller than the six photos' natural width,
            // which doesn't wrap a fixed-size `image` box the way it wraps
            // text, but does shrink `pizzeria-social-N`'s own 250px box away
            // from the number the `-img` child inside it declares — every
            // photo stops being the SAME square once that happens.
            size: { width: "max-content" },
          },
        },
        behaviors: [{ type: "marquee", options: { duration: 32, direction: "left", pauseOnHover: true } }],
        children: [
          "pizzeria-social-1",
          "pizzeria-social-2",
          "pizzeria-social-3",
          "pizzeria-social-4",
          "pizzeria-social-5",
          "pizzeria-social-6",
        ],
      },
      ...socialPhoto("pizzeria-social-1", "Margherita pizza fresh out of the oven", "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?w=400&q=80&auto=format&fit=crop", "@lucia.eats"),
      ...socialPhoto("pizzeria-social-2", "Dough being hand-stretched", "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400&q=80&auto=format&fit=crop", "@fornorosso"),
      ...socialPhoto("pizzeria-social-3", "Wood-fired oven glowing at night", "https://images.unsplash.com/photo-1721797480125-a1bdf7aa523a?w=400&q=80&auto=format&fit=crop", "@night.oven"),
      ...socialPhoto("pizzeria-social-4", "Table of friends sharing pizza", "https://images.unsplash.com/photo-1548369937-47519962c11a?w=400&q=80&auto=format&fit=crop", "@fridaycrew"),
      ...socialPhoto("pizzeria-social-5", "Close-up of a pizza slice with melted cheese", "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80&auto=format&fit=crop", "@cheesepull"),
      ...socialPhoto("pizzeria-social-6", "Pizza baking in the wood-fired oven", "https://images.unsplash.com/photo-1721797480125-a1bdf7aa523a?w=400&q=80&auto=format&fit=crop", "@fornorosso"),
      // Second row, counter-scrolling (`direction: "right"` → `pb-marquee--right`,
      // `animation-direction: reverse`). Reuses the five item photos T4 orphaned
      // when the menu became a numbered list (Diavola/Quattro Formaggi/Funghi e
      // Tartufo/Prosciutto e Rucola/Ortolana never got an `image` node there),
      // plus the Margherita photo already used twice elsewhere on the page
      // (hero-adjacent `menuFeatured`), so both rows carry the same photo count.
      "pizzeria-social-track-b": {
        id: "pizzeria-social-track-b",
        type: "logo-cloud",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("logo-cloud").base,
            layout: { display: "flex", flexWrap: "nowrap", alignItems: "flex-start", gap: "16px" },
            spacing: { padding: "0" },
            size: { width: "max-content" },
          },
          overrides: { md: { spacing: { padding: "0" } } },
        },
        behaviors: [{ type: "marquee", options: { duration: 32, direction: "right", pauseOnHover: true } }],
        children: [
          "pizzeria-social-7",
          "pizzeria-social-8",
          "pizzeria-social-9",
          "pizzeria-social-10",
          "pizzeria-social-11",
          "pizzeria-social-12",
        ],
      },
      ...socialPhoto("pizzeria-social-7", "Diavola pizza with spicy salami", "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80&auto=format&fit=crop", "@spicylover"),
      ...socialPhoto("pizzeria-social-8", "Quattro Formaggi pizza with four cheeses", "https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=400&q=80&auto=format&fit=crop", "@cheeseplease"),
      ...socialPhoto("pizzeria-social-9", "Funghi e Tartufo pizza with wild mushrooms", "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?w=400&q=80&auto=format&fit=crop", "@truffletime"),
      ...socialPhoto("pizzeria-social-10", "Prosciutto e Rucola pizza with arugula", "https://images.unsplash.com/photo-1584782930656-e2bc1e803fc7?w=400&q=80&auto=format&fit=crop", "@prosciuttofan"),
      ...socialPhoto("pizzeria-social-11", "Ortolana pizza with grilled vegetables", "https://images.unsplash.com/photo-1511689660979-10d2b1aada49?w=400&q=80&auto=format&fit=crop", "@veggieslice"),
      ...socialPhoto("pizzeria-social-12", "Margherita pizza with basil and mozzarella", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80&auto=format&fit=crop", "@classicmargherita"),

      // --- Blog / news --------------------------------------------------------
      "pizzeria-news": {
        id: "pizzeria-news",
        type: "section",
        props: {},
        style: band("var(--colors-surface-default)", BAND_PADDING, BAND_PADDING_MD, "ruled"),
        behaviors: REVEAL,
        children: ["pizzeria-news-inner"],
      },
      "pizzeria-news-inner": {
        id: "pizzeria-news-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["pizzeria-news-head", "pizzeria-news-grid"],
      },
      "pizzeria-news-head": {
        id: "pizzeria-news-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-news-eyebrow", "pizzeria-news-title"],
      },
      "pizzeria-news-eyebrow": { id: "pizzeria-news-eyebrow", type: "text", props: { content: "/ FROM THE OVEN" }, style: eyebrow() },
      "pizzeria-news-title": {
        id: "pizzeria-news-title",
        type: "text",
        props: { content: "<strong>Fresh off the press</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-news-grid": {
        id: "pizzeria-news-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "20px" } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } },
        },
        children: ["pizzeria-news-1", "pizzeria-news-2", "pizzeria-news-3"],
      },
      ...newsCard("pizzeria-news-1", {
        category: "The Founder",
        date: "August 14, 2026",
        title: "A note from the founder",
        imageUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80&auto=format&fit=crop",
      }),
      ...newsCard("pizzeria-news-2", {
        category: "The Oven",
        date: "August 2, 2026",
        title: "Why we only burn oak",
        imageUrl: "https://images.unsplash.com/photo-1475500958746-c4562f6f40f0?w=800&q=80&auto=format&fit=crop",
      }),
      ...newsCard("pizzeria-news-3", {
        category: "The Room",
        date: "July 24, 2026",
        title: "The patio is open for the season",
        imageUrl: "https://images.unsplash.com/photo-1773681092966-04cc821c6cea?w=800&q=80&auto=format&fit=crop",
      }),

      // --- FAQ -----------------------------------------------------------------
      "pizzeria-faq": {
        id: "pizzeria-faq",
        type: "section",
        props: {},
        style: band("var(--colors-surface-alt)", BAND_PADDING, BAND_PADDING_MD, "dots"),
        children: ["pizzeria-faq-inner"],
      },
      "pizzeria-faq-inner": {
        id: "pizzeria-faq-inner",
        type: "container",
        props: {},
        style: inner("820px", "20px", "28px"),
        children: ["pizzeria-faq-title", "pizzeria-faq-list"],
      },
      "pizzeria-faq-title": {
        id: "pizzeria-faq-title",
        type: "text",
        props: { content: "<strong>Before you come</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-faq-list": {
        id: "pizzeria-faq-list",
        type: "accordion",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("accordion").base,
            appearance: {
              ...defaultStyleFor("accordion").base.appearance,
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              borderRadius: "0",
              boxShadow: SHADOW_CARD,
            },
            spacing: { padding: "8px" },
          },
          overrides: { md: { spacing: { padding: "16px" } } },
        },
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["pizzeria-faq-1", "pizzeria-faq-2", "pizzeria-faq-3"],
      },
      "pizzeria-faq-1": {
        id: "pizzeria-faq-1",
        type: "accordion-item",
        props: { label: "Do you deliver?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["pizzeria-faq-1-text"],
      },
      "pizzeria-faq-1-text": {
        id: "pizzeria-faq-1-text",
        type: "text",
        props: { content: "<p>Yes, within 3 miles through our own drivers, and further out through delivery partners.</p>" },
        style: bodyText(),
      },
      "pizzeria-faq-2": {
        id: "pizzeria-faq-2",
        type: "accordion-item",
        props: { label: "Can you make a pizza dairy-free?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["pizzeria-faq-2-text"],
      },
      "pizzeria-faq-2-text": {
        id: "pizzeria-faq-2-text",
        type: "text",
        props: { content: "<p>Yes, ask for any pizza without cheese or with a plant-based mozzarella at no extra charge.</p>" },
        style: bodyText(),
      },
      "pizzeria-faq-3": {
        id: "pizzeria-faq-3",
        type: "accordion-item",
        props: { label: "Do you take reservations?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["pizzeria-faq-3-text"],
      },
      "pizzeria-faq-3-text": {
        id: "pizzeria-faq-3-text",
        type: "text",
        props: { content: "<p>Tables for 6 or more, yes. Smaller tables are first come, first served.</p>" },
        style: bodyText(),
      },

      // --- Order / booking -----------------------------------------------------
      "pizzeria-order": {
        id: "pizzeria-order",
        type: "section",
        props: {},
        style: band("var(--colors-surface-default)", BAND_PADDING, BAND_PADDING_MD, "ruled"),
        behaviors: REVEAL,
        children: ["pizzeria-order-inner"],
      },
      "pizzeria-order-inner": {
        id: "pizzeria-order-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px", alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)", gap: "48px" } } },
        },
        children: ["pizzeria-order-copy", "pizzeria-order-form"],
      },
      "pizzeria-order-copy": {
        id: "pizzeria-order-copy",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["pizzeria-order-eyebrow", "pizzeria-order-title", "pizzeria-order-sub", "pizzeria-order-perks"],
      },
      "pizzeria-order-eyebrow": { id: "pizzeria-order-eyebrow", type: "text", props: { content: "/ ORDER OR BOOK" }, style: eyebrow() },
      "pizzeria-order-title": {
        id: "pizzeria-order-title",
        type: "text",
        props: { content: "<strong>Get a table or a pie</strong>" },
        style: sectionTitle(),
      },
      "pizzeria-order-sub": {
        id: "pizzeria-order-sub",
        type: "text",
        props: { content: "Fill in the form and we'll confirm by phone within the hour." },
        style: bodyText(),
      },
      "pizzeria-order-perks": {
        id: "pizzeria-order-perks",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } }, spacing: { margin: "4px 0 0" } },
          overrides: { md: { spacing: { margin: "8px 0 0" } } },
        },
        children: ["pizzeria-order-perk-1", "pizzeria-order-perk-2", "pizzeria-order-perk-3"],
      },
      "pizzeria-order-perk-1": {
        id: "pizzeria-order-perk-1",
        type: "text",
        props: { content: "✓ Confirmed within the hour" },
        style: { base: { typography: { fontSize: { token: "typography.sizes.base" } }, appearance: { color: { token: "colors.text" } } } },
      },
      "pizzeria-order-perk-2": {
        id: "pizzeria-order-perk-2",
        type: "text",
        props: { content: "✓ Free delivery within 3 miles" },
        style: { base: { typography: { fontSize: { token: "typography.sizes.base" } }, appearance: { color: { token: "colors.text" } } } },
      },
      "pizzeria-order-perk-3": {
        id: "pizzeria-order-perk-3",
        type: "text",
        props: { content: "✓ Tell us about allergies and we'll adapt the pie" },
        style: { base: { typography: { fontSize: { token: "typography.sizes.base" } }, appearance: { color: { token: "colors.text" } } } },
      },
      "pizzeria-order-form": {
        id: "pizzeria-order-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            ...defaultStyleFor("form").base,
            layout: { display: "flex", flexDirection: "column", gap: "10px" },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: {
              ...defaultStyleFor("form").base.appearance,
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              borderRadius: "0",
            },
          },
        },
        behaviors: [{ type: "form-validation", options: {} }],
        children: [
          "pizzeria-order-label-name",
          "pizzeria-order-input-name",
          "pizzeria-order-label-phone",
          "pizzeria-order-input-phone",
          "pizzeria-order-label-type",
          "pizzeria-order-select-type",
          "pizzeria-order-submit",
          "pizzeria-order-note",
        ],
      },
      "pizzeria-order-label-name": { id: "pizzeria-order-label-name", type: "label", props: { text: "Full name", for: "pizzeria-order-input-name" }, style: defaultStyleFor("label") },
      "pizzeria-order-input-name": {
        id: "pizzeria-order-input-name",
        type: "input",
        props: { name: "name", placeholder: "Your name", type: "text", required: true, disabled: false },
        style: {
          base: { ...defaultStyleFor("input").base, spacing: { padding: "14px 16px" }, size: { width: "100%" }, appearance: { ...defaultStyleFor("input").base.appearance, borderRadius: "0" } },
        },
      },
      "pizzeria-order-label-phone": { id: "pizzeria-order-label-phone", type: "label", props: { text: "Phone", for: "pizzeria-order-input-phone" }, style: defaultStyleFor("label") },
      "pizzeria-order-input-phone": {
        id: "pizzeria-order-input-phone",
        type: "input",
        props: { name: "phone", placeholder: "+1 (512) 555-0177", type: "tel", required: true, disabled: false },
        style: {
          base: { ...defaultStyleFor("input").base, spacing: { padding: "14px 16px" }, size: { width: "100%" }, appearance: { ...defaultStyleFor("input").base.appearance, borderRadius: "0" } },
        },
      },
      "pizzeria-order-label-type": { id: "pizzeria-order-label-type", type: "label", props: { text: "Order type", for: "pizzeria-order-select-type" }, style: defaultStyleFor("label") },
      "pizzeria-order-select-type": {
        id: "pizzeria-order-select-type",
        type: "select",
        props: {
          options: [
            { label: "Dine-in", value: "dine-in" },
            { label: "Takeout", value: "takeout" },
            { label: "Delivery", value: "delivery" },
          ],
          name: "orderType",
          placeholder: "Select",
          ariaLabel: "Order type",
        },
        style: { base: { ...defaultStyleFor("select").base, size: { width: "100%" }, appearance: { ...defaultStyleFor("select").base.appearance, borderRadius: "0" } } },
      },
      "pizzeria-order-submit": {
        id: "pizzeria-order-submit",
        type: "button-submit",
        props: { label: "Confirm order", disabled: false },
        style: {
          base: {
            ...defaultStyleFor("button-submit").base,
            spacing: { padding: "16px 24px", margin: "4px 0 0" },
            size: { width: "100%" },
            typography: { ...defaultStyleFor("button-submit").base.typography, fontFamily: { token: "typography.families.sans" }, fontSize: "1.0625rem", fontWeight: { token: "typography.weights.bold" }, textAlign: "center" },
            appearance: { ...defaultStyleFor("button-submit").base.appearance, background: ACCENT_GRADIENT, borderRadius: "999px", color: { token: "colors.primary.on" }, boxShadow: SHADOW_CARD },
          },
          overrides: { md: { spacing: { margin: "8px 0 0" } } },
          states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
        },
      },
      "pizzeria-order-note": {
        id: "pizzeria-order-note",
        type: "text",
        props: { content: "We only use your details to manage this order." },
        style: { base: { typography: { fontSize: { token: "typography.sizes.sm" }, textAlign: "center" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Footer ---------------------------------------------------------------
      "pizzeria-footer": {
        id: "pizzeria-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("footer").base,
            spacing: { padding: "48px 20px 28px" },
            appearance: { ...defaultStyleFor("footer").base.appearance, background: { token: "colors.text" }, color: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "80px 20px 40px" } } },
        },
        children: ["pizzeria-footer-inner", "pizzeria-footer-copyright"],
      },
      "pizzeria-footer-copyright": {
        id: "pizzeria-footer-copyright",
        type: "text",
        props: { content: "© 2026 Forno Rosso. All rights reserved." },
        style: {
          base: {
            size: { width: "100%" },
            spacing: { padding: "16px 0 0 0" },
            typography: { textAlign: "center", fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: "inherit", borderColor: "rgba(255,255,255,0.16)", borderWidth: "1px 0 0 0", borderStyle: "solid" },
          },
        },
      },
      "pizzeria-footer-inner": {
        id: "pizzeria-footer-inner",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "24px" }, spacing: { margin: "0 auto" }, size: { width: "100%", maxWidth: INNER_MAX } },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["pizzeria-footer-cols"],
      },
      "pizzeria-footer-cols": {
        id: "pizzeria-footer-cols",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" },
            spacing: { padding: "0 0 20px" },
            appearance: { borderWidth: "0 0 1px", borderStyle: "solid", borderColor: { token: "colors.muted" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "40px" }, spacing: { padding: "0 0 28px" } } },
        },
        children: ["pizzeria-footer-brand-col", "pizzeria-footer-hours-col", "pizzeria-footer-contact-col"],
      },
      "pizzeria-footer-brand-col": {
        id: "pizzeria-footer-brand-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-footer-brand", "pizzeria-footer-address"],
      },
      "pizzeria-footer-brand": {
        id: "pizzeria-footer-brand",
        type: "text",
        props: { content: "<strong>Forno Rosso</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.25rem", fontWeight: { token: "typography.weights.regular" } },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "pizzeria-footer-address": {
        id: "pizzeria-footer-address",
        type: "text",
        props: { content: "220 Rainey St, Austin, TX 78701" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "pizzeria-footer-hours-col": {
        id: "pizzeria-footer-hours-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["pizzeria-footer-hours-title", "pizzeria-footer-hours-body"],
      },
      "pizzeria-footer-hours-title": {
        id: "pizzeria-footer-hours-title",
        type: "text",
        props: { content: "<strong>Opening hours</strong>" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "pizzeria-footer-hours-body": {
        id: "pizzeria-footer-hours-body",
        type: "text",
        props: { content: "Daily: 12:00 – 00:00" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "pizzeria-footer-contact-col": {
        id: "pizzeria-footer-contact-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" }, alignItems: "flex-start" } } },
        children: ["pizzeria-footer-contact-title", "pizzeria-footer-contact-body", "pizzeria-footer-social"],
      },
      "pizzeria-footer-contact-title": {
        id: "pizzeria-footer-contact-title",
        type: "text",
        props: { content: "<strong>Contact</strong>" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "pizzeria-footer-contact-body": {
        id: "pizzeria-footer-contact-body",
        type: "text",
        props: { content: "+1 (512) 555-0177<br/>hello@fornorosso.example" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "pizzeria-footer-social": {
        id: "pizzeria-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },
  };
}
