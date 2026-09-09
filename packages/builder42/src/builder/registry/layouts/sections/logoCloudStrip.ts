import type { NodeFragment } from "../../../model/tree";

/**
 * Franja de prueba social "empresas que confían en Maildrill": un badge de
 * verificación (icono, no texto-etiqueta) seguido del muro de logos
 * propiamente dicho, con 5 **wordmarks tipográficos** separados por reglas
 * verticales reales. Sin behavior `marquee`: es una franja estática, no un
 * carrusel.
 *
 * Rediseño estructural (impeccable — bolder; la ronda anterior solo subía
 * el rótulo a mayúsculas y añadía un borde a la banda, sin cambiar la
 * estructura, y se sintió plano):
 *
 *  - **Rótulo eliminado.** La versión anterior probó un rótulo
 *    "EMPRESAS QUE CONFÍAN EN MAILDRILL" en mayúsculas con tracking — es el
 *    patrón de kicker/eyebrow que el craft floor de este proyecto prohíbe
 *    sin excepción. Se sustituye por un **badge de verificación**
 *    (`logo-cloud-strip-badge`: icono `BadgeCheck` en un halo circular +
 *    texto corto "Empresas que confían en Maildrill" al lado, mismo patrón
 *    icono+texto ya usado en `features3Col`/`statsStrip` — la diferencia
 *    con un kicker es que aquí el icono es el protagonista visual y el
 *    texto lo acompaña en línea, no un rótulo suelto sobre un titular).
 *  - **Separadores verticales reales** (`divider` con `size.width: "1px"`,
 *    `height: "28px"`) entre cada logo — la franja se lee como una barra de
 *    confianza con divisiones explícitas, mismo lenguaje que una toolbar o
 *    una fila de métricas separadas. Se ocultan en `base` (`display: none`
 *    bajo `flex-wrap`, donde los logos ya rompen en 2-3 filas y una regla
 *    vertical suelta entre filas se vería rota) y aparecen desde `sm`.
 *  - El contenedor raíz mantiene el fondo/borde de banda ya introducidos
 *    (`colors.surface.alt` + borde 1px `colors.border` + `radii.lg`).
 *
 * Fix (feedback: "usa otros logos, se ve muy mal"): los 5 nodos `image` con
 * fotos reales de Unsplash (retratos/objetos recortados forzados a
 * `objectFit: contain` en cajas de 28-44px de alto) no leían como "logo de
 * cliente" — leían como fotos genéricas borrosas y desenfocadas, porque NO
 * son logos: son fotografías de stock recortadas a un rectángulo pequeño.
 * Mismo problema heredado del muro de `creativeAgencyPage.ts`, que usa las
 * mismas URLs.
 *
 * Se reemplazan por **wordmarks tipográficos** — 5 nodos `text` con el
 * nombre del cliente en mayúsculas, peso bold, tamaño consistente y
 * `colors.muted` (mismo tratamiento "logo de texto" que usan páginas reales
 * como Stripe o Vercel en su fila de "trusted by" cuando no hay artwork de
 * marca real disponible). Es el único camino honesto dentro del modelo de
 * este builder: no hay backend de generación de logotipos ni un asset real
 * de estas marcas ficticias, y una foto de stock recortada NUNCA se lee
 * como logo — un wordmark limpio sí, y es exactamente el patrón que usan
 * los placeholders reales de la industria.
 */
export function buildLogoCloudStripFragment(): NodeFragment {
  const sepStyle = (): NodeFragment["nodes"][string]["style"] => ({
    base: {
      layout: { display: "none" },
      size: { width: "1px", height: "20px" },
      spacing: { margin: "0" },
      appearance: { background: { token: "colors.border" }, border: "none", borderRadius: "0" },
    },
    overrides: { sm: { layout: { display: "block" }, size: { height: "24px" } } },
  });

  const wordmarkStyle = (): NodeFragment["nodes"][string]["style"] => ({
    base: {
      typography: {
        fontSize: { token: "typography.sizes.lg" },
        fontWeight: { token: "typography.weights.bold" },
      },
      appearance: { color: { token: "colors.muted" } },
    },
    overrides: { md: { typography: { fontSize: "1.375em" } } },
  });

  return {
    rootId: "logo-cloud-strip-root",
    nodes: {
      "logo-cloud-strip-root": {
        id: "logo-cloud-strip-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.md" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderColor: { token: "colors.border" },
              borderWidth: "1px",
              borderRadius: { token: "radii.lg" },
            },
          },
          overrides: {
            md: { spacing: { padding: "40px" } },
          },
        },
        children: ["logo-cloud-strip-badge", "logo-cloud-strip-cloud"],
      },

      // --- Badge de verificación (icono protagonista + texto en línea) -----
      "logo-cloud-strip-badge": {
        id: "logo-cloud-strip-badge",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", alignItems: "center", gap: { token: "spacing.sm" } } } },
        children: ["logo-cloud-strip-badge-icon-wrap", "logo-cloud-strip-badge-label"],
      },
      "logo-cloud-strip-badge-icon-wrap": {
        id: "logo-cloud-strip-badge-icon-wrap",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center", alignItems: "center" },
            size: { width: "32px", height: "32px" },
            appearance: { background: { token: "colors.primary.default" }, borderRadius: "50%" },
          },
        },
        children: ["logo-cloud-strip-badge-icon"],
      },
      "logo-cloud-strip-badge-icon": {
        id: "logo-cloud-strip-badge-icon",
        type: "icon",
        props: { name: "BadgeCheck", title: "" },
        style: { base: { size: { width: "18px", height: "18px" }, appearance: { color: { token: "colors.primary.on" } } } },
      },
      "logo-cloud-strip-badge-label": {
        id: "logo-cloud-strip-badge-label",
        type: "text",
        props: { content: "Empresas que confían en Maildrill" },
        style: {
          base: {
            typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },

      // --- Muro de wordmarks con separadores verticales ----------------------
      "logo-cloud-strip-cloud": {
        id: "logo-cloud-strip-cloud",
        type: "logo-cloud",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "20px" },
            spacing: { padding: "0" },
            appearance: { color: { token: "colors.muted" } },
          },
          overrides: { sm: { layout: { gap: "24px" } }, md: { layout: { gap: "40px" } } },
        },
        children: [
          "logo-cloud-strip-logo-1",
          "logo-cloud-strip-sep-1",
          "logo-cloud-strip-logo-2",
          "logo-cloud-strip-sep-2",
          "logo-cloud-strip-logo-3",
          "logo-cloud-strip-sep-3",
          "logo-cloud-strip-logo-4",
          "logo-cloud-strip-sep-4",
          "logo-cloud-strip-logo-5",
        ],
      },
      "logo-cloud-strip-logo-1": {
        id: "logo-cloud-strip-logo-1",
        type: "text",
        props: { content: "NORTEK" },
        style: wordmarkStyle(),
      },
      "logo-cloud-strip-sep-1": { id: "logo-cloud-strip-sep-1", type: "divider", props: {}, style: sepStyle() },
      "logo-cloud-strip-logo-2": {
        id: "logo-cloud-strip-logo-2",
        type: "text",
        props: { content: "FJORD GOODS" },
        style: wordmarkStyle(),
      },
      "logo-cloud-strip-sep-2": { id: "logo-cloud-strip-sep-2", type: "divider", props: {}, style: sepStyle() },
      "logo-cloud-strip-logo-3": {
        id: "logo-cloud-strip-logo-3",
        type: "text",
        props: { content: "VANTIA" },
        style: wordmarkStyle(),
      },
      "logo-cloud-strip-sep-3": { id: "logo-cloud-strip-sep-3", type: "divider", props: {}, style: sepStyle() },
      "logo-cloud-strip-logo-4": {
        id: "logo-cloud-strip-logo-4",
        type: "text",
        props: { content: "BRUMA LABS" },
        style: wordmarkStyle(),
      },
      "logo-cloud-strip-sep-4": { id: "logo-cloud-strip-sep-4", type: "divider", props: {}, style: sepStyle() },
      "logo-cloud-strip-logo-5": {
        id: "logo-cloud-strip-logo-5",
        type: "text",
        props: { content: "ORIXÁ DIGITAL" },
        style: wordmarkStyle(),
      },
    },
  };
}
