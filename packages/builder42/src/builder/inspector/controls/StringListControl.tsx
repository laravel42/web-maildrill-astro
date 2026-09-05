/**
 * StringListControl — editor de lista de líneas de texto simples (una entrada
 * por fila, sin `value` separado del `label`). Auditoría docs/54 §4.1 / H
 * "pricing-card roto en la práctica": `pricing-card.features` se declaraba
 * `control: "text"` → un `<input>` de una línea, con el render partiendo el
 * string por `"\n"` (`PricingCard.tsx`) — imposible teclear un salto de línea
 * en un input de una sola línea; solo funcionaba pegando texto multilínea.
 *
 * A diferencia de `OptionsListControl` (pares label/value, para `<select>`),
 * este control edita un array de STRINGS planos serializado en el prop como
 * un único string con `"\n"` como separador (mismo formato que ya consume
 * `PricingCard.tsx`, así que no cambia el modelo de datos ni rompe documentos
 * existentes — solo cambia cómo se EDITA).
 */

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, GripVertical, CloseIcon } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { NodeId } from "@/builder/model/types";

interface StringListControlProps {
  nodeId: NodeId;
  fieldKey: string;
  /** Valor crudo actual del prop: string con líneas separadas por `"\n"`. */
  value: string;
  itemPlaceholder?: string;
}

function toItems(value: string): string[] {
  if (value === "") return [];
  return value.split("\n");
}

function toValue(items: string[]): string {
  return items.join("\n");
}

export function StringListControl({ nodeId, fieldKey, value, itemPlaceholder }: StringListControlProps) {
  const { t } = useTranslation("inspector");
  const setProp = useDocumentStore((s) => s.setProp);

  const [items, setItems] = useState<string[]>(() => toItems(value));

  const lastInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusRef = useRef(false);

  const commit = useCallback(
    (next: string[]) => {
      setItems(next);
      setProp(nodeId, fieldKey, toValue(next));
    },
    [nodeId, fieldKey, setProp],
  );

  const handleChange = (index: number, text: string) => {
    commit(items.map((it, i) => (i === index ? text : it)));
  };

  const handleRemove = (index: number) => {
    commit(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    shouldFocusRef.current = true;
    commit([...items, ""]);
    requestAnimationFrame(() => {
      lastInputRef.current?.focus();
    });
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    const updated = [...items];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved!);
    commit(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  if (items.length === 0) {
    return (
      <div className="pbx-options-list pbx-options-list--empty">
        <p className="pbx-options-list__empty-msg">{t("optionsList.emptyState")}</p>
        <button type="button" className="pbx-options-list__add pbx-options-list__add--prominent" onClick={handleAdd}>
          + {t("optionsList.add")}
        </button>
      </div>
    );
  }

  return (
    <div className="pbx-options-list">
      <div className="pbx-options-list__header">
        <span className="pbx-options-list__title">{t("optionsList.title")}</span>
        <span className="pbx-options-list__count">
          {items.length} {items.length === 1 ? t("optionsList.countSingular") : t("optionsList.countPlural")}
        </span>
      </div>

      <div className="pbx-options-list__rows">
        {items.map((it, index) => (
          <div
            key={index}
            className="pbx-options-list__row"
            draggable
            onDragStart={(e) => handleDragStart(index, e)}
            onDrop={(e) => handleDrop(index, e)}
            onDragOver={handleDragOver}
          >
            <span className="pbx-options-list__handle" aria-hidden="true" title={t("optionsList.dragHandle")}>
              <GripVertical size={14} />
            </span>

            <div className="pbx-options-list__fields">
              <div className="pbx-options-list__field">
                <input
                  ref={index === items.length - 1 ? lastInputRef : undefined}
                  className="pbx-control__input"
                  type="text"
                  placeholder={itemPlaceholder ?? t("optionsList.labelPlaceholder", { n: index + 1 })}
                  value={it}
                  onChange={(e) => handleChange(index, e.target.value)}
                />
              </div>
            </div>

            <IconButton
              icon={CloseIcon}
              label={t("optionsList.remove")}
              intent="danger"
              disabled={items.length <= 1}
              onClick={() => handleRemove(index)}
            />
          </div>
        ))}
      </div>

      <button type="button" className="pbx-options-list__add" onClick={handleAdd}>
        + {t("optionsList.add")}
      </button>
    </div>
  );
}
