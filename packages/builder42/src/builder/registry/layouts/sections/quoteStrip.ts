import type { NodeFragment } from "../../../model/tree";
import { darkBandStyleFor, quoteFragment } from "../helpers";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Cita destacada a ancho completo sobre una banda enfática oscura (docs/43
 * §3, docs/48 §3.2): el `section` raíz lleva `appearance.background` al
 * token `colors.band.dark` y el `quote` interior usa `darkBandStyleFor` para
 * que su texto siga siendo legible sobre el fondo oscuro. Atribuida a un
 * caso de uso real de Maildrill (recuperación de campañas con alta tasa de
 * apertura vía multicanal).
 *
 * Rediseño estructural (impeccable — bolder; la ronda anterior solo subía
 * tamaños de fuente y agregaba una marca de comillas, sin evidencia real de
 * prueba social, y se sintió plano):
 *
 *  - **Marca de comillas** (`quote-strip-mark`): se mantiene — un glifo `"`
 *    grande antes de la cita, mismo criterio que un pull-quote editorial
 *    (es un motivo tipográfico del propio contenido, no un kicker/etiqueta
 *    separada, así que no cae en el ban del craft floor).
 *  - **Avatar real del cliente** (`quote-strip-avatar`, mismo componente
 *    `avatar` + patrón circular ya usado en `teamGrid`) — antes la
 *    atribución era solo texto (`— Nombre, Rol`); ahora hay una cara real
 *    junto a la cita, la misma evidencia visual que un testimonio de
 *    verdad usa. Se coloca en una fila junto al bloque cita+atribución
 *    (`quote-strip-row`, `flex-direction: column` en `base`, `row` desde
 *    `sm` — un avatar de 64px al lado de una cita a ancho completo en un
 *    viewport angosto se vería apretado).
 *  - **Rating de 5 estrellas** (`quote-strip-rating`, icono `Star` × 5,
 *    mismo componente `icon` que el resto del catálogo) sobre la
 *    atribución — refuerza la prueba social con una señal reconocible al
 *    instante, sin depender solo del texto de la cita.
 *
 * Fix de contraste (feedback: "los colores de la letra de quote no se ven"):
 * la marca de comillas, la atribución y las estrellas usaban
 * `colors.primary.default` (azul indigo `#2563eb`) sobre
 * `colors.band.dark` (casi negro `#1a1a1a`) — azul saturado sobre fondo
 * casi negro cae muy por debajo de 4.5:1, ilegible en la práctica. Los tres
 * elementos pasan a `colors.band.on` (blanco, el par semántico correcto
 * para texto sobre banda oscura — mismo token que ya usa el propio cuerpo
 * de la cita vía `darkBandStyleFor`, y que un tema remapea junto con
 * `colors.band.dark` para que el contraste se mantenga en cualquier tema).
 *
 * Segundo fix de contraste (feedback: "el background interno del quote
 * sigue siendo blanco, no se lee el texto"): `darkBandStyleFor` SOLO
 * sobreescribe `appearance.color` — el `background` de
 * `QUOTE_DEFAULT_STYLE` (`colors.surface.alt`, un tono claro) queda
 * intacto. El `<blockquote>` heredaba ese fondo claro con texto blanco
 * encima: el fix de color anterior no alcanzaba porque el problema real
 * era un SEGUNDO fondo claro anidado dentro de la banda oscura, no el
 * color del texto. Se añade `appearance.background: "transparent"`
 * explícito al `rootStyle` del quote — la banda del `section` raíz ya
 * aporta el fondo oscuro (`colors.band.dark`), el `blockquote` no necesita
 * (ni debe) pintar el suyo encima.
 * `darkBandStyleFor("quote")` sigue siendo la base del cuerpo de la cita —
 * se mergea campo a campo con los overrides de tamaño/tipografía/fondo de
 * esta sección para no perder ese contraste.
 */
export function buildQuoteStripFragment(): NodeFragment {
  const quoteBandStyle = darkBandStyleFor("quote");
  const quoteNodes = quoteFragment(
    "quote-strip-quote",
    {
      content:
        "When we moved our reactivation campaigns to Maildrill, combining email and WhatsApp in the same flow tripled our open rate in less than a month.",
      attribution: "Diego Salcedo, Growth Lead at Cursor Fintech",
    },
    {
      ...quoteBandStyle,
      base: {
        ...quoteBandStyle.base,
        spacing: { ...quoteBandStyle.base.spacing, margin: "0" },
        appearance: { ...quoteBandStyle.base.appearance, background: "transparent" },
        typography: {
          ...quoteBandStyle.base.typography,
          fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
          lineHeight: "1.4",
        },
      },
    },
  );

  const attributionNode = quoteNodes["quote-strip-quote-attribution"];
  if (attributionNode) {
    attributionNode.style = {
      ...attributionNode.style,
      base: {
        ...attributionNode.style.base,
        typography: { ...attributionNode.style.base.typography, fontSize: { token: "typography.sizes.base" } },
        appearance: { ...attributionNode.style.base.appearance, color: { token: "colors.band.on" } },
      },
    };
  }

  const starStyle: NodeFragment["nodes"][string]["style"] = {
    base: { size: { width: "16px", height: "16px" }, appearance: { color: { token: "colors.band.on" } } },
  };

  return {
    rootId: "quote-strip-root",
    nodes: {
      "quote-strip-root": {
        id: "quote-strip-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            spacing: { padding: "24px 20px" },
            appearance: { background: { token: "colors.band.dark" } },
          },
          overrides: {
            sm: { spacing: { padding: "56px 32px" } },
            md: { spacing: { padding: "96px 20px" } },
          },
        },
        children: ["quote-strip-mark", "quote-strip-row"],
      },
      "quote-strip-mark": {
        id: "quote-strip-mark",
        type: "text",
        props: { content: "&ldquo;" },
        style: {
          base: {
            spacing: { margin: "0 0 -12px 0" },
            typography: {
              fontSize: "clamp(3rem, 8vw, 5rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },

      // --- Fila: avatar + (cita/rating/atribución) --------------------------
      "quote-strip-row": {
        id: "quote-strip-row",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.md" } },
            size: { maxWidth: "65ch" },
          },
          overrides: { sm: { layout: { flexDirection: "row", alignItems: "flex-start" } } },
        },
        children: ["quote-strip-avatar", "quote-strip-content-col"],
      },
      "quote-strip-avatar": {
        id: "quote-strip-avatar",
        type: "avatar",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80&auto=format&fit=crop&crop=faces",
          },
          alt: "Portrait of Diego Salcedo",
          initials: "DS",
        },
        style: {
          base: {
            ...defaultStyleFor("avatar").base,
            size: { width: "64px", height: "64px" },
            appearance: { ...defaultStyleFor("avatar").base.appearance, borderRadius: "50%" },
          },
        },
      },
      "quote-strip-content-col": {
        id: "quote-strip-content-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column" } } },
        children: ["quote-strip-rating", "quote-strip-quote"],
      },
      "quote-strip-rating": {
        id: "quote-strip-rating",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", gap: { token: "spacing.xs" } }, spacing: { margin: "0 0 8px 0" } } },
        children: [
          "quote-strip-star-1",
          "quote-strip-star-2",
          "quote-strip-star-3",
          "quote-strip-star-4",
          "quote-strip-star-5",
        ],
      },
      "quote-strip-star-1": { id: "quote-strip-star-1", type: "icon", props: { name: "Star", title: "" }, style: starStyle },
      "quote-strip-star-2": { id: "quote-strip-star-2", type: "icon", props: { name: "Star", title: "" }, style: starStyle },
      "quote-strip-star-3": { id: "quote-strip-star-3", type: "icon", props: { name: "Star", title: "" }, style: starStyle },
      "quote-strip-star-4": { id: "quote-strip-star-4", type: "icon", props: { name: "Star", title: "" }, style: starStyle },
      "quote-strip-star-5": { id: "quote-strip-star-5", type: "icon", props: { name: "Star", title: "" }, style: starStyle },
      ...quoteNodes,
    },
  };
}
