import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Vitrina de producto (docs/37 §3.1 #1): primer uso de `video` en la galería
 * de layouts (hueco real, docs/37 §1).
 *
 * Pulido de diseño: la versión anterior embebía un `video` (iframe de
 * YouTube) directo en el layout de la sección — pesado en el DOM (embed de
 * terceros cargando aunque nadie reproduzca nada) y poco vistoso frente al
 * resto de la galería. Se reemplaza por una GALERÍA DE THUMBNAILS estilo
 * tarjeta: grid mobile-first (1 col → `repeat(3, 1fr)` en `md`, mismo patrón
 * que `teamGrid.ts`/`features3Col.ts`) de 3 tarjetas, cada una con:
 * - un `container` con `layout.overflowY: "hidden"` + altura fija (`210px`,
 *   proporción ~16:9 a los anchos de columna típicos) y `borderRadius:
 *   radii.md` para recortar el `image` (`objectFit: "cover"`) de una foto
 *   real de Unsplash (pantalla/dashboard/persona presentando);
 * - debajo, EN FLUJO NORMAL (el modelo de estilos no soporta `position`,
 *   verificado en `builder/model/types.ts` — no hay overlay del ícono sobre
 *   la miniatura), una fila `icon` (`CirclePlay`, confirmado en
 *   `catalogs/generated/lucide.names.ts`) + `text` con el título corto del
 *   video, dando la sensación de "tarjeta de video para reproducir" sin el
 *   costo del embed.
 *
 * Las 3 tarjetas comparten un único `modal` (mismo patrón EXACTO que
 * `newsletterModalTrigger.ts`: la tarjeta-raíz lleva `onClick: { type:
 * "open-modal", target: <modalId> }`, el `modal` vive fuera del grid y no
 * ocupa layout). El modelo no permite parametrizar qué URL reproduce un
 * modal genérico por disparador, así que las 3 tarjetas abren el mismo
 * modal con un único video destacado (el "demo principal" — crear y enviar
 * una campaña multicanal), en vez de intentar 3 modales o un modal
 * paramétrico: prioriza que compile y sea coherente sobre la complejidad de
 * múltiples videos. Solo 2 behaviors únicos en toda la sección: `modal`
 * (en el diálogo) — el resto de nodos no lleva behaviors.
 */
export function buildVideoShowcaseFragment(): NodeFragment {
  return {
    rootId: "video-showcase-root",
    nodes: {
      "video-showcase-root": {
        id: "video-showcase-root",
        type: "section",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } }, spacing: { padding: { token: "spacing.md" } } },
        },
        children: ["video-showcase-title", "video-showcase-grid", "video-showcase-modal"],
      },
      "video-showcase-title": {
        id: "video-showcase-title",
        type: "text",
        props: { content: "<strong>See Maildrill in action</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: { token: "typography.sizes.lg" },
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "video-showcase-grid": {
        id: "video-showcase-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["video-showcase-card-1", "video-showcase-card-2", "video-showcase-card-3"],
      },

      // --- Tarjeta 1: Create your first campaign ---------------------------------
      "video-showcase-card-1": {
        id: "video-showcase-card-1",
        type: "card",
        props: {},
        style: defaultStyleFor("card"),
        onClick: { type: "open-modal", target: "video-showcase-modal" },
        children: ["video-showcase-card-1-thumb", "video-showcase-card-1-row"],
      },
      "video-showcase-card-1-thumb": {
        id: "video-showcase-card-1-thumb",
        type: "container",
        props: {},
        style: {
          base: {
            size: { height: "210px" },
            layout: { overflowX: "hidden", overflowY: "hidden" },
            appearance: { borderRadius: { token: "radii.md" } },
          },
        },
        children: ["video-showcase-card-1-img"],
      },
      "video-showcase-card-1-img": {
        id: "video-showcase-card-1-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&auto=format&fit=crop",
          },
          alt: "Person creating an email campaign in a visual editor on screen",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%", height: "100%" } } },
      },
      "video-showcase-card-1-row": {
        id: "video-showcase-card-1-row",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", alignItems: "center", gap: { token: "spacing.xs" } } },
        },
        children: ["video-showcase-card-1-icon", "video-showcase-card-1-label"],
      },
      "video-showcase-card-1-icon": {
        id: "video-showcase-card-1-icon",
        type: "icon",
        props: { name: "CirclePlay", title: "" },
        style: defaultStyleFor("icon"),
      },
      "video-showcase-card-1-label": {
        id: "video-showcase-card-1-label",
        type: "text",
        props: { content: "Create your first campaign" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },

      // --- Tarjeta 2: Live deliverability dashboard --------------------------
      "video-showcase-card-2": {
        id: "video-showcase-card-2",
        type: "card",
        props: {},
        style: defaultStyleFor("card"),
        onClick: { type: "open-modal", target: "video-showcase-modal" },
        children: ["video-showcase-card-2-thumb", "video-showcase-card-2-row"],
      },
      "video-showcase-card-2-thumb": {
        id: "video-showcase-card-2-thumb",
        type: "container",
        props: {},
        style: {
          base: {
            size: { height: "210px" },
            layout: { overflowX: "hidden", overflowY: "hidden" },
            appearance: { borderRadius: { token: "radii.md" } },
          },
        },
        children: ["video-showcase-card-2-img"],
      },
      "video-showcase-card-2-img": {
        id: "video-showcase-card-2-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format&fit=crop",
          },
          alt: "Deliverability dashboard with real-time charts on a screen",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%", height: "100%" } } },
      },
      "video-showcase-card-2-row": {
        id: "video-showcase-card-2-row",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", alignItems: "center", gap: { token: "spacing.xs" } } },
        },
        children: ["video-showcase-card-2-icon", "video-showcase-card-2-label"],
      },
      "video-showcase-card-2-icon": {
        id: "video-showcase-card-2-icon",
        type: "icon",
        props: { name: "CirclePlay", title: "" },
        style: defaultStyleFor("icon"),
      },
      "video-showcase-card-2-label": {
        id: "video-showcase-card-2-label",
        type: "text",
        props: { content: "Live deliverability dashboard" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },

      // --- Tarjeta 3: Automations in 3 steps ------------------------------
      "video-showcase-card-3": {
        id: "video-showcase-card-3",
        type: "card",
        props: {},
        style: defaultStyleFor("card"),
        onClick: { type: "open-modal", target: "video-showcase-modal" },
        children: ["video-showcase-card-3-thumb", "video-showcase-card-3-row"],
      },
      "video-showcase-card-3-thumb": {
        id: "video-showcase-card-3-thumb",
        type: "container",
        props: {},
        style: {
          base: {
            size: { height: "210px" },
            layout: { overflowX: "hidden", overflowY: "hidden" },
            appearance: { borderRadius: { token: "radii.md" } },
          },
        },
        children: ["video-showcase-card-3-img"],
      },
      "video-showcase-card-3-img": {
        id: "video-showcase-card-3-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&q=80&auto=format&fit=crop",
          },
          alt: "Messaging automation flow shown on a dashboard",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%", height: "100%" } } },
      },
      "video-showcase-card-3-row": {
        id: "video-showcase-card-3-row",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "row", alignItems: "center", gap: { token: "spacing.xs" } } },
        },
        children: ["video-showcase-card-3-icon", "video-showcase-card-3-label"],
      },
      "video-showcase-card-3-icon": {
        id: "video-showcase-card-3-icon",
        type: "icon",
        props: { name: "CirclePlay", title: "" },
        style: defaultStyleFor("icon"),
      },
      "video-showcase-card-3-label": {
        id: "video-showcase-card-3-label",
        type: "text",
        props: { content: "Automations in 3 steps" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },

      // --- Modal compartido: demo principal ------------------------------------
      "video-showcase-modal": {
        id: "video-showcase-modal",
        type: "modal",
        props: { title: "Main demo: Maildrill in action" },
        style: defaultStyleFor("modal"),
        behaviors: [{ type: "modal", options: { closeOnBackdrop: true, duration: 200 } }],
        children: ["video-showcase-modal-video"],
      },
      "video-showcase-modal-video": {
        id: "video-showcase-modal-video",
        type: "video",
        props: {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          aspectRatio: "16:9",
          title: "Demo: create and send a multichannel campaign in Maildrill",
        },
        style: defaultStyleFor("video"),
      },
    },
  };
}
