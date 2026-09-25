/**
 * VisibilityStrip — reemplazo de `controls/VisibilityField.tsx` (docs/41
 * §5.2, §8 checklist #6/#7, Paso 7 de la tabla §7). Strip de ancho completo,
 * sin tarjeta, con divisoria de 1px debajo. **2 filas** (petición del
 * usuario, este commit — antes 1 fila de 36px con todo apretado: label +
 * "Anular aquí"/ojo + chips de breakpoint compitiendo por el mismo ancho):
 * fila 1 = label + acciones (ojo / "Anular aquí"), fila 2 = los chips de
 * breakpoint a ancho completo, con más espacio para el icono+abreviatura de
 * cada uno. Tres estados (docs/41 §5.2):
 *
 * - **Visible**: fondo transparente, sin icono a la izquierda, ojo abierto
 *   como botón de alternancia (nunca azul — el azul del panel está
 *   reservado a "modificado", D4).
 * - **Oculto en el bp activo**: `display:none` DECLARADO en la capa activa
 *   (`declaredInActiveLayer`) — fondo ámbar 10%, barra de acento 2px ámbar a
 *   la izquierda, ojo tachado, panel atenuado (D3, vía `pbx-inspector--dimmed`
 *   en el contenedor que lo monta).
 * - **Oculto heredado**: oculto (`isHiddenAt`) pero NO declarado en la capa
 *   activa — viene de una capa inferior. Ojo "fantasma" (atenuado, de solo
 *   lectura) + botón de texto "Anular aquí" que declara el display visible
 *   EN la capa activa (mismo criterio que `computeShowAction`, pero fijando
 *   el resultado en la capa activa en vez de resetearla — "anular aquí" es
 *   más fuerte que "mostrar": el usuario quiere que ESTE breakpoint sea
 *   visible sin importar qué diga la cascada).
 *
 * Micro-indicador: un chip icono+abreviatura por breakpoint configurado
 * (`cfg.order`, nunca 4 hardcodeados — docs/41 §2.1 punto 3), clic =
 * `setActiveBreakpoint`, hover = tooltip nativo (`title`) con el estado de
 * ESE breakpoint. Antes eran puntos (`dots`) sin ninguna pista de a qué
 * breakpoint correspondía cada uno — reemplazados por el MISMO icono de
 * dispositivo que usa `ViewportDropdown` (`viewportIcon`, ahora compartido
 * vía `builder/model/breakpointIcons.ts`) más el id corto del breakpoint
 * (sm/md/lg/xl) al lado, para que la fila sea legible sin depender del
 * tooltip (feedback real de usuario: los dots no se entendían).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { isHiddenAt, computeShowAction } from "@/builder/model/visibility";
import { viewportIcon } from "@/builder/model/breakpointIcons";
import type { BuilderNode, Breakpoint } from "@/builder/model/types";
import { Eye, EyeOff } from "@/components";
import { FieldHelp } from "../controls/FieldHelp";
import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";

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

  return (
    <div className={stripClassName}>
      <div className="pbx-visibility-strip__top">
        <span className="pbx-visibility-strip__label">
          <span className="pbx-visibility-strip__label-text">{t("panel.visibility.fieldLabel")}</span>
          <FieldHelp message={t("panel.visibility.help")} />
        </span>

        {kind === "hiddenInherited" ? (
          <button type="button" className="pbx-visibility-strip__override" onClick={overrideHere}>
            {t("panel.visibility.overrideHere")}
          </button>
        ) : null}

        {kind !== "hiddenInherited" ? (
          <button
            type="button"
            className={"pbx-visibility-strip__eye" + (hidden ? " pbx-visibility-strip__eye--hidden" : "")}
            onClick={toggle}
            aria-pressed={hidden}
            aria-label={hidden ? t("panel.visibility.toggleShow", { bp: breakpoint }) : t("panel.visibility.toggleHide", { bp: breakpoint })}
            title={hidden ? t("panel.visibility.toggleShow", { bp: breakpoint }) : t("panel.visibility.toggleHide", { bp: breakpoint })}
          >
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : (
          // Ojo "fantasma" de solo lectura (docs/41 §5.2): atenuado, no
          // interactivo — el único camino desde aquí es "Anular aquí", nunca
          // togglear directo (togglear un heredado ambiguo sobre qué capa
          // tocar).
          <span className="pbx-visibility-strip__eye pbx-visibility-strip__eye--ghost" aria-hidden="true">
            <EyeOff size={16} />
          </span>
        )}
      </div>

      <div
        className="pbx-visibility-strip__breakpoints"
        role="group"
        aria-label={t("visibility.label")}
        {...dataTourAttr(BUILDER42_TOUR_ANCHORS.inspectorBreakpoints)}
      >
        {cfg.order.map((bp) => {
          const bpHidden = isHiddenAt(node.style, bp, cfg);
          const BpIcon = viewportIcon(bp);
          const itemClassName =
            "pbx-visibility-strip__bp" +
            (bpHidden ? " pbx-visibility-strip__bp--hidden" : "") +
            (bp === breakpoint ? " pbx-visibility-strip__bp--active" : "");
          const tooltip = bpHidden
            ? t("panel.visibility.dotTooltipHidden", { bp })
            : t("panel.visibility.dotTooltipVisible", { bp });
          return (
            <button
              key={bp}
              type="button"
              className={itemClassName}
              title={tooltip}
              aria-label={tooltip}
              onClick={() => setActiveBreakpoint(bp)}
            >
              <BpIcon size={13} aria-hidden="true" />
              <span className="pbx-visibility-strip__bp-label">{bp}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** `true` si el nodo está oculto en el breakpoint activo (docs/41 §5.2, D3 — para atenuar el panel). */
export function useIsNodeHiddenAtActiveBreakpoint(node: BuilderNode): boolean {
  const breakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);
  return useMemo(() => isHiddenAt(node.style, breakpoint, cfg), [node.style, breakpoint, cfg]);
}
