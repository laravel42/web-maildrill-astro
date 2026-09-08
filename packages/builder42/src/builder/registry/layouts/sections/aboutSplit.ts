import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Sección "quiénes somos" a 2 columnas (1 columna base, 2 en `md`, mismo
 * patrón responsive que `videoShowcase.ts`): foto real de equipo trabajando
 * a un lado, historia/misión de Maildrill como workspace de mensajería
 * multicanal (email, SMS, WhatsApp, voz) al otro.
 *
 * Responsive (fix mobile, ronda de mejora visual del catálogo — mismo bug
 * que rompía el hero): en `base` el grid es de **1 columna**, así que la
 * fila de la imagen no tiene una altura impuesta por un hermano — el
 * `size.height: "100%"` original quedaba sin referencia (`height: 100%` de
 * un contenedor sin altura explícita colapsa) y la imagen podía renderizar
 * con una altura mínima fea o inconsistente en móvil angosto (320-375px).
 * Ahora `base` fija `size.height: "240px"` (alto fijo razonable para una
 * foto ilustrativa en una columna) y el override `md` lo sube a `"320px"`:
 * ahí el grid ya es de 2 columnas con `alignItems: center`, así que una
 * altura fija (en vez de `100%`) sigue dando una fila de imagen cómoda sin
 * depender de la altura del texto vecino. El título usa `clamp()` con un
 * mínimo `1.5rem` en `base` (sube a `1.75rem`/`2rem` en `sm`/`md`) para que
 * la jerarquía tipográfica escale sin desbordar en pantallas chicas.
 */
export function buildAboutSplitFragment(): NodeFragment {
  return {
    rootId: "about-split-root",
    nodes: {
      "about-split-root": {
        id: "about-split-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" }, alignItems: "center" },
            spacing: { padding: { token: "spacing.md" } },
          },
          overrides: {
            sm: { spacing: { padding: { token: "spacing.lg" } } },
            md: { layout: { gridTemplateColumns: "1fr 1fr" }, spacing: { padding: { token: "spacing.xl" } } },
          },
        },
        children: ["about-split-image", "about-split-copy"],
      },
      "about-split-image": {
        id: "about-split-image",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop" },
          alt: "Equipo de Maildrill trabajando junto en la oficina",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: {
            ...defaultStyleFor("image").base,
            size: { width: "100%", height: "240px" },
            appearance: { borderRadius: { token: "radii.lg" }, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.28)" },
          },
          overrides: {
            md: { size: { height: "320px" } },
          },
        },
      },
      "about-split-copy": {
        id: "about-split-copy",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } },
        },
        children: ["about-split-title", "about-split-body"],
      },
      "about-split-title": {
        id: "about-split-title",
        type: "text",
        props: { content: "<strong>Un solo workspace para cada conversación con tu audiencia</strong>" },
        style: {
          base: {
            size: { maxWidth: "26ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.5rem, 5vw, 1.75rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.15",
            },
            appearance: { color: { token: "colors.text" } },
          },
          overrides: {
            sm: { size: { maxWidth: "30ch" } },
            md: { size: { maxWidth: "34ch" }, typography: { fontSize: "clamp(1.75rem, 3vw, 2rem)" } },
          },
        },
      },
      "about-split-body": {
        id: "about-split-body",
        type: "text",
        props: {
          content:
            "Maildrill nació para acabar con la dispersión de herramientas: un equipo, un editor visual y una sola vista de entregabilidad para email, SMS, WhatsApp y voz. Diseñamos cada detalle para que crear, enviar y analizar una campaña se sienta tan simple como debería haber sido siempre.",
        },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
    },
  };
}
