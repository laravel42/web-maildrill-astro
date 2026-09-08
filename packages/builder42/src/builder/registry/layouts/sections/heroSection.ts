import type { NodeFragment } from "../../../model/tree";

/**
 * Hero **full-bleed** con foto real de fondo, replicando EXACTAMENTE el
 * patrón de `agency-hero` en `creativeAgencyPage.ts` (docs/17, líneas
 * ~266-283): nodo raíz tipo `hero` con `layout: flex-column,
 * justifyContent: flex-end, alignItems: flex-start`, `size.minHeight` alto
 * en `base` y aún más alto en el override `md`, y
 * `appearance.background` con el mismo gradiente + `url(...)
 * center/cover no-repeat` para legibilidad del texto sobre la foto. El
 * texto usa `colors.band.on` (color pensado para bandas oscuras) y la
 * tipografía de impacto usa el mismo `clamp(2.5rem, 7vw, 5rem)` que
 * `agency-hero-title`.
 *
 * Por qué el salto de "grid 2 columnas + foto recortada" a full-bleed:
 * el diseño previo (foto en un contenedor de `320px`/`420px` de alto)
 * diluía el impacto visual del hero — quedaba como una tarjeta más en vez
 * de la portada de la sección. El patrón `agency-hero` ya resuelto en
 * `creativeAgencyPage.ts` es el estándar de este proyecto para héroes de
 * impacto: la foto ocupa el 100% del nodo (vía `background`, no `<img>`),
 * el overlay en gradiente garantiza contraste AA para el texto en
 * `colors.band.on`, y el contenido queda anclado abajo-izquierda con
 * `flex-end`/`flex-start` — nunca con `position: absolute` (el modelo de
 * estilos de este proyecto, ver `builder/model/types.ts` — `LayoutStyle` /
 * `AppearanceStyle` — no declara `position`/`top`/`left`/`zIndex`; todo el
 * posicionamiento se resuelve con flujo normal + flexbox).
 *
 * Foto: equipo trabajando frente a pantallas con mensajes/chat — temática
 * de comunicación/mensajería distinta a la ya usada por `agency-hero`
 * (`photo-1558655146-d09347e92766`) y por `cta-banner`
 * (`photo-1522071820081-009f0129c71c`), ver `ctaBanner.ts`.
 *
 * Copy propio de mensajería multicanal Maildrill (email, SMS, WhatsApp,
 * voz), no genérico. Escrito exclusivamente con `BASE_TOKENS` salvo la
 * imagen de fondo.
 * Responsive (fix mobile, docs/builder-sections-plan.md): el `clamp` del
 * título usaba un mínimo fijo de `2.5rem` (40px) sin override — en un
 * viewport angosto (320-375px) con `padding: 20px` y el copy real (20ch),
 * eso desborda o se ve desproporcionado. Ahora el mínimo del `clamp` baja a
 * `1.75rem` en `base` y solo alcanza `2.5rem`/`5rem` a partir de `sm`/`md`
 * vía `overrides`, además de reducir el padding vertical del hero y el
 * `minHeight` en `base` para que el texto no quede apretado contra bordes en
 * pantallas chicas.
 */
export function buildHeroSectionFragment(): NodeFragment {
  return {
    rootId: "hero-section-root",
    nodes: {
      "hero-section-root": {
        id: "hero-section-root",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start" },
            spacing: { padding: "32px 20px" },
            size: { width: "100%", minHeight: "440px" },
            typography: { fontFamily: { token: "typography.families.display" } },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.band.on" },
            },
          },
          overrides: {
            sm: { size: { minHeight: "520px" }, spacing: { padding: "56px 32px" } },
            md: { size: { minHeight: "720px" }, spacing: { padding: "96px 20px" } },
          },
        },
        children: ["hero-section-title", "hero-section-sub", "hero-section-cta"],
      },
      "hero-section-title": {
        id: "hero-section-title",
        type: "text",
        props: { content: "<strong>Cada mensaje, en el canal correcto, en el momento correcto</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(1.75rem, 8vw, 2.5rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.08",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
          overrides: {
            sm: { size: { maxWidth: "20ch" }, typography: { fontSize: "clamp(2.25rem, 6vw, 3.25rem)" } },
            md: { typography: { fontSize: "clamp(2.5rem, 5vw, 5rem)", lineHeight: "1.02" } },
          },
        },
      },
      "hero-section-sub": {
        id: "hero-section-sub",
        type: "text",
        props: {
          content:
            "Email, SMS, WhatsApp y voz desde un solo workspace: crea la campaña una vez, entrégala en el canal donde tu audiencia realmente responde.",
        },
        style: {
          base: {
            size: { maxWidth: "42ch" },
            spacing: { margin: "16px 0 0 0" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "hero-section-cta": {
        id: "hero-section-cta",
        type: "button",
        props: { label: "Probar ahora", link: { kind: "external", href: "#" } },
        style: {
          base: {
            spacing: { padding: "14px 26px", margin: "24px 0 0 0" },
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
    },
  };
}
