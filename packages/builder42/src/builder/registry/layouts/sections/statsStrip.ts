import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { statFragment } from "../helpers";

/**
 * Franja de KPIs con icono (docs/37 §3.1 #5): 3 `stat` + `icon`, distinta de
 * la de `example-home` (sin duplicar contenido, docs/16 §13.1). Métricas de
 * mensajería multicanal (throughput, deliverability, canales soportados).
 * Escrita exclusivamente con `BASE_TOKENS`.
 *
 * Ronda de mejora visual (mismo objetivo que hero/videoShowcase/features3Col/
 * teamGrid/ctaBanner en la ronda anterior — docs/37 §3.1, catálogo completo):
 * antes cada bloque icon+stat era un `container` sin fondo/sombra/radius, así
 * que los 3 KPIs "flotaban" sueltos sobre el fondo de la página sin ningún
 * contenedor visual que los agrupara como una unidad. Ahora cada bloque es
 * una card real:
 *  - `appearance.background: colors.surface.default` + `borderRadius:
 *    radii.lg` (generoso, coherente con las cards ya mejoradas de
 *    `features3Col`/`teamGrid`) + `borderColor: colors.border` (borde sutil de
 *    1px, no solo sombra — evita que la card "desaparezca" en temas donde el
 *    fondo de página y `colors.surface.default` casi no contrastan).
 *  - `appearance.boxShadow` con blur real de 2 capas (sombra larga y difusa +
 *    sombra corta de contacto), NO el `shadows.sm` de 1px del token base —
 *    mismo criterio que las otras secciones ya pulidas: una sombra de un solo
 *    pixel no comunica elevación en pantallas de alta densidad.
 *  - El `stat` interno pierde su padding propio (`spacing.padding: 0`) porque
 *    ahora el padding vive en el contenedor card — evita doble padding
 *    (card + stat) que dejaría el número/label empujado hacia el centro sin
 *    necesidad.
 *
 * Breakpoints (docs/01 §1, `DEFAULT_BREAKPOINTS`: `base/sm 640/md 768/lg
 * 1024`) — el bug real que rompía el hero en la ronda anterior era el mismo
 * patrón: valores pensados solo para desktop, sin ningún ajuste explícito
 * para `base`, que en un viewport angosto (320-375px) heredaban tamaños
 * pensados para pantallas grandes. Aquí:
 *  - Grid: `base` = 1 columna (cada card a ancho completo, la más segura en
 *    320px con 3 items de contenido variable). `sm` (≥640px) = 2 columnas
 *    — ya cabe cómodo un par de cards de ~280px con gap sin apretarse; el
 *    tercer item cae solo en la fila siguiente (no se fuerza a 3 en un ancho
 *    donde cada card quedaría <200px). `md` (≥768px) = 3 columnas, layout
 *    final.
 *  - `gap`/`padding` de la sección: `spacing.sm` en `base` (compacto, no
 *    desperdicia el ancho de un móvil angosto) → `spacing.md` en `sm` →
 *    `spacing.lg` en `md` (más aire una vez que hay espacio horizontal de
 *    sobra).
 *  - Padding interno de cada card: `spacing.sm` en `base` (evita el padding
 *    "de escritorio" comprimiendo el contenido en 320px) → `spacing.lg` en
 *    `md` (la card respira más en desktop).
 *  - `icon`: `20px` en `base` → `24px` (default) desde `md`, para que el
 *    glifo no domine desproporcionadamente una card angosta en mobile.
 *  - `stat-value` (número grande, ver `STAT_VALUE_STYLE` en `helpers.ts`/
 *    `Stat.tsx`, `2.75em` por defecto): se pisa a `1.75em` en `base` y crece a
 *    `2.25em` en `sm` y al `2.75em` completo en `md` — en 320px un `2.75em`
 *    (~44px con la base de 16px) sobre 3 cards en columna ya se ve bien
 *    porque cada card ocupa el ancho completo, pero se compacta un poco para
 *    dejar más aire vertical entre las 3 cards apiladas.
 */
export function buildStatsStripFragment(): NodeFragment {
  const cardStyle = (): NodeFragment["nodes"][string]["style"] => ({
    base: {
      layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } },
      spacing: { padding: { token: "spacing.sm" } },
      appearance: {
        background: { token: "colors.surface.default" },
        borderColor: { token: "colors.border" },
        borderWidth: "1px",
        borderStyle: "solid",
        borderRadius: { token: "radii.lg" },
        boxShadow: "0 16px 32px -12px rgba(15,23,42,0.14), 0 3px 8px -2px rgba(15,23,42,0.08)",
      },
    },
    overrides: {
      md: {
        spacing: { padding: { token: "spacing.lg" } },
      },
    },
  });

  const iconStyle = (): NodeFragment["nodes"][string]["style"] => {
    const base = defaultStyleFor("icon");
    return {
      ...base,
      base: { ...base.base, size: { width: "20px", height: "20px" } },
      overrides: { md: { size: { width: "24px", height: "24px" } } },
    };
  };

  const statRootStyle = (): NodeFragment["nodes"][string]["style"] => {
    const base = defaultStyleFor("stat");
    return {
      ...base,
      base: { ...base.base, spacing: { padding: "0" } },
    };
  };

  const valueOverrideStyle: NodeFragment["nodes"][string]["style"] = {
    base: { typography: { fontSize: "1.75em", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.1" }, spacing: { margin: "0" } },
    overrides: {
      sm: { typography: { fontSize: "2.25em" } },
      md: { typography: { fontSize: "2.75em" } },
    },
  };

  /**
   * `statFragment` no expone un parámetro para el estilo del hijo
   * `${id}-value` (solo `rootStyle`, aplicado al nodo `stat` raíz) — se pisa
   * aquí el estilo del nodo `${id}-value` ya generado con el `fontSize`
   * responsive descrito arriba, sin duplicar el resto del árbol del stat.
   */
  const withResponsiveValue = (nodes: Record<string, BuilderNode>, statId: string) => {
    const valueId = `${statId}-value`;
    if (nodes[valueId]) {
      nodes[valueId] = { ...nodes[valueId], style: valueOverrideStyle };
    }
    return nodes;
  };

  return {
    rootId: "stats-strip-root",
    nodes: {
      "stats-strip-root": {
        id: "stats-strip-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.sm" } },
          },
          overrides: {
            sm: {
              layout: { gridTemplateColumns: "repeat(2, 1fr)" },
              spacing: { padding: { token: "spacing.md" } },
            },
            md: {
              layout: { gridTemplateColumns: "repeat(3, 1fr)" },
              spacing: { padding: { token: "spacing.lg" } },
            },
          },
        },
        children: ["stats-strip-1", "stats-strip-2", "stats-strip-3"],
      },
      "stats-strip-1": {
        id: "stats-strip-1",
        type: "container",
        props: {},
        style: cardStyle(),
        children: ["stats-strip-1-icon", "stats-strip-1-stat"],
      },
      "stats-strip-1-icon": {
        id: "stats-strip-1-icon",
        type: "icon",
        props: { name: "Zap", title: "" },
        style: iconStyle(),
      },
      ...withResponsiveValue(statFragment("stats-strip-1-stat", { value: "10M+", label: "messages delivered per month" }, statRootStyle()), "stats-strip-1-stat"),
      "stats-strip-2": {
        id: "stats-strip-2",
        type: "container",
        props: {},
        style: cardStyle(),
        children: ["stats-strip-2-icon", "stats-strip-2-stat"],
      },
      "stats-strip-2-icon": {
        id: "stats-strip-2-icon",
        type: "icon",
        props: { name: "ShieldCheck", title: "" },
        style: iconStyle(),
      },
      ...withResponsiveValue(statFragment("stats-strip-2-stat", { value: "99.9%", label: "delivery rate (deliverability)" }, statRootStyle()), "stats-strip-2-stat"),
      "stats-strip-3": {
        id: "stats-strip-3",
        type: "container",
        props: {},
        style: cardStyle(),
        children: ["stats-strip-3-icon", "stats-strip-3-stat"],
      },
      "stats-strip-3-icon": {
        id: "stats-strip-3-icon",
        type: "icon",
        props: { name: "Globe", title: "" },
        style: iconStyle(),
      },
      ...withResponsiveValue(statFragment("stats-strip-3-stat", { value: "4", label: "channels: email, SMS, WhatsApp, and voice" }, statRootStyle()), "stats-strip-3-stat"),
    },
  };
}
