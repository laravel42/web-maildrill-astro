import type { BuilderDocument, NodeId, NodeStyle, PageMeta } from "../../model/types";
import type { NodeFragment } from "../../model/tree";
import type { NodeTranslations } from "../../model/types";
import { defaultStyleFor } from "../../store/exampleSite/styleFor";

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
