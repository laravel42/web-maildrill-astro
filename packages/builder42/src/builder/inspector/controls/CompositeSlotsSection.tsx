/**
 * CompositeSlotsSection — gestión de las slots de un composite (docs/23 Fase 5):
 * añadir, seleccionar, reordenar visualmente y eliminar las pestañas de un
 * `tabs` o las secciones de un `accordion`.
 *
 * Se muestra en la pestaña "Props" del Inspector cuando el nodo seleccionado es
 * un composite (`def.slots`) o una de sus slots (`def.isSlot`). En ambos casos
 * opera sobre el composite padre: lista sus slots (`node.children`), permite
 * seleccionar cada una, añadir (`addSlot`) hasta `slots.max` y eliminar hasta
 * `slots.min` (misma guarda de mínimos que `removeSelected`, docs/23 §4).
 *
 * Reordenar (T11): flechas ▲▼ (`reorderNode`) en touch/coarse y DnD nativo de
 * fila (`moveExistingNode`) en desktop, conmutados por la misma preferencia
 * `reorderControls` que el `SelectionHandle` (`useReorderControlsVisible`,
 * docs/24 §2.3) — un único criterio de reorden en todo el editor.
 *
 * P4/P8: no conoce "tabs"/"accordion" — lee `def.slots` del registry y usa el
 * `props.label` de cada slot como título. i18n (P9) con fallback al `addLabel`
 * del registry para composites futuros sin clave propia.
 */

import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { findParentId } from "@/builder/model/tree";
import { useReorderControlsVisible } from "@/hooks/usePointerCoarse";
import { IconButton, CloseIcon, Plus, ChevronUp, ChevronDown, GripVertical } from "@/components";
import type { BuilderNode, NodeId } from "@/builder/model/types";

export function CompositeSlotsSection({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const document = useDocumentStore((s) => s.document);
  const selectedId = useDocumentStore((s) => s.selectedId);
  const addSlot = useDocumentStore((s) => s.addSlot);
  const reorderNode = useDocumentStore((s) => s.reorderNode);
  const moveExistingNode = useDocumentStore((s) => s.moveExistingNode);
  const select = useDocumentStore((s) => s.select);
  const removeSelected = useDocumentStore((s) => s.removeSelected);

  // Reordenamiento: flechas ▲▼ en touch/coarse (misma bandera `reorderControls`
  // que el `SelectionHandle`, docs/24 §2.3), DnD nativo en desktop — mismo
  // criterio que el resto del editor, unificado bajo una sola preferencia.
  const useArrows = useReorderControlsVisible();

  const def = getDefinition(node.type);

  // Resolver el composite: el propio nodo (si es composite) o su padre (si es
  // una slot seleccionada).
  let compositeId: NodeId | undefined;
  let compositeType: string | undefined;
  if (def?.slots) {
    compositeId = node.id;
    compositeType = node.type;
  } else if (def?.isSlot) {
    const parentId = findParentId(document, node.id);
    const parent = parentId ? document.nodes[parentId] : undefined;
    if (parent && getDefinition(parent.type)?.slots) {
      compositeId = parent.id;
      compositeType = parent.type;
    }
  }
  if (!compositeId || !compositeType) return null;

  const composite = document.nodes[compositeId];
  const compDef = getDefinition(compositeType);
  if (!composite || !compDef?.slots) return null;

  const slotIds = composite.children ?? [];
  const min = compDef.slots.min ?? 1;
  const max = compDef.slots.max;
  const canAdd = max === undefined || slotIds.length < max;
  const canDelete = slotIds.length > min;

  const heading = t(`compositeSlots.${compositeType}.heading`, { defaultValue: compDef.label });
  const addLabel = t(`compositeSlots.${compositeType}.add`, {
    defaultValue: compDef.slots.addLabel ?? "+",
  });

  const deleteSlot = (slotId: NodeId) => {
    // `removeSelected` opera sobre `selectedId` y aplica la guarda de mínimos.
    select(slotId);
    removeSelected();
    // La slot ya no existe; vuelve al composite (sigue presente).
    select(compositeId!);
  };

  // DnD nativo (desktop) — mismo patrón que `OptionsListControl`: el índice
  // origen viaja en `dataTransfer`; al soltar se mueve la slot a la posición
  // destino con `moveExistingNode` (misma semántica splice que la lista de
  // opciones). Solo activo cuando NO se muestran las flechas (`!useArrows`).
  const handleDragStart = (index: number) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (targetIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    const sourceId = slotIds[sourceIndex];
    if (!sourceId) return;
    moveExistingNode(sourceId, { parentId: compositeId!, index: targetIndex });
  };

  return (
    <div className="pbx-slots">
      <div className="pbx-slots__head">
        <span className="pbx-slots__title">{heading}</span>
        <span className="pbx-slots__count" title={String(slotIds.length)}>
          {slotIds.length}
        </span>
      </div>

      <ul className="pbx-slots__list">
        {slotIds.map((id, i) => {
          const slot = document.nodes[id];
          const rawLabel = slot?.props.label;
          const label =
            typeof rawLabel === "string" && rawLabel.trim() !== ""
              ? rawLabel
              : t("compositeSlots.untitled");
          const active = id === selectedId;
          return (
            <li
              key={id}
              className={"pbx-slots__item" + (active ? " pbx-slots__item--active" : "")}
              draggable={!useArrows}
              onDragStart={!useArrows ? handleDragStart(i) : undefined}
              onDragOver={!useArrows ? handleDragOver : undefined}
              onDrop={!useArrows ? handleDrop(i) : undefined}
            >
              {!useArrows ? (
                <span
                  className="pbx-slots__handle"
                  title={t("compositeSlots.dragHandle")}
                  aria-hidden="true"
                >
                  <GripVertical size={14} />
                </span>
              ) : null}
              <button
                type="button"
                className="pbx-slots__select"
                aria-current={active}
                onClick={() => select(id)}
              >
                <span className="pbx-slots__index" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="pbx-slots__label" title={label}>
                  {label}
                </span>
              </button>
              {useArrows ? (
                <>
                  <IconButton
                    icon={ChevronUp}
                    size="sm"
                    disabled={i === 0}
                    onClick={() => reorderNode(id, -1)}
                    label={t("compositeSlots.moveUp")}
                  />
                  <IconButton
                    icon={ChevronDown}
                    size="sm"
                    disabled={i === slotIds.length - 1}
                    onClick={() => reorderNode(id, 1)}
                    label={t("compositeSlots.moveDown")}
                  />
                </>
              ) : null}
              <IconButton
                icon={CloseIcon}
                size="sm"
                intent="danger"
                disabled={!canDelete}
                onClick={() => deleteSlot(id)}
                label={t("compositeSlots.delete")}
              />
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="pbx-slots__add"
        disabled={!canAdd}
        onClick={() => addSlot(compositeId!)}
      >
        <Plus size={14} aria-hidden="true" /> {addLabel}
      </button>
    </div>
  );
}
