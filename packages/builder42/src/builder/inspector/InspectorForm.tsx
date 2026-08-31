/**
 * InspectorForm — formulario generado desde los schemas del registry (docs/03
 * §3). docs/41 §5.1 (Paso 6): la cabecera es de **2 filas** —
 * fila 1: `Breadcrumb` (movido aquí desde `app/layout/Inspector.tsx`) + `×`
 * que **cierra el panel** (D2, `inspectorCollapsed`); fila 2: tabs
 * (Props/Estilo/Interactividad) + botón de **papelera** que borra el nodo
 * (D2 — separado del `×` para que cerrar el panel no sea una trampa de un
 * clic irreversible). Se eliminan el chip de tipo grande
 * (`pbx-node-type-chip`) y la barra `ESTILO · EDITANDO [bp]`
 * (`pbx-style-tab__bar`) — el breakpoint activo ya se controla desde el
 * selector de viewport del `Header` y desde los puntos de `VisibilityStrip`
 * (el segmented de breakpoints que vivía aquí se retiró por ser un tercer
 * control redundante con esos dos, sin aportar una función propia).
 *
 * docs/41 §5.2/§7 (Paso 7): la tab Estilo monta `VisibilityStrip` (sustituye
 * a `controls/VisibilityField.tsx`) y, cuando el nodo está oculto en el
 * breakpoint activo, el contenedor gana `pbx-inspector--dimmed` (D3 —
 * atenuación SELECTIVA de encabezados/labels, nunca opacity global ni sobre
 * los valores/controles, ver CSS).
 *
 * docs/41 Paso 8: la tab Estilo monta directamente el editor unificado
 * `panel/StylePanel.tsx` — reemplaza TANTO a `form/StyleSection.tsx` como al
 * antiguo panel del modo simple (ambos borrados en este paso junto con el
 * flag `uiComplexity`, D1 opción (a): sin interruptor global).
 *
 * El estado de la tab es UI-state local (`useState`), no del documento (no
 * entra a undo/redo). Docs/39 §2.3: la tab "Interactividad" solo se renderiza
 * si el nodo tiene algo configurable ahí (behaviors posibles, click-action
 * permitido, o es un `modal`) — de lo contrario solo hay 2 tabs.
 *
 * El header y la tab bar son sticky vía `.pbx-inspector-sticky-bar` (docs/26 §1.1).
 *
 * No hay formularios hardcodeados por tipo (P4): se recorre el schema.
 * Subcomponentes en `./form/` (PropsSection, …) y `./panel/` (StylePanel).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useDocumentStore } from "@/builder/store/documentStore";
import { undo } from "@/builder/store/useTemporalStore";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { hasNodeSpecificBehaviors } from "@/builder/registry/behaviorRegistry";
import type { BuilderNode } from "@/builder/model/types";
import { IconButton, CloseIcon, Trash2, SimpleModal, ToastHost, useToast } from "@/components";
import { Breadcrumb } from "@/app/layout/Breadcrumb";
import { CompositeSlotsSection } from "./controls/CompositeSlotsSection";
import { BehaviorsSection } from "./BehaviorsSection";
import { ModalTriggersSection } from "./ModalTriggersSection";
import { NodeClickActionSection } from "./NodeClickActionSection";
import { PropsSection } from "./form/PropsSection";
import { countEditableFields, hasEditableFields } from "./controls/propControls/registry";
import { StylePanel } from "./panel/StylePanel";
import { VisibilityStrip, useIsNodeHiddenAtActiveBreakpoint } from "./panel/VisibilityStrip";
import type { InspectorTab } from "./form/types";

/**
 * Confirmación de borrado cuando el nodo tiene hijos (docs/46 Fase 1, H1).
 * Mismo patrón StrictMode-safe que `PageLayoutConfirmModal`
 * (`app/layout/TemplatesPanel.tsx`): el `Modal` de c42-react pierde el
 * estado que lo activó bajo `React.StrictMode` cuando se monta tras una
 * actualización de estado posterior al montaje inicial — exactamente este
 * caso (click en la papelera → aparece el modal). `SimpleModal`
 * reimplementa el mismo contrato de marcado/CSS sin ese defecto.
 */
function DeleteNodeConfirmModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation("inspector");

  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <SimpleModal className="pbx-modal" onClose={onClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div data-c42-modal-content className="pbx-modal__content pbx-template-confirm">
        <div className="pbx-modal__header">
          <div>
            <h3 className="pbx-modal__title">{t("panel.deleteConfirm.title")}</h3>
            <p className="pbx-modal__subtitle">{t("panel.deleteConfirm.body")}</p>
          </div>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("panel.deleteConfirm.cancel")}
            data-c42-modal-close
          />
        </div>
        <div className="pbx-modal__body pbx-template-confirm__actions">
          <button type="button" className="pbx-template-confirm__btn" onClick={onClose}>
            {t("panel.deleteConfirm.cancel")}
          </button>
          <button
            type="button"
            className="pbx-template-confirm__btn pbx-template-confirm__btn--primary"
            onClick={handleConfirm}
          >
            {t("panel.deleteConfirm.confirm")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}

export function InspectorForm({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const def = getDefinition(node.type);
  const removeSelected = useDocumentStore((s) => s.removeSelected);
  const [, setInspectorCollapsed] = useLocalConfig("inspectorCollapsed");
  const [tab, setTab] = useState<InspectorTab>("props");
  // docs/46 Fase 1 (H1): confirmación solo si el nodo a borrar tiene hijos
  // (subárbol) — borrar una hoja es inmediato, sin interrumpir al usuario
  // experto. En ambos casos se emite un toast con "Deshacer" (no bloqueante).
  const [pendingDelete, setPendingDelete] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  function handleDeleteClick() {
    const hasChildren = (node.children?.length ?? 0) > 0;
    if (hasChildren) {
      setPendingDelete(true);
      return;
    }
    performDelete();
  }

  function performDelete() {
    removeSelected();
    // Guarda de mínimos de slots (docs/23 §4, `slices/tree.ts`
    // `removeSelected`): si el nodo es una slot y su composite ya está en
    // `slots.min`, `removeSelected` es un no-op silencioso. Verificar que el
    // nodo realmente se borró antes de anunciar el toast — evita un
    // "eliminado" falso (docs/46 Fase 1).
    const stillExists = !!useDocumentStore.getState().document.nodes[node.id];
    if (stillExists) return;
    showToast({
      message: t("panel.deleteToast.message"),
      actionLabel: t("panel.deleteToast.undo"),
      onAction: undo,
    });
  }
  // D3 (docs/41 §3, §5.2, §8 criterio 8): panel atenuado cuando el nodo está
  // oculto en el breakpoint activo. Atenuación SELECTIVA (nunca opacity global
  // — rompería AA): la clase la consumen encabezados/iconos/labels vía CSS,
  // los VALORES de control quedan a contraste pleno (docs/41 D3).
  const isHidden = useIsNodeHiddenAtActiveBreakpoint(node);

  if (!def) return <p className="pbx-inspector__empty">{t("typeNotRegistered")}</p>;

  // La tab "Props" cuenta y muestra solo fields REALMENTE editables (ver
  // `propControls/registry.tsx`): un control puramente informativo (ej.
  // `richtext` de `text`, cuyo contenido se edita en el canvas vía Tiptap,
  // docs/12 §B.11) no cuenta para el badge ni justifica la tab por sí solo.
  // Un composite con slots (`hasSlotsUI` abajo) también justifica la tab
  // aunque sus `propsSchema.fields` sean 0 o no-editables.
  const propsCount = countEditableFields(def.propsSchema.fields);
  const hasSlotsUI = !!(def.slots || def.isSlot);
  const hasPropsTab = hasEditableFields(def.propsSchema.fields) || hasSlotsUI;
  const activeBehaviors = node.behaviors?.length ?? 0;

  // docs/39 §2.3: la tab "Interactividad" solo existe si el nodo tiene algo
  // configurable ahí — behaviors posibles (aunque ninguno esté activo aún),
  // click-action permitido, o es un nodo `modal` (panel de Disparadores).
  const isModal = node.type === "modal";
  const hasBehaviorsPossible = hasNodeSpecificBehaviors(node);
  const hasClickAction = !isModal && !def.disallowsClickAction;
  const hasInteractivityTab = hasBehaviorsPossible || hasClickAction || isModal;

  const tabs: { id: InspectorTab; label: string }[] = [
    ...(hasPropsTab ? [{ id: "props" as InspectorTab, label: t("tabs.props") }] : []),
    { id: "style", label: t("tabs.style") },
    ...(hasInteractivityTab ? [{ id: "behaviors" as InspectorTab, label: t("tabs.behaviors") }] : []),
  ];
  // Si el nodo activo cambió y la tab seleccionada ya no existe (fantasma sin
  // botón ni contenido), cae a la PRIMERA tab disponible — derivado, sin
  // useEffect (mismo espíritu que `key={node.id}` en StyleSection para
  // resetear por nodo). Ya no se puede asumir "props" como fallback fijo:
  // un nodo sin fields editables (ej. `text`) ni siquiera tiene esa tab.
  const activeTab: InspectorTab = tabs.some((it) => it.id === tab) ? tab : tabs[0]!.id;

  return (
    <div className={"pbx-inspector-form" + (isHidden ? " pbx-inspector--dimmed" : "")}>
      {/* Header + tab bar — sticky container (docs/26 §1.1) */}
      <div className="pbx-inspector-sticky-bar">
        {/* Fila 1 (docs/41 §5.1): breadcrumb + cerrar panel (D2). */}
        <div className="pbx-inspector-header">
          <Breadcrumb />
          <IconButton
            icon={CloseIcon}
            size="md"
            intent="ghost"
            onClick={() => setInspectorCollapsed(true)}
            label={t("panel.closePanel")}
          />
        </div>

        {/* Fila 2 (docs/41 §5.1): tabs + segmented de breakpoints + papelera (D2). */}
        <div className="pbx-inspector-tabs" role="tablist" aria-label={t("tabs.ariaLabel")}>
          {tabs.map((it) => (
            <button
              key={it.id}
              type="button"
              role="tab"
              id={`pbx-inspector-tab-${it.id}`}
              aria-selected={activeTab === it.id}
              aria-controls={`pbx-inspector-panel-${it.id}`}
              className={"pbx-inspector-tab" + (activeTab === it.id ? " pbx-inspector-tab--active" : "")}
              onClick={() => setTab(it.id)}
            >
              <span className="pbx-inspector-tab__label">{it.label}</span>
              {it.id === "props" && propsCount > 0 && (
                <span className="pbx-inspector-tab__count">{propsCount}</span>
              )}
              {it.id === "behaviors" && activeBehaviors > 0 && (
                <span
                  className="pbx-inspector-tab__badge"
                  aria-label={String(activeBehaviors)}
                  title={String(activeBehaviors)}
                />
              )}
            </button>
          ))}
          <div className="pbx-inspector-tabs__spacer" />
          <IconButton
            icon={Trash2}
            size="md"
            intent="danger"
            onClick={handleDeleteClick}
            label={t("panel.deleteNode")}
          />
        </div>
      </div>

      {/* Contenido de la tab activa */}
      <div
        className="pbx-inspector-tabpanel"
        role="tabpanel"
        id={`pbx-inspector-panel-${activeTab}`}
        aria-labelledby={`pbx-inspector-tab-${activeTab}`}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {activeTab === "props" && (
              <>
                {hasSlotsUI ? <CompositeSlotsSection node={node} /> : null}
                {propsCount > 0 ? <PropsSection node={node} def={def} /> : null}
              </>
            )}

            {activeTab === "style" && (
              <>
                <VisibilityStrip node={node} />
                <StylePanel key={node.id} node={node} />
              </>
            )}

            {activeTab === "behaviors" && (
              <>
                {node.type === "modal" ? <ModalTriggersSection node={node} /> : null}
                {node.type !== "modal" && !def.disallowsClickAction ? (
                  <NodeClickActionSection node={node} />
                ) : null}
                <BehaviorsSection node={node} />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {pendingDelete ? (
        <DeleteNodeConfirmModal onConfirm={performDelete} onClose={() => setPendingDelete(false)} />
      ) : null}
      <ToastHost toast={toast} onClose={hideToast} />
    </div>
  );
}
