import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Franja de prueba social "empresas que confían en Maildrill": un rótulo
 * pequeño fuera del `logo-cloud` (docs/16 §12.1 #14) seguido del muro de
 * logos propiamente dicho, con 5 nodos `image` (`objectFit: "contain"`,
 * mismo patrón que la fila de clientes de `creativeAgencyPage.ts`). Sin
 * behavior `marquee`: es una franja estática, no un carrusel.
 *
 * Pulido de diseño (ronda de mejora visual): antes el rótulo + fila de logos
 * flotaban sueltos, sin ningún contenedor visual que los diferenciara del
 * resto de la página (mismo fondo, sin límite propio). El `container` raíz
 * (`logo-cloud-strip-root`) pasa a comportarse como una banda propia:
 * `background: colors.surface.alt` (mismo tono que usa `features3Col`/
 * `teamGrid` para diferenciar superficies) + `radii.lg` + padding vertical
 * generoso (`spacing.lg` en `base`, sube a `40px` desde `md`) — se lee como
 * sección con identidad propia, no como texto+logos sin marco.
 *
 * Mobile angosto (320-375px, `flex-wrap: wrap` de 5 logos): con el
 * `gap: "32px"`/`maxWidth: "120px"` original, 375px de viewport menos
 * `spacing.md` de padding a cada lado deja ~325-340px útiles — dos logos de
 * 120px + 32px de gap ya ocupan 272px, así que en la práctica solo entraban
 * 2 por fila con mucho aire perdido y una tercera fila corta y desbalanceada
 * para el 5º logo. Se reduce el gap en `base` a `20px` y el tamaño de cada
 * logo a `maxWidth: "88px"`/`height: "28px"` (siguen siendo legibles como
 * "logo de cliente", no iconos) para que quepan 3 por fila con aire real
 * entre ellos; ambos escalan por breakpoint (`DEFAULT_BREAKPOINTS`,
 * `builder/model/types.ts`): tamaño completo (`120px`/`40px`, `gap: 32px`)
 * desde `sm` (640px, ya hay ancho de sobra para 3-4 por fila), y el `gap`
 * generoso de `64px` que ya existía se mantiene reservado para `md` (768px)
 * en adelante, donde caben los 5 logos en una sola fila con espacio de
 * sobra.
 */
export function buildLogoCloudStripFragment(): NodeFragment {
  return {
    rootId: "logo-cloud-strip-root",
    nodes: {
      "logo-cloud-strip-root": {
        id: "logo-cloud-strip-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: { token: "radii.lg" },
            },
          },
          overrides: {
            md: { spacing: { padding: "40px" } },
          },
        },
        children: ["logo-cloud-strip-label", "logo-cloud-strip-cloud"],
      },
      "logo-cloud-strip-label": {
        id: "logo-cloud-strip-label",
        type: "text",
        props: { content: "Empresas que confían en Maildrill" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: { token: "typography.sizes.sm" },
              fontWeight: { token: "typography.weights.medium" },
            },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
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
          overrides: { sm: { layout: { gap: "32px" } }, md: { layout: { gap: "64px" } } },
        },
        children: [
          "logo-cloud-strip-logo-1",
          "logo-cloud-strip-logo-2",
          "logo-cloud-strip-logo-3",
          "logo-cloud-strip-logo-4",
          "logo-cloud-strip-logo-5",
        ],
      },
      "logo-cloud-strip-logo-1": {
        id: "logo-cloud-strip-logo-1",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=240&q=80&auto=format&fit=crop" },
          alt: "Logo del cliente Nortek",
          objectFit: "contain",
          loading: "lazy",
        },
        style: {
          base: { size: { width: "auto", maxWidth: "88px", height: "28px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { sm: { size: { maxWidth: "120px", height: "40px" } }, md: { size: { height: "44px" } } },
        },
      },
      "logo-cloud-strip-logo-2": {
        id: "logo-cloud-strip-logo-2",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1611162457237-98a67b8be684?w=240&q=80&auto=format&fit=crop" },
          alt: "Logo del cliente Fjord Goods",
          objectFit: "contain",
          loading: "lazy",
        },
        style: {
          base: { size: { width: "auto", maxWidth: "88px", height: "28px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { sm: { size: { maxWidth: "120px", height: "40px" } }, md: { size: { height: "44px" } } },
        },
      },
      "logo-cloud-strip-logo-3": {
        id: "logo-cloud-strip-logo-3",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=240&q=80&auto=format&fit=crop" },
          alt: "Logo del cliente Vantia",
          objectFit: "contain",
          loading: "lazy",
        },
        style: {
          base: { size: { width: "auto", maxWidth: "88px", height: "28px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { sm: { size: { maxWidth: "120px", height: "40px" } }, md: { size: { height: "44px" } } },
        },
      },
      "logo-cloud-strip-logo-4": {
        id: "logo-cloud-strip-logo-4",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1611162458324-aae1eb4129a4?w=240&q=80&auto=format&fit=crop" },
          alt: "Logo del cliente Bruma Labs",
          objectFit: "contain",
          loading: "lazy",
        },
        style: {
          base: { size: { width: "auto", maxWidth: "88px", height: "28px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { sm: { size: { maxWidth: "120px", height: "40px" } }, md: { size: { height: "44px" } } },
        },
      },
      "logo-cloud-strip-logo-5": {
        id: "logo-cloud-strip-logo-5",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1622547785177-6f321421d693?w=240&q=80&auto=format&fit=crop" },
          alt: "Logo del cliente Orixá Digital",
          objectFit: "contain",
          loading: "lazy",
        },
        style: {
          base: { size: { width: "auto", maxWidth: "88px", height: "28px" }, appearance: { color: { token: "colors.muted" } } },
          overrides: { sm: { size: { maxWidth: "120px", height: "40px" } }, md: { size: { height: "44px" } } },
        },
      },
    },
  };
}
