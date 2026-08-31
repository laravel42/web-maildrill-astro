/**
 * NodeClickActionSection — control de "acción de click" del propio nodo
 * (docs/20 §3, docs/44 Fase 1), visible en el tab Interactividad de
 * CUALQUIER nodo que pueda ser disparador (`!def.disallowsClickAction`).
 * Simétrico a `ModalTriggersSection` (que gestiona la lista de disparadores
 * desde el modal): este panel resuelve el flujo inverso — seleccionar el
 * botón/imagen/etc. y decidir directamente qué acción dispara su click.
 *
 * Dirigido por el `actionRegistry` (P4, docs/44 §2): el selector de TIPO
 * lista `actionsForNode()` en vez de una lista de modales hardcodeada; según
 * el `targetKind` de la acción elegida se muestra el picker de objetivo
 * correspondiente (hoy solo `"modal"` está registrado, así que el único
 * picker que existe es el de modales); si la `ActionDefinition` declara
 * `optionsSchema`, sus campos se renderizan con el mismo motor de controles
 * que usa `BehaviorsSection` (`OptionsSchemaField`) — ningún motor nuevo.
 *
 * Escribe con `setNodeAction` (misma acción que usa `ModalTriggersSection`),
 * que ya normaliza la exclusión mutua con `link` (store/slices/behaviors.ts):
 * si el nodo tenía una URL/enlace de navegación con valor real, se limpia al
 * elegir una acción. Se muestra un aviso explícito cuando eso va a ocurrir
 * para que el cambio no sea una sorpresa silenciosa.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { actionsForNode, getActionDefinition } from "@/builder/registry/actionRegistry";
import { linkFieldKeys, linkTargetHasValue } from "@/builder/model/nodeAction";
import { OptionsSchemaField } from "./controls/OptionsSchemaField";
import { NodeTargetPicker, TOP_PRESET_VALUE } from "./controls/NodeTargetPicker";
import type { BuilderNode } from "@/builder/model/types";

const NONE = "__none__";

export function NodeClickActionSection({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const document = useDocumentStore((s) => s.document);
  const setNodeAction = useDocumentStore((s) => s.setNodeAction);

  // Tipo elegido en el selector pero todavía sin objetivo escrito en
  // `node.onClick` (ej. el usuario elige "Abrir modal" y aún no eligió CUÁL).
  // Solo se usa mientras `targetKind !== "none"` y no hay `node.onClick` para
  // este nodo; se descarta en cuanto se escribe la acción real o se cambia
  // de nodo (no persiste entre nodos distintos, docs/44 §8.1 D1: es un paso
  // intermedio de UI, no estado del documento).
  const [pendingType, setPendingType] = useState<string | null>(null);

  const availableActions = useMemo(() => actionsForNode(node, document), [node, document]);

  const modals = useMemo(
    () =>
      Object.values(document.nodes)
        .filter((n) => n.type === "modal")
        .map((n) => ({
          id: n.id,
          label:
            typeof n.props.title === "string" && n.props.title.trim() !== ""
              ? n.props.title
              : t("clickAction.untitledModal"),
        })),
    [document.nodes, t],
  );

  const currentType = node.onClick?.type ?? pendingType ?? NONE;
  const currentDef = getActionDefinition(currentType === NONE ? "" : currentType);

  // Advertencia: si el nodo tiene un `link` con valor real, elegir una acción
  // lo limpiará (exclusión mutua aplicada en `setNodeAction`, store).
  const hasActiveLink = useMemo(() => {
    const def = getDefinition(node.type);
    if (!def) return false;
    return linkFieldKeys(def.propsSchema.fields).some((key) => linkTargetHasValue(node.props[key]));
  }, [node]);

  const actionLabel = (type: string) =>
    t(`clickAction.actions.${type}`, { defaultValue: getActionDefinition(type)?.label ?? type });

  // Equivalencia funcional con el `<select>` anterior (docs/44 Fase 1): una
  // acción con `targetKind: "modal"` sin ningún modal en el sitio, o con
  // `targetKind: "node"` sin ningún otro nodo en el documento, no tiene
  // objetivo posible todavía — no vale la pena ofrecerla en el selector de
  // tipo. Genérico en el criterio (targetKind sin objetivos disponibles).
  const otherNodesCount = useMemo(
    () => Object.keys(document.nodes).filter((id) => id !== node.id && id !== document.rootId).length,
    [document, node.id],
  );
  const selectableActions = useMemo(
    () =>
      availableActions.filter((def) => {
        if (def.targetKind === "modal") return modals.length > 0;
        if (def.targetKind === "node") return otherNodesCount > 0;
        return true;
      }),
    [availableActions, modals, otherNodesCount],
  );

  const handleTypeChange = (type: string) => {
    if (type === NONE) {
      setPendingType(null);
      setNodeAction(node.id, null);
      return;
    }
    const def = getActionDefinition(type);
    if (!def) return;
    if (def.targetKind === "none") {
      setPendingType(null);
      setNodeAction(node.id, { type, params: def.defaultParams ? { ...def.defaultParams } : undefined });
      return;
    }
    // Acción con objetivo (modal/nodo/página): sin objetivo elegido todavía,
    // no se escribe nada hasta que el picker de abajo elija uno — evita
    // escribir una acción "target: undefined" incompleta. Se recuerda el tipo
    // elegido para que el selector de arriba no vuelva a mostrar "Ninguna".
    setPendingType(type);
  };

  const handleTargetChange = (target: string) => {
    if (!currentDef) return;
    setPendingType(null);
    // Preset "inicio de página" (docs/44 §4 fila P2, `scroll-to-top`): el
    // sentinel de UI del picker NO es un `NodeId` real — se traduce a
    // `params: { preset: "top" }` sin escribir `target`, así
    // `nodesReferencedAsTarget` (`exportToHtml.ts`) nunca lo confunde con
    // una referencia a un nodo que no existe.
    if (target === TOP_PRESET_VALUE) {
      setNodeAction(node.id, { type: currentDef.type, params: { preset: "top" } });
      return;
    }
    setNodeAction(node.id, {
      type: currentDef.type,
      target,
      params: node.onClick?.params,
    });
  };

  const handleParamChange = (key: string, value: unknown) => {
    if (!node.onClick) return;
    setNodeAction(node.id, {
      ...node.onClick,
      params: { ...node.onClick.params, [key]: value },
    });
  };

  if (availableActions.length === 0) {
    return (
      <section className="pbx-click-action">
        <h4 className="pbx-click-action__title">{t("clickAction.title")}</h4>
        <p className="pbx-click-action__empty">{t("clickAction.noActions")}</p>
      </section>
    );
  }

  if (selectableActions.length === 0) {
    // Todas las acciones aplicables a este nodo piden un objetivo que hoy no
    // existe en el sitio (ej. `open-modal` sin ningún modal creado todavía) —
    // mismo mensaje que el `<select>` de modales anterior.
    return (
      <section className="pbx-click-action">
        <h4 className="pbx-click-action__title">{t("clickAction.title")}</h4>
        <p className="pbx-click-action__empty">{t("clickAction.noModals")}</p>
      </section>
    );
  }

  return (
    <section className="pbx-click-action">
      <h4 className="pbx-click-action__title">{t("clickAction.title")}</h4>
      <p className="pbx-click-action__hint">{t("clickAction.hint")}</p>

      <select
        className="pbx-control__input pbx-control__input--select"
        value={currentType}
        aria-label={t("clickAction.title")}
        onChange={(e) => handleTypeChange(e.target.value)}
      >
        <option value={NONE}>{t("clickAction.none")}</option>
        {selectableActions.map((def) => (
          <option key={def.type} value={def.type}>
            {actionLabel(def.type)}
          </option>
        ))}
      </select>

      {currentDef?.targetKind === "modal" ? (
        <select
          className="pbx-control__input pbx-control__input--select"
          value={node.onClick?.target ?? NONE}
          aria-label={t("clickAction.targetModal")}
          onChange={(e) => {
            if (e.target.value !== NONE) handleTargetChange(e.target.value);
          }}
        >
          <option value={NONE}>{t("clickAction.chooseModal")}</option>
          {modals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      ) : null}

      {currentDef?.targetKind === "node" ? (
        <NodeTargetPicker
          document={document}
          excludeNodeId={node.id}
          value={node.onClick?.params?.preset === "top" ? TOP_PRESET_VALUE : node.onClick?.target}
          onChange={handleTargetChange}
          topPresetLabel={currentDef.type === "scroll-to" ? t("clickAction.scrollToTopPreset") : undefined}
        />
      ) : null}

      {currentDef?.optionsSchema && currentDef.optionsSchema.fields.length > 0 ? (
        <div className="pbx-click-action__options">
          {currentDef.optionsSchema.fields.map((field) => (
            <OptionsSchemaField
              key={field.key}
              field={field}
              value={node.onClick?.params?.[field.key]}
              label={t(`clickAction.fields.${currentDef.type}.${field.key}`, {
                defaultValue: field.label,
              })}
              onChange={(v) => handleParamChange(field.key, v)}
            />
          ))}
        </div>
      ) : null}

      {hasActiveLink && currentType === NONE ? (
        <p className="pbx-click-action__warning">{t("clickAction.linkWillBeCleared")}</p>
      ) : null}
    </section>
  );
}
