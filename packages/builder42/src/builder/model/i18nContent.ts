/**
 * Resolución de contenido multilingüe (docs/12 §B.4, §B.7). Función PURA (P7):
 * fusiona `node.props` (idioma default) con la traducción activa del locale
 * dado, campo a campo, solo para las claves marcadas `translatable` en el
 * `propsSchema` del componente (docs/12 §B.5). Si no hay traducción para un
 * campo, se usa el valor default como fallback — igual que el estilo
 * responsive (capa activa = override, default = base).
 *
 * La usan tanto el canvas (`NodeRenderer`, modo edición) como el export
 * (`exportSite`, B2.1): mismo criterio de resolución en ambos lados (P1/P3).
 */

import type { BuilderNode, NodeId, NodeTranslations, PageMeta, PageMetaTranslation } from "./types";
import { getDefinition } from "../registry/componentRegistry";

/**
 * Props efectivas de un nodo en `locale` (docs/12 §B.7). En el idioma default
 * devuelve `node.props` tal cual (misma referencia, sin copiar). En otro
 * idioma, fusiona solo los campos `translatable` que tengan traducción; los
 * demás (traducibles sin traducción, o no-traducibles) caen al valor default.
 */
export function resolvePropsForLocale(
  node: BuilderNode,
  locale: string,
  defaultLocale: string,
  translations: Record<NodeId, NodeTranslations> | undefined,
): Record<string, unknown> {
  if (locale === defaultLocale) return node.props;
  const nodeT = translations?.[node.id]?.[locale];
  if (!nodeT) return node.props;

  const translatableKeys = getDefinition(node.type)?.propsSchema.fields
    .filter((f) => f.translatable)
    .map((f) => f.key);
  if (!translatableKeys || translatableKeys.length === 0) return node.props;

  const merged: Record<string, unknown> = { ...node.props };
  for (const key of translatableKeys) {
    if (key in nodeT) merged[key] = nodeT[key];
  }
  return merged;
}


/**
 * Metadata SEO efectiva de una página en `locale` (docs/12 §B.9). En el
 * idioma default devuelve `meta` tal cual (misma referencia). En otro
 * idioma, fusiona campo a campo con `meta.metaTranslations[locale]`: `title`
 * y `description` se sobreescriben si están presentes en la traducción;
 * `seo` se fusiona a un nivel más (openGraph/twitter), preservando cualquier
 * campo del default no cubierto por la traducción — mismo criterio de
 * fallback que `resolvePropsForLocale`.
 */
export function resolveMetaForLocale(
  meta: PageMeta,
  locale: string,
  defaultLocale: string,
): PageMeta {
  if (locale === defaultLocale) return meta;
  const t: PageMetaTranslation | undefined = meta.metaTranslations?.[locale];
  if (!t) return meta;

  const seo =
    t.seo === undefined && meta.seo === undefined
      ? undefined
      : {
          ...meta.seo,
          ...t.seo,
          openGraph:
            t.seo?.openGraph === undefined && meta.seo?.openGraph === undefined
              ? undefined
              : { ...meta.seo?.openGraph, ...t.seo?.openGraph },
          twitter:
            t.seo?.twitter === undefined && meta.seo?.twitter === undefined
              ? undefined
              : { ...meta.seo?.twitter, ...t.seo?.twitter },
        };

  return {
    ...meta,
    title: t.title ?? meta.title,
    description: t.description ?? meta.description,
    seo,
  };
}
