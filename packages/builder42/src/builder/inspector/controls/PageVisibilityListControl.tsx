/**
 * PageVisibilityListControl — checklist de páginas del sitio para `navbar`
 * (docs/16 §12.4, rework por feedback de usuario).
 *
 * El `navbar` ya no requiere que el usuario escriba cada enlace a mano: la
 * lista de páginas sale del sistema de páginas del sitio (`site.pages` +
 * `pageOrder`, mismo orden que el `PageManager`). Este control solo decide
 * QUÉ páginas de esa lista se OCULTAN (`props.hiddenPageIds: PageId[]`) — la
 * fuente de verdad de qué páginas existen sigue siendo el store (P1); este
 * control nunca escribe títulos/rutas, solo el set de ids ocultos.
 *
 * Mismo patrón que el `VisibilityStrip` del Inspector (Toggle de c42 por fila, P10).
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { Toggle } from "@/components";
import type { NodeId } from "@/builder/model/types";

interface PageVisibilityListControlProps {
  nodeId: NodeId;
  fieldKey: string;
  hiddenPageIds: string[];
}

export function PageVisibilityListControl({ nodeId, fieldKey, hiddenPageIds }: PageVisibilityListControlProps) {
  const { t } = useTranslation("inspector");
  const setProp = useDocumentStore((s) => s.setProp);
  const pageOrder = useDocumentStore((s) => s.site.pageOrder);
  const pages = useDocumentStore((s) => s.site.pages);

  const hiddenSet = new Set(hiddenPageIds);

  const toggle = (pageId: string, visible: boolean) => {
    const next = visible
      ? hiddenPageIds.filter((id) => id !== pageId)
      : [...hiddenPageIds, pageId];
    setProp(nodeId, fieldKey, next);
  };

  if (pageOrder.length === 0) {
    return <p className="pbx-control__hint">{t("pageVisibilityList.empty")}</p>;
  }

  return (
    <div className="pbx-page-visibility-list">
      {pageOrder.map((pageId) => {
        const page = pages[pageId];
        if (!page) return null;
        const visible = !hiddenSet.has(pageId);
        return (
          <div key={pageId} className="pbx-page-visibility-list__row">
            <Toggle
              checked={visible}
              onChange={(checked) => toggle(pageId, checked)}
              label={t("pageVisibilityList.toggleAria", { title: page.meta.title })}
            >
              {page.meta.title}
            </Toggle>
          </div>
        );
      })}
    </div>
  );
}
