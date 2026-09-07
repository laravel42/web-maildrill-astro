import type { BuilderDocument, BuilderNode, NodeId, NodeStyle, PageMeta } from "../../model/types";
import type { NodeFragment } from "../../model/tree";
import type { NodeTranslations } from "../../model/types";
import { defaultStyleFor } from "../../store/exampleSite/styleFor";
import {
  TESTIMONIAL_AUTHOR_STYLE,
  TESTIMONIAL_AVATAR_STYLE,
  TESTIMONIAL_CAPTION_STYLE,
  TESTIMONIAL_NAME_STYLE,
  TESTIMONIAL_QUOTE_STYLE,
  TESTIMONIAL_ROLE_STYLE,
} from "../components/Testimonial";

/**
 * Metadata SEO que una plantilla de página propone para la página donde se
 * aplica (docs/42 §2.8). `slug`, `lang` y `themeId` NO se tocan: son del sitio
 * del usuario, no de la plantilla. `metaTranslations` sigue el mismo modelo que
 * el resto del contenido multilingüe (docs/12 §B.9).
 */
export interface LayoutPageMeta {
  title: string;
  description?: string;
  seo?: PageMeta["seo"];
  metaTranslations?: PageMeta["metaTranslations"];
}

/**
 * `defaultStyleFor(type)` con el color de texto forzado a un token de "encima de
 * banda oscura", para componentes que caen dentro de una **banda enfática**
 * (docs/43 §3, convención actualizada en docs/48 §3.2). Sin esto, un
 * `social-links`/`nav-menu` hereda `colors.text` de su `defaultStyle` y sus
 * glifos quedan casi invisibles sobre el footer oscuro (bug real detectado por
 * la guarda `lowContrastOnDarkBands`).
 *
 * El default es `colors.band.on`, el par semántico de `colors.band.dark`: un
 * tema los remapea juntos, así que el contraste se mantiene en cualquier tema
 * (con `colors.surface.default` no: un tema oscuro lo vuelve casi negro).
 */
export function darkBandStyleFor(type: string, colorToken = "colors.band.on"): NodeStyle {
  const style = defaultStyleFor(type);
  return {
    ...style,
    base: {
      ...style.base,
      appearance: { ...style.base.appearance, color: { token: colorToken } },
    },
  };
}

/** Convierte un documento completo en fragmento portable (plantillas de página). */
export function documentToFragment(
  doc: BuilderDocument,
  translations?: Record<NodeId, NodeTranslations>,
): NodeFragment {
  return {
    rootId: doc.rootId,
    nodes: structuredClone(doc.nodes),
    translations: translations ? structuredClone(translations) : undefined,
  };
}

/**
 * Subárbol de nodos de un `testimonial` (docs, recomposición de Testimonial en
 * componentes base — corrige el margin no editable de la fila avatar+autor).
 * Genera el mismo árbol que `TESTIMONIAL_DEFAULT_CHILDREN`/la migración de
 * `migrateSlots.ts`, con ids deterministas `${id}-quote`/`${id}-caption`/
 * `${id}-avatar`/`${id}-author`/`${id}-name`/`${id}-role` — así una plantilla
 * de página puede referenciar estos ids en `translations` igual que cualquier
 * otro nodo. `rootStyle` permite el mismo override que antes recibía el nodo
 * `testimonial` plano (p. ej. padding de card + `overrides.md`).
 */
export interface TestimonialContent {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export function testimonialFragment(
  id: NodeId,
  content: TestimonialContent,
  rootStyle?: NodeStyle,
): Record<NodeId, BuilderNode> {
  const quoteId = `${id}-quote`;
  const captionId = `${id}-caption`;
  const avatarId = `${id}-avatar`;
  const authorId = `${id}-author`;
  const nameId = `${id}-name`;
  const roleId = `${id}-role`;

  return {
    [id]: {
      id,
      type: "testimonial",
      props: {},
      style: rootStyle ?? defaultStyleFor("testimonial"),
      children: [quoteId, captionId],
    },
    [quoteId]: {
      id: quoteId,
      type: "text",
      props: { content: `<p>${content.quote}</p>` },
      style: structuredClone(TESTIMONIAL_QUOTE_STYLE),
    },
    [captionId]: {
      id: captionId,
      type: "container",
      props: {},
      style: structuredClone(TESTIMONIAL_CAPTION_STYLE),
      children: [avatarId, authorId],
    },
    [avatarId]: {
      id: avatarId,
      type: "avatar",
      props: { initials: content.initials },
      style: structuredClone(TESTIMONIAL_AVATAR_STYLE),
    },
    [authorId]: {
      id: authorId,
      type: "container",
      props: {},
      style: structuredClone(TESTIMONIAL_AUTHOR_STYLE),
      children: [nameId, roleId],
    },
    [nameId]: {
      id: nameId,
      type: "text",
      props: { content: `<strong>${content.name}</strong>` },
      style: structuredClone(TESTIMONIAL_NAME_STYLE),
    },
    [roleId]: {
      id: roleId,
      type: "text",
      props: { content: content.role },
      style: structuredClone(TESTIMONIAL_ROLE_STYLE),
    },
  };
}
