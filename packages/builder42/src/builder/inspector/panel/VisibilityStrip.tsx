/**
 * VisibilityStrip — reemplazo de `controls/VisibilityField.tsx` (docs/41
 * §5.2, §8 checklist #6/#7, Paso 7 de la tabla §7). Strip de ancho completo,
 * sin tarjeta, 36px de alto, con divisoria de 1px debajo. Tres estados
 * (docs/41 §5.2):
 *
 * - **Visible**: fondo transparente, ojo abierto, switch NEUTRO (nunca azul
 *   — el azul del panel está reservado a "modificado", D4).
 * - **Oculto en el bp activo**: `display:none` DECLARADO en la capa activa
 *   (`declaredInActiveLayer`) — fondo ámbar 10%, barra de acento 2px ámbar a
 *   la izquierda, ojo tachado, panel atenuado (D3, vía `pbx-inspector--dimmed`
 *   en el contenedor que lo monta).
 * - **Oculto heredado**: oculto (`isHiddenAt`) pero NO declarado en la capa
 *   activa — viene de una capa inferior. Switch "fantasma" (contorno
 *   punteado, de solo lectura) + botón de texto "Anular aquí" que declara el
 *   display visible EN la capa activa (mismo criterio que `computeShowAction`,
 *   pero fijando el resultado en la capa activa en vez de resetearla — "anular
 *   aquí" es más fuerte que "mostrar": el usuario quiere que ESTE breakpoint
 *   sea visible sin importar qué diga la cascada).
 *
 * Micro-indicador: un punto por breakpoint configurado (`cfg.order`, nunca 4
 * hardcodeados — docs/41 §2.1 punto 3), clic = `setActiveBreakpoint`, hover =
 * tooltip nativo (`title`) con el estado de ESE breakpoint.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { isHiddenAt, computeShowAction } from "@/builder/model/visibility";
import type { BuilderNode, Breakpoint, BreakpointConfig } from "@/builder/model/types";
import { Eye, EyeOff } from "@/components";

/** `true` si `layout.display: "none"` está declarado EN la capa del breakpoint activo (no heredado). */
function declaredNoneInActiveLayer(node: BuilderNode, bp: Breakpoint): boolean {
  const layer =
    bp === "base"
      ? node.style.base.layout
      : node.style.overrides?.[bp]?.layout;
  return layer?.display === "none";
}

export function VisibilityStrip({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const breakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);
  const setActiveBreakpoint = useDocumentStore((s) => s.setActiveBreakpoint);
  const toggleNodeVisibility = useDocumentStore((s) => s.toggleNodeVisibility);
  const setStyleProp = useDocumentStore((s) => s.setStyleProp);
  const resetStyleProp = useDocumentStore((s) => s.resetStyleProp);

  const def = getDefinition(node.type);
  const defaultDisplay = def?.defaultStyle?.base?.layout?.display;

  const hidden = useMemo(() => isHiddenAt(node.style, breakpoint, cfg), [node.style, breakpoint, cfg]);
  const declaredHere = declaredNoneInActiveLayer(node, breakpoint);

  const kind: "visible" | "hiddenHere" | "hiddenInherited" = !hidden
    ? "visible"
    : declaredHere
      ? "hiddenHere"
      : "hiddenInherited";

  const toggle = () => toggleNodeVisibility(node.id);

  // "Anular aquí" (docs/41 §5.2, fila 3): declara EXPLÍCITAMENTE un display
  // visible en la capa ACTIVA, sin importar qué diga la cascada heredada —
  // más fuerte que `toggleNodeVisibility` (que resetea la declaración de la
  // capa activa, pero si la capa activa no declara nada hoy, seguiría
  // heredando `none`). Reutiliza `computeShowAction` con la MISMA capa activa
  // como "bp a mostrar", pero el resultado se fija con `setStyleProp` en vez
  // de dejar que un `reset` potencialmente no baste.
  const overrideHere = () => {
    const action = computeShowAction(node.style, breakpoint, cfg, defaultDisplay);
    if ("reset" in action) resetStyleProp(node.id, breakpoint, ["layout", "display"]);
    else setStyleProp(node.id, breakpoint, ["layout", "display"], action.set);
  };

  const stripClassName = [
    "pbx-visibility-strip",
    kind === "hiddenHere" ? "pbx-visibility-strip--hidden" : "",
    kind === "hiddenInherited" ? "pbx-visibility-strip--hidden-inherited" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label =
    kind === "visible"
      ? t("panel.visibility.visible")
      : kind === "hiddenHere"
        ? t("panel.visibility.hiddenAt", { bp: breakpoint })
        : t("panel.visibility.hiddenInherited", { bp: findInheritedFrom(node, breakpoint, cfg) });

  return (
    <div className={stripClassName}>
      <span className="pbx-visibility-strip__icon" aria-hidden="true">
        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </span>
      <span className="pbx-visibility-strip__label">{label}</span>

      {kind === "hiddenInherited" ? (
        <button type="button" className="pbx-visibility-strip__override" onClick={overrideHere}>
          {t("panel.visibility.overrideHere")}
        </button>
      ) : null}

      <div className="pbx-visibility-strip__dots" role="group" aria-label={t("visibility.label")}>
        {cfg.order.map((bp) => {
          const bpHidden = isHiddenAt(node.style, bp, cfg);
          const dotClassName =
            "pbx-visibility-strip__dot" +
            (bpHidden ? " pbx-visibility-strip__dot--hidden" : "") +
            (bp === breakpoint ? " pbx-visibility-strip__dot--active" : "");
          const tooltip = bpHidden
            ? t("panel.visibility.dotTooltipHidden", { bp })
            : t("panel.visibility.dotTooltipVisible", { bp });
          return (
            <button
              key={bp}
              type="button"
              className={dotClassName}
              title={tooltip}
              aria-label={tooltip}
              onClick={() => setActiveBreakpoint(bp)}
            />
          );
        })}
      </div>

      {kind !== "hiddenInherited" ? (
        <label className={"pbx-visibility-strip__switch" + (hidden ? " pbx-visibility-strip__switch--hidden" : "")}>
          <input
            type="checkbox"
            className="pbx-switch__input"
            checked={!hidden}
            onChange={toggle}
            aria-label={t("visibility.toggleAria", { breakpoint })}
          />
          <span className="pbx-switch__track" aria-hidden="true">
            <span className="pbx-switch__thumb" />
          </span>
        </label>
      ) : (
        // Switch "fantasma" de solo lectura (docs/41 §5.2): contorno
        // punteado, no interactivo — el único camino desde aquí es
        // "Anular aquí", nunca togglear directo (togglear un heredado
        // ambiguo sobre qué capa tocar).
        <span
          className="pbx-visibility-strip__switch pbx-visibility-strip__switch--ghost"
          aria-hidden="true"
        >
          <span className="pbx-switch__track" aria-hidden="true">
            <span className="pbx-switch__thumb" />
          </span>
        </span>
      )}
    </div>
  );
}

/** Breakpoint desde el que se hereda el `none` activo (para el texto "heredado de {{bp}}"). */
function findInheritedFrom(node: BuilderNode, bp: Breakpoint, cfg: BreakpointConfig): Breakpoint {
  const idx = cfg.order.indexOf(bp);
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = cfg.order[i];
    if (candidate === undefined) continue;
    const layer = candidate === "base" ? node.style.base.layout : node.style.overrides?.[candidate]?.layout;
    if (layer?.display !== undefined) return candidate;
  }
  return cfg.order[0] ?? "base";
}

/** `true` si el nodo está oculto en el breakpoint activo (docs/41 §5.2, D3 — para atenuar el panel). */
export function useIsNodeHiddenAtActiveBreakpoint(node: BuilderNode): boolean {
  const breakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);
  return useMemo(() => isHiddenAt(node.style, breakpoint, cfg), [node.style, breakpoint, cfg]);
}
