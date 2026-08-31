/**
 * OptionsListControl — editor de pares label/value para el componente `select`.
 * docs/14 §1.4, descripción visual:
 *
 * - Handle de arrastre (⠿) para reordenar.
 * - Auto-slug del value mientras el usuario no lo haya editado manualmente.
 * - Validación visual: duplicados (borde rojo), campos vacíos.
 * - Estado vacío con mensaje y botón destacado.
 * - Foco automático en el label al agregar una nueva opción.
 */

import { useCallback, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, GripVertical, CloseIcon } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { NodeId } from "@/builder/model/types";
import { SearchableSelectControl } from "./SearchableSelectControl";

export interface SelectOption {
  label: string;
  value: string;
}

/** Estado interno por fila: controla si el value está vinculado al label (auto-slug). */
interface RowState {
  label: string;
  value: string;
  /** true si el usuario no ha editado manualmente el value. */
  autoValue: boolean;
}

/** Slugifica un string para generar el value automáticamente. */
function slugify(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface OptionsListControlProps {
  nodeId: NodeId;
  fieldKey: string;
  options: SelectOption[];
  /** Catálogo de sugerencias para el campo `label` de cada fila (docs §label picker). */
  labelOptions?: SelectOption[];
  renderLabelPreview?: (value: string) => ReactElement | null;
}

export function OptionsListControl({
  nodeId,
  fieldKey,
  options,
  labelOptions,
  renderLabelPreview,
}: OptionsListControlProps) {
  const { t } = useTranslation("inspector");
  const setProp = useDocumentStore((s) => s.setProp);

  // Estado local de filas (con tracking de auto-slug por fila)
  const [rows, setRows] = useState<RowState[]>(() =>
    options.map((opt) => ({
      label: opt.label ?? "",
      value: opt.value ?? "",
      autoValue: (opt.value ?? "") === slugify(opt.label ?? ""),
    })),
  );

  // Ref para auto-focus en la última fila agregada
  const lastLabelRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusRef = useRef(false);

  // Commit al store (escribe el array completo)
  const commit = useCallback(
    (newRows: RowState[]) => {
      setRows(newRows);
      setProp(
        nodeId,
        fieldKey,
        newRows.map((r) => ({ label: r.label, value: r.value })),
      );
    },
    [nodeId, fieldKey, setProp],
  );

  // Detecta values duplicados
  const duplicateValues = new Set<string>();
  const seenValues = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.value) {
      if (seenValues.has(r.value)) {
        duplicateValues.add(r.value);
      }
      seenValues.set(r.value, i);
    }
  });

  const handleLabelChange = (index: number, newLabel: string) => {
    const updated = rows.map((r, i) => {
      if (i !== index) return r;
      const newValue = r.autoValue ? slugify(newLabel) : r.value;
      return { ...r, label: newLabel, value: newValue };
    });
    commit(updated);
  };

  const handleValueChange = (index: number, newValue: string) => {
    const updated = rows.map((r, i) => {
      if (i !== index) return r;
      return { ...r, value: newValue, autoValue: false };
    });
    commit(updated);
  };

  const handleRemove = (index: number) => {
    commit(rows.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    shouldFocusRef.current = true;
    commit([...rows, { label: "", value: "", autoValue: true }]);
    // El foco se aplica después del render vía el ref callback
    requestAnimationFrame(() => {
      lastLabelRef.current?.focus();
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
    const updated = [...rows];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved!);
    commit(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // --- Estado vacío ---
  if (rows.length === 0) {
    return (
      <div className="pbx-options-list pbx-options-list--empty">
        <p className="pbx-options-list__empty-msg">{t("optionsList.emptyState")}</p>
        <button
          type="button"
          className="pbx-options-list__add pbx-options-list__add--prominent"
          onClick={handleAdd}
        >
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
          {rows.length} {rows.length === 1 ? t("optionsList.countSingular") : t("optionsList.countPlural")}
        </span>
      </div>

      <div className="pbx-options-list__rows">
        {rows.map((row, index) => {
          const isDuplicate = duplicateValues.has(row.value) && row.value !== "";
          const isLabelEmpty = row.label.trim() === "" && rows.length > 1;
          const isValueEmpty = row.value.trim() === "" && row.label.trim() !== "";

          return (
            <div
              key={index}
              className={"pbx-options-list__row" + (isDuplicate ? " pbx-options-list__row--error" : "")}
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
                  {labelOptions ? (
                    <SearchableSelectControl
                      value={row.label}
                      options={labelOptions}
                      placeholder={t("optionsList.labelPlaceholder", { n: index + 1 })}
                      onCommit={(v) => handleLabelChange(index, v)}
                      renderPreview={renderLabelPreview}
                    />
                  ) : (
                    <input
                      ref={index === rows.length - 1 ? lastLabelRef : undefined}
                      className={"pbx-control__input pbx-options-list__label-input" + (isLabelEmpty ? " pbx-control__input--error" : "")}
                      type="text"
                      placeholder={t("optionsList.labelPlaceholder", { n: index + 1 })}
                      value={row.label}
                      onChange={(e) => handleLabelChange(index, e.target.value)}
                    />
                  )}
                  {isLabelEmpty && (
                    <span className="pbx-options-list__error-text">{t("optionsList.requiredField")}</span>
                  )}
                </div>
                <div className="pbx-options-list__field">
                  <input
                    className={"pbx-control__input pbx-options-list__value-input" + ((isDuplicate || isValueEmpty) ? " pbx-control__input--error" : "")}
                    type="text"
                    placeholder={t("optionsList.valuePlaceholder", { n: index + 1 })}
                    value={row.value}
                    onChange={(e) => handleValueChange(index, e.target.value)}
                  />
                  {isDuplicate && (
                    <span className="pbx-options-list__error-text">{t("optionsList.duplicateValue")}</span>
                  )}
                  {isValueEmpty && !isDuplicate && (
                    <span className="pbx-options-list__error-text">{t("optionsList.requiredField")}</span>
                  )}
                </div>
              </div>

              <IconButton
                icon={CloseIcon}
                label={t("optionsList.remove")}
                intent="danger"
                disabled={rows.length <= 1}
                onClick={() => handleRemove(index)}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="pbx-options-list__add"
        onClick={handleAdd}
      >
        + {t("optionsList.add")}
      </button>
    </div>
  );
}
