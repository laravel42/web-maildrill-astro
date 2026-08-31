/**
 * Inspector derecho (PLAN §6). Muestra id/type del nodo seleccionado, el
 * formulario generado (`InspectorForm`) y, si el nodo es un contenedor que
 * DESBORDA horizontalmente y aún no es slider, una affordance para convertirlo
 * en slider (docs/02: detección editor-only → acción que escribe estilo).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { selectSelectedNode } from "@/builder/store/selectors";
import { useOverflowStore } from "@/builder/store/overflowStore";
import { resolveStyle } from "@/builder/model/style";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { InspectorForm } from "@/builder/inspector/InspectorForm";
import { SiteSettingsPanel } from "@/builder/inspector/SiteSettingsPanel";
import { useLocalConfig } from "@/hooks/useLocalConfig";

export function Inspector() {
  const { t } = useTranslation("inspector");
  const node = useDocumentStore(selectSelectedNode);
  const setStyleProp = useDocumentStore((s) => s.setStyleProp);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);
  const overflowing = useOverflowStore((s) => (node ? !!s.overflowing[node.id] : false));
  const [inspectorCollapsed] = useLocalConfig("inspectorCollapsed");

  const def = node ? getDefinition(node.type) : undefined;
  // overflowX efectivo en el breakpoint activo (para saber si YA es slider).
  const isSlider = useMemo(() => {
    if (!node) return false;
    const ox = resolveStyle(node.style, activeBreakpoint, cfg).layout?.overflowX;
    return ox === "auto" || ox === "scroll";
  }, [node, activeBreakpoint, cfg]);

  const showSliderHint = !!node && !!def?.acceptsChildren && overflowing && !isSlider;

  const convertToSlider = () => {
    if (!node) return;
    setStyleProp(node.id, activeBreakpoint, ["layout", "overflowX"], "auto");
    setStyleProp(node.id, activeBreakpoint, ["layout", "flexWrap"], "nowrap");
  };

  return (
    <aside
      className={
        "pbx-inspector" +
        (!inspectorCollapsed ? " pbx-inspector--open" : "")
      }
    >
      <div className="pbx-inspector__body">
        {!node ? (
          <SiteSettingsPanel />
        ) : (
          <>
            {showSliderHint ? (
              <div className="pbx-overflow-hint" role="status">
                <span>
                  {t("overflow.overflowsPrefix")}
                  <code>{activeBreakpoint}</code>
                  {t("overflow.overflowsSuffix")}
                </span>
                <button
                  type="button"
                  className="pbx-overflow-hint__btn"
                  onClick={convertToSlider}
                >
                  {t("overflow.convertToSlider")}
                </button>
              </div>
            ) : null}

            <InspectorForm node={node} />
          </>
        )}
      </div>
    </aside>
  );
}
